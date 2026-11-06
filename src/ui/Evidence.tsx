import type { AtlasBundle, Evidence as EvidenceRecord } from '../domain/schema';
import { availabilityFor } from '../domain/selectors';
import { Sources } from './Sources';

export function Evidence({ bundle, evidence }: { bundle: AtlasBundle; evidence: EvidenceRecord }) {
  const availability = availabilityFor(bundle, evidence.artifactId, evidence.locationId);
  const checks = bundle.checkRecords.filter(check => 'evidenceId' in check && check.evidenceId === evidence.id);
  const reviews = checks.filter(check => check.kind === 'source-review');
  const replays = checks.filter(check => check.kind === 'replay');
  return <section className="evidence-record" aria-label="Evidence record">
    <h4>{evidence.method === 'theorem-proving' ? 'Theorem proving' : evidence.method === 'smt' ? 'SMT verification' : 'Model checking'}</h4>
    <p className="tag">{evidence.scope.kind === 'bounded' ? 'Bounded result' : 'Unbounded theorem statement'}</p>
    <p>{evidence.scope.statement}</p>
    {evidence.scope.kind === 'bounded' && <><h5>Exploration bounds</h5><ul>{evidence.scope.bounds.map(b => <li key={b}>{b}</li>)}</ul></>}
    <h5>Abstractions</h5><ul>{evidence.scope.abstractions.map(a => <li key={a}>{a}</li>)}</ul>
    <h5>Configuration</h5><p>{evidence.scope.configuration}</p>
    <Sources bundle={bundle} showAvailability={false} sources={[{ artifactId: evidence.artifactId, locationId: evidence.locationId }]} />
    <h5>Public artifact located</h5><p>Located at intake; availability is a dated observation, not proof replay.</p>
    <p className="availability">{!availability ? 'Not checked' :
      availability.result === 'available' ? 'Available when last checked' : 'Unavailable when last checked'}
      {availability && <> · <time dateTime={availability.checkedAt}>{availability.checkedAt.slice(0, 10)}</time></>}</p>
    {availability && <p>{availability.details}</p>}
    <h5>Claim and source correspondence</h5>
    {reviews.length === 0 ? <p>Not reviewed</p> : reviews.map(check =>
      <div key={check.id}><p>{check.result === 'reviewed' ? 'Reviewed' : 'Inconclusive'} · {check.checkedAt.slice(0, 10)}</p>
        <p>{check.scope}</p><p>{check.details}</p></div>)}
    <h5>Verification replay</h5>
    {replays.length === 0 ? <p>Not performed</p> : replays.map(check =>
      <div key={check.id}><p>Attempt result: {check.result} · {check.checkedAt.slice(0, 10)}</p>
        <p>{check.scope}</p><p>{check.configuration}</p><p>{check.details}</p>
        <p>A timeout or failed attempt does not establish that the property is false. A successful replay does not remove assumptions.</p></div>)}
  </section>;
}
