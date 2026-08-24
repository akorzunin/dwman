import dayjs from 'dayjs';
import { expect, test } from 'vitest';

import {
  parseFormTime,
  parseUserSaveTime,
  parseUserWeekDay,
} from '../../../web/src/utils/dbManager';

test('parseFormTime', () => {
  const testTime = '16:23';
  const testDay = { name: 'Fr', index: 5 } as const;
  const time = parseFormTime(testTime, testDay.name);
  expect(time).toBe(
    dayjs(`1973-01-0${testDay.index}T${testTime}`).toISOString()
  );
});

test('parseFormTime weekend', () => {
  const testTime = '00:00';
  const testDay = { name: 'Su', index: 7 } as const;
  const time = parseFormTime(testTime, testDay.name);
  expect(time).toBe(
    dayjs(`1973-01-0${testDay.index}T${testTime}`).toISOString()
  );
});

test('parseUserSaveTime empty', () => {
  const testTime = dayjs('1970-01-01').format();
  const time = parseUserSaveTime(testTime);
  expect(time).toBe('00:00');
});

test('parseUserSaveTime', () => {
  const testTime = dayjs('1970-01-01T16:04').format();
  const time = parseUserSaveTime(testTime);
  expect(time).toBe('16:04');
});

test('parseUserWeekDay invalid', () => {
  const testTime = dayjs('').format();
  console.log(testTime);
  const time = parseUserWeekDay(testTime);
  expect(time).toBe(false);
});

test('parseUserWeekDay monday', () => {
  const testTime = dayjs('1970-01-01').format();
  console.log(testTime);
  const time = parseUserWeekDay(testTime);
  expect(time).toBe('Th');
});
