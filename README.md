# Incident Management Flow via Slack's Slash Command

This node.js app is allowing you to start an incident management process via a [Slack slash command](https://api.slack.com/slash-commands). The command will do the following:
* Posts a Slack message in an incidents Slack channel with links to:
  * A newly created Slack channel for this specific incident
  * A Google Hangout/Meet meeting to join to communicate with your team members
  * A Google Docs template to be copied manually (for now) to share the timelines, notes, logs, etc.

This is what it looks like:
![Slack message example](https://raw.githubusercontent.com/rfeiner/slackincident/master/docs/slack-message-example.png)

## Setup
* Deploy the app to any node.js enabled hosting environment ([Heroku?](https://www.heroku.com)), and configure the environment variables like explained below.
* [Create a Slash Command](https://api.slack.com/slash-commands?#creating_commands) and point it to the URL where the app is hosted.
  * Update the Command token in the environment variables.
* Test `/incident TEST!!! This is a test of an incident slack command` in your Slack workspace

### Config Environment Variables
#### Slack Integration
* `SLACK_COMMAND_TOKEN`: Your slack command token (generated when you create a slash Slack command).
* `SLACK_API_TOKEN`: [Legacy Slack API token](https://api.slack.com/custom-integrations/legacy-tokens).
* `SLACK_INCIDENTS_CHANNEL`: The incidents Slack channel where all incidents are shared (e.g. `tech-incidents`).
* `SLACK_INCIDENT_CHANNEL_PREFIX`: Slack channel for the incident postfixed with timestamp (e.g. `incident-`).
* `SLACK_TEAM_ID`: The team ID to use for deep linking to channels. See https://stackoverflow.com/questions/40940327/what-is-the-simplest-way-to-find-a-slack-team-id-and-a-channel-id 
#### Pagerduty integration
* `PAGERDUTY_API_TOKEN`: The Pagerduty API token used to page an incident manager
#### Jira Integration
* `JIRA_DOMAIN`: The domain of your organisation that you're using for Jira (e.g. `messagebird.atlassian.net`)
* `JIRA_USER`: User name to authenticate the requests to Jira;
* `JIRA_API_KEY`: API KEY associated to the given user name. It can be generated through `https://id.atlassian.com`.
* `JIRA_PROJECT_ID`: ID of the Jira Project that will be used to track follow-up actions
* `JIRA_ISSUE_TYPE_ID`: IssueTypeId used to create main task in the specified project. Can be obtained thorugh API call `rest/api/3/issue/createmeta`. Most commonly used type id is the one associated to epic in the specified project.
#### Google Calendar/Meet/Docs integration

The supported authentication method is OAuth 2.0. The details below are generated in the cloiud console, in https://console.cloud.google.com/apis/credentials. Create and Create OAuth client ID of type 'Other' and you will get the info need to start. Remember to enable the Calendar API in your account.

* `GOOGLEAPI_CLIENT_ID`: The client ID of your credentials
* `GOOGLEAPI_CLIENT_SECRET`: The client secret of your credentials
* `GOOGLE_AUTHORIZATION_TOKEN`: A generated token which is obtained after user gives the permissions. The 'generate_googleapi_token.js' script helps you to obatin the token.
* `GOOGLE_CALENDAR_ID`: Id of the calendar where the incident details will be saved. Optional. default: primary
* `GOOGLE_CALENDAR_TIMEZONE`: Timezone of the events. Optional. Default: Europe/Amsterdam
* `GDRIVE_INCIDENT_NOTES_FOLDER`: Folder id rto be used as repository for the incident log files. Optional.

## Todo / Wishlist

