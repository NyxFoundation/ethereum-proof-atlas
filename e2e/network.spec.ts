import { test, expect } from '@playwright/test';

const networks = [
  ['Beacon Spec', 'Gossipsub topics', 'b-gossipsub', 0, 'Gossipsub topic mesh'],
  ['Lean Spec', 'Gossipsub topics', 'l-gossipsub', 0, 'Gossipsub topic mesh'],
  ['Execution Spec', 'ETH wire protocol', 'x-eth', 0, 'chain synchronization'],
] as const;

for (const width of [1280, 390, 320]) {
  for (const [tab, name, instance, count, protocol] of networks) {
    test(`should expose ${name} in its own row and map when ${tab} opens at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.getByRole('tab', { name: tab, exact: true }).click();
      const table = page.getByRole('table');
      const row = table.getByRole('row').filter({
        has: page.getByRole('rowheader', { name: 'Network', exact: true }),
      });
      await expect(row).toHaveCount(1);
      await expect(row.getByRole('button')).not.toHaveCount(0);
      const cell = row.getByRole('button', {
        name: `${name}: ${count ? `Claims: ${count}` : 'No catalogued claims'}`, exact: true,
      });
      await expect(cell).toBeVisible();
      await cell.focus();
      await page.keyboard.press('Enter');
      const panel = page.getByRole('complementary', { name: 'Details panel' });
      await expect(panel.getByRole('heading', { name, exact: true })).toBeVisible();
      await expect(panel.locator('p').filter({ hasText: protocol }).first()).toBeVisible();
      await expect(panel.getByRole('heading', { name: count ? `Claims: ${count}` : '0 claims', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      await page.getByRole('button', { name: 'Map', exact: true }).click();
      const node = page.locator(`.react-flow__node[data-id="${instance}"]`);
      await expect(node.getByRole('button', { name: `Select ${name}`, exact: true })).toBeVisible();
      await expect(node.locator('.node-count')).toHaveText(count ? `Claims: ${count}` : '0 claims');
      await expect(panel.getByRole('heading', { name, exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Index', exact: true }).click();
      await expect(cell).toHaveAttribute('aria-pressed', 'true');
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    });
  }
}
