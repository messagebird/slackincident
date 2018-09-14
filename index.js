'use strict';

const config = require('./config.json');
const googleapis = require('googleapis');
const request = require('request');

function formatSlackMessage (incidentId, incidentName, slackUserName, incidentSlackChannel, googleDocUrl) {
  // Prepare a rich Slack message
  // See https://api.slack.com/docs/message-formatting
  const slackMessage = {
    response_type: 'in_channel',
    text: `Incident reported: ${incidentName} (${incidentId})`,
    attachments: []
  };

  // Google Doc
  slackMessage.attachments.push({
      color: '#3367d6',
      title: 'Incident Document',
      text: googleDocUrl
      author_name: `@${slackUserName}`
  });

  // Hangout link
  slackMessage.attachments.push({
      color: '#228B22',
      title: 'Incident Google Meet',
      text: 'https://hangouts.google.com/hangouts/_/meet/' + config.GOOGLE_DOMAIN + '/incident-' + incidentId;
  });

  // Slack channel
  slackMessage.attachments.push({
      color: '#8f0000',
      title: 'Incident Slack channel'
      text: incidentSlackChannel
  });

  return slackMessage;
}

function verifyWebhook (body) {
  if (!body || body.token !== config.SLACK_TOKEN) {
    const error = new Error('Invalid credentials');
    error.code = 401;
    throw error;
  }
}

function createIncidentFlow (body) {
  var incidentId = moment().format('YYMMDDhhmm');
  var incidentName = body.text;

  var incidentSlackChannel = createSlackChannel(incidentId);

  // Create Google Doc
  var googleDocUrl = createGoogleDoc(incidentId, incidentName);

  // Return a formatted message
  resolve(formatSlackMessage(incidentId, incidentName, body.user_name, incidentSlackChannel, googleDocUrl));
}

function createSlackChannel (channelName) {
  var incidentSlackChannel = config.SLACK_INCIDENT_CHANNEL_PREFIX + incidentId;

  request.post({
    url:'https://slack.com/api/channels.create',
    form: {
      token: config.SLACK_TOKEN,
      name: incidentSlackChannel
    }
  },
  function(error, response, body) {
    if (error) {
      return console.error('Creating slack channel failed:', error);
    }
  });

  return incidentSlackChannel;
}

function createGoogleDoc(incidentId, incidentName) {
  var googleDrive = googleapis.drive({
    version: 'v3',
    auth: config.GOOGLE_API_KEY
  });

  var request = googleDrive.files.copy({
    'fileId': config.GOOGLE_DOCS_FILE_ID,
    'resource': {
      title: 'Incident: ' + incidentName
    }
  });

  request.execute(function(resp) {
      return 'https://docs.google.com/document/d/' + resp.fileId;
  });
}

exports.incident = (req, res) => {
  return Promise.resolve()
    .then(() => {
      if (req.method !== 'POST') {
        const error = new Error('Only POST requests are accepted');
        error.code = 405;
        throw error;
      }

      // Verify that this request came from Slack
      verifyWebhook(req.body);

      return createIncidentFlow(req.body);
    })
    .then((response) => {
      // Send the formatted message back to Slack
      res.json(response);
    })
    .catch((err) => {
      console.error(err);
      res.status(err.code || 500).send(err);
      return Promise.reject(err);
    });
};
