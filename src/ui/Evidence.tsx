import type { AtlasBundle, CheckRecord, Evidence as EvidenceRecord } from '../domain/schema';
import { availabilityFor } from '../domain/selectors';
import { Sources } from './Sources';
import { availabilityKind, statusCopy, StatusToken, type StatusKind } from './status';

const methodKind = { 'theorem-proving': 'theorem', smt: 'smt', 'model-checking': 'checking' } as const;
const replayKind = { passed: 'replayed', failed: 'replay-failed', timeout: 'timeout', error: 'error' } as const;
type Review = Extract<CheckRecord, { kind: 'source-review' }>;
type Replay = Extract<CheckRecord, { kind: 'replay' }>;

function CheckTokens({ reviews, replays, located }: { reviews: Review[]; replays: Replay[]; located: StatusKind }) {
  return <>
    {reviews.length === 0 ? <StatusToken kind="unreviewed" /> : reviews.map(check =>
      <StatusToken key={check.id} kind={check.result === 'reviewed' ? 'reviewed' : 'inconclusive'} />)}
    {replays.length === 0 ? <StatusToken kind="no-replay" /> : replays.map(check =>
      <StatusToken key={check.id} kind={replayKind[check.result]} />)}
    <StatusToken kind={located} />
  </>;
}
function ReplayDetail({ check }: { check: Replay }) {
  return <div>
    <p>{statusCopy[replayKind[check.result]].phrase} · <time dateTime={check.checkedAt}>{check.checkedAt.slice(0, 10)}</time></p>
    <p>{check.scope}</p><p>{check.configuration}</p><p>{check.details}</p>
    <p>A timeout or failed attempt does not establish that the property is false. A successful replay does not remove assumptions.</p>
  </div>;
}
function EvidenceDetail({ bundle, evidence, reviews, replays, scopeKind }: {
  bundle: AtlasBundle; evidence: EvidenceRecord; reviews: Review[]; replays: Replay[]; scopeKind: StatusKind;
}) {
  const availability = availabilityFor(bundle, evidence.artifactId, evidence.locationId);
  const located = availabilityKind(bundle, evidence.artifactId, evidence.locationId);
  return <details>
    <summary>Evidence record</summary>
    <p>{statusCopy[methodKind[evidence.method]].phrase}</p>
    <p>{statusCopy[scopeKind].phrase}</p>
    {evidence.scope.kind === 'bounded' && <><h5>Exploration bounds</h5><ul>{evidence.scope.bounds.map(bound => <li key={bound}>{bound}</li>)}</ul></>}
    <h5>Abstractions</h5><ul>{evidence.scope.abstractions.map(item => <li key={item}>{item}</li>)}</ul>
    <h5>Configuration</h5><p>{evidence.scope.configuration}</p>
    <h5>Public artifact located</h5>
    <p>Located at intake; availability is a dated observation, not proof replay.</p>
    <p>{statusCopy[located].phrase}{availability && <> · <time dateTime={availability.checkedAt}>{availability.checkedAt.slice(0, 10)}</time></>}</p>
    {availability && <p>{availability.details}</p>}
    <h5>Claim and source correspondence</h5>
    {reviews.length === 0 ? <p>{statusCopy.unreviewed.phrase}</p> : reviews.map(check =>
      <div key={check.id}><p>{statusCopy[check.result === 'reviewed' ? 'reviewed' : 'inconclusive'].phrase} · <time dateTime={check.checkedAt}>{check.checkedAt.slice(0, 10)}</time></p>
        <p>{check.scope}</p><p>{check.details}</p></div>)}
    <h5>Verification replay</h5>
    {replays.length === 0 ? <p>{statusCopy['no-replay'].phrase}</p> : replays.map(check => <ReplayDetail key={check.id} check={check} />)}
  </details>;
}
export function Evidence({ bundle, evidence }: { bundle: AtlasBundle; evidence: EvidenceRecord }) {
  const checks = bundle.checkRecords.filter(check => 'evidenceId' in check && check.evidenceId === evidence.id);
  const reviews = checks.filter((check): check is Review => check.kind === 'source-review');
  const replays = checks.filter((check): check is Replay => check.kind === 'replay');
  const scopeKind = evidence.scope.kind === 'bounded' ? 'bounded' : 'unbounded';
  return <section className="evidence-record" aria-label="Evidence record">
    <div className="token-row">
      <StatusToken kind={methodKind[evidence.method]} />
      <StatusToken kind={scopeKind} />
      <CheckTokens reviews={reviews} replays={replays} located={availabilityKind(bundle, evidence.artifactId, evidence.locationId)} />
    </div>
    <p>{evidence.scope.statement}</p>
    <Sources bundle={bundle} showAvailability={false} sources={[{ artifactId: evidence.artifactId, locationId: evidence.locationId }]} />
    <EvidenceDetail bundle={bundle} evidence={evidence} reviews={reviews} replays={replays} scopeKind={scopeKind} />
  </section>;
}
