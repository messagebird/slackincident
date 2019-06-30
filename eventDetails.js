var exports = module.exports = {};

const {google} = require('googleapis');
const moment = require('moment');

function getoAuth2Client(){
  if(!process.env.GOOGLEAPI_CLIENT_ID || !process.env.GOOGLEAPI_CLIENT_SECRET){
    console.log('GOOGLEAPI_CLIENT_ID or GOOGLEAPI_CLIENT_SECRET not provided. Calendar/Conference details wont be provided');
    return;
  }
  var client_secret = process.env.GOOGLEAPI_CLIENT_SECRET;
  var client_id = process.env.GOOGLEAPI_CLIENT_ID;
  //const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'urn:ietf:wg:oauth:2.0:oob');
  oAuth2Client.setCredentials(JSON.parse(process.env.GOOGLE_AUTHORIZATION_TOKEN));
  return oAuth2Client;
}

/**
 * Create an OAuth2 client with the given credentials
 * @param {Object} credentials The authorization client credentials.
 */
exports.registerIncidentEvent =  function registerIncidentEvent(incidentId, incidentName, reportedBy, slackChannel, eventHandle) {
    const oAuth2Client = getoAuth2Client();
    if(!oAuth2Client){
      return;
    }
    var now = moment();
    var eventDescription = "<b>"+incidentName+"</b>\n"+
                              "<small>" +
                              "Incident response triggered on " + now.format("DD/MM/YYYY HH:mm") + "\n" +
                              "Reported by " + reportedBy + "\n" +
                              (slackChannel?"<a href='https://slack.com/app_redirect?" + slackChannel+ "'>Incident Slack Channel</a>\n":'')+
                              "</small>";
                              
    createEvent(oAuth2Client, incidentName, incidentId, eventDescription, eventHandle);
}

function createEvent(auth, incidentName, incidentId, incidentDescription, eventHandle){
  const calendar = google.calendar({version: 'v3', auth});
  var calendarId = process.env.GOOGLE_CALENDAR_ID;
  if(!calendarId){
    calendarId = 'primary';
  }
  var calendarTimezone = process.env.GOOGLE_CALENDAR_TIMEZONE;
  if(!calendarTimezone){
    calendarTimezone = 'Europe/Amsterdam';
  }
  var start = new Date ();
  var end = new Date ( start );
  end.setMinutes ( start.getMinutes() + 5 );

  var event = {
    'summary': incidentName,
    'description': incidentDescription,
    'start': {
      'dateTime': start.toISOString(),
      'timeZone': calendarTimezone,
    },
    'end': {
      'dateTime': end.toISOString(),
      'timeZone': calendarTimezone,
    },
  };

  var eventCreated;
  calendar.events.insert({
    auth: auth,
    calendarId: calendarId,
    resource: event,
  }, function(err, event) {
        if (err) {
          console.log('There was an error contacting the Calendar service: ' + err);
          return;
        }

        var eventPatch = {
          conferenceData: {
            createRequest: {requestId: incidentId},
          },
        };

        calendar.events.patch({
          calendarId: calendarId,
          eventId: event.data.id,
          resource: eventPatch,
          sendNotifications: true,
          conferenceDataVersion: 1
        }, function(err, event) {
            if(err){
              console.log('There was an error adding the conference details');
            }
            else{
              eventHandle['obj'] = event;
            }
          }
        );
  });
}