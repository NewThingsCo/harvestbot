'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.notifyUsers = exports.calcFlextime = undefined;

var _app = require('./app');

var _app2 = _interopRequireDefault(_app);

var _log = require('./log');

var _log2 = _interopRequireDefault(_log);

var _db = require('./db');

var _db2 = _interopRequireDefault(_db);

var _http = require('./http');

var _http2 = _interopRequireDefault(_http);

var _slack = require('./slack');

var _slack2 = _interopRequireDefault(_slack);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const validateEnv = () => {
  const getEnvParam = param => process.env[param] ? process.env[param] : _log2.default.error(`Environment variable ${param} missing.`);
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

const calcFlextime = exports.calcFlextime = (req, res) => {
  if (req.body.text === 'help') {
    return res.json({ text: '_Bot for calculating your harvest balance. Use /flextime with no parameters to start calculation._' });
  }

  const config = validateEnv();
  const slack = (0, _slack2.default)(config, _http2.default, req.body.response_url);
  const userId = req.body.user_id;
  if (userId) {
    _log2.default.info(`Fetching data for user id ${userId}`);
    slack.getUserEmailForId(userId).then(email => {
      (0, _db2.default)(config).storeUserData(userId, email);
      (0, _app2.default)(config, _http2.default).sendFlexTime(email, slack.postResponse);
    }).catch(err => _log2.default.error(err));
  } else {
    _log2.default.error('User id missing.');
  }
  return res.json({ text: 'Starting to calculate flextime. This may take a while...' });
};

const notifyUsers = exports.notifyUsers = (req, res) => {
  const config = validateEnv();
  const store = (0, _db2.default)(config);
  store.fetchUsers.then(users => {
    const slack = (0, _slack2.default)(config, _http2.default);
    const app = (0, _app2.default)(config, _http2.default);
    slack.getImIds(users.map(({ id }) => id)).then(imData => imData.filter(item => item.imId === 'D547CU95J').forEach(imItem => {
      const user = users.find(({ id }) => imItem.userId === id);
      app.calcFlexTime(user.email).then(data => slack.postMessage(imItem.imId, data));
    }));
  }).catch(() => _log2.default.error('Unable to fetch user ids.'));
  return res.json({ text: 'ok' });
};

if (process.argv.length === 3) {
  const printResponse = (header, msgs) => {
    _log2.default.info(header);
    if (msgs) {
      msgs.forEach(msg => _log2.default.info(msg));
    }
  };

  const email = process.argv[2];
  _log2.default.info(`Email ${email}`);
  const app = (0, _app2.default)(validateEnv(), _http2.default);
  app.sendFlexTime(email, printResponse);
  notifyUsers(null, { json: data => _log2.default.info(data) });
}