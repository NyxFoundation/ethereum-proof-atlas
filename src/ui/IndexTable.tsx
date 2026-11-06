import { useMemo } from 'react';
import type { AtlasBundle, ArchitectureView } from '../domain/schema';
import { buildIndex, COLUMN_GROUPS } from '../domain/indexLayout';

type Props = { bundle: AtlasBundle; view: ArchitectureView; selected: string | null; onSelect: (id: string) => void };

export function IndexTable({ bundle, view, selected, onSelect }: Props) {
  const rows = useMemo(() => buildIndex(bundle, view).rows, [bundle, view]);
  return <section className="index-view" aria-label="Claims index table">
    <div className="index-scroll"><table className="index-table">
      <caption>Catalogued claims per component in this view. Foundations sit at the bottom, consumers above.
        Shading reflects the claim count, not a coverage score.</caption>
      <thead><tr>{COLUMN_GROUPS.map(group =>
        <th key={group.id} scope="col">{group.label}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.key}>{COLUMN_GROUPS.map(group => {
        const cells = row.cells.filter(cell => cell.column === group.id);
        return <td key={group.id}>{cells.map(cell =>
          <button key={cell.instanceId} type="button"
            className={`index-cell band-${cell.band}`} aria-pressed={selected === cell.instanceId}
            aria-label={`${cell.name}: ${cell.count ? `Claims: ${cell.count}` : 'No catalogued claims'}`}
            title={cell.count ? undefined : 'No catalogued claims'}
            onClick={() => onSelect(cell.instanceId)}>
            <span className="index-name">{cell.name}</span>
            <span className="index-count">{cell.count ? `Claims: ${cell.count}` : '0 claims'}</span>
          </button>)}</td>;
      })}</tr>)}</tbody>
    </table></div>
  </section>;
}
