import application from './app';
import log from './log';
import db from './cloud/db';
import queue from './cloud/queue';
import http from './http';
import settings from './settings';
import slackApi from './slack';
import verifier from './verifier';

let logger = null;
let appConfig = null;

const getAppConfig = async () => {
  if (appConfig) {
    return appConfig;
  }
  appConfig = await settings().getConfig();
  logger = log(appConfig);
  return appConfig;
};

export const initFlextime = async (req, res) => {
  const config = await getAppConfig();

  if (verifier(config).verifySlackRequest(req)) {
    const cmd = req.body.text;

    if (cmd === 'help') {
      return res.json({ text: '_Bot for calculating your harvest balance. Use /flextime with no parameters to start calculation._' });
    }

    logger.info(`Received valid Slack request with cmd ${cmd}`);

    const cmdParts = cmd.split(' ');
    if (cmdParts.length > 0 && cmdParts[0] === 'stats') {
      const currentDate = new Date();
      const year = cmdParts.length > 1 ? cmdParts[1] : currentDate.getFullYear();
      const month = cmdParts.length > 2 ? cmdParts[2] : currentDate.getMonth() + 1;

      logger.info('Enqueuing stats request');

      await queue(config)
        .enqueueStatsRequest({
          userId: req.body.user_id, responseUrl: req.body.response_url, year, month,
        });
      return res.json({ text: 'Starting to generate stats. This may take a while...' });
    }

    logger.info('Enqueuing flex time request');

    await queue(config)
      .enqueueFlexTimeRequest({ userId: req.body.user_id, responseUrl: req.body.response_url });
    return res.json({ text: 'Starting to calculate flextime. This may take a while... Join channel #harvest for weekly notifications.' });
  }

  logger.warn('Received invalid Slack request');
  return res.status(401).send('Unauthorized');
};

export const calcFlextime = async (message) => {
  const config = await getAppConfig();
  const request = JSON.parse(Buffer.from(message.data, 'base64').toString());
  const slack = slackApi(config, http, request.responseUrl);
  const { userId } = request;

  if (userId) {
    logger.info(`Fetching data for user id ${userId}`);
    const email = request.email || await slack.getUserEmailForId(userId);
    const { startDate, endDate, calcAll } = request;
    if (!email) {
      return slack.postMessage(userId, 'Cannot find email for Slack user id');
    }
    if (!request.email) {
      await slack.postMessage(userId, `Fetching time entries for email ${email}`);
    }
    await db(config).storeUserData(userId, email);
    logger.info('User data stored');

    const data = await application(config, http).calcFlextime(email, startDate, endDate, calcAll);
    logger.info('Flextime calculated');

    return slack.postMessage(userId, data.header, data.messages);
  }
  return logger.error('Cannot find Slack user id');
};

export const notifyUsers = async (req, res) => {
  const config = await getAppConfig();
  if (verifier(config).verifySlackRequest(req)) {
    const store = db(config);
    const msgQueue = queue(config);

    const users = await store.fetchUsers;
    logger.info(`Found ${users.length} users`);

    await Promise.all(users.map(async ({ email, id }) => {
      logger.info(`Notify ${email}`);
      return msgQueue.enqueueFlexTimeRequest({ userId: id, email });
    }));
    return res.json({ text: 'ok' });
  }
  return res.status(401).send('Unauthorized');
};

export const calcStats = async (message) => {
  const config = await getAppConfig();
  const request = JSON.parse(Buffer.from(message.data, 'base64').toString());
  const slack = slackApi(config, http, request.responseUrl);
  const { userId, year, month } = request;

  if (userId) {
    logger.info(`Calculating stats requested by user ${userId}`);
    const email = await slack.getUserEmailForId(userId); // TODO: need slack admin role?
    if (!email) {
      return slack.postMessage(userId, 'Cannot find email for Slack user id');
    }

    const result = await application(config, http).generateReport(year, month, email);
    logger.info('Stats generated');

    return slack.postMessage(userId, result);
  }
  return logger.error('Cannot find Slack user id');
};
