'use strict';

const http = require('http');
const qs = require('querystring');
// const {google} = require('googleapis'); // Add "googleapis": "^33.0.0", to package.json 'dependencies' when you enable this again.
const request = require('request');
const moment = require('moment');
var eventM = require("./eventDetails.js");

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

  // Google Doc
  slackMessage.attachments.push({
      color: '#3367d6',
      title: 'Document',
      title_link: googleDocUrl,
      text: 'Use linked template and share in incident slack channel'
  });

  return slackMessage;
}

function sendEpicToChannel(incidentSlackChannel, epicUrl){
  var slackMessage = {
    username: 'After the incident',
    icon_emoji: ':pencil:',
    channel: '',
    attachments: [],
    link_names: true,
    parse: 'full',
  };
  // Epic link
  slackMessage.attachments.push({
    color: '#FD6A02',
    title: 'Discuss and track follow-up actions',
    title_link: epicUrl,
    text: epicUrl,
    footer: 'Remember: Don\'t Neglect the Post-Mortem!'
  });
  sendSlackMessageToChannel(incidentSlackChannel, slackMessage);
}

function sendConferenceCallDetailsToChannel(incidentSlackChannel, eventDetails){
  var entryPoints = eventDetails.obj.data.conferenceData.entryPoints;
  var title_link;
  var text;
  var more_phones_link;
  var tel;
  var tel_link;
  var pin;
  var regionCode;
  for(var i=0; i < entryPoints.length;i++){
    var entryPoint = entryPoints[i];
    var type = entryPoint.entryPointType;
    if(type == 'video'){
      title_link = entryPoint.uri;
      text = entryPoint.label;
    }
    if(type == 'phone'){
      tel_link = entryPoint.uri;
      tel = entryPoint.label;
      pin = entryPoint.pin;
      regionCode = entryPoint.regionCode;
    }
    if(type == 'more'){
      more_phones_link = entryPoint.uri;
    }
  }

  var confDetailsMessage = {
    "color": "#1F8456",
    "title": "Join Conference Call",
    "title_link": title_link,
    "text": text,
    "fields": [
        {
            "title": "Join by phone",
            "value": tel + " | PIN: " + pin + "#",
            "short": false
        }
    ],
    "footer": "Not in "+regionCode+"? More phone numbers at "+more_phones_link
  }

  var slackMessage = {
    username: 'Conference Call Details',
    icon_emoji: ':telephone_receiver:',
    channel: '',
    attachments: [],
    link_names: true,
    parse: 'full',
  };
  slackMessage.attachments.push(confDetailsMessage);
  sendSlackMessageToChannel(incidentSlackChannel, slackMessage);
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
  var incidentCreatorSlackHandle = body.user_name;

  var incidentSlackChannel = createSlackChannel(incidentId);
  var googleDocUrl = createGoogleDoc(incidentId, incidentName);

  //Sending a object as an argument to have it populated with the response
  var epic = new Object();
  createFollowupsEpic(incidentName, epic);

  var eventDetails = new Object();
  eventM.registerIncidentEvent(incidentId, incidentName, incidentCreatorSlackHandle, incidentSlackChannel, eventDetails);


  alertIncidentManager(incidentName, incidentSlackChannel, incidentCreatorSlackHandle);

  // Return a formatted message
  var slackMessage = formatSlackMessage(incidentId, incidentName, incidentCreatorSlackHandle, incidentSlackChannel, googleDocUrl);

  // Bit of delay before posting message to channels, to make sure channel and epic are created
  setTimeout(function () {
      sendSlackMessageToChannel(process.env.SLACK_INCIDENTS_CHANNEL, slackMessage);
      sendSlackMessageToChannel(incidentSlackChannel, slackMessage)
    },
    500
  );

    // Bit of delay before posting message to channels, to make sure channel and eventn and epic are created
  setTimeout(function () {
      if(eventDetails['obj']){
        sendConferenceCallDetailsToChannel(incidentSlackChannel, eventDetails);
      }
    },
    3000
  );

  setTimeout(function () {
      //This will only be populated if Jira is enabled and the response was already returned.
      if(epic['url']){
        sendEpicToChannel(incidentSlackChannel, epic['url']);
      }
    },
    4000
  );
}

function createSlackChannel (incidentId) {
  var prefix = process.env.SLACK_INCIDENT_CHANNEL_PREFIX;
  if(!prefix){
    prefix = 'incident-';
  }
  var incidentSlackChannel = prefix + incidentId;


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

function alertIncidentManager(incidentName, incidentSlackChannel, incidentCreatorSlackHandle) {
  if (!process.env.PAGERDUTY_API_TOKEN || process.env.DRY_RUN) {
    return
  }

  request.post({
    url: "https://events.pagerduty.com/v2/enqueue",
    json: {
      "routing_key": process.env.PAGERDUTY_API_TOKEN,
      "event_action": "trigger",
      "payload": {
        "summary": "New incident '" + incidentName + "' created by @" + incidentCreatorSlackHandle,
        "source": incidentSlackChannel,
        "severity": "critical"
      },
    }
  })
}

function sendSlackMessageToChannel(slackChannel, slackMessage) {
  if(process.env.DRY_RUN){
    console.log("Sending message below to channel "+slackChannel);
    console.log(slackMessage);
    return;
  }
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

function createFollowupsEpic(incidentName, epicResponse) {
  var jiraDomain = process.env.JIRA_DOMAIN;
  //Return if JIRA details are not specified. Assuming checking the domain is enough
  if (!jiraDomain) {
    return
  }

  var jiraUser = process.env.JIRA_USER;
  var jiraApiKey = process.env.JIRA_API_KEY;
  var jiraProjectId = process.env.JIRA_PROJECT_ID;
  var jiraEpicIssueTypeId = process.env.JIRA_ISSUE_TYPE_ID;

  const newMessage =   {
    "fields": {
      "issuetype": {
        "id": jiraEpicIssueTypeId
      },
      "project": {
        "id": jiraProjectId
      },
      "summary": incidentName
    }
  };

  var epicKey;
  request.post({
    url:'https://'+jiraDomain+'/rest/api/3/issue',
    auth: {
      'user': jiraUser,
      'pass':jiraApiKey
    },
    json: newMessage
  },
  function(error, response, body) {
    if (error) {
      console.error('Sending message to Jira failed:', error);

      throw new Error('Sending message to Jira failed');
    }
    epicKey = response.body['key'];
    epicResponse['url'] = epicKey?'https://'+jiraDomain+'/browse/'+epicKey:'';
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
console.log('Server listening on port '+(process.env.PORT ? process.env.PORT : 8080));
