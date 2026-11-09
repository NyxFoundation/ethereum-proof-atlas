import type { AtlasBundle, SourceReference } from '../domain/schema';
import { availabilityFor, sourceFor } from '../domain/selectors';
import { availabilityKind, StatusToken } from './status';

export function Sources({ bundle, sources, showAvailability = true, tokens = false }: {
  bundle: AtlasBundle; sources: SourceReference[]; showAvailability?: boolean; tokens?: boolean;
}) {
  return <ul className="sources">{sources.map((ref, i) => {
    const { artifact, location } = sourceFor(bundle, ref);
    const availability = availabilityFor(bundle, artifact.id, location.id);
    return <li key={i}>
      <a href={location.url} target="_blank" rel="noopener noreferrer">{location.label}</a>
      <span className="source-identity">{artifact.title} · {artifact.kind}</span>
      {tokens && <StatusToken kind={availabilityKind(bundle, artifact.id, location.id)} />}
      {!tokens && showAvailability && <span className="source-identity">{!availability ? 'Not checked' :
        `${availability.result === 'available' ? 'Available when last checked' : 'Unavailable when last checked'} · ${availability.checkedAt.slice(0, 10)}`}</span>}
    </li>;
  })}</ul>;
}
