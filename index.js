'use strict';

const http = require('http');
const qs = require('querystring');
const request = require('request');
const moment = require('moment');
var rp = require('request-promise');

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
        text: "Incident Channel: #" + incidentSlackChannel,
        "fallback": "Join Incident Channel #" + incidentSlackChannel,
        "actions": [
            {
                "type": "button",
                "text": "Join Incident Channel",
                "url": "slack://channel?team=" + process.env.SLACK_TEAM_ID + "&id=" + incidentSlackChannelId,
                "style": "danger"
            }
        ],
        footer: `reported by @${slackUserName}`
    });
    return slackMessage;
}

function sendIncidentLogFileToChannel(incidentSlackChannelId, docUrl) {
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
    sendSlackMessageToChannel(incidentSlackChannelId, slackMessage);
}

function verifyPostRequest(method) {
    if (method !== 'POST') {
        const error = new Error('Only POST requests are accepted');
        error.code = 405;
        throw error;
    }
}

function verifySlackWebhook(body) {
    if (!body || body.token !== process.env.SLACK_COMMAND_TOKEN) {
        const error = new Error('Invalid credentials');
        error.code = 401;
        throw error;
    }
}

async function createIncidentFlow(body) {
    var incidentId = moment().format('YYMMDDHHmm');
    var incidentName = body.text;
    var incidentCreatorSlackHandle = body.user_name;
    var incidentCreatorSlackUserId = body.user_id;

    var prefix = process.env.SLACK_INCIDENT_CHANNEL_PREFIX;
    if (!prefix) {
        prefix = 'incident-';
    }

    var incidentSlackChannel = prefix + incidentId;
    if (!incidentName) {
        incidentName = incidentSlackChannel;
    }

    var incidentSlackChannelID = await createSlackChannel(incidentName, incidentCreatorSlackUserId, incidentSlackChannel);

    return incidentSlackChannelID;
}

async function createSlackChannel(incidentName, incidentCreatorSlackUserId, incidentSlackChannel) {
    try {
        const res = await rp.post({
            url: 'https://slack.com/api/channels.create',
            auth: {
                'bearer': process.env.SLACK_API_TOKEN
            },
            json: {
                name: '#' + incidentSlackChannel
            }
        });

        let channelId = res.channel.id;

        setChannelTopic(channelId, incidentName + '. Please join conference call. See pinned message for details.');
        inviteUser(channelId, incidentCreatorSlackUserId);
        return res.channel.id
    } catch (error) {
        throw new Error(error);
    }
}

function setChannelTopic(channelId, topic) {
    request.post({
            url: 'https://slack.com/api/channels.setTopic',
            auth: {
                'bearer': process.env.SLACK_API_TOKEN
            },
            json: {
                'channel': channelId,
                'topic': topic
            }
        },
        function (error, response, body) {
            if (error || !body['ok']) {
                console.log('Error setting topic for channel ' + channelId);
            }
        });
}

function inviteUser(channelId, userId) {
    request.post({
            url: 'https://slack.com/api/channels.invite',
            auth: {
                'bearer': process.env.SLACK_API_TOKEN
            },
            json: {
                'channel': channelId,
                'user': userId
            }
        },
        function (error, response, body) {
            if (error || !body['ok']) {
                console.log('Error inviting user for channel');
                console.log(body, error);
            }
        });
}


function sendSlackMessageToChannel(slackChannel, slackMessage, pin_message) {
    if (process.env.DRY_RUN) {
        console.log("Sending message below to channel " + slackChannel);
        console.log(slackMessage);
        return;
    }
    const newMessage = {
        ...slackMessage,
        channel: slackChannel
    };

    request.post({
            url: 'https://slack.com/api/chat.postMessage',
            auth: {
                'bearer': process.env.SLACK_API_TOKEN
            },
            json: newMessage
        },
        function (error, response, body) {
            if (error) {
                console.error('Sending message to Slack channel failed:', error);
                throw new Error('Sending message to Slack channel failed');
            }
            if (pin_message) {
                var ts = body['ts'];
                var channel = body['channel'];
                request.post({
                        url: 'https://slack.com/api/pins.add',
                        auth: {
                            'bearer': process.env.SLACK_API_TOKEN
                        },
                        json: {
                            'channel': channel,
                            'timestamp': ts
                        }
                    }, (error, response) => {
                        if (error) {
                            console.log('Error pinning message to channel: ' + error);
                        }
                    }
                );
            }
        });
}

http.createServer(function (req, res) {
    try {
        verifyPostRequest(req.method);

        var body = '';
        var post = {};
        req.on('data', function (chunk) {
            body += chunk;
        });

        req.on('end', async function () {
            console.log('body: ' + body);
            post = qs.parse(body);

            verifySlackWebhook(post);

            var incidentChannelId = await createIncidentFlow(post);

            console.log('Successful execution of incident flow');

            res.writeHead(200, {'Content-Type': 'application/json'});
            res.write(JSON.stringify({
                // text: "Incident management process started. Join incident channel: #"+incidentChannel,
                text: "Incident management process started. Join incident channel: slack://channel?team=" + process.env.SLACK_TEAM_ID + "&id=" + incidentChannelId,
                incident_channel_id: incidentChannelId
            }));
            res.end();
        });
    } catch (error) {
        console.log(error);

        res.writeHead((error.code ? error.code : 500), {'Content-Type': 'application/json'});
        res.write(JSON.stringify({response_type: "in_channel", text: error.message}));
        res.end();
    }
}).listen(process.env.PORT ? process.env.PORT : 8080);
console.log('Server listening on port ' + (process.env.PORT ? process.env.PORT : 8080));
