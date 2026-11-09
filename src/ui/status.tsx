import { useId, type ReactNode } from 'react';
import type { AtlasBundle } from '../domain/schema';
import { availabilityFor } from '../domain/selectors';

export const statusCopy = {
  direct: { token: 'Direct', phrase: 'Direct subject' },
  related: { token: 'Related', phrase: 'Related model' },
  unknown: { token: 'Unknown', phrase: 'Unknown / not fully reviewed' },
  bounded: { token: 'Bounded', phrase: 'Bounded result' },
  unbounded: { token: 'Unbounded', phrase: 'Unbounded theorem statement' },
  unreviewed: { token: 'Unreviewed', phrase: 'Not reviewed' },
  reviewed: { token: 'Reviewed', phrase: 'Reviewed' },
  inconclusive: { token: 'Inconclusive', phrase: 'Inconclusive' },
  'no-replay': { token: 'No replay', phrase: 'Not performed' },
  replayed: { token: 'Replayed', phrase: 'Replay passed' },
  'replay-failed': { token: 'Replay failed', phrase: 'Replay failed' },
  timeout: { token: 'Timeout', phrase: 'Replay timeout' },
  error: { token: 'Error', phrase: 'Replay error' },
  unchecked: { token: 'Unchecked', phrase: 'Not checked' },
  located: { token: 'Located', phrase: 'Available when last checked' },
  unavailable: { token: 'Unavailable', phrase: 'Unavailable when last checked' },
  theorem: { token: 'Theorem', phrase: 'Theorem proving' },
  smt: { token: 'SMT', phrase: 'SMT verification' },
  checking: { token: 'Checking', phrase: 'Model checking' },
} as const;
export type StatusKind = keyof typeof statusCopy;

export function availabilityKind(bundle: AtlasBundle, artifactId: string, locationId: string): StatusKind {
  const record = availabilityFor(bundle, artifactId, locationId);
  if (!record) return 'unchecked';
  return record.result === 'available' ? 'located' : 'unavailable';
}

const icons: Record<StatusKind, ReactNode> = {
  direct: <circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" />,
  related: <><circle cx="6" cy="8" r="3" /><circle cx="10" cy="8" r="3" /></>,
  unknown: <circle cx="8" cy="8" r="5" strokeDasharray="2 2" />,
  bounded: <rect x="3" y="3" width="10" height="10" rx="1" />,
  unbounded: <circle cx="8" cy="8" r="5" />,
  unreviewed: <path d="M3 8h10" />,
  reviewed: <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />,
  inconclusive: <><circle cx="8" cy="8" r="5" /><path d="M8 3v10" /></>,
  'no-replay': <><circle cx="8" cy="8" r="5" /><path d="M5 8h6" /></>,
  replayed: <><circle cx="8" cy="8" r="5" /><path d="M5 8.2 7.2 10.4 11.2 5.8" /></>,
  'replay-failed': <><circle cx="8" cy="8" r="5" /><rect x="6" y="6" width="4" height="4" /></>,
  timeout: <><circle cx="8" cy="8" r="5" /><path d="M8 5.5V8l2 1.5" /></>,
  error: <rect x="3" y="3" width="10" height="10" rx="3" />,
  unchecked: <circle cx="8" cy="8" r="5" strokeDasharray="1 2" />,
  located: <path d="M8 13.5s4-3.4 4-6.2A4 4 0 0 0 4 7.3c0 2.8 4 6.2 4 6.2z" />,
  unavailable: <><path d="M8 13.5s4-3.4 4-6.2A4 4 0 0 0 4 7.3c0 2.8 4 6.2 4 6.2z" /><path d="M3 14h4" /></>,
  theorem: <path d="M3 4h10M3 8h10M3 12h7" />,
  smt: <><rect x="3" y="3" width="4" height="4" /><rect x="9" y="3" width="4" height="4" /><rect x="3" y="9" width="4" height="4" /><rect x="9" y="9" width="4" height="4" /></>,
  checking: <><rect x="3" y="3" width="10" height="10" /><path d="M3 8h10M8 3v10" /></>,
};

export function StatusToken({ kind }: { kind: StatusKind }) {
  const id = useId();
  const copy = statusCopy[kind];
  return <span className="status-wrap">
    <button type="button" className="status-token" aria-describedby={id}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{icons[kind]}</svg>
      <span>{copy.token}</span>
    </button>
    <span id={id} role="tooltip" className="token-explain">{copy.phrase}</span>
  </span>;
}
