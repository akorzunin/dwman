import dayjs from 'dayjs';
import { expect, test, vi } from 'vitest';

import { generatePlData } from '../../../web/src/utils/apiManager';
import { getTimeData, TimeData } from '../../../web/src/utils/timeMangment';

const testWithTime = test.extend({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture API requires an object parameter.
  testTime: async ({}, use) => {
    use(dayjs('1970-01-01'));
  },
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture API requires an object parameter.
  testTimeData: async ({}, use) => {
    use(getTimeData(dayjs('1970-01-01').toDate()));
  },
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture API requires an object parameter.
  mockDate: async ({}, use) => {
    vi.stubEnv('TZ', 'UTC');
    vi.useFakeTimers();
    vi.setSystemTime(dayjs('1970-01-01').toDate());
    await use(dayjs('1970-01-01').toDate());
    vi.useRealTimers();
  },
});

interface TestTime {
  testTime: dayjs.Dayjs;
  testTimeData: TimeData;
  mockDate: Date;
}

testWithTime('generatePlData default', async ({ testTimeData }: TestTime) => {
  const plData = await generatePlData({ date: testTimeData });
  expect(plData.name).toBeDefined();
  expect(plData.description).toBeDefined();
});

testWithTime(
  'generatePlData custom',
  async ({ mockDate: _mockDate }: TestTime) => {
    const plData = await generatePlData({
      name: 'test_{year}_{week}',
      description: 'test description {created}',
    });

    expect(plData.name).toBe('test_1970_1');
    expect(plData.description).toBe('test description 1970-01-01 00:00:00');
  }
);

testWithTime(
  'generatePlData empty',
  async ({ mockDate: _mockDate }: TestTime) => {
    const plData = await generatePlData({});

    expect(plData.name).toBe('1970_1');
    expect(plData.description).toBe(
      'Created at: 1970-01-01T00:00:00.000Z. This playlist was created by dwman (https://github.com/akorzunin/dwman)'
    );
  }
);

testWithTime(
  'generatePlData template items',
  async ({ mockDate: _mockDate }: TestTime) => {
    const plData = await generatePlData({
      description: `{year}
{month}
{week}
{day}
{created}
{<3}
{kaomoji}
{songs_num}
{repo_url}
`,

      songs: [
        {
          name: 'test',
          artists: ['test'],
          uri: 'test',
          imgUrl: 'test',
        },
      ],
      kaomoji: 'ಠ_ಠ',
    });

    expect(plData.description).toBe(
      `1970
1
1
1
1970-01-01 00:00:00
❤️
ಠ_ಠ
1
https://github.com/akorzunin/dwman
`
    );
  }
);
