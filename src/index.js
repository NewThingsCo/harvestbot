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
  return config;
};

export const calcFlextime = (req, res) => {
  if (req.body.text === 'help') {
    return res.json({ text: '_Bot for calculating your harvest balance. Use /flextime with no parameters to start calculation._' });
  }

  const config = validateEnv();
  const slack = slackApi(config, http, req.body.response_url);
  const userId = req.body.user_id;
  if (userId) {
    logger.info(`Fetching data for user id ${userId}`);
    slack.getUserEmailForId(userId)
      .then((email) => {
        db(config).storeUserData(userId, email);
        application(config, http).sendFlexTime(email, slack.postResponse);
      })
      .catch(err => logger.error(err));
  } else {
    logger.error('User id missing.');
  }
  return res.json({ text: 'Starting to calculate flextime. This may take a while...' });
};

export const notifyUsers = (req, res) => {
  const config = validateEnv();
  const store = db(config);
  store.fetchUsers.then((users) => {
    const slack = slackApi(config, http);
    const app = application(config, http);
    slack.getImIds(users.map(({ id }) => id)).then(imData =>
      imData
        .filter(item => item.imId === 'D547CU95J')
        .forEach((imItem) => {
          const user = users.find(({ id }) => imItem.userId === id);
          app.calcFlexTime(user.email).then(data => slack.postMessage(imItem.imId, data));
        }));
  }).catch(() => logger.error('Unable to fetch user ids.'));
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
  notifyUsers(null, { json: data => logger.info(data) });
}
