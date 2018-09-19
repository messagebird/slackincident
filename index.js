'use strict';

const config = require('./config.json');
const {google} = require('googleapis');
const request = require('request');
const moment = require('moment');

function formatSlackMessage (incidentId, incidentName, slackUserName, incidentSlackChannel, googleDocUrl) {
  // Prepare a rich Slack message
  // See https://api.slack.com/docs/message-formatting
  var slackMessage = {
    username: 'Incident Bot',
    icon_emoji: ':warning:',
    channel: '',
    text: incidentName,
    attachments: [],
    link_names: true,
    parse: 'full'
  };

  slackMessage.attachments.push({
      color: '#000000',
      title: "Reported by",
      text: `@${slackUserName}`
  });

  // Slack channel
  slackMessage.attachments.push({
      color: '#8f0000',
      title: 'Incident Slack channel',
      text: '#' + incidentSlackChannel
  });

  // Hangout link
  slackMessage.attachments.push({
      color: '#228B22',
      title: 'Incident Google Meet',
      text: 'https://hangouts.google.com/hangouts/_/meet/' + config.GOOGLE_DOMAIN + '/incident-' + incidentId
  });

  // Google Doc
  slackMessage.attachments.push({
      color: '#3367d6',
      title: 'Incident Document',
      text: googleDocUrl
  });

  return slackMessage;
}

function verifyPostRequest(method) {
  if (method !== 'POST') {
    const error = new Error('Only POST requests are accepted');
    error.code = 405;
    throw error;
  }
}

function verifySlackWebhook (body) {
  if (!body || body.token !== config.SLACK_TOKEN) {
    const error = new Error('Invalid credentials');
    error.code = 401;
    throw error;
  }
}

function createIncidentFlow (body) {
  var incidentId = moment().format('YYMMDDhhmm');
  var incidentName = body.text;
  var incidentManagerSlackHandle = body.user_name;

  var incidentSlackChannel = createSlackChannel(incidentId);
  var googleDocUrl = createGoogleDoc(incidentId, incidentName);

  // Return a formatted message
  var slackMessage = formatSlackMessage(incidentId, incidentName, incidentManagerSlackHandle, incidentSlackChannel, googleDocUrl);

  sendSlackMessageToChannel(config.SLACK_INCIDENTS_CHANNEL, slackMessage);
  setTimeout(function () {
      sendSlackMessageToChannel(incidentSlackChannel, slackMessage)
    },
    500
  );
}

function createSlackChannel (incidentId) {
  var incidentSlackChannel = config.SLACK_INCIDENT_CHANNEL_PREFIX + incidentId;

  // return config.SLACK_INCIDENT_CHANNEL_PREFIX + '000000';

  request.post({
    url:'https://slack.com/api/channels.create',
    form: {
      token: config.SLACK_TOKEN,
      name: '#' + incidentSlackChannel
    }
  },
  function(error, response, body) {
    if (error) {
      console.error('Creating Slack channel failed:', error);

      throw new Error('Creating Slack channel failed');
    }
  });

  return incidentSlackChannel;
}

function sendSlackMessageToChannel(slackChannel, slackMessage) {
  const newMessage = {
    ...slackMessage,
    channel: '#' + slackChannel
  };

  console.log(newMessage);

  request.post({
    url:'https://slack.com/api/chat.postMessage',
    auth: {
      'bearer': config.SLACK_TOKEN
    },
    json: newMessage
  },
  function(error, response, body) {
    if (error) {
      console.error('Sending message to Slack channel failed:', error);

      throw new Error('Sending message to Slack channel failed');
    }
  });
}

function createGoogleDoc(incidentId, incidentName) {
  // Disabled for now, because it's not so easy to grant Drive access via API on single/some files/folders
  /*
  var googleDrive = google.drive({
    version: 'v3',
    auth: config.GOOGLE_API_KEY
  });

  var params = {
    fileId: config.GOOGLE_DOCS_FILE_ID,
    supportsTeamDrives: true,
    resource: {
      title: 'Incident: ' + incidentName + ' (' + incidentId + ')' 
    }
  };

  var result = googleDrive.files.copy(params)
    .then(res => {
      console.log(`New document ID is ${res.fileId}`);

      return 'https://docs.google.com/document/d/' + res.fileId;
    })
    .catch(error => {
      console.error('Copying Google Document failed', error);

      return 'Copying Google Document failed';
    });

  console.log('Google result: ', result);
  */

  return 'Use following template and share in incident slack channel: https://docs.google.com/document/d/' + config.GOOGLE_DOCS_FILE_ID + '/template/preview'
}

exports.incident = (req, res) => {
  try {
    verifyPostRequest(req.method);

    verifySlackWebhook(req.body);

    createIncidentFlow(req.body);

    res.status(200).json({message: "Request accepted"});
  } catch (error) {
      res.status((error.code ? error.code : 500)).json({response_type: "in_channel", text: error.message});
  }
};
