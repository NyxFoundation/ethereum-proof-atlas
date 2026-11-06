import { useState } from 'react';
import type { AtlasBundle, ArchitectureView } from '../domain/schema';
import { visibleInstances } from '../domain/selectors';
import { Graph } from './Graph';
import { Details } from './Details';
import { Sources } from './Sources';

export function Atlas({ bundle, view }: { bundle: AtlasBundle; view: ArchitectureView }) {
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
  return <>
    <section className="snapshot" aria-label="Selected snapshot"><div><strong>{view.fork}</strong>
      <code title={primary.revision}>{primary.revision.slice(0, 12)}</code></div>
      <details><summary>Sources</summary>
        <p>{view.description}</p>
        <ul>{view.inheritance.map(note => <li key={note}>{note}</li>)}</ul><Sources bundle={bundle} sources={view.sources} /></details>
    </section>
    <div className="map-bar"><select aria-label="Component" value={instanceId ?? ''} onChange={e => select(e.target.value)}>
      <option value="" disabled>Select</option>{view.componentInstances.map(i =>
        <option key={i.instanceId} value={i.instanceId}>{bundle.components.find(c => c.id === i.componentId)!.name}</option>)}</select>
      <ul className="legend" aria-label="Relationship legend">
        <li className="legend-dependency"><span>Dependency</span><span className="legend-detail">: provider → consumer</span></li>
        <li className="legend-interface"><span>Interface</span><span className="legend-detail">: sender → receiver</span></li>
        <li className="legend-generated-code"><span>Generated code</span><span className="legend-detail">: compiler → target</span></li>
      </ul>
    </div>
    <div className="workspace"><Graph bundle={bundle} view={view} expanded={expanded} selected={instanceId}
      onSelect={select} onExpand={expand} onEdge={chooseEdge} />
      <Details bundle={bundle} view={view} instanceId={instanceId} claimId={claimId} edgeId={edgeId} onClaim={setClaim} onEdge={chooseEdge} /></div>
    <p className="map-note" aria-live="polite">{instanceId ? 'Component selected. Details are in the adjacent panel.' : 'Select a component to inspect claims.'}</p>
    <footer><details><summary>Dataset</summary><code>{bundle.datasetRevision}</code> · Schema {bundle.schemaVersion}</details></footer>
  </>;
}
