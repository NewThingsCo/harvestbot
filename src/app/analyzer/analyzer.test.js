import analyzer from './index';

describe('Analyzer', () => {
  const mockDates = [
    { date: '2017-12-07' },
    { date: '2017-06-07' },
    { date: '2017-12-05' },
    { date: '2018-07-20' },
    { date: '2018-05-09' },
  ];
  const mockEntry = {
    date: '2018-08-20',
    hours: 7.5,
    billable: true,
    projectId: 'projectId',
    projectName: 'projectName',
    taskId: 'taskId',
    taskName: 'taskName',
  };

  const mockEntries = [
    mockEntry,
    {
      ...mockEntry,
      date: '2018-08-27',
      billable: false,
      taskId: 'flexLeaveTaskId',
    },
    {
      ...mockEntry,
      date: '2017-12-24',
    },
  ];

  const mockTask = {
    user: { first_name: 'first', last_name: 'last' },
    entries: mockEntries,
  };

  const mockConfig = {
    taskIds: {
      publicHoliday: '',
      vacation: '',
      unpaidLeave: '',
      sickLeave: '',
      flexLeave: 'flexLeaveTaskId',
    },
  };


  const {
    calculateWorkedHours,
    getPeriodRange,
    getHoursStats,
    getBillableStats,
  } = analyzer(mockConfig);

  describe('getPeriodRange', () => {
    it('should get start and end dates', () => expect(getPeriodRange(mockDates, new Date('2018-07-20')))
      .toEqual({
        start: new Date('2017-06-07'),
        end: new Date('2018-07-20'),
        entries: [
          { date: '2017-06-07' },
          { date: '2017-12-05' },
          { date: '2017-12-07' },
          { date: '2018-05-09' },
          { date: '2018-07-20' },
        ],
      }));
    it('should allow for custom startDate', () => expect(
      getPeriodRange(mockDates, new Date('2018-07-20'), new Date('2017-12-06')),
    )
      .toEqual({
        start: new Date('2017-12-06'),
        end: new Date('2018-07-20'),
        entries: [
          { date: '2017-12-07' },
          { date: '2018-05-09' },
          { date: '2018-07-20' },
        ],
      }));
  });
  describe('calculateWorkedHours', () => {
    it('should calculate worked hours', () => expect(calculateWorkedHours(mockEntries))
      .toEqual({
        billablePercentageCurrentMonth: 0,
        total: 7.5,
        warnings: ['Recorded hours in non-working day (2017-12-24) - ignoring!'],
      }));
    it('should calculate all worked hours when calcAll true',
      () => expect(calculateWorkedHours(mockEntries, true))
        .toEqual({
          billablePercentageCurrentMonth: 0,
          total: 15,
          warnings: ['Recorded hours in non-working day (2017-12-24)!'],
        }));
  });
  describe('getHoursStats', () => {
    it('should get hours stats', () => expect(getHoursStats(mockTask, 1))
      .toEqual({
        absentDays: 1,
        billableHours: 7.5,
        billablePercentage: 100,
        days: 2,
        flexLeaveDays: 1,
        flexSaldo: -7.5,
        hours: 7.5,
        hoursPerCalendar: 15,
        name: 'first last',
        markedDays: 2,
        missingDays: 1,
        projectName: 'projectName',
        sickDays: 0,
        unpaidLeaveDays: 0,
        vacationDays: 0,
      }));
  });
  describe('getBillableStats', () => {
    it('should get billable stats', () => expect(
      getBillableStats(
        [mockTask],
        [{
          hourly_rate: 10,
          project: { id: 'projectId' },
          task: { id: 'taskId' },
        }],
      ),
    ).toEqual([
      {
        hours: 7.5, name: '', projectName: 'projectName', taskName: '', taskRate: '', total: 75,
      },
      {
        taskName: 'taskName', hours: 7.5, taskRate: 10, total: 75,
      },
      {
        hours: 7.5, name: 'first last', total: 75,
      },
      {
        total: undefined,
      },
      {
        hours: 7.5,
        total: 75,
        billableAvg: 10,
      },
    ]));
  });
});
