import { test, expect } from '@playwright/experimental-ct-react';
import { EasterEgg } from '../../../src/frontend/src/components/EasterEgg';
import React from 'react';
test.use({ viewport: { width: 500, height: 500 } });

test('EasterEgg', async ({ mount }) => {
  const component = await mount(<EasterEgg />);
  await expect(component).toHaveCount(1);
});
