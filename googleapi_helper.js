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

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'urn:ietf:wg:oauth:2.0:oob');
  var token = JSON.parse(process.env.GOOGLE_AUTHORIZATION_TOKEN);
  oAuth2Client.setCredentials(token);
  return oAuth2Client;
}

exports.createIncidentsLogFile = function createIncidentsLogFile(fileName, folder, incidentTitle, reportedBy, documentHandle) {
  const oAuth2Client = getoAuth2Client();
  if(!oAuth2Client){
    return;
  }

  const drive = google.drive({version: 'v3', auth: oAuth2Client});
  var metadata = {
    "mimeType": "application/vnd.google-apps.document",
    "name":fileName
  };
  if(folder){
    metadata['parents'] = [folder];
  }
  drive.files.create({
    resource:metadata,
    "fields": 'id',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);

    documentHandle['id'] = res.data.id;
    documentHandle['url'] = 'https://docs.google.com/document/d/'+res.data.id;
    const docs = google.docs({version: 'v1', auth: oAuth2Client});
    var now = moment.utc();

    var inicidentTitleLength = incidentTitle.length;
    //console.log(res);
    //docs.documents.move()
    var texts = [
      {
        text: incidentTitle + "\n",
        style: {
          "updateParagraphStyle":{
            paragraphStyle:{
              namedStyleType:"TITLE"
            },
            fields:'namedStyleType'
          }
        }
      },
      {
        text: "Quick description of the problem\n",
        style: {
            "updateParagraphStyle":{
              paragraphStyle:{
                namedStyleType:"HEADING_1"
              },
              fields:'namedStyleType'
            }
          },
      },
      {
        text: "\n",
      },
      {
        text:"Timeline\n",
        style: {
          "updateParagraphStyle":{
            paragraphStyle:{
              namedStyleType:"HEADING_1"
            },
            fields:'namedStyleType'
          }
        }, 
      },
      {
        text: "Times in UTC\n\n",
        style: {
          "updateTextStyle":{
            textStyle:{
              italic:true
            },
            fields:'italic'
          }
        }
      },
      {
        text: now.format("YYYY-MM-DD HH:mm Z") + ": Incident started by " + reportedBy + "\n\n"
      },
      {
        text:"[Copy & paste data]\n",
        style:  {
          "updateParagraphStyle":{
            paragraphStyle:{
              namedStyleType:"HEADING_1"
            },
            fields:'namedStyleType'
          }
        }, 
      },
      {
        text: "\n\n"
      }
    ];

    var requests = [];
    var index = 1;
    for(var i=0;i<texts.length;i++){
      var text = texts[i].text;
       requests.push(
        {
          "insertText":{
            "text": text,
            location:{
              "index":index
            }
          }
        }
       );
       if(texts[i].style){
         var style = texts[i].style;
         style[Object.keys(style)[0]]['range'] = {
          startIndex:index,
          endIndex: index + text.length
        };
        requests.push(texts[i].style);
       }
       index = index + text.length;
    }

    setTimeout(
    function(){docs.documents.batchUpdate({
      documentId: res.data.id,
      resource:{
        "requests": requests        
      }
    },(err, res) =>{
      if (err){
        console.log("Error writing to file: " + err);
      }
    }
    )},1000);;


  });
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
                              (slackChannel?"<a href='https://slack.com/app_redirect?channel=" + slackChannel+ "'>Incident Slack Channel</a>\n":'')+
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
