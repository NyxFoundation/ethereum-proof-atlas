import { useMemo } from 'react';
import type { AtlasBundle, ArchitectureView } from '../domain/schema';
import { buildIndex } from '../domain/indexLayout';

type Props = { bundle: AtlasBundle; view: ArchitectureView; selected: string | null; onSelect: (id: string) => void };

export function IndexTable({ bundle, view, selected, onSelect }: Props) {
  const rows = useMemo(() => buildIndex(bundle, view).rows, [bundle, view]);
  return <section className="index-view" aria-label="Claims index table">
    <div className="index-scroll"><table className="index-table">
      <caption>Catalogued claims per component in this view. Shading reflects the claim count, not a coverage score.</caption>
      <thead><tr><th scope="col" className="index-claims-head">Catalogued claims</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.instanceId}>
        <th scope="row"><span className="index-name">{row.name}</span>
          <span className="row-area">{row.area}</span></th>
        <td><button type="button"
          className={`index-cell band-${row.band}`} aria-pressed={selected === row.instanceId}
          aria-label={`${row.name}: ${row.count ? `Claims: ${row.count}` : 'No catalogued claims'}`}
          title={row.count ? undefined : 'No catalogued claims'}
          onClick={() => onSelect(row.instanceId)}>
          <span className="index-count">{row.count ? `Claims: ${row.count}` : '0 claims'}</span>
        </button></td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}
