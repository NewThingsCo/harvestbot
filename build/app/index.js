'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _log = require('../log');

var _log2 = _interopRequireDefault(_log);

var _harvest = require('../harvest');

var _harvest2 = _interopRequireDefault(_harvest);

var _analyzer = require('../analyzer');

var _analyzer2 = _interopRequireDefault(_analyzer);

var _calendar = require('../calendar');

var _calendar2 = _interopRequireDefault(_calendar);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = (config, http) => {
  const formatDate = date => date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const validateEmail = (email, emailParts = email.split('@')) => config.emailDomains.includes(emailParts[1]) ? emailParts[0] : null;

  const analyzer = (0, _analyzer2.default)();
  const calendar = (0, _calendar2.default)();
  const tracker = (0, _harvest2.default)(config, http);
  const round = val => Math.floor(val * 2) / 2;

  const calcFlexTime = email => new Promise(resolve => {
    const userName = validateEmail(email);
    if (!userName) {
      return resolve({ header: `Invalid email domain for ${email}` });
    }

    _log2.default.info(`Ignore following task ids ${config.ignoreTaskIds}`);
    _log2.default.info(`Fetch data for ${email}`);

    return tracker.getTimeEntries(userName, validateEmail).then(entries => {
      if (!entries) {
        return resolve({ header: `Unable to find time entries for ${email}` });
      }
      const messages = [];
      const latestFullDay = calendar.getLatestFullWorkingDay();
      _log2.default.info(messages[0]);

      const range = analyzer.getPeriodRange(entries, latestFullDay);
      _log2.default.info(`Received range starting from ${formatDate(range.start)} to ${formatDate(range.end)}`);
      messages.push(`Latest calendar working day: ${formatDate(range.end)}`);
      messages.push(`Last time you have recorded hours: ${formatDate(new Date(range.entries[range.entries.length - 1].date))}`);

      const totalHours = calendar.getTotalWorkHoursSinceDate(range.start, range.end);
      _log2.default.info(`Total working hours from range start ${totalHours}`);

      const result = analyzer.calculateWorkedHours(range.entries, config.ignoreTaskIds);
      if (result.warnings.length > 0) {
        _log2.default.info(result.warnings);
      } else {
        _log2.default.info('No warnings!');
      }
      result.warnings.forEach(msg => messages.push(msg));

      messages.push(`Current month ${result.billablePercentageCurrentMonth}% billable`);

      const header = `*Your flex hours count: ${round(result.total - totalHours)}*`;
      _log2.default.info(header);

      _log2.default.info('All done!');
      return resolve({ header, messages });
    });
  });

  const sendFlexTime = (email, response) => {
    response(`Fetching time entries for email ${email}`);
    calcFlexTime(email).then(({ header, messages }) => response(header, messages));
  };

  return {
    calcFlexTime,
    sendFlexTime
  };
};