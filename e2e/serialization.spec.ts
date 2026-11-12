import { test, expect, type Page } from '@playwright/test';

const components = [
  { id: 'ssz-codec', name: 'SSZ encoding / decoding',
    claim: 'An accepted SSZ decode re-encodes to its own input',
    theorem: 'Codec.Canonicality.serialize_of_deserialize' },
  { id: 'ssz-merkleization', name: 'SSZ Merkleization',
    claim: "A constructed SSZ branch rebuilds the value's hash-tree root",
    theorem: 'Codec.ProofCorrectness.buildProof_rebuilds_value_root' },
] as const;

async function openClaim(page: Page, component: typeof components[number]) {
  const panel = page.getByRole('complementary', { name: 'Details panel' });
  await expect(panel.getByRole('heading', { name: component.name, exact: true })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Claims: 1', exact: true })).toBeVisible();
  await expect(panel.locator('.claim-list > li')).toHaveCount(1);
  await panel.getByRole('button', { name: component.claim, exact: true }).click();
  const article = panel.getByRole('article', { name: 'Claim details' });
  await expect(article.getByRole('heading', { name: component.claim, exact: true })).toBeVisible();
  await expect(article.getByRole('button', { name: 'Direct', exact: true })).toBeVisible();
  await expect(article.getByRole('button', { name: 'No replay', exact: true })).toBeVisible();
  const evidence = article.getByRole('region', { name: 'Evidence record', exact: true });
  await expect(evidence.getByRole('link', { name: component.theorem, exact: true })).toHaveAttribute('href',
    /^https:\/\/github\.com\/ethereum\/EthLib\/blob\/[a-f0-9]{40}\/.+#L\d+-L\d+$/);
}

async function expectSeparateNodes(page: Page, instanceId: string) {
  const overlaps = await page.locator('.react-flow__node').evaluateAll((nodes, id) => {
    const selected = nodes.find(node => node.getAttribute('data-id') === id)!;
    const bounds = selected.getBoundingClientRect();
    return nodes.filter(node => node !== selected).filter(node => {
      const other = node.getBoundingClientRect();
      return bounds.left < other.right && bounds.right > other.left
        && bounds.top < other.bottom && bounds.bottom > other.top;
    }).map(node => node.getAttribute('data-id'));
  }, instanceId);
  expect(overlaps).toEqual([]);
}

for (const width of [1280, 390, 320]) {
  for (const [tab, prefix] of [['Beacon Spec', 'b'], ['Lean Spec', 'l']]) {
    test(`should keep SSZ claims separate across index and map when ${tab} opens at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.getByRole('tab', { name: tab, exact: true }).click();
      const row = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Serialization', exact: true }) });
      await expect(row.getByRole('button')).toHaveCount(2);
      for (const component of components) {
        const cell = row.getByRole('button', { name: `${component.name}: Claims: 1`, exact: true });
        await cell.focus();
        await page.keyboard.press('Enter');
        await openClaim(page, component);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        await page.getByRole('button', { name: 'Map', exact: true }).click();
        const instanceId = `${prefix}-${component.id}`;
        const node = page.locator(`.react-flow__node[data-id="${instanceId}"]`);
        await expect(node).toHaveClass(/selected/);
        await expect(node.locator('.node-count')).toHaveText('Claims: 1');
        await expectSeparateNodes(page, instanceId);
        await expect(page.getByRole('article').getByRole('heading', { name: component.claim, exact: true })).toBeVisible();
        await node.getByRole('button', { name: `Select ${component.name}`, exact: true }).click();
        await openClaim(page, component);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        await page.getByRole('button', { name: 'Index', exact: true }).click();
        await expect(cell).toHaveAttribute('aria-pressed', 'true');
      }
      await page.getByRole('tab', { name: 'Execution Spec', exact: true }).click();
      await expect(page.getByRole('rowheader', { name: 'Serialization', exact: true })).toHaveCount(0);
      await expect(page.getByRole('article', { name: 'Claim details' })).toHaveCount(0);
    });
  }
}
