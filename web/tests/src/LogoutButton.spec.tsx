import { expect, test } from '@playwright/experimental-ct-react';
import { MemoryRouter } from 'react-router';
import { LogoutButton } from '../../../web/src/components/buttons/LogoutButton';

test('logout clears browser credentials', async ({ mount, page }) => {
  await page.evaluate(() => {
    localStorage.setItem('access_token', 'access-token');
    localStorage.setItem('refresh_token', 'refresh-token');
    localStorage.setItem('expired_at', '2099-01-01');
  });

  const component = await mount(
    <MemoryRouter>
      <LogoutButton />
    </MemoryRouter>
  );
  await component.click();

  await expect
    .poll(async () =>
      page.evaluate(() => [
        localStorage.getItem('access_token'),
        localStorage.getItem('refresh_token'),
        localStorage.getItem('expired_at'),
      ])
    )
    .toEqual([null, null, null]);
});
