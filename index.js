'use strict';

const http = require('http');
const qs = require('querystring');
// const {google} = require('googleapis'); // Add "googleapis": "^33.0.0", to package.json 'dependencies' when you enable this again.
const request = require('request');
const moment = require('moment');
var gapi_helper = require("./googleapi_helper.js");

function createInitialMessage(incidentName, slackUserName, incidentSlackChannel, incidentSlackChannelId) {
  // Prepare a rich Slack message
  // See https://api.slack.com/docs/message-formatting
  var slackMessage = {
    username: 'Incident Management',
    icon_emoji: ':warning:',
    attachments: [],
    link_names: true,
    parse: 'full',
  };

  slackMessage.attachments.push({
      color: '#8f0000',
      title: incidentName,
      text: "Incident Channel: #"+incidentSlackChannel,
      "fallback": "Join Incident Channel #"+incidentSlackChannel,
      "actions": [
        {
          "type": "button",
          "text": "Join Incident Channel",
          "url": "https://slack.com/app_redirect?channel="+incidentSlackChannelId,
          "style":"danger"
        }
      ],
      footer: `reported by @${slackUserName}`
  });
  return slackMessage;
}

function sendIncidentLogFileToChannel(incidentSlackChannel, docUrl){
  var slackMessage = {
    username: 'During the incident',
    icon_emoji: ':pencil:',
    channel: '',
    attachments: [],
    link_names: true,
    parse: 'full',
  };

  // Google Doc
  slackMessage.attachments.push({
      color: '#3367d6',
      title: 'Notes & Actions',
      title_link: docUrl,
      text: docUrl,
      footer: 'Use this document to to maintain a timeline of key events during an incident. Document actions, and keep track of any followup items that will need to be addressed.'
  });
  sendSlackMessageToChannel(incidentSlackChannel, slackMessage);
}

function sendEpicToChannel(incidentSlackChannel, epicUrl){
  var slackMessage = {
    username: 'After the incident',
    icon_emoji: ':dart:',
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
    "text": title_link,
    "fields": [
        {
            "title": "Join by phone",
            "value": "<" + tel_link + ",," + pin + "%23" + "|" + tel + " PIN: " + pin + "#>",
            "short": false
        }
    ],
    "actions": [
      {
        "type": "button",
        "text": "Join Conference Call",
        "url": title_link,
        "style":"primary"
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
    parse: 'none',
    mrkdwn: true,
  };
  slackMessage.attachments.push(confDetailsMessage);
  sendSlackMessageToChannel(incidentSlackChannel, slackMessage, true);
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

  var incidentSlackChannel = createSlackChannel(incidentId, incidentName, incidentCreatorSlackHandle);
  alertIncidentManager(incidentName, incidentSlackChannel, incidentCreatorSlackHandle);
}

function createSlackChannel (incidentId, incidentName, incidentCreatorSlackHandle) {
  var prefix = process.env.SLACK_INCIDENT_CHANNEL_PREFIX;
  if(!prefix){
    prefix = 'incident-';
  }
  var incidentSlackChannel = prefix + incidentId;

  request.post({
    url:'https://slack.com/api/channels.create',
    auth: {
      'bearer': process.env.SLACK_API_TOKEN
    },
    json: {
      name: '#' + incidentSlackChannel
    }
  },
  function(error, response, body) {
    if (error) {
      console.error('Creating Slack channel failed:', error);
      throw new Error('Creating Slack channel failed');
    }
    console.log(typeof response.body);
    var obj = response.body;
    var channelId = obj.channel.id;
    var channelName = obj.channel.name;

    createAdditionalResources(incidentId, incidentName, channelId, channelName, incidentCreatorSlackHandle);
    setChannelTopic(channelId, incidentName + '. Please join conference call. See pinned message for details.');

  });

  return incidentSlackChannel;
}

function createAdditionalResources(incidentId, incidentName, incidentSlackChannelId, incidentSlackChannel, incidentCreatorSlackHandle){

  var eventDetails = new Object();
  gapi_helper.registerIncidentEvent(incidentId, incidentName, incidentCreatorSlackHandle, incidentSlackChannel, eventDetails);

  var docDetails = new Object();
  var fileName = incidentSlackChannel;
  gapi_helper.createIncidentsLogFile(fileName,process.env.GDRIVE_INCIDENT_NOTES_FOLDER,incidentName,incidentCreatorSlackHandle, docDetails);

  //Sending a object as an argument to have it populated with the response
  var epic = new Object();
  createFollowupsEpic(incidentName, epic);

  // Return a formatted message
  var slackMessage = createInitialMessage(incidentName, incidentCreatorSlackHandle, incidentSlackChannel, incidentSlackChannelId);

  sendSlackMessageToChannel(process.env.SLACK_INCIDENTS_CHANNEL, slackMessage);
  //remove join button from initial message and then send to incident channel
  slackMessage.attachments[0].actions.shift();
  sendSlackMessageToChannel(incidentSlackChannel, slackMessage)

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
      if(docDetails['url']){
        sendIncidentLogFileToChannel(incidentSlackChannel, docDetails['url']);
      }
    },
    3200
  );

  setTimeout(function () {
      //This will only be populated if Jira is enabled and the response was already returned.
      if(epic['url']){
        sendEpicToChannel(incidentSlackChannel, epic['url']);
      }
    },
    3500
  );
}

function setChannelTopic(channelId, topic){
  request.post({
    url:'https://slack.com/api/channels.setTopic',
    auth: {
      'bearer': process.env.SLACK_API_TOKEN
    },
    json: {
      'channel': channelId,
      'topic': topic
    }
  },
  function(error, response, body) {
    if(error || !body['ok']){
      console.log('Error setting topic for channel '+channelId);
    }
  });
}

function alertIncidentManager(incidentName, incidentSlackChannel, incidentCreatorSlackHandle) {
  if (!process.env.PAGERDUTY_API_TOKEN || process.env.DRY_RUN) {
    console.log('pagerduty not setup');
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

function sendSlackMessageToChannel(slackChannel, slackMessage, pin_message) {
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
    if(pin_message){
      var ts = body['ts'];
      var channel = body['channel'];
      request.post({
          url:'https://slack.com/api/pins.add',
          auth: {
            'bearer': process.env.SLACK_API_TOKEN
          },
          json: {
            'channel': channel,
            'timestamp':ts
          }
        }, (error, response) => {
          if(error){
            console.log('Error pinning message to channel: '+error);
          }
        }
      );
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
