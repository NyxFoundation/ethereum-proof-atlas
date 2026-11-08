import { useMemo } from 'react';
import type { AtlasBundle, ArchitectureView } from '../domain/schema';
import { buildIndex, COLUMN_GROUPS } from '../domain/indexLayout';

type Props = { bundle: AtlasBundle; view: ArchitectureView; selected: string | null; onSelect: (id: string) => void };

export function IndexTable({ bundle, view, selected, onSelect }: Props) {
  const table = useMemo(() => buildIndex(bundle, view), [bundle, view]);
  const labelOf = new Map(COLUMN_GROUPS.map(group => [group.id, group.label] as const));
  return <section className="index-view" aria-label="Claims index table">
    <div className="index-scroll"><table className="index-table">
      <caption>Catalogued claims per component in this view. Shading reflects the claim count, not a coverage score.</caption>
      <tbody>{table.rows.map(row => <tr key={row.group}>
        <th scope="row">{labelOf.get(row.group)}</th>
        {Array.from({ length: table.columns }, (_, index) => {
          const cell = row.cells[index];
          return <td key={index}>{cell && <button type="button"
            className={`index-cell band-${cell.band}`} aria-pressed={selected === cell.instanceId}
            aria-label={`${cell.name}: ${cell.count ? `Claims: ${cell.count}` : 'No catalogued claims'}`}
            title={cell.count ? undefined : 'No catalogued claims'}
            onClick={() => onSelect(cell.instanceId)}>
            <span className="index-name">{cell.name}</span>
            <span className="index-count">{cell.count ? `Claims: ${cell.count}` : '0 claims'}</span>
          </button>}</td>;
        })}
      </tr>)}</tbody>
    </table></div>
  </section>;
}
