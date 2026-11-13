import { test, expect, type Page } from '@playwright/test';

const cases = [
  { tab: 'Beacon Spec', components: [
    { id: 'b-bls-hash-to-g2', name: 'BLS hash-to-G2', claims: ['BLS hash-to-G2 succeeds with a nonsingular curve point'] },
    { id: 'b-kzg', name: 'KZG commitments', claims: [
      'Honestly generated KZG openings satisfy the pairing equation', 'KZG evaluation-binding advantage reduces to t-SDH'] },
    { id: 'b-bls', name: 'BLS signatures', claims: [] },
  ] },
  { tab: 'Lean Spec', components: [
    { id: 'l-poseidon', name: 'Poseidon hashing', claims: [] },
    { id: 'l-xmss-merkle', name: 'XMSS Merkle authentication', claims: [] },
    { id: 'l-xmss-chains', name: 'XMSS hash chains', claims: [] },
    { id: 'l-xmss', name: 'XMSS signatures', claims: ['Generated leanXMSS keys verify successfully produced signatures'] },
    { id: 'l-signatures', name: 'Signature aggregation', claims: [] },
  ] },
] as const;
type Component = typeof cases[number]['components'][number];

async function expectClaimScope(page: Page, component: Component) {
  const panel = page.getByRole('complementary', { name: 'Details panel' });
  await expect(panel.getByRole('heading', { name: component.name, exact: true })).toBeVisible();
  await expect(panel.getByRole('heading', {
    name: component.claims.length ? `Claims: ${component.claims.length}` : '0 claims', exact: true,
  })).toBeVisible();
  await expect(panel.locator('.claim-list > li > button')).toHaveText([...component.claims]);
  if (!component.claims.length) await expect(panel.getByText('No records in this view. This does not mean unproved or unsafe.')).toBeVisible();
}

async function expectNonOverlappingNode(page: Page, id: string) {
  const overlaps = await page.locator('.react-flow__node').evaluateAll((nodes, selectedId) => {
    const selected = nodes.find(node => node.getAttribute('data-id') === selectedId)!;
    const bounds = selected.getBoundingClientRect();
    return nodes.filter(node => node !== selected).filter(node => {
      const other = node.getBoundingClientRect();
      return bounds.left < other.right && bounds.right > other.left
        && bounds.top < other.bottom && bounds.bottom > other.top;
    }).map(node => node.getAttribute('data-id'));
  }, id);
  expect(overlaps).toEqual([]);
}

for (const width of [1280, 390, 320]) {
  for (const { tab, components } of cases) {
    test(`should expose distinct cryptographic functions when ${tab} opens at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.getByRole('tab', { name: tab, exact: true }).click();
      const row = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Cryptography', exact: true }) });
      await expect(row.getByRole('button')).toHaveCount(components.length);
      for (const component of components) {
        const count = component.claims.length;
        const cell = row.getByRole('button', {
          name: `${component.name}: ${count ? `Claims: ${count}` : 'No catalogued claims'}`, exact: true,
        });
        await cell.focus();
        await page.keyboard.press('Enter');
        await expectClaimScope(page, component);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        await page.getByRole('button', { name: 'Map', exact: true }).click();
        const node = page.locator(`.react-flow__node[data-id="${component.id}"]`);
        await expect(node).toHaveClass(/selected/);
        await expect(node.locator('.node-count')).toHaveText(count ? `Claims: ${count}` : '0 claims');
        await expectNonOverlappingNode(page, component.id);
        await node.getByRole('button', { name: `Select ${component.name}`, exact: true }).click();
        await expectClaimScope(page, component);
        await page.getByRole('button', { name: 'Index', exact: true }).click();
        await expect(cell).toHaveAttribute('aria-pressed', 'true');
      }
      await page.getByRole('tab', { name: 'Execution Spec', exact: true }).click();
      await expect(page.getByRole('rowheader', { name: 'Cryptography', exact: true })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Select a component', exact: true })).toBeVisible();
    });
  }
}
