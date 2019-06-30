const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

// If modifying these scopes, delete token_googleapi.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token_googleapi.json';

var CLIENT_ID = process.env.GOOGLEAPI_CLIENT_ID;
var CLIENT_SECRET = process.env.GOOGLEAPI_CLIENT_SECRET;

// Generate token
init();

function init(){
  if(!CLIENT_ID){
    askClientId();
  } else{

  }
}

function askClientId(){
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Enter the client id of your credentials: ', (client_id) => {
      rl.close();
      CLIENT_ID = client_id;
      if(!CLIENT_SECRET){
        askClientSecret();
      }
      else{
        authorize();
      }
    });
}

function askClientSecret(){
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the client secret of your credentials: ', (client_secret) => {
    rl.close();
    CLIENT_SECRET = client_secret;
    authorize();
  });
}

function authorize() {

  if(!CLIENT_ID || !CLIENT_SECRET){
    console.log("\n\nPlease provide the client id and secret of your crdentials otherwise token cannot be generated.\nBye.\n");
    return;
  }
  //const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, 'urn:ietf:wg:oauth:2.0:oob');

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err){
      getAccessToken(oAuth2Client);
    }
    else{
      console.log('Token already exists', TOKEN_PATH);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log("Authorize this app by visiting the url below:\n", authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      console.log("\n\nHere is your GOOGLE_AUTHORIZATION_TOKEN. Set this environemnt variable and run the main app to enable conference calls and calendars");

      console.log("\n\n=============================COPY TOKEN=====================================\n\n\n");
      console.log(JSON.stringify(token));
      console.log("\n\n\n==============================END============================================\n\n")
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
    });
  });
}
