'use strict';

const http = require('http');
const qs = require('querystring');
// const {google} = require('googleapis'); // Add "googleapis": "^33.0.0", to package.json 'dependencies' when you enable this again.
const request = require('request');
const moment = require('moment');

function formatSlackMessage (incidentId, incidentName, slackUserName, incidentSlackChannel, googleDocUrl) {
  // Prepare a rich Slack message
  // See https://api.slack.com/docs/message-formatting
  var slackMessage = {
    username: 'Incident Management',
    icon_emoji: ':warning:',
    channel: '',
    attachments: [],
    link_names: true,
    parse: 'full',
  };

  slackMessage.attachments.push({
      color: '#000000',
      title: "Incident",
      text: incidentName,
      footer: `reported by @${slackUserName}`
  });

  // Slack channel
  slackMessage.attachments.push({
      color: '#8f0000',
      title: 'Slack channel',
      text: '#' + incidentSlackChannel
  });

  // Hangout link
  slackMessage.attachments.push({
      color: '#228B22',
      title: 'Google Meet Meeting',
      title_link: 'https://hangouts.google.com/hangouts/_/meet/' + process.env.GOOGLE_DOMAIN + '/incident-' + incidentId
  });

  // Google Doc
  slackMessage.attachments.push({
      color: '#3367d6',
      title: 'Document',
      title_link: googleDocUrl,
      text: 'Use linked template and share in incident slack channel'
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
  if (!body || body.token !== process.env.SLACK_COMMAND_TOKEN) {
    const error = new Error('Invalid credentials');
    error.code = 401;
    throw error;
  }
}

function createIncidentFlow (body) {
  var incidentId = moment().format('YYMMDDHHmm');
  var incidentName = body.text;
  var incidentManagerSlackHandle = body.user_name;

  var incidentSlackChannel = createSlackChannel(incidentId);
  var googleDocUrl = createGoogleDoc(incidentId, incidentName);

  // Return a formatted message
  var slackMessage = formatSlackMessage(incidentId, incidentName, incidentManagerSlackHandle, incidentSlackChannel, googleDocUrl);

  // Bit of delay before posting message to channels, to make sure channel is created
  setTimeout(function () {
      sendSlackMessageToChannel(process.env.SLACK_INCIDENTS_CHANNEL, slackMessage);
      sendSlackMessageToChannel(incidentSlackChannel, slackMessage)
    },
    500
  );
}

function createSlackChannel (incidentId) {
  var incidentSlackChannel = process.env.SLACK_INCIDENT_CHANNEL_PREFIX + incidentId;

  // return process.env.SLACK_INCIDENT_CHANNEL_PREFIX + '000000';

  request.post({
    url:'https://slack.com/api/channels.create',
    form: {
      token: process.env.SLACK_API_TOKEN,
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

  request.post({
    url:'https://slack.com/api/chat.postMessage',
    auth: {
      'bearer': process.env.SLACK_API_TOKEN
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
    auth: process.env.GOOGLE_API_KEY
  });

  var params = {
    fileId: process.env.GOOGLE_DOCS_FILE_ID,
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

  return 'https://docs.google.com/document/d/' + process.env.GOOGLE_DOCS_FILE_ID + '/template/preview'
}

http.createServer(function(req, res) {
  try {
    verifyPostRequest(req.method);

    var body = '';
    var post = {};
    req.on('data', function (chunk) {
      body += chunk;
    });

    req.on('end', function () {
      console.log('body: ' + body);
      post = qs.parse(body);

      verifySlackWebhook(post);

      createIncidentFlow(post);

      console.log('Successful execution of incident flow');

      res.writeHead(200, {'Content-Type': 'application/json'});
      res.write(JSON.stringify({text: "Incident management process started"}));
      res.end();
    });
  } catch (error) {
      console.log(error);

      res.writeHead((error.code ? error.code : 500), {'Content-Type': 'application/json'});
      res.write(JSON.stringify({response_type: "in_channel", text: error.message}));
      res.end();
  }
}).listen(process.env.PORT ? process.env.PORT : 8080);
