# BirdFinder

This node.js app is allowing you find a colleague via a [Slack slash command](https://api.slack.com/slash-commands). The command will do the following:
* ...

## Setup
* Deploy the app to any node.js enabled hosting environment ([Heroku?](https://www.heroku.com)), and configure the environment variables like explained below.
* [Create a Slash Command](https://api.slack.com/slash-commands?#creating_commands) and point it to the URL where the app is hosted.
  * Update the Command token in the environment variables.
* Test `/find @nickname` in your Slack workspace

### Config Environment Variables
#### Slack Integration
* `SLACK_COMMAND_TOKEN`: Your slack command token (generated when you create a slash Slack command).
* `SLACK_API_TOKEN`: [Legacy Slack API token](https://api.slack.com/custom-integrations/legacy-tokens).

