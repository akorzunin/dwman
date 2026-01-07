import { expect, test, vi } from 'vitest';
import dayjs from 'dayjs';
import {
  getTimeData,
  getWeekNumber,
} from '../../../src/frontend/src/utils/timeMangment';

test('getWeekNumber', async () => {
  const currentDate = dayjs('1970-01-01');
  const [fullYear, weekNumber] = getWeekNumber(currentDate.toDate());
  expect(weekNumber).toBe(1);
  expect(fullYear).toBe(1970);
});

test('timeData', async () => {
  vi.setSystemTime(new Date(1970, 0, 1));

  const td = getTimeData();
  expect(td.fullYear).toBe(1970);
  expect(td.weekNumber).toBe(1);
  expect(td.currentTime).toBe(dayjs().toISOString());
});
