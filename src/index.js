import application from './app';
import logger from './log';
import db from './db';
import http from './http';
import slackApi from './slack';

const validateEnv = () => {
  const getEnvParam = param => (process.env[param] ? process.env[param] : logger.error(`Environment variable ${param} missing.`));
  const config = {};
  const ignoreTaskIds = getEnvParam('IGNORE_FROM_FLEX_TASK_IDS');
  const emailDomains = getEnvParam('ALLOWED_EMAIL_DOMAINS');
  config.ignoreTaskIds = ignoreTaskIds ? ignoreTaskIds.split(',').map(id => parseInt(id, 10)) : [];
  config.emailDomains = emailDomains ? emailDomains.split(',') : [];
  config.projectId = getEnvParam('GCLOUD_PROJECT');
  config.harvestAccessToken = getEnvParam('HARVEST_ACCESS_TOKEN');
  config.harvestAccountId = getEnvParam('HARVEST_ACCOUNT_ID');
  config.slackBotToken = getEnvParam('SLACK_BOT_TOKEN');
  config.notifyChannelId = getEnvParam('SLACK_NOTIFY_CHANNEL_ID');
  return config;
};

export const calcFlextime = async (req, res) => {
  if (req.body.text === 'help') {
    return res.json({ text: '_Bot for calculating your harvest balance. Use /flextime with no parameters to start calculation._' });
  }

  res.json({ text: 'Starting to calculate flextime. This may take a while...' });

  const config = validateEnv();
  const slack = slackApi(config, http, req.body.response_url);
  const userId = req.body.user_id;

  if (userId) {
    logger.info(`Fetching data for user id ${userId}`);
    const email = await slack.getUserEmailForId(userId);
    if (!email) {
      return slack.postResponse({ text: 'Cannot find email for Slack user id' });
    }
    db(config).storeUserData(userId, email);
    return application(config, http).sendFlexTime(email, slack.postResponse);
  }
  return slack.postResponse({ text: 'Cannot find email for Slack user id' });
};

export const notifyUsers = async (req, res) => {
  const config = validateEnv();
  const store = db(config);
  const slack = slackApi(config, http);
  const app = application(config, http);

  const users = await store.fetchUsers;
  logger.info(`Found ${users.length} users`);

  users.forEach(async ({ email, id }) => {
    logger.info(`Notify ${email}`);
    const data = await app.calcFlexTime(email);
    slack.postMessage(config.notifyChannelId, id, data);
  });
  return res.json({ text: 'ok' });
};

if (process.argv.length === 3) {
  const printResponse =
    (header, msgs) => {
      logger.info(header);
      if (msgs) {
        msgs.forEach(msg => logger.info(msg));
      }
    };

  const email = process.argv[2];
  logger.info(`Email ${email}`);
  const app = application(validateEnv(), http);
  app.sendFlexTime(email, printResponse);
  // notifyUsers(null, { json: data => logger.info(data) });
}
