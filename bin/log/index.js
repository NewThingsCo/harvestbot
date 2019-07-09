"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));

var _winston = require("winston");

var _loggingWinston = require("@google-cloud/logging-winston");

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { keys.push.apply(keys, Object.getOwnPropertySymbols(object)); } if (enumerableOnly) keys = keys.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

var _default = ({
  inGoogleCloud
}) => {
  const {
    Console
  } = _winston.transports;
  const appTransports = {
    default: [...(inGoogleCloud ? [new _loggingWinston.LoggingWinston()] : []), new Console()]
  };
  const exceptionHandlers = {
    default: [...(inGoogleCloud ? [new _loggingWinston.LoggingWinston()] : []), new Console()]
  };

  const loggingConfig = _objectSpread({}, inGoogleCloud ? {} : {
    format: _winston.format.combine(_winston.format.colorize(), _winston.format.timestamp(), _winston.format.printf(info => `[${info.timestamp}] ${info.level}: ${info.message}`))
  }, {
    level: 'info',
    transports: appTransports.default,
    exceptionHandlers: exceptionHandlers.default,
    exitOnError: true
  });

  const logger = (0, _winston.createLogger)(loggingConfig);
  return logger;
};

exports.default = _default;