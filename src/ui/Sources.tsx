import type { AtlasBundle, SourceReference } from '../domain/schema';
import { availabilityFor, sourceFor } from '../domain/selectors';
import { revisionHref } from './links';

export function Sources({ bundle, sources, showAvailability = true }: {
  bundle: AtlasBundle; sources: SourceReference[]; showAvailability?: boolean;
}) {
  return <ul className="sources">{sources.map((ref, i) => {
    const { artifact, location } = sourceFor(bundle, ref);
    const availability = availabilityFor(bundle, artifact.id, location.id);
    const href = revisionHref(artifact);
    return <li key={i}>
      <a href={location.url} target="_blank" rel="noopener noreferrer">{location.label}</a>
      <span className="source-identity">{artifact.title} · {artifact.kind}</span>
      <code>{href ? <a href={href} target="_blank" rel="noopener noreferrer"
        title={`Browse revision ${artifact.revision}`}>{artifact.revision}</a> : artifact.revision}</code><span className="source-identity">{artifact.version}</span>
      {showAvailability && <span className="source-identity">{!availability ? 'Not checked' :
        `${availability.result === 'available' ? 'Available when last checked' : 'Unavailable when last checked'} · ${availability.checkedAt.slice(0, 10)}`}</span>}
    </li>;
  })}</ul>;
}
