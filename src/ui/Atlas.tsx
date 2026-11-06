import { useState } from 'react';
import type { AtlasBundle, ArchitectureView } from '../domain/schema';
import { visibleInstances } from '../domain/selectors';
import { Graph } from './Graph';
import { IndexTable } from './IndexTable';
import { Details } from './Details';
import { Sources } from './Sources';
import { revisionHref } from './links';

type Repository = { repository: string; slug: string };
function repositoryLinks(bundle: AtlasBundle): Repository[] {
  const repositories = new Map(bundle.artifacts.map(artifact =>
    [artifact.repository, new URL(artifact.repository).pathname.replace(/^\//, '')] as const));
  return [...repositories.entries()].map(([repository, slug]) => ({ repository, slug }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}
export function Atlas({ bundle, view, mode, onMode }: { bundle: AtlasBundle; view: ArchitectureView;
  mode: 'map' | 'index'; onMode: (mode: 'map' | 'index') => void }) {
  const [instanceId, setInstance] = useState<string | null>(null);
  const [claimId, setClaim] = useState<string | null>(null);
  const [edgeId, setEdge] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const select = (id: string) => {
    setInstance(id); setClaim(null); setEdge(null);
    const parents: string[] = [];
    let parent = view.componentInstances.find(i => i.instanceId === id)?.parentInstanceId;
    while (parent) {
      parents.push(parent);
      parent = view.componentInstances.find(i => i.instanceId === parent)?.parentInstanceId;
    }
    setExpanded(current => new Set([...current, ...parents]));
  };
  const expand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
    if (instanceId && !visibleInstances(view, next).some(i => i.instanceId === instanceId)) select(id);
  };
  const chooseEdge = (id: string) => { setEdge(id); setClaim(null); };
  const primary = bundle.artifacts.find(a => a.id === view.sources[0].artifactId)!;
  const primaryHref = revisionHref(primary);
  return <>
    <section className="snapshot" aria-label="Selected snapshot"><div><strong>{view.fork}</strong>
      {primaryHref ? <a className="snapshot-revision" href={primaryHref} target="_blank" rel="noopener noreferrer"
        title={`Browse this snapshot at ${primary.revision}`} aria-label={`Browse ${primary.title} revision ${primary.revision.slice(0, 12)}`}>{primary.revision.slice(0, 12)}</a>
        : <code title={primary.revision}>{primary.revision.slice(0, 12)}</code>}</div>
      <details><summary>Sources</summary>
        <p>{view.description}</p>
        <ul>{view.inheritance.map(note => <li key={note}>{note}</li>)}</ul><Sources bundle={bundle} sources={view.sources} /></details>
    </section>
    <div className="map-bar"><div role="group" aria-label="Display mode" className="mode-toggle">
      {(['map', 'index'] as const).map(value =>
        <button key={value} type="button" aria-pressed={mode === value} onClick={() => onMode(value)}>{value === 'map' ? 'Map' : 'Index'}</button>)}</div>
      <ul className="legend" aria-label="Relationship legend" hidden={mode !== 'map'}>
        <li className="legend-dependency"><span>Dependency</span><span className="legend-detail">: provider → consumer</span></li>
        <li className="legend-interface"><span>Interface</span><span className="legend-detail">: sender → receiver</span></li>
        <li className="legend-generated-code"><span>Generated code</span><span className="legend-detail">: compiler → target</span></li>
      </ul>
      <ul className="index-legend" aria-label="Claim-count shading legend" hidden={mode === 'map'}>
        <li><span className="swatch band-0" />No catalogued claims</li>
        <li><span className="swatch band-1" />1–2 claims</li>
        <li><span className="swatch band-2" />3–4 claims</li>
        <li><span className="swatch band-3" />5+ claims</li>
      </ul>
    </div>
    <div className="workspace">{mode === 'map'
      ? <Graph bundle={bundle} view={view} expanded={expanded} selected={instanceId}
          onSelect={select} onExpand={expand} onEdge={chooseEdge} />
      : <IndexTable bundle={bundle} view={view} selected={instanceId} onSelect={select} />}
      <Details bundle={bundle} view={view} instanceId={instanceId} claimId={claimId} edgeId={edgeId} onClaim={setClaim} onEdge={chooseEdge} /></div>
    <p className="map-note" aria-live="polite">{instanceId ? 'Component selected. Details are in the adjacent panel.' : 'Select a component to inspect claims.'}</p>
    <footer><details><summary>Dataset</summary><code>{bundle.datasetRevision}</code> · Schema {bundle.schemaVersion}</details>
      <p className="footer-repos"><span className="eyebrow">Referenced repositories</span>
        <span className="footer-note">Discovery links, not pinned evidence</span>
        {repositoryLinks(bundle).map(repo =>
          <a key={repo.repository} href={repo.repository} target="_blank" rel="noopener noreferrer">{repo.slug}</a>)}
      </p>
    </footer>
  </>;
}
