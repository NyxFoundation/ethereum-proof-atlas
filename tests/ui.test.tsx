// @vitest-environment jsdom
import { useState } from 'react';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import raw from '../data/atlas.json';
import { validateStructure } from '../src/domain/validate';
import { ClaimDetails, Details } from '../src/ui/Details';
import { Evidence } from '../src/ui/Evidence';
import { Sources } from '../src/ui/Sources';
import { Atlas } from '../src/ui/Atlas';
import { App } from '../src/ui/App';
import { loadAtlas } from '../src/ui/api';
import { ComponentNode, MapControls } from '../src/ui/Graph';

vi.mock('../src/ui/api', () => ({loadAtlas: vi.fn()}));
const bundle = validateStructure(raw);
const view = bundle.architectureViews[0];
const claim = bundle.claims[0];
const binding = view.claimBindings[0];

beforeAll(() => {
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('ResizeObserver', class {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) { this.callback = callback; }
    observe(target: Element) {
      const entry = { target, contentRect: {width: 800, height: 680} } as ResizeObserverEntry;
      queueMicrotask(() => this.callback([entry], this as unknown as ResizeObserver));
    }
    unobserve() {}
    disconnect() {}
  });
  vi.stubGlobal('DOMMatrixReadOnly', class { m22 = 1; });
  Object.defineProperty(SVGElement.prototype, 'getBBox', { value: () => ({x: 0,y: 0,width: 100,height: 20}) });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { get() { return this.classList.contains('react-flow__node') ? 205 : 800; } });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { get() { return this.classList.contains('react-flow__node') ? 110 : 680; } });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('evidence presentation', () => {
  it('should label unrecorded and dated source availability without making live probes', () => {
    const sources = [{artifactId: 'gasper-proof',locationId: 'theorem'}];
    const {rerender} = render(<Sources bundle={bundle} sources={sources} />);
    expect(screen.getByText(/Available when last checked/)).toBeTruthy();
    const fixture = {...bundle,checkRecords: bundle.checkRecords.map(c =>
      c.kind === 'availability' ? {...c,result: 'unavailable' as const} : c)};
    rerender(<Sources bundle={fixture} sources={sources} />);
    expect(screen.getByText(/Unavailable when last checked/)).toBeTruthy();
    rerender(<Sources bundle={bundle} sources={[{artifactId: 'consensus',locationId: 'mainnet'}]} />);
    expect(screen.getByText('Not checked')).toBeTruthy();
  });
  it('should keep subjects, assumptions, limits and checks distinct when a claim opens', () => {
    render(<ClaimDetails bundle={bundle} claim={claim} binding={binding} />);
    expect(screen.getByText('Formal model')).toBeTruthy();
    expect(screen.getAllByText('Not performed').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Unknown \/ not fully reviewed/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Available when last checked/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Structural result only/)).toBeTruthy();
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\//);
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });
  it('should open a claim on short status tokens and keep record detail closed', () => {
    render(<ClaimDetails bundle={bundle} claim={claim} binding={binding} />);
    const article = screen.getByRole('article', {name: 'Claim details'});
    const related = within(article).getByRole('button', {name: 'Related'});
    const describedBy = related.getAttribute('aria-describedby');
    expect(describedBy).toEqual(expect.any(String));
    const phrase = document.getElementById(describedBy ?? '');
    expect(phrase?.textContent).toBe('Related model');
    expect(phrase?.getAttribute('role')).toBe('tooltip');
    for (const token of ['Theorem', 'Unbounded', 'Reviewed', 'No replay', 'Located', 'Unknown'])
      expect(within(article).getByRole('button', {name: token})).toBeTruthy();
    expect(within(article).queryByRole('heading', {name: /direction/})).toBeNull();
    const audit = within(article).getByText('Dependency audit').closest('details');
    expect(audit?.hasAttribute('open')).toBe(false);
    expect(audit?.textContent).toContain('Unknown / not fully reviewed');
    expect(audit?.textContent).toContain('Transitive dependencies and axioms');
    const basis = within(article).getByText('Applicability basis').closest('details');
    expect(basis?.hasAttribute('open')).toBe(false);
    expect(basis?.textContent).toContain('Related model');
    expect(basis?.textContent).toContain('2026-11-06');
    expect(basis?.textContent).toContain('source-level comparison only');
    const record = within(article).getByText('Evidence record').closest('details');
    expect(record?.hasAttribute('open')).toBe(false);
    expect(record?.textContent).toContain('Unbounded theorem statement');
    expect(record?.textContent).toContain('Not performed');
    expect(record?.textContent).toContain('Available when last checked');
    expect(record?.textContent).toContain('Lean 4.31.0');
    expect(record?.textContent).toContain('not proof replay');
    expect(within(article).getByText(/Universally quantified Lean theorem/)).toBeTruthy();
  });
  it('should keep an unknown assumption phrase closed and date a checked binding source', () => {
    const source = binding.sources[0];
    const fixture = {...bundle, checkRecords: [...bundle.checkRecords, {
      id: 'binding-availability', kind: 'availability' as const, artifactId: source.artifactId,
      locationIds: [source.locationId], result: 'available' as const, checkedAt: '2026-11-07T00:00:00Z',
      details: 'Binding source was located.',
    }]};
    render(<ClaimDetails bundle={fixture} claim={{...claim, assumptions: {...claim.assumptions, status: 'unknown'}}} binding={binding} />);
    const status = screen.getByText('Assumption status').closest('details');
    expect(status?.hasAttribute('open')).toBe(false);
    expect(status?.textContent).toContain('Unknown / not fully reviewed');
    const basis = screen.getByText('Applicability basis').closest('details');
    expect(basis?.hasAttribute('open')).toBe(false);
    expect(basis?.textContent).toContain('2026-11-07');
    expect(basis?.textContent).toContain('Binding source was located.');
  });
  it('should distinguish bounded exploration and unsuccessful replay from unbounded theorems', () => {
    const evidence = { ...bundle.evidence[0], method: 'model-checking' as const, scope: {
      kind: 'bounded' as const, bounds: ['At most 4 validators, 8 steps.'], statement: 'Fixture bounded exploration.',
      abstractions: ['No networking.'], configuration: 'Fixture config A',
    }};
    const fixture = { ...bundle, checkRecords: [{
      id: 'test-replay', kind: 'replay' as const, evidenceId: evidence.id, artifactId: evidence.artifactId,
      subjectArtifactIds: claim.subjectArtifactIds, scope: 'Four validators only.', configuration: 'Fixture config A',
      result: 'timeout' as const, checkedAt: '2026-11-06T00:00:00Z', details: 'Time limit reached.',
    }] };
    render(<Evidence bundle={fixture} evidence={evidence} />);
    const record = screen.getByText('Evidence record').closest('details');
    expect(record?.hasAttribute('open')).toBe(false);
    expect(screen.getByRole('button', {name: 'Bounded'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Checking'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Timeout'})).toBeTruthy();
    expect(record?.textContent).toContain('Bounded result');
    expect(record?.textContent).toContain('At most 4 validators, 8 steps.');
    expect(record?.textContent).toContain('Not checked');
    expect(record?.textContent).toContain('Not reviewed');
    expect(record?.textContent).toContain('Replay timeout');
    expect(record?.textContent).toContain('does not establish that the property is false');
    expect(screen.queryByText('Unbounded theorem statement')).toBeNull();
    expect(screen.queryByText(/Attempt result/)).toBeNull();
  });
  it('should name passed, failed and error replays without treating them as a false property', () => {
    const evidence = bundle.evidence[0];
    for (const [result, token, phrase] of [
      ['passed', 'Replayed', 'Replay passed'],
      ['failed', 'Replay failed', 'Replay failed'],
      ['error', 'Error', 'Replay error'],
    ] as const) {
      cleanup();
      render(<Evidence bundle={{...bundle, checkRecords: [{
        id: 'replay', kind: 'replay', evidenceId: evidence.id, artifactId: evidence.artifactId,
        subjectArtifactIds: claim.subjectArtifactIds, scope: 'Recorded scope.', configuration: 'Recorded config.',
        result, checkedAt: '2026-11-06T00:00:00Z', details: 'Recorded attempt.',
      }]}} evidence={evidence} />);
      expect(screen.getByRole('button', {name: token})).toBeTruthy();
      const record = screen.getByText('Evidence record').closest('details');
      expect(record?.hasAttribute('open')).toBe(false);
      expect(record?.textContent).toContain(phrase);
      expect(record?.textContent).toContain('does not remove assumptions');
    }
  });
  it('should render identities free of hash notation while sources stay pinned', () => {
    render(<Atlas bundle={bundle} view={view} mode="map" onMode={vi.fn()} />);
    expect(document.body.textContent).not.toMatch(/[0-9a-f]{8,64}/);
    expect(screen.queryByRole('link', { name: /204fb4a19774/ })).toBeNull();
    expect(screen.queryByText('Select a component to inspect claims.')).toBeNull();
    expect(within(screen.getByRole('contentinfo')).queryByText(/Dataset schema/)).toBeNull();
    render(<ClaimDetails bundle={bundle} claim={claim} binding={binding} />);
    expect(screen.getByText(/Conflicting finality/)).toBeTruthy();
    expect(screen.queryByText(/^[0-9a-f]{12,}$/)).toBeNull();
    const pinned = screen.getAllByRole('link', { name: 'GasperBeaconChain.Core.accountable_safety' });
    expect(pinned[0].getAttribute('href')).toContain('7650709170327c5f10c8b5da99b10941e208ef5d');
    expect(pinned[0].getAttribute('rel')).toBe('noopener noreferrer');
  });
  it('should never display the dataset digest, artifact revisions or versions in the interface', () => {
    const digest = { id: 'digest-artifact', kind: 'proof' as const, title: 'Digest fixture',
      repository: 'https://github.com/ethereum/devp2p', revisionKind: 'sha256' as const,
      revision: 'a'.repeat(64), version: 'Fixture v1',
      locations: [{ id: 'digest-location', path: 'fixture', label: 'Fixture', url: 'https://example.org/fixture' }] };
    render(<Sources bundle={{ ...bundle, artifacts: [...bundle.artifacts, digest] }}
      sources={[{ artifactId: 'digest-artifact', locationId: 'digest-location' }]} />);
    expect(screen.getByText('Fixture')).toBeTruthy();
    expect(document.body.textContent).not.toContain('a'.repeat(64));
    expect(document.body.textContent).not.toContain('Fixture v1');
  });
  it('should retain source identities when a stored observation says unavailable', () => {
    const fixture = structuredClone(bundle);
    fixture.checkRecords = fixture.checkRecords.map(c => c.kind === 'availability' ? {...c, result: 'unavailable'} :
      c.kind === 'source-review' ? {...c, result: 'inconclusive'} : c);
    render(<Evidence bundle={fixture} evidence={{...fixture.evidence[0],method: 'smt'}} />);
    const record = screen.getByText('Evidence record').closest('details');
    expect(screen.getByRole('button', {name: 'SMT'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Unavailable'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Inconclusive'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'No replay'})).toBeTruthy();
    expect(record?.textContent).toContain('SMT verification');
    expect(record?.textContent).toContain('Unavailable when last checked');
    expect(record?.textContent).toContain('Inconclusive');
    expect(record?.textContent).toContain('Not performed');
    expect(screen.getByRole('link', {name: 'GasperBeaconChain.Core.accountable_safety'})).toBeTruthy();
  });
  it('should escape imported source text instead of interpreting markup', () => {
    render(<ClaimDetails bundle={bundle} claim={{...claim,title: '<script>alert(1)</script>',
      relation: {kind: 'refinement',fromArtifactId: 'gasper-model',toArtifactId: 'consensus',direction: 'Model to implementation.'}}}
      binding={{...binding,applicabilityKind: 'direct-subject',basis: {kind: 'version-match'}}} />);
    expect(screen.getByText('<script>alert(1)</script>')).toBeTruthy();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByRole('button', {name: 'Direct'})).toBeTruthy();
    expect(screen.getAllByText('Direct subject').length).toBeGreaterThan(0);
    expect(screen.getByText('refinement direction')).toBeTruthy();
    expect(screen.getByText(/gasper-lean4 abstract FFG model → Ethereum consensus specifications: Model to implementation\./)).toBeTruthy();
  });
  it('should show neutral empty states and source-backed relationships when components change', () => {
    const props = {bundle,view,instanceId: 'b-head',claimId: null,edgeId: null,onClaim: vi.fn(),onEdge: vi.fn()};
    const {rerender} = render(<Details {...props} />);
    expect(screen.getByRole('heading', {name: '0 claims'})).toBeTruthy();
    rerender(<Details {...props} instanceId="b-bls" />);
    expect(screen.getByRole('heading', {name: 'Claims: 1'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Signatures · dependency'}));
    expect(props.onEdge).toHaveBeenCalledWith('b-bls-state');
    rerender(<Details {...props} instanceId="b-state" />);
    fireEvent.click(screen.getByRole('button', {name: claim.title}));
    expect(props.onClaim).toHaveBeenCalledWith(claim.id);
    rerender(<Details {...props} instanceId="b-state" claimId={claim.id} />);
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(props.onClaim).toHaveBeenCalledWith(null);
    rerender(<Details {...props} edgeId="b-bls-state" />);
    expect(screen.getByText(/RANDAO processing call BLS/)).toBeTruthy();
  });
});

describe('map interaction', () => {
  it('should keep node selection and expansion accessible with explicit claim counts', () => {
    const data = {name: 'Fixture node',area: 'consensus',count: 2,expandable: true,expanded: false,select: vi.fn(),expand: vi.fn()};
    const props = {id: 'test',data,type: 'atlas' as const,selected: false,dragging: false,draggable: false,
      selectable: true,deletable: false,isConnectable: false,zIndex: 0,positionAbsoluteX: 0,positionAbsoluteY: 0};
    const {rerender} = render(<ReactFlowProvider><ComponentNode {...props} /></ReactFlowProvider>);
    expect(screen.getByText('Claims: 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Select Fixture node'}));
    fireEvent.click(screen.getByRole('button', {name: 'Expand Fixture node'}));
    expect(data.select).toHaveBeenCalledOnce(); expect(data.expand).toHaveBeenCalledOnce();
    rerender(<ReactFlowProvider><ComponentNode {...props} data={{...data,count: 0,expanded: true}} /></ReactFlowProvider>);
    expect(screen.getByText('0 claims')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Collapse Fixture node'}).getAttribute('aria-expanded')).toBe('true');
  });
  it('should offer keyboard-operable viewport controls without mutating domain geometry', () => {
    render(<ReactFlowProvider><MapControls /></ReactFlowProvider>);
    for (const label of ['Zoom in','Zoom out','Pan left','Pan right','Pan up','Pan down','Fit map']) {
      fireEvent.click(screen.getByRole('button', {name: label}));
    }
    expect(view.componentInstances[0].position).toEqual({x: 310,y: 0});
  });
  it('should preserve map context while selecting hidden children and navigating evidence', async () => {
    render(<Atlas bundle={bundle} view={view} mode="map" onMode={vi.fn()} />);
    expect(screen.getByRole('heading', {name: 'Select a component'})).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.click(await screen.findByRole('button', {name: 'Expand State transition'}));
    await waitFor(() => expect(screen.getByRole('button', {name: 'Select Justification / finalization'})).toBeTruthy());
    fireEvent.click(screen.getByRole('button', {name: 'Select Justification / finalization'}));
    const panel = within(screen.getByRole('complementary'));
    fireEvent.click(panel.getByRole('button', {name: claim.title}));
    expect(panel.getByText('Property')).toBeTruthy();
    fireEvent.click(panel.getByRole('button', {name: 'Back'}));
    fireEvent.click(panel.getByRole('button', {name: 'Epoch processing · dependency'}));
    expect(panel.getByText(/Fulu process_epoch invokes/)).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', {name: 'Collapse State transition'}));
    expect(screen.queryByRole('button', {name: 'Select Justification / finalization'})).toBeNull();
    fireEvent.click(await screen.findByRole('button', {name: 'Expand State transition'}));
    expect(await screen.findByRole('button', {name: 'Select Justification / finalization'})).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', {name: 'Select BLS signatures'}));
    expect(panel.getByRole('heading', {name: 'Claims: 1'})).toBeTruthy();
    expect(panel.getByRole('button', {name: 'BLS hash-to-G2 succeeds with a nonsingular curve point'})).toBeTruthy();
  });
});

describe('index presentation', () => {
  const Harness = () => {
    const [mode, setMode] = useState<'map' | 'index'>('map');
    return <Atlas bundle={bundle} view={view} mode={mode} onMode={setMode} />;
  };
  it('should share selection with the map and treat zero cells as selectable inventory', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', {name: 'Index'}));
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('rowheader').map(header => header.textContent))
      .toEqual(['Consensus', 'Network', 'Cryptography', 'Serialization']);
    fireEvent.click(within(table).getByRole('button', {name: 'State transition: Claims: 2'}));
    const panel = within(screen.getByRole('complementary'));
    expect(panel.getByRole('heading', {name: 'State transition'})).toBeTruthy();
    expect(panel.getByRole('button', {name: claim.title})).toBeTruthy();
    fireEvent.click(within(table).getByRole('button', {name: 'Fork choice: No catalogued claims'}));
    expect(panel.getByRole('heading', {name: '0 claims'})).toBeTruthy();
    expect(panel.getByText(/does not mean unproved or unsafe/)).toBeTruthy();
    expect(within(table).getAllByRole('button', {name: /: No catalogued claims$/})).toHaveLength(1);
    expect(within(table).queryByRole('rowheader', {name: 'Solidity / solc'})).toBeNull();
    expect(screen.getByText(/Shading reflects the claim count, not a coverage score/)).toBeTruthy();
    expect(screen.getByRole('list', {name: 'Claim-count shading legend'})).toBeTruthy();
    expect(screen.queryByRole('list', {name: 'Relationship legend'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Map'}));
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('list', {name: 'Relationship legend'})).toBeTruthy();
    expect(panel.getByRole('heading', {name: 'Fork choice'})).toBeTruthy();
  });
  it('should list the formal-verification repositories once as discovery links', () => {
    render(<Atlas bundle={bundle} view={view} mode="map" onMode={vi.fn()} />);
    const links = within(screen.getByRole('contentinfo')).getAllByRole('link');
    const hrefs = links.map(link => link.getAttribute('href'));
    expect(hrefs).toHaveLength(8);
    expect(new Set(hrefs)).toEqual(new Set([
      'https://github.com/ethereum/EthLib', 'https://github.com/ethereum/ssz-specs',
      'https://github.com/etheorem/leanp2p',
      'https://github.com/leanEthereum/ots.golf-dev', 'https://github.com/leanEthereum/ots.golf-submissions',
      'https://github.com/NyxFoundation/formal-leanSpec',
      'https://github.com/NyxFoundation/gasper-lean4', 'https://github.com/Verified-zkEVM/ArkLib',
    ]));
    for (const link of links) {
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('target')).toBe('_blank');
    }
    expect(screen.queryByRole('link', {name: 'ethereum/consensus-specs'})).toBeNull();
    expect(screen.getByRole('link', {name: 'etheorem/leanp2p'}).getAttribute('href'))
      .toBe('https://github.com/etheorem/leanp2p');
    expect(screen.getByRole('link', {name: 'leanEthereum/ots.golf-submissions'}).textContent).toBe('leanEthereum/ots.golf-submissions');
  });
  it('should open the index table first and keep the mode across view changes', async () => {
    vi.mocked(loadAtlas).mockResolvedValue(bundle);
    render(<App />);
    const beaconTable = await screen.findByRole('table');
    expect(screen.getByRole('button', {name: 'Index'}).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', {name: 'Map'}).getAttribute('aria-pressed')).toBe('false');
    const toggleOrder = screen.getAllByRole('button', { name: /^(Index|Map)$/ })
      .map(button => button.textContent);
    expect(toggleOrder).toEqual(['Index', 'Map']);
    expect(within(beaconTable).getByRole('button', {name: 'State transition: Claims: 2'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Map'}));
    expect(screen.getByRole('button', {name: 'Map'}).getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(screen.getByRole('tab', {name: 'Beacon Spec'}), {key: 'ArrowRight'});
    await screen.findByText('Lstar (experimental)');
    expect(screen.getByRole('button', {name: 'Map'}).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', {name: 'Index'}));
    const table = screen.getByRole('table');
    expect(within(table).getByRole('button', {name: 'State transition: Claims: 1'})).toBeTruthy();
    expect(within(table).queryByRole('button', {name: /^Solidity \/ solc/})).toBeNull();
    fireEvent.click(screen.getByRole('tab', {name: 'Execution Spec'}));
    await screen.findByText('Osaka');
    expect(screen.getByRole('button', {name: 'Index'}).getAttribute('aria-pressed')).toBe('true');
    expect(within(screen.getByRole('table')).getByRole('button', {name: /^Solidity \/ solc/})).toBeTruthy();
    expect(within(screen.getByRole('table')).queryByRole('button', {name: 'State transition: Claims: 1'})).toBeNull();
    expect(within(screen.getByRole('table')).getAllByRole('rowheader').map(header => header.textContent))
      .toEqual(['Execution', 'Network', 'Development']);
  });
});

describe('application lifecycle', () => {
  it('should introduce the atlas with its name and one description when the page opens', async () => {
    vi.mocked(loadAtlas).mockResolvedValue(bundle);
    render(<App />);
    const header = within(screen.getByRole('banner'));
    expect(header.getByRole('heading', {level: 1, name: 'Ethereum Proof Atlas'})).toBeTruthy();
    expect(header.getByRole('link', {name: 'Ethereum Proof Atlas'}).getAttribute('href')).toBe('/');
    expect(header.getByText('Formal verification across Ethereum.')).toBeTruthy();
    expect(screen.getAllByRole('heading', {level: 1})).toHaveLength(1);
    for (const text of ['Claims, not certifications.', 'A source-pinned evidence map', 'What has been proved?',
      'Explore the architecture. Inspect the subject, assumptions and limits behind each claim.']) {
      expect(screen.queryByText(text)).toBeNull();
    }
    expect(screen.queryByText('Ethereum L1 and supporting infrastructure')).toBeNull();
    await screen.findByRole('heading', {name: 'Select a component'});
  });
  it('should link the source repository from the page header with the GitHub mark', async () => {
    vi.mocked(loadAtlas).mockResolvedValue(bundle);
    render(<App />);
    const header = within(screen.getByRole('banner'));
    const link = header.getByRole('link', {name: 'GitHub repository'});
    expect(link.getAttribute('href')).toBe('https://github.com/NyxFoundation/ethereum-proof-atlas');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.querySelector('svg')).toBeTruthy();
  });
  it('should reset selected evidence and support tab keyboard navigation on view changes', async () => {
    vi.mocked(loadAtlas).mockResolvedValue(bundle);
    render(<App />);
    expect(screen.getByRole('status').textContent).toContain('Loading');
    await screen.findByRole('heading', {name: 'Select a component'});
    fireEvent.keyDown(screen.getByRole('tab', {name: 'Beacon Spec'}), {key: 'Home'});
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.keyDown(screen.getByRole('tab', {name: 'Beacon Spec'}), {key: 'ArrowRight'});
    await screen.findByText('Lstar (experimental)');
    expect(screen.getByRole('tab', {name: 'Lean Spec'}).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('button', {name: 'Select BLS signatures'})).toBeNull();
    fireEvent.keyDown(screen.getByRole('tab', {name: 'Lean Spec'}), {key: 'ArrowRight'});
    await screen.findByText('Osaka');
    expect(screen.getByRole('tab', {name: 'Execution Spec'}).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('button', {name: 'Select BLS signatures'})).toBeNull();
    fireEvent.keyDown(screen.getByRole('tab', {name: 'Execution Spec'}), {key: 'ArrowLeft'});
    await screen.findByText('Lstar (experimental)');
    fireEvent.keyDown(screen.getByRole('tab', {name: 'Lean Spec'}), {key: 'End'});
    await screen.findByText('Osaka');
    fireEvent.keyDown(screen.getByRole('tab', {name: 'Execution Spec'}), {key: 'Home'});
    await screen.findByText('Fulu / Osaka (Fusaka; BPO2)');
    fireEvent.click(screen.getByRole('tab', {name: 'Lean Spec'}));
    await screen.findByText('Lstar (experimental)');
  });
  it('should display an English error and recover when a request can be retried', async () => {
    vi.mocked(loadAtlas).mockRejectedValueOnce(new Error('Atlas data is unavailable. Try again.')).mockResolvedValue(bundle);
    render(<App />);
    expect((await screen.findByRole('alert')).textContent).toContain('Atlas data is unavailable');
    fireEvent.click(screen.getByRole('button', {name: 'Try again'}));
    await screen.findByText('Fulu / Osaka (Fusaka; BPO2)');
  });
});
