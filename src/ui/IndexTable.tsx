import { useMemo } from 'react';
import type { AtlasBundle, ArchitectureView } from '../domain/schema';
import { buildIndex } from '../domain/indexLayout';

type Props = { bundle: AtlasBundle; view: ArchitectureView; selected: string | null; onSelect: (id: string) => void };

export function IndexTable({ bundle, view, selected, onSelect }: Props) {
  const table = useMemo(() => buildIndex(bundle, view), [bundle, view]);
  const rows = useMemo(() => table.bands.flatMap((band, bandIndex) =>
    band.cells.map(cell => ({ cell, bandIndex }))), [table]);
  return <section className="index-view" aria-label="Claims index table">
    <div className="index-scroll"><table className="index-table">
      <caption>Catalogued claims per component in this view. Foundations sit on the left, consumers to the right.
        Shading reflects the claim count, not a coverage score.</caption>
      <thead><tr>{table.bands.map(band => <th key={band.key} scope="col"></th>)}</tr></thead>
      <tbody>{rows.map(({ cell, bandIndex }) => <tr key={cell.instanceId}>
        <th scope="row"><span className="index-name">{cell.name}</span>
          <span className="row-area">{cell.area}</span></th>
        {table.bands.map((band, index) => <td key={band.key}>{index === bandIndex &&
          <button type="button"
            className={`index-cell band-${cell.band}`} aria-pressed={selected === cell.instanceId}
            aria-label={`${cell.name}: ${cell.count ? `Claims: ${cell.count}` : 'No catalogued claims'}`}
            title={cell.count ? undefined : 'No catalogued claims'}
            onClick={() => onSelect(cell.instanceId)}>
            <span className="index-count">{cell.count ? `Claims: ${cell.count}` : '0 claims'}</span>
          </button>}</td>)}
      </tr>)}</tbody>
    </table></div>
  </section>;
}
