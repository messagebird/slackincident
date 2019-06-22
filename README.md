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
#### Google Docs Integration
* `GOOGLE_DOMAIN`: The domain of your organisation that you're using in Google G-Suite (e.g. `messagebird.com`).
* `GOOGLE_DOCS_FILE_ID`: The Google Docs file ID of the Incident management document you want the team to use to fill to dump info during incident.
#### Pagerduty integration
* `PAGERDUTY_API_TOKEN`: The Pagerduty API token used to page an incident manager
#### Jira Integration
* `JIRA_DOMAIN`: The domain of your organisation that you're using for Jira (e.g. `messagebird.atlassian.net`)
* `JIRA_USER`: User name to authenticate the requests to Jira;
* `JIRA_API_KEY`: API KEY associated to the given user name. It can be generated through `https://id.atlassian.com`.
* `JIRA_PROJECT_ID`: ID of the Jira Project that will be used to track follow-up actions
* `JIRA_EPIC_ISSUE_TYPE_ID`: IssueTypeId for epics in the specified project. Can be obtained thorugh API call `rest/api/3/issue/createmeta`.

## Todo / Wishlist
* Automate the copy of the Google Doc Incident Template and link to the new document
