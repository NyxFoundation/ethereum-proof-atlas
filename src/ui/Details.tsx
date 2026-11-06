import type { AtlasBundle, ArchitectureView, Claim, ClaimBinding } from '../domain/schema';
import { claimsFor } from '../domain/selectors';
import { Sources } from './Sources';
import { Evidence } from './Evidence';

export function SubjectTypes({ bundle, claim }: { bundle: AtlasBundle; claim: Claim }) {
  const labels = { 'formal-model': 'Formal model', implementation: 'Implementation', specification: 'Specification', proof: 'Proof artifact' };
  return <span>{[...new Set(claim.subjectArtifactIds.map(id => labels[bundle.artifacts.find(a => a.id === id)!.kind]))].join(' + ')}</span>;
}
function Knowledge({ title, value }: { title: string; value: Claim['assumptions'] }) {
  return <section><h4>{title} {value.status === 'unknown' && <span className="tag">Unknown / not fully reviewed</span>}</h4>
    <ul>{value.details.map(detail => <li key={detail}>{detail}</li>)}</ul></section>;
}
export function ClaimDetails({ bundle, claim, binding }: { bundle: AtlasBundle; claim: Claim; binding: ClaimBinding }) {
  const basis = binding.basis;
  const comparison = basis.kind === 'manual-comparison' ? bundle.checkRecords.find(c => c.id === basis.checkId) : undefined;
  return <article aria-label="Claim details">
    <h3>{claim.title}</h3>
    <p className="tag"><SubjectTypes bundle={bundle} claim={claim} /> · {binding.applicabilityKind === 'related-model' ? 'Related model' : 'Direct subject'}</p>
    <h4>Property</h4><p>{claim.statement}</p>
    <h4>Subject identities</h4>
    {claim.subjectArtifactIds.map(id => {
      const artifact = bundle.artifacts.find(a => a.id === id)!;
      return <div key={id}><p>{artifact.title} · {artifact.kind}</p><p>{artifact.version}</p><code>{artifact.revision}</code></div>;
    })}
    <h4>Applicability to this view</h4><p>{binding.explanation}</p>
    <p>Basis: {binding.basis.kind}{comparison && <> · {comparison.checkedAt.slice(0, 10)}</>}</p>
    {comparison && <p>{comparison.details}</p>}
    <Sources bundle={bundle} sources={binding.sources} />
    <Knowledge title="Assumptions" value={claim.assumptions} />
    <Knowledge title="Dependency / axiom audit" value={claim.dependencies} />
    <h4>Limitations</h4><ul>{claim.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul>
    {claim.relation && <section><h4>{claim.relation.kind} direction</h4>
      <p>{claim.relation.fromArtifactId} → {claim.relation.toArtifactId}: {claim.relation.direction}</p></section>}
    <h4>Evidence</h4>
    {bundle.evidence.filter(e => e.claimId === claim.id).map(e => <Evidence key={e.id} bundle={bundle} evidence={e} />)}
  </article>;
}
type Props = { bundle: AtlasBundle; view: ArchitectureView; instanceId: string | null; claimId: string | null;
  edgeId: string | null; onClaim: (id: string | null) => void; onEdge: (id: string) => void };
export function Details({ bundle, view, instanceId, claimId, edgeId, onClaim, onEdge }: Props) {
  const edge = bundle.architectureEdges.find(e => e.viewId === view.id && e.id === edgeId);
  const instance = view.componentInstances.find(i => i.instanceId === instanceId);
  const component = bundle.components.find(c => c.id === instance?.componentId);
  if (edge) return <aside aria-label="Details panel"><h2>{edge.label}</h2><p className="tag">{edge.kind}</p>
    <p>{edge.explanation}</p><p>{edge.source} → {edge.target}</p><Sources bundle={bundle} sources={edge.sources} /></aside>;
  if (!component || !instance) return <aside aria-label="Details panel"><h2>Select a component</h2>
    <details><summary>Help</summary>
      <p>Claims are not coverage scores or safety rankings. Architecture arrows never propagate proof guarantees.</p>
      <p>Foundations sit below their consumers. Parallel areas are not a single verification chain.</p>
      <p>Use Tab to reach nodes and controls. Enter selects; expansion reveals finer components. Nodes cannot be moved or deleted.</p></details></aside>;
  const claims = claimsFor(bundle, view.id, instance.instanceId);
  const claim = claims.find(c => c.id === claimId);
  const binding = view.claimBindings.find(b => b.componentInstanceId === instanceId && b.claimId === claimId);
  return <aside aria-label="Details panel"><p className="eyebrow">{component.area}</p><h2>{component.name}</h2>
    <p>{component.description}</p>
    {claim && binding ? <><button onClick={() => onClaim(null)}>Back</button>
      <ClaimDetails bundle={bundle} claim={claim} binding={binding} /></> :
      <><h3>{claims.length ? `Claims: ${claims.length}` : '0 claims'}</h3>
        {!claims.length && <p>No records in this view. This does not mean unproved or unsafe.</p>}
        <ul className="claim-list">{claims.map(c => {
          const association = view.claimBindings.find(b => b.componentInstanceId === instanceId && b.claimId === c.id)!;
          return <li key={c.id}><button onClick={() => onClaim(c.id)}>{c.title}</button>
            <span><SubjectTypes bundle={bundle} claim={c} /> · {association.applicabilityKind === 'related-model' ? 'Related model' : 'Direct subject'}</span></li>;
        })}</ul>
        <h3>Component sources</h3><Sources bundle={bundle} sources={instance.sources} />
        <h3>Relationships</h3><ul className="relationships">
          {bundle.architectureEdges.filter(e => e.viewId === view.id && [e.source, e.target].includes(instanceId!)).map(e =>
            <li key={e.id}><button onClick={() => onEdge(e.id)}>{e.label} · {e.kind}</button></li>)}
        </ul></>}
  </aside>;
}
