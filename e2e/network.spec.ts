import { test, expect } from '@playwright/test';

const networks = [
  ['Beacon Spec', 'Consensus Network', 'b-p2p', 1, 'Gossipsub gossip and Req/Resp'],
  ['Lean Spec', 'Consensus Network', 'l-p2p', 1, 'Gossipsub gossip and Req/Resp'],
  ['Execution Spec', 'Execution Network', 'x-elp2p', 0, 'ETH/RLPx'],
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
      await expect(row.getByRole('button')).toHaveCount(1);
      const cell = row.getByRole('button', {
        name: `${name}: ${count ? `Claims: ${count}` : 'No catalogued claims'}`, exact: true,
      });
      await expect(cell).toBeVisible();
      await cell.focus();
      await page.keyboard.press('Enter');
      const panel = page.getByRole('complementary', { name: 'Details panel' });
      await expect(panel.getByRole('heading', { name, exact: true })).toBeVisible();
      await expect(panel.getByText(protocol, { exact: false })).toBeVisible();
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
