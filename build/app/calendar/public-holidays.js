'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
const publicHolidays = ['2017-01-01', '2017-01-06', '2017-04-14', '2017-04-16', '2017-04-17', '2017-05-01', '2017-05-14', '2017-05-25', '2017-06-04', '2017-06-23', '2017-06-24', '2017-11-04', '2017-11-12', '2017-12-06', '2017-12-24', '2017-12-25', '2017-12-26', '2018-01-01', '2018-01-06', '2018-03-30', '2018-04-01', '2018-04-02', '2018-05-01', '2018-05-10', '2018-05-13', '2018-05-20', '2018-06-22', '2018-06-23', '2018-11-03', '2018-11-11', '2018-12-06', '2018-12-24', '2018-12-25', '2018-12-26'];

exports.default = publicHolidays.map(date => new Date(date));