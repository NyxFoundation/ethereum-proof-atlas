import { test, expect } from '@playwright/test';

const cases = [
  ['Beacon Spec', 'b-p2p', 'Consensus Gossipsub', 1,
    'Varint encoding round-trips and accepted prefixes are canonical',
    'Varint.decodeEncodeSuffix', 'etheorem/leanp2p', '63-bit'],
  ['Lean Spec', 'l-p2p', 'Consensus Gossipsub', 1,
    'Varint encoding round-trips and accepted prefixes are canonical',
    'Varint.encodeDecode', 'etheorem/leanp2p', '64-bit'],
  ['Beacon Spec', 'b-state', 'State transition', 2,
    'Conflicting k-finality yields a churn-adjusted intersection bound',
    'GasperBeaconChain.Core.slashable_bound', 'NyxFoundation/gasper-lean4', 'lower bound can be zero'],
  ['Lean Spec', 'l-head', 'Fork choice', 1,
    'Equivalent vote tallies select the same LMD-GHOST head',
    'Store.computeLmdGhostHead_incremental', 'NyxFoundation/formal-leanSpec', 'pointwise equal'],
  ['Beacon Spec', 'b-kzg', 'KZG commitments', 3,
    'KZG evaluation-binding advantage reduces to t-SDH',
    'KZG.CommitmentScheme.binding_reduces_to_tSdh', 'Verified-zkEVM/ArkLib', 'does not prove t-SDH hardness'],
  ['Beacon Spec', 'b-bls', 'BLS signatures', 1,
    'BLS hash-to-G2 succeeds with a nonsingular curve point',
    'HashToCurve.hashToG2_total', 'ethereum/EthLib', 'not prime-order subgroup membership'],
  ['Lean Spec', 'l-xmss', 'XMSS signatures', 1,
    'Generated leanXMSS keys verify successfully produced signatures',
    'Xmss.verify_keyGen_sign', 'ethereum/EthLib', 'Keccak-256'],
  ['Beacon Spec', 'b-da', 'PeerDAS', 1,
    'Encoding and decoding a KZG cell preserves its field elements',
    'Kzg.cellToCosetEvals_cosetEvalsToCell', 'ethereum/EthLib', 'cell serialization theorem'],
  ['Execution Spec', 'x-evm', 'EVM', 1,
    'MODEXP computation returns modular exponentiation',
    'Modexp.compute_eq_pow_mod', 'ethereum/EthLib', 'not the entire precompile call'],
] as const;

for (const [tab, instance, component, count, title, theorem, repository, limitation] of cases) {
  test(`should expose ${theorem} through the ${tab} index and map`, async ({ page }) => {
    const foreignRequests: string[] = [];
    page.on('request', request => {
      if (!request.url().startsWith('http://127.0.0.1:4173/')) foreignRequests.push(request.url());
    });
    await page.goto('/');
    await page.getByRole('tab', { name: tab, exact: true }).click();
    await page.getByRole('table').getByRole('button', { name: `${component}: Claims: ${count}`, exact: true }).click();
    const panel = page.getByRole('complementary', { name: 'Details panel' });
    await expect(panel.getByRole('heading', { name: `Claims: ${count}`, exact: true })).toBeVisible();
    await panel.getByRole('button', { name: title, exact: true }).click();
    const article = panel.getByRole('article', { name: 'Claim details' });
    await expect(article.getByRole('button', { name: 'Related', exact: true })).toBeVisible();
    await expect(article.getByRole('button', { name: 'No replay', exact: true }).first()).toBeVisible();
    await expect(article.getByRole('button', { name: 'Reviewed', exact: true }).first()).toBeVisible();
    await expect(article.getByText(limitation, { exact: false }).first()).toBeVisible();
    const source = article.getByRole('link', { name: theorem, exact: true });
    expect(await source.getAttribute('href')).toMatch(
      new RegExp(`^https://github\\.com/${repository}/blob/[a-f0-9]{40}/.+#L\\d+-L\\d+$`));
    await expect(source).toHaveAttribute('rel', 'noopener noreferrer');
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await expect(article.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.locator(`.react-flow__node[data-id="${instance}"] .node-count`)).toHaveText(`Claims: ${count}`);
    await panel.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: `Select ${component}`, exact: true }).click();
    await panel.getByRole('button', { name: title, exact: true }).click();
    await expect(source).toBeVisible();
    expect(foreignRequests).toEqual([]);
  });
}

test('should keep related networking claims out of execution and retain narrow-screen usability', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Consensus Gossipsub: Claims: 1', exact: true }).click();
  await page.getByRole('button', { name: cases[0][4], exact: true }).click();
  const article = page.getByRole('article', { name: 'Claim details' });
  await expect(article.getByRole('link', { name: 'Varint.encodeDecode', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole('tab', { name: 'Execution Spec', exact: true }).click();
  await page.getByRole('button', { name: 'Execution ETH / RLPx: No catalogued claims', exact: true }).click();
  await expect(page.getByRole('heading', { name: '0 claims', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: cases[0][4], exact: true })).toHaveCount(0);
});
