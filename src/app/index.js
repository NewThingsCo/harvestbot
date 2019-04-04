import { tmpdir } from 'os';
import { unlinkSync } from 'fs';

import log from '../log';

import analyze from './analyzer';
import excel from './excel';
import cal from './calendar';
import harvest from './harvest';
import emailer from './emailer';

export default (config, http) => {
  const logger = log(config);
  const formatDate = date => date.toLocaleDateString(
    'en-US',
    {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    },
  );
  const validateEmail = (email, emailParts = email.split('@')) => (config.emailDomains.includes(emailParts[1]) ? emailParts[0] : null);

  const analyzer = analyze(config);
  const calendar = cal();
  const tracker = harvest(config, http);
  const round = val => Math.floor(val * 2) / 2;

  const calcFlextime = async (email, startDate, endDate, calcAll) => {
    const userName = validateEmail(email);
    if (!userName) {
      return { header: `Invalid email domain for ${email}` };
    }

    logger.info(`Fetch data for ${email}`);

    const entries = await tracker.getTimeEntriesForEmail(userName, validateEmail);
    if (!entries) {
      return { header: `Unable to find time entries for ${email}` };
    }

    const range = analyzer.getPeriodRange(
      entries,
      endDate && new Date(endDate),
      startDate && new Date(startDate),
    );
    logger.info(`Received date range from ${formatDate(range.start)} to ${formatDate(range.end)}`);

    const totalHours = calendar.getTotalWorkHoursSinceDate(range.start, range.end);
    logger.info(`Total working hours from range start ${totalHours}`);

    const result = analyzer.calculateWorkedHours(range.entries, !!calcAll);
    if (result.warnings.length > 0) {
      logger.info(result.warnings);
    } else {
      logger.info('No warnings!');
    }

    const header = `*Your flex hours count: ${round(result.total - totalHours)}*`;
    const messages = [
      `Latest calendar working day: ${formatDate(range.end)}`,
      `Last time you have recorded hours: ${formatDate(new Date(range.entries[range.entries.length - 1].date))}`,
      ...result.warnings,
      `Current month ${result.billablePercentageCurrentMonth}% billable`,
    ];

    logger.info(header);
    logger.info('All done!');

    return { header, messages };
  };

  const getMonthlyEntries = async (users, year, month) => {
    const orderValue = (a, b) => (a < b ? -1 : 1);
    const compare = (a, b) => (a === b ? 0 : orderValue(a, b));
    const sortedUsers = users.sort(
      (a, b) => compare(a.first_name, b.first_name) || compare(a.last_name, b.last_name),
    );
    // Find all users who have tracked hours this year to keep the rows consistent
    const timeEntries = await Promise.all(
      sortedUsers.map(({ id }) => tracker.getTimeEntriesForUserId(id, year)),
    );

    const isRequestedMonthEntry = ({ date }) => {
      const entryDate = new Date(date);
      return entryDate.getFullYear() === year && (entryDate.getMonth() + 1) === month;
    };

    const validEntries = timeEntries.reduce((result, entries, index) => (entries.length > 0
      ? [...result, { user: sortedUsers[index], entries: entries.filter(isRequestedMonthEntry) }]
      : result),
    []);
    return validEntries;
  };

  const generateMonthlyHoursStats = async (entries, year, month) => {
    const workDaysInMonth = calendar.getWorkingDaysForMonth(year, month);
    return [
      { name: 'CALENDAR DAYS', days: workDaysInMonth },
      ...entries.map(userData => analyzer.getHoursStats(userData, workDaysInMonth)),
    ];
  };

  const generateMonthlyBillingStats = async (entries) => {
    const taskRates = await tracker.getTaskAssignments();
    return analyzer.getBillableStats(entries, taskRates);
  };

  const generateReport = async (
    yearArg,
    monthArg,
    email,
    year = parseInt(yearArg, 10),
    month = parseInt(monthArg, 10),
  ) => {
    const userName = validateEmail(email);
    if (!userName) {
      return `Invalid email domain for ${email}`;
    }

    const users = await tracker.getUsers();
    const authorisedUser = users.find(
      user => user.is_admin && validateEmail(user.email) === userName,
    );
    if (!authorisedUser) {
      return `Unable to authorise harvest user ${email}`;
    }

    const validEntries = await getMonthlyEntries(users, year, month);
    const monthlyHoursRows = await generateMonthlyHoursStats(validEntries, year, month);
    const monthlyBillingRows = await generateMonthlyBillingStats(validEntries);

    const fileName = `${year}-${month}-hours-${new Date().getTime()}.xlsx`;
    const filePath = `${tmpdir()}/${fileName}`;
    logger.info(`Writing stats to ${filePath}`);
    excel().writeSheet(
      filePath,
      [{
        rows: monthlyHoursRows,
        title: `${year}-${month}-hours`,
        headers: config.hoursStatsColumnHeaders,
        columns: [{ index: 0, width: 20 }, { index: 5, width: 20 }],
      },
      {
        rows: monthlyBillingRows,
        title: `${year}-${month}-billable`,
        headers: config.billableStatsColumnHeaders,
        columns: [{ index: 0, width: 20 }, { index: 1, width: 20 }, { index: 3, width: 20 }],
      }],
    );
    await emailer(config).sendExcelFile(authorisedUser.email, 'Monthly harvest stats', `${year}-${month}`, filePath, fileName);
    unlinkSync(filePath);
    return `Stats sent to email ${authorisedUser.email}.`;
  };

  return {
    calcFlextime,
    generateReport,
  };
};
