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
    expect(screen.getByText('Not performed')).toBeTruthy();
    expect(screen.getByText(/Unknown \/ not fully reviewed/)).toBeTruthy();
    expect(screen.getByText(/Available when last checked/)).toBeTruthy();
    expect(screen.getByText(/Structural result only/)).toBeTruthy();
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\//);
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }
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
    expect(screen.getByText('Bounded result')).toBeTruthy();
    expect(screen.getByText('At most 4 validators, 8 steps.')).toBeTruthy();
    expect(screen.getByText('Not checked')).toBeTruthy();
    expect(screen.getByText('Not reviewed')).toBeTruthy();
    expect(screen.getByText(/Attempt result: timeout/)).toBeTruthy();
    expect(screen.getByText(/does not establish that the property is false/)).toBeTruthy();
    expect(screen.queryByText('Unbounded theorem statement')).toBeNull();
  });
  it('should retain source identities when a stored observation says unavailable', () => {
    const fixture = structuredClone(bundle);
    fixture.checkRecords = fixture.checkRecords.map(c => c.kind === 'availability' ? {...c, result: 'unavailable'} :
      c.kind === 'source-review' ? {...c, result: 'inconclusive'} : c);
    render(<Evidence bundle={fixture} evidence={{...fixture.evidence[0],method: 'smt'}} />);
    expect(screen.getByText('SMT verification')).toBeTruthy();
    expect(screen.getByText(/Unavailable when last checked/)).toBeTruthy();
    expect(screen.getByText(/Inconclusive/)).toBeTruthy();
    expect(screen.getByText('Not performed')).toBeTruthy();
    expect(screen.getByRole('link', {name: 'GasperBeaconChain.Core.accountable_safety'})).toBeTruthy();
  });
  it('should escape imported source text instead of interpreting markup', () => {
    render(<ClaimDetails bundle={bundle} claim={{...claim,title: '<script>alert(1)</script>',
      relation: {kind: 'refinement',fromArtifactId: 'a',toArtifactId: 'b',direction: 'Model to implementation.'}}}
      binding={{...binding,applicabilityKind: 'direct-subject',basis: {kind: 'version-match'}}} />);
    expect(screen.getByText('<script>alert(1)</script>')).toBeTruthy();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByText(/Direct subject/)).toBeTruthy();
    expect(screen.getByText('refinement direction')).toBeTruthy();
  });
  it('should show neutral empty states and source-backed relationships when components change', () => {
    const props = {bundle,view,instanceId: 'b-bls',claimId: null,edgeId: null,onClaim: vi.fn(),onEdge: vi.fn()};
    const {rerender} = render(<Details {...props} />);
    expect(screen.getByRole('heading', {name: '0 claims'})).toBeTruthy();
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
    fireEvent.change(screen.getByRole('combobox'), {target: {value: 'b-finality'}});
    await waitFor(() => expect(screen.getByRole('button', {name: 'Select Justification / finalization'})).toBeTruthy());
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
    expect(panel.getByRole('heading', {name: '0 claims'})).toBeTruthy();
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
    expect(within(table).getAllByRole('columnheader').map(header => header.textContent))
      .toEqual(['Consensus', 'Execution', 'Cryptography', 'Serialization', 'Development']);
    fireEvent.click(within(table).getByRole('button', {name: 'State transition: Claims: 1'}));
    const panel = within(screen.getByRole('complementary'));
    expect(panel.getByRole('heading', {name: 'State transition'})).toBeTruthy();
    expect(panel.getByRole('button', {name: claim.title})).toBeTruthy();
    fireEvent.click(within(table).getByRole('button', {name: 'Fork choice: No catalogued claims'}));
    expect(panel.getByRole('heading', {name: '0 claims'})).toBeTruthy();
    expect(panel.getByText(/does not mean unproved or unsafe/)).toBeTruthy();
    expect(within(table).getAllByRole('button', {name: /: No catalogued claims$/}).length).toBeGreaterThan(5);
    expect(screen.getByText(/Shading reflects the claim count, not a coverage score/)).toBeTruthy();
    expect(screen.getByRole('list', {name: 'Claim-count shading legend'})).toBeTruthy();
    expect(screen.queryByRole('list', {name: 'Relationship legend'})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Map'}));
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('list', {name: 'Relationship legend'})).toBeTruthy();
    expect(panel.getByRole('heading', {name: 'Fork choice'})).toBeTruthy();
  });
  it('should switch modes inside a tab and keep the mode across view changes', async () => {
    vi.mocked(loadAtlas).mockResolvedValue(bundle);
    render(<App />);
    await screen.findByRole('heading', {name: 'Select a component'});
    fireEvent.click(screen.getByRole('button', {name: 'Index'}));
    expect(screen.getByRole('button', {name: 'Index'}).getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(screen.getByRole('tab', {name: 'Beacon Spec'}), {key: 'ArrowRight'});
    await screen.findByText('Lstar (experimental)');
    expect(screen.getByRole('button', {name: 'Index'}).getAttribute('aria-pressed')).toBe('true');
    const table = screen.getByRole('table');
    expect(within(table).getByRole('button', {name: 'State transition: Claims: 1'})).toBeTruthy();
    expect(within(table).queryByRole('button', {name: /^Solidity \/ solc/})).toBeNull();
    fireEvent.keyDown(screen.getByRole('tab', {name: 'Lean Spec'}), {key: 'Home'});
    await screen.findByText('Fulu / Osaka (Fusaka; BPO2)');
    expect(within(screen.getByRole('table')).getByRole('button', {name: /^Solidity \/ solc/})).toBeTruthy();
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
    fireEvent.keyDown(screen.getByRole('tab', {name: 'Lean Spec'}), {key: 'Home'});
    await screen.findByText('Fulu / Osaka (Fusaka; BPO2)');
    fireEvent.keyDown(screen.getByRole('tab', {name: 'Beacon Spec'}), {key: 'End'});
    await screen.findByText('Lstar (experimental)');
    fireEvent.click(screen.getByRole('tab', {name: 'Beacon Spec'}));
    await screen.findByText('Fulu / Osaka (Fusaka; BPO2)');
  });
  it('should display an English error and recover when a request can be retried', async () => {
    vi.mocked(loadAtlas).mockRejectedValueOnce(new Error('Atlas data is unavailable. Try again.')).mockResolvedValue(bundle);
    render(<App />);
    expect((await screen.findByRole('alert')).textContent).toContain('Atlas data is unavailable');
    fireEvent.click(screen.getByRole('button', {name: 'Try again'}));
    await screen.findByText('Fulu / Osaka (Fusaka; BPO2)');
  });
});
