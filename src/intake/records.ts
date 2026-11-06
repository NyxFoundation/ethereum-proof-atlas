import type { CheckRecord } from '../domain/schema.ts';
import { requireIntake, type Content, type Proposal, type Target } from './model.ts';

export function comparisonId(target: Target, revision: string, viewId: string, instanceId: string) {
  return `update-${target.id}-${revision.slice(0,12)}-${viewId}-${instanceId}`;
}
// Callers parse the proposal and match its entity scope to a validated release first.
export function recordsFor(proposal: Proposal): CheckRecord[] {
  const { review, content } = proposal;
  requireIntake(review, 'pending_review');
  const details = `Reviewed by ${review.reviewer}. ${review.notes}`;
  const availability: CheckRecord[] = content.artifacts.filter(a => a.kind === 'proof').map(a => {
    const observations = a.locations.map(l => proposal.observations.find(o => o.artifactId === a.id &&
      o.locationId === l.id && o.revision === a.revision && o.path === l.path));
    requireIntake(observations.every(o => o?.sha256), 'source_unavailable');
    return { id: `update-${a.id}-${proposal.after.slice(0,12)}-available`, kind: 'availability',
      artifactId: a.id, locationIds: a.locations.map(l => l.id), result: 'available',
      checkedAt: observations[0]!.checkedAt,
      details: 'Pinned source GETs succeeded. SHA-256: ' + observations.map(o => `${o!.locationId}=${o!.sha256}`).join('; ') };
  });
  const reviews: CheckRecord[] = content.evidence.map(e => ({
    id: `update-${e.id}-${proposal.after.slice(0,12)}-review`, kind: 'source-review', artifactId: e.artifactId,
    evidenceId: e.id, subjectArtifactIds: content.claims.find(c => c.id === e.claimId)!.subjectArtifactIds,
    scope: `Source correspondence for ${e.id} at ${proposal.after}; not proof replay or a transitive axiom audit.`,
    result: 'reviewed', checkedAt: review.checkedAt, details,
  }));
  const comparisons: CheckRecord[] = content.bindings.map(({ viewId, binding }) => {
    requireIntake(binding.basis.kind === 'manual-comparison', 'unsupported_binding');
    return { id: binding.basis.checkId, kind: 'manual-comparison', viewId,
      componentInstanceId: binding.componentInstanceId, claimId: binding.claimId, sources: binding.sources,
      result: 'related', checkedAt: review.checkedAt, details: `${binding.explanation}\n${details}` };
  });
  return [...availability, ...reviews, ...comparisons];
}
export function mergeContent<T extends { id: string }>(old: T[], next: T[]) {
  return old.map(item => next.find(replacement => replacement.id === item.id) ?? item);
}
export function mergeBindings(original: Content['bindings'][number]['binding'][], viewId: string, content: Content) {
  return original.map(binding => content.bindings.find(b => b.viewId === viewId &&
    b.binding.componentInstanceId === binding.componentInstanceId && b.binding.claimId === binding.claimId)?.binding ?? binding);
}
