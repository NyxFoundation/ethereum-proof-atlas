import { test, expect } from '@playwright/test';
import { request as httpRequest } from 'node:http';

for (const width of [1280, 390, 320]) {
  test(`should keep the introduction compact and the map in view at ${width}px`, async ({ page }) => {
    await page.setViewportSize({width, height: 844});
    await page.goto('/');
    const header = page.getByRole('banner');
    await expect(header.getByRole('heading', {level: 1, name: 'Ethereum Proof Atlas'})).toBeVisible();
    const description = header.getByText('Formal verification across Ethereum.');
    await expect(description).toBeVisible();
    expect(await description.evaluate(element => element.getBoundingClientRect().height <=
      Number.parseFloat(getComputedStyle(element).lineHeight) + 1)).toBe(true);
    expect((await header.boundingBox())!.height).toBeLessThanOrEqual(104);
    expect((await page.getByRole('tablist').boundingBox())!.y).toBeLessThanOrEqual(112);
    await expect(page.getByRole('button', {name: 'Select State transition', exact: true})).toBeVisible();
    await expect(page.locator('.map')).toBeInViewport({ratio: 0.5});
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

test('should navigate independently sourced views and evidence in the Workers runtime', async ({ page }) => {
  const foreignRequests: string[] = [];
  const errors: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173/')) foreignRequests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto('/');
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(response?.headers()['referrer-policy']).toBe('no-referrer');
  await expect(page.getByText('Fulu / Osaka (Fusaka; BPO2)', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select BLS signatures', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Select State transition', exact: true }).click();
  const panel = page.getByRole('complementary', { name: 'Details panel' });
  await expect(panel.getByText('Formal model · Related model')).toBeVisible();
  await panel.getByRole('button', { name: 'Conflicting finality implies a slashed quorum intersection' }).click();
  await expect(panel.getByText('Not performed', { exact: true })).toBeVisible();
  await expect(panel.getByText(/Available when last checked/)).toBeVisible();
  await expect(panel.getByText(/does not assert that the shared set is nonempty/)).toBeVisible();
  const theorem = panel.getByRole('link', { name: 'GasperBeaconChain.Core.accountable_safety' });
  await expect(theorem).toHaveAttribute('href', /7650709170327c5f10c8b5da99b10941e208ef5d/);
  await expect(theorem).toHaveAttribute('rel', 'noopener noreferrer');
  await page.getByRole('tab', { name: 'Lean Spec' }).click();
  await expect(page.getByText('Lstar (experimental)', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select BLS signatures', exact: true })).toHaveCount(0);
  await expect(panel.getByText('Conflicting finality implies a slashed quorum intersection')).toHaveCount(0);
  await page.getByRole('button', { name: 'Select State transition', exact: true }).click();
  await panel.getByRole('button', { name: 'Post-genesis checkpoints stay unchanged or move strictly forward' }).click();
  await expect(panel.getByText(/genesis anchoring is excluded/)).toBeVisible();
  await expect(panel.getByRole('link', { name: 'State.checkpoint_forward' })).toHaveAttribute('href', /ba7284513031eac5c66bfb8221d27b6154cf240b/);
  await page.getByRole('button', { name: 'Select XMSS signatures', exact: true }).click();
  await expect(panel.getByRole('heading', { name: '0 claims' })).toBeVisible();
  expect(foreignRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('should expand and pan with keyboard without permitting graph mutation', async ({ page }) => {
  await page.goto('/');
  const node = page.locator('.react-flow__node[data-id="b-state"]');
  await expect(node).toBeVisible();
  const position = await node.evaluate(element => (element as HTMLElement).style.transform);
  const storedNodes = await page.locator('.react-flow__node').count();
  const storedEdges = await page.locator('.react-flow__edge').count();
  expect(await page.locator('.react-flow__edgeupdater, .react-flow__handle.connectable').count()).toBe(0);
  await page.getByRole('button', { name: 'Expand State transition', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Select Justification / finalization', exact: true })).toBeVisible();
  await node.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Backspace');
  await expect.poll(() => node.evaluate(element => (element as HTMLElement).style.transform)).toBe(position);
  const box = await node.boundingBox();
  await page.mouse.move(box!.x + 20, box!.y + 15);
  await page.mouse.down(); await page.mouse.move(box!.x + 160, box!.y + 90); await page.mouse.up();
  await expect.poll(() => node.evaluate(element => (element as HTMLElement).style.transform)).toBe(position);
  expect(await page.locator('.react-flow__node').count()).toBe(storedNodes + 1);
  expect(await page.locator('.react-flow__edge').count()).toBe(storedEdges + 1);
  const viewport = page.locator('.react-flow__viewport');
  const transform = await viewport.getAttribute('style');
  await page.getByRole('button', { name: 'Pan right', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(viewport).not.toHaveAttribute('style', transform!);
  const panned = await viewport.getAttribute('style');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(viewport).not.toHaveAttribute('style', panned!);
  await page.getByRole('button', { name: 'Fit map', exact: true }).click();
  await page.getByRole('combobox', {name: 'Component'}).selectOption('b-solc');
  await page.getByRole('button', {name: 'EVM bytecode · generated-code', exact: true}).click();
  await expect(page.getByRole('complementary').getByText(/Execution does not invoke the compiler/)).toBeVisible();
  await page.getByRole('tab', { name: 'Beacon Spec' }).focus();
  await page.keyboard.press('Home');
  await expect(node).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Lstar (experimental)', {exact: true})).toBeVisible();
});

test('should keep graph-to-evidence navigation usable on narrow screens', async ({ page }) => {
  await page.setViewportSize({width: 390,height: 844});
  await page.goto('/');
  await page.getByRole('combobox', {name: 'Component'}).selectOption('b-finality');
  await page.getByRole('button', {name: 'Conflicting finality implies a slashed quorum intersection'}).click();
  await expect(page.getByRole('article', {name: 'Claim details'})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('should fail explicitly when an open browser encounters a newer schema', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Select State transition', exact: true })).toBeVisible();
  await page.route('**/api/atlas?view=lean', route => route.fulfill({json: {schemaVersion: 2}}));
  await page.getByRole('tab', {name: 'Lean Spec'}).click();
  await expect(page.getByRole('alert')).toContainText('Unsupported atlas schema version');
  await expect(page.locator('.react-flow')).toHaveCount(0);
});

test('should enforce the production CSP while normal diagram styles work', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).violations = [];
    document.addEventListener('securitypolicyviolation', event => (window as any).violations.push(event.violatedDirective));
  });
  await page.goto('/');
  await expect(page.getByRole('button', {name: 'Select State transition', exact: true})).toBeVisible();
  expect(await page.evaluate(() => (window as any).violations)).toEqual([]);
  await page.evaluate(async () => {
    const script = document.createElement('script');
    script.textContent = 'window.inlineScriptRan = true'; document.body.append(script);
    const style = document.createElement('style'); style.textContent = 'body { display: none; }'; document.head.append(style);
    const object = document.createElement('object'); object.data = '/'; object.type = 'text/html'; document.body.append(object);
    try { await fetch('https://example.com/data'); } catch { /* Expected CSP rejection. */ }
  });
  await expect.poll(() => page.evaluate(() => (window as any).violations)).toEqual(expect.arrayContaining(['script-src-elem', 'style-src-elem', 'connect-src', 'object-src']));
  expect(await page.evaluate(() => (window as any).inlineScriptRan)).toBeUndefined();
  await expect(page.getByRole('button', {name: 'Select State transition', exact: true})).toBeVisible();
  await page.route('**/frame-test', route => route.fulfill({contentType: 'text/html', body: '<iframe src="/"></iframe>'}));
  await page.goto('/frame-test');
  await expect.poll(() => page.frames().filter(frame => frame.url().includes('chrome-error')).length).toBeGreaterThan(0);
});

test('should reject invalid methods, selectors and bodies on the actual Worker', async ({ request }) => {
  for (const [url, status] of [
    ['/api/atlas?view=lean&view=beacon', 400], ['/api/atlas?view=missing', 404],
    ['/api/atlas?view=beacon&claim=checkpoint-forward', 404], ['/api/atlas?' + 'a'.repeat(2049), 414],
  ] as const) expect((await request.get(url)).status()).toBe(status);
  for (const path of ['/api/atlas', '/', '/assets/unknown.js']) {
    const response = await request.post(path, {data: 'not a query'});
    expect(response.status()).toBe(405);
    expect(response.headers().allow).toBe('GET, HEAD');
  }
  const bodyStatus = await new Promise<number>(resolve => {
    const req = httpRequest('http://127.0.0.1:4173/api/atlas', {method: 'GET', headers: {'content-length': '4'}}, res => {
      res.resume(); resolve(res.statusCode!);
    });
    req.end('data');
  });
  expect(bodyStatus).toBe(400);
  const head = await request.head('/api/atlas');
  expect(head.status()).toBe(200);
  expect(await head.text()).toBe('');
  expect(head.headers()['access-control-allow-origin']).toBeUndefined();
});

test('should retain stored source details when external navigation is unavailable', async ({ page, context }) => {
  await context.route('https://github.com/**', route => route.abort());
  await page.goto('/');
  await page.getByRole('combobox', {name: 'Component'}).selectOption('b-state');
  await page.getByRole('button', { name: 'Conflicting finality implies a slashed quorum intersection' }).click();
  const popup = context.waitForEvent('page');
  await page.getByRole('link', {name: 'GasperBeaconChain.Core.accountable_safety'}).click();
  const external = await popup; await external.close();
  await expect(page.getByRole('article', {name: 'Claim details'})).toBeVisible();
  await expect(page.getByText(/Available when last checked/)).toBeVisible();
  await expect(page.getByText('Not performed', {exact: true})).toBeVisible();
});
