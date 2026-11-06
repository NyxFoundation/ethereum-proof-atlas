import { useMemo } from 'react';
import type { AtlasBundle, ArchitectureView } from '../domain/schema';
import { buildIndex, COLUMN_GROUPS } from '../domain/indexLayout';

type Props = { bundle: AtlasBundle; view: ArchitectureView; selected: string | null; onSelect: (id: string) => void };

export function IndexTable({ bundle, view, selected, onSelect }: Props) {
  const bands = useMemo(() => buildIndex(bundle, view).bands, [bundle, view]);
  return <section className="index-view" aria-label="Claims index table">
    <div className="index-scroll"><table className="index-table">
      <caption>Catalogued claims per component in this view. Foundations sit on the left, consumers to the right.
        Shading reflects the claim count, not a coverage score.</caption>
      <thead><tr>{bands.map(band => <th key={band.key} scope="col"></th>)}</tr></thead>
      <tbody>{COLUMN_GROUPS.map(col => <tr key={col.id}>
        <th scope="row">{col.label}</th>
        {bands.map(band => {
          const cells = band.cells.filter(cell => cell.group === col.id);
          return <td key={band.key}>{cells.map(cell =>
            <button key={cell.instanceId} type="button"
              className={`index-cell band-${cell.band}`} aria-pressed={selected === cell.instanceId}
              aria-label={`${cell.name}: ${cell.count ? `Claims: ${cell.count}` : 'No catalogued claims'}`}
              title={cell.count ? undefined : 'No catalogued claims'}
              onClick={() => onSelect(cell.instanceId)}>
              <span className="index-name">{cell.name}</span>
              <span className="index-count">{cell.count ? `Claims: ${cell.count}` : '0 claims'}</span>
            </button>)}</td>;
        })}
      </tr>)}</tbody>
    </table></div>
  </section>;
}
