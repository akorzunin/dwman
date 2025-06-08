import { expect, test } from "vitest";
import dayjs from "dayjs";
import { vi } from "vitest";

import { generatePlData } from "../../../src/frontend/src/utils/apiManager";
import {
  getTimeData,
  getWeekNumber,
  TimeData,
} from "../../../src/frontend/src/utils/timeMangment";

const testWithTime = test.extend({
  testTime: async ({}, use) => {
    use(dayjs("1970-01-01"));
  },
  testTimeData: async ({}, use) => {
    use(getTimeData(dayjs("1970-01-01").toDate()));
  },
  mockDate: async ({}, use) => {
    vi.useFakeTimers();
    vi.setSystemTime(dayjs("1970-01-01").toDate());
    await use(dayjs("1970-01-01").toDate());
    vi.useRealTimers();
  },
});

interface TestTime {
  testTime: dayjs.Dayjs;
  testTimeData: TimeData;
  mockDate: Date;
}

testWithTime("generatePlData default", async ({ testTimeData }: TestTime) => {
  const plData = await generatePlData(undefined, undefined, testTimeData);
  expect(plData.name).toBeDefined();
  expect(plData.description).toBeDefined();
});

testWithTime("generatePlData custom", async ({ mockDate }: TestTime) => {
  const plData = await generatePlData(
    "test_{year}_{week}",
    "test description {created}",
  );

  expect(plData.name).toBe("test_1970_1");
  expect(plData.description).toBe("test description 1970-01-01 00:00:00");
});

testWithTime("generatePlData empty", async ({ mockDate }: TestTime) => {
  const plData = await generatePlData("", "");

  expect(plData.name).toBe("1970_1");
  expect(plData.description).toBe(
    "Created at: 1969-12-31T21:00:00.000Z. This playlist was created by dwman (https://github.com/akorzunin/dwman)",
  );
});

testWithTime(
  "generatePlData template items",
  async ({ mockDate }: TestTime) => {
    const plData = await generatePlData(
      "",
      `{year}
{month}
{week}
{day}
{created}
{<3}
{kaomoji}
{songs_num}
{repo_url}
`,
      undefined,
      {
        songs: [
          {
            name: "test",
            artists: ["test"],
            uri: "test",
            imgUrl: "test",
          },
        ],
        kaomoji: "ಠ_ಠ",
      },
    );

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
`,
    );
  },
);
