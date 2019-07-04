"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _objectSpread2 = _interopRequireDefault(require("@babel/runtime/helpers/objectSpread2"));

var _log = _interopRequireDefault(require("../log"));

var _defaults = require("./defaults");

var _keyRing = _interopRequireDefault(require("../cloud/key-ring"));

var _default = () => {
  const inGoogleCloud = process.env.FUNCTION_NAME;
  const logger = (0, _log.default)({
    inGoogleCloud
  });

  const getEnvParam = param => process.env[param] ? process.env[param] : logger.error(`Environment variable ${param} missing.`);

  const baseConfig = {
    inGoogleCloud,
    projectId: getEnvParam('GCLOUD_PROJECT'),
    region: getEnvParam('FUNCTION_REGION')
  };
  const {
    decryptSecret
  } = (0, _keyRing.default)(baseConfig);

  const getConfig = async () => {
    const secretConfigString = await decryptSecret();
    const secretConfig = JSON.parse(secretConfigString);
    return (0, _objectSpread2.default)({}, baseConfig, {}, secretConfig, {
      emailDomains: secretConfig.emailDomains ? secretConfig.emailDomains.split(',') : [],
      hoursStatsColumnHeaders: secretConfig.hoursStatsColumnHeaders ? secretConfig.hoursStatsColumnHeaders.split(',') : _defaults.DEFAULT_HOURS_STATS_COLUMN_HEADERS,
      billableStatsColumnHeaders: secretConfig.billableStatsColumnHeaders ? secretConfig.billableStatsColumnHeaders.split(',') : _defaults.DEFAULT_BILLABLE_STATS_COLUMN_HEADERS,
      taskIds: {
        publicHoliday: parseInt(secretConfig.taskIds.publicHoliday, 10),
        vacation: parseInt(secretConfig.taskIds.vacation, 10),
        unpaidLeave: parseInt(secretConfig.taskIds.unpaidLeave, 10),
        sickLeave: parseInt(secretConfig.taskIds.sickLeave, 10),
        flexLeave: parseInt(secretConfig.taskIds.flexLeave, 10)
      },
      currentTime: new Date().getTime() / 1000
    });
  };

  return {
    getConfig
  };
};

exports.default = _default;