import type { AtlasBundle, ArchitectureView, Claim, ClaimBinding } from '../domain/schema';
import { availabilityFor, claimsFor } from '../domain/selectors';
import { Sources } from './Sources';
import { Evidence } from './Evidence';
import { availabilityKind, statusCopy, StatusToken } from './status';

export function SubjectTypes({ bundle, claim }: { bundle: AtlasBundle; claim: Claim }) {
  const labels = { 'formal-model': 'Formal model', implementation: 'Implementation', specification: 'Specification', proof: 'Proof artifact' };
  return <span>{[...new Set(claim.subjectArtifactIds.map(id => labels[bundle.artifacts.find(a => a.id === id)!.kind]))].join(' + ')}</span>;
}
function Knowledge({ title, value }: { title: string; value: Claim['assumptions'] }) {
  return <section><h4>{title} {value.status === 'unknown' && <StatusToken kind="unknown" />}</h4>
    <ul>{value.details.map(detail => <li key={detail}>{detail}</li>)}</ul>
    {value.status === 'unknown' && <details><summary>Assumption status</summary><p>{statusCopy.unknown.phrase}</p></details>}
  </section>;
}
function DependencyAudit({ value }: { value: Claim['dependencies'] }) {
  return <div className="disclosure-head">{value.status === 'unknown' && <StatusToken kind="unknown" />}
    <details><summary>Dependency audit</summary>
      {value.status === 'unknown' && <p>{statusCopy.unknown.phrase}</p>}
      <ul>{value.details.map(detail => <li key={detail}>{detail}</li>)}</ul></details></div>;
}
function ApplicabilityBasis({ bundle, binding }: { bundle: AtlasBundle; binding: ClaimBinding }) {
  const basis = binding.basis;
  const comparison = basis.kind === 'manual-comparison'
    ? bundle.checkRecords.find(record => record.id === basis.checkId && record.kind === 'manual-comparison') : undefined;
  return <details><summary>Applicability basis</summary>
    <p>{statusCopy[binding.applicabilityKind === 'related-model' ? 'related' : 'direct'].phrase}</p>
    <p>Basis: {basis.kind}</p>
    {comparison && <p><time dateTime={comparison.checkedAt}>{comparison.checkedAt.slice(0, 10)}</time></p>}
    {comparison && <p>{comparison.details}</p>}
    {binding.sources.map((ref, index) => {
      const availability = availabilityFor(bundle, ref.artifactId, ref.locationId);
      const kind = availabilityKind(bundle, ref.artifactId, ref.locationId);
      return <p key={`${ref.artifactId}-${index}`}>{statusCopy[kind].phrase}
        {availability && <> · <time dateTime={availability.checkedAt}>{availability.checkedAt.slice(0, 10)}</time> {availability.details}</>}</p>;
    })}</details>;
}
function Relation({ bundle, claim }: { bundle: AtlasBundle; claim: Claim }) {
  if (!claim.relation) return null;
  const { kind, fromArtifactId, toArtifactId, direction } = claim.relation;
  const title = (id: string) => bundle.artifacts.find(artifact => artifact.id === id)!.title;
  return <section><h4>{kind} direction</h4><p>{title(fromArtifactId)} → {title(toArtifactId)}: {direction}</p></section>;
}
export function ClaimDetails({ bundle, claim, binding }: { bundle: AtlasBundle; claim: Claim; binding: ClaimBinding }) {
  return <article aria-label="Claim details">
    <h3>{claim.title}</h3>
    <p className="token-row"><SubjectTypes bundle={bundle} claim={claim} />
      <StatusToken kind={binding.applicabilityKind === 'related-model' ? 'related' : 'direct'} /></p>
    <h4>Property</h4><p>{claim.statement}</p>
    <h4>Subject identities</h4>
    {claim.subjectArtifactIds.map(id => {
      const artifact = bundle.artifacts.find(a => a.id === id)!;
      return <div key={id}><p>{artifact.title} · {artifact.kind}</p></div>;
    })}
    <h4>Applicability to this view</h4><p>{binding.explanation}</p>
    <Knowledge title="Assumptions" value={claim.assumptions} />
    <h4>Limitations</h4><ul>{claim.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul>
    <Relation bundle={bundle} claim={claim} />
    <Sources bundle={bundle} sources={binding.sources} showAvailability={false} tokens />
    <DependencyAudit value={claim.dependencies} />
    <ApplicabilityBasis bundle={bundle} binding={binding} />
    <h4>Evidence</h4>
    {bundle.evidence.filter(evidence => evidence.claimId === claim.id).map(evidence =>
      <Evidence key={evidence.id} bundle={bundle} evidence={evidence} />)}
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
