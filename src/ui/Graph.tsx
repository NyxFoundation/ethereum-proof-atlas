import { useMemo } from 'react';
import { Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, useReactFlow, type Node, type NodeProps } from '@xyflow/react';
import type { AtlasBundle, ArchitectureView } from '../domain/schema';
import { claimsFor, visibleEdges, visibleInstances } from '../domain/selectors';

type NodeData = { name: string; area: string; count: number; expandable: boolean; expanded: boolean;
  select: () => void; expand: () => void };
type AtlasNode = Node<NodeData, 'atlas'>;
export function ComponentNode({ data }: NodeProps<AtlasNode>) {
  return <div className={`component-node area-${data.area}`}>
    <Handle type="target" position={Position.Bottom} isConnectable={false} />
    <span className="node-area">{data.area}</span>
    <button className="node-select nodrag nopan" onClick={data.select} aria-label={`Select ${data.name}`}>{data.name}</button>
    <span className="node-count" title={data.count ? undefined : 'No catalogued claims'}>{data.count ? `Claims: ${data.count}` : '0 claims'}</span>
    {data.expandable && <button className="node-expand nodrag nopan" onClick={data.expand} aria-expanded={data.expanded}
      aria-label={`${data.expanded ? 'Collapse' : 'Expand'} ${data.name}`}>{data.expanded ? '− Collapse' : '+ Expand'}</button>}
    <Handle type="source" position={Position.Top} isConnectable={false} />
  </div>;
}
const nodeTypes = { atlas: ComponentNode };
export function MapControls() {
  const flow = useReactFlow();
  const pan = (x: number, y: number) => { const v = flow.getViewport(); void flow.setViewport({ ...v, x: v.x + x, y: v.y + y }); };
  return <div className="map-controls" role="toolbar" aria-label="Map navigation">
    <button onClick={() => void flow.zoomIn()} aria-label="Zoom in">+</button>
    <button onClick={() => void flow.zoomOut()} aria-label="Zoom out">−</button>
    <button onClick={() => void flow.fitView({ padding: 0.12 })}>Fit map</button>
    <button onClick={() => pan(120, 0)} aria-label="Pan left">←</button>
    <button onClick={() => pan(-120, 0)} aria-label="Pan right">→</button>
    <button onClick={() => pan(0, 120)} aria-label="Pan up">↑</button>
    <button onClick={() => pan(0, -120)} aria-label="Pan down">↓</button>
  </div>;
}
type Props = { bundle: AtlasBundle; view: ArchitectureView; expanded: ReadonlySet<string>; selected: string | null;
  onSelect: (id: string) => void; onExpand: (id: string) => void; onEdge: (id: string) => void };
export function Graph({ bundle, view, expanded, selected, onSelect, onExpand, onEdge }: Props) {
  const nodes = useMemo(() => visibleInstances(view, expanded).map(instance => {
    const component = bundle.components.find(c => c.id === instance.componentId)!;
    return { id: instance.instanceId, type: 'atlas' as const, position: instance.position,
      selected: selected === instance.instanceId, ariaLabel: component.name,
      data: { name: component.name, area: component.area, count: claimsFor(bundle, view.id, instance.instanceId).length,
        expandable: view.componentInstances.some(i => i.parentInstanceId === instance.instanceId),
        expanded: expanded.has(instance.instanceId), select: () => onSelect(instance.instanceId), expand: () => onExpand(instance.instanceId) } };
  }), [bundle, view, expanded, selected, onSelect, onExpand]);
  const edges = visibleEdges(bundle, view, expanded).map(edge => ({
    id: edge.id, source: edge.source, target: edge.target, label: edge.label,
    className: `edge-${edge.kind}`, ariaLabel: `${edge.label}: ${edge.kind}`,
    markerEnd: { type: MarkerType.ArrowClosed }, focusable: true, reconnectable: false,
  }));
  return <section className="map" aria-label="Architecture diagram"><ReactFlowProvider>
    <ReactFlow<AtlasNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.12 }}
      nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false} connectOnClick={false}
      deleteKeyCode={null} multiSelectionKeyCode={null} minZoom={0.2} maxZoom={2} nodesFocusable edgesFocusable
      onNodeClick={(_event, node) => onSelect(node.id)} onEdgeClick={(_event, edge) => onEdge(edge.id)}
      ariaLabelConfig={{ 'node.a11yDescription.default': 'Press Enter to select. Nodes are read-only and cannot be moved.',
        'node.a11yDescription.keyboardDisabled': 'Select a component to read its claims.' }}>
      <MapControls />
    </ReactFlow>
  </ReactFlowProvider></section>;
}
