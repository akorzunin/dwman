import { expect, test } from '@playwright/experimental-ct-react';
import { EasterEgg } from '../../../web/src/components/EasterEgg';

test.use({ viewport: { width: 500, height: 500 } });

test('EasterEgg', async ({ mount }) => {
  const component = await mount(<EasterEgg />);
  await expect(component).toHaveCount(1);
});
