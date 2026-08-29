import dayjs from 'dayjs';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { generatePlData, saveUserPl } from '../../../web/src/utils/apiManager';
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

const storage = new Map<string, string>();

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    clear: () => storage.clear(),
    getItem: (key: string) => storage.get(key) ?? null,
    removeItem: (key: string) => storage.delete(key),
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});

afterEach(() => {
  storage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

test('saveUserPl uses current Spotify playlist endpoints', async () => {
  localStorage.setItem('access_token', 'token');
  localStorage.setItem('expired_at', dayjs().add(1, 'hour').toISOString());
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'playlist-id' }), { status: 201 })
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ snapshot_id: 'snapshot-id' }), {
        status: 201,
      })
    );
  vi.stubGlobal('fetch', fetchMock);

  const [data, error] = await saveUserPl({
    songs: [
      {
        name: 'Song',
        artists: ['Artist'],
        imgUrl: '',
        id: 'spotify:track:track-id',
      },
    ],
  });

  expect(error).toBeNull();
  expect(data).toEqual({ snapshot_id: 'snapshot-id' });
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    '/api/spotify/v1/me/playlists',
    '/api/spotify/v1/playlists/playlist-id/items',
  ]);
  expect(fetchMock.mock.calls[1][1]?.body).toBe(
    JSON.stringify({ uris: ['spotify:track:track-id'] })
  );
});

test('saveUserPl handles non-JSON Spotify errors', async () => {
  localStorage.setItem('access_token', 'token');
  localStorage.setItem('expired_at', dayjs().add(1, 'hour').toISOString());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 }))
  );

  const [data, error] = await saveUserPl({ songs: [] });

  expect(data).toBeNull();
  expect(error?.message).toBe('Cant create playlist, status: 404');
});

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
