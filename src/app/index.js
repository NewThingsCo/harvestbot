import logger from '../log';
import harvest from '../harvest';
import analyze from '../analyzer';
import cal from '../calendar';

export default (config, http) => {
  const formatDate = date => date.toLocaleDateString(
    'en-US',
    {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    },
  );
  const validateEmail = (email, emailParts = email.split('@')) =>
    (config.emailDomains.includes(emailParts[1]) ? emailParts[0] : null);

  const analyzer = analyze();
  const calendar = cal();
  const tracker = harvest(config, http);
  const round = val => Math.floor(val * 2) / 2;

  const calcFlexTime = email => new Promise((resolve) => {
    const userName = validateEmail(email);
    if (!userName) {
      return resolve({ header: `Invalid email domain for ${email}` });
    }

    logger.info(`Ignore following task ids ${config.ignoreTaskIds}`);
    logger.info(`Fetch data for ${email}`);

    return tracker.getTimeEntries(userName, validateEmail)
      .then((entries) => {
        if (!entries) {
          return resolve({ header: `Unable to find time entries for ${email}` });
        }
        const messages = [];
        const latestFullDay = calendar.getLatestFullWorkingDay();
        logger.info(messages[0]);

        const range = analyzer.getPeriodRange(entries, latestFullDay);
        logger.info(`Received range starting from ${formatDate(range.start)} to ${formatDate(range.end)}`);
        messages.push(`Latest calendar working day: ${formatDate(range.end)}`);
        messages.push(`Last time you have recorded hours: ${formatDate(new Date(range.entries[range.entries.length - 1].date))}`);

        const totalHours = calendar.getTotalWorkHoursSinceDate(range.start, range.end);
        logger.info(`Total working hours from range start ${totalHours}`);

        const result = analyzer.calculateWorkedHours(range.entries, config.ignoreTaskIds);
        if (result.warnings.length > 0) {
          logger.info(result.warnings);
        } else {
          logger.info('No warnings!');
        }
        result.warnings.forEach(msg => messages.push(msg));

        messages.push(`Current month ${result.billablePercentageCurrentMonth}% billable`);

        const header = `*Your flex hours count: ${round(result.total - totalHours)}*`;
        logger.info(header);

        logger.info('All done!');
        return resolve({ header, messages });
      });
  });

  const sendFlexTime = (email, response) => {
    response(`Fetching time entries for email ${email}`);
    calcFlexTime(email).then(({ header, messages }) => response(header, messages));
  };

  return {
    calcFlexTime,
    sendFlexTime,
  };
};
