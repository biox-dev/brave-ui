import {
  Background,
  Controls,
  Handle,
  type Node,
  type Edge,
  Position,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo } from 'react';
import { Button, Popover, Tag, Tooltip, theme } from 'antd';
import { CodeOutlined, EditOutlined } from '@ant-design/icons';

import { memo } from 'react';
import { useOutletContext } from 'react-router';
import { invoke } from '@/core/ui-system/invokeV2';
import { useGlobalMessage } from '@/hooks/useGlobalMessage';

// const initialNodes = [
//   {
//     id: '1',
//     type: 'custom',
//     position: { x: 0, y: 100 },
//     data: {
//       label: 'Join with Store details',
//       color: '#2E7D32',
//       inputs: [],
//       outputs: ['out1', 'out2'],
//     },
//   },
//   {
//     id: '2',
//     type: 'custom',
//     position: { x: 250, y: 60 },
//     data: {
//       label: 'Filter for selected store',
//       color: '#7B1FA2',
//       inputs: ['in1', 'in2'],
//       outputs: ['out1', 'out2'],
//     },
//   },
//   {
//     id: '3',
//     type: 'custom',
//     position: { x: 500, y: 120 },
//     data: {
//       label: 'Calculate variance',
//       color: '#512DA8',
//       inputs: ['in1'],
//       outputs: ['out1', 'out2'],
//     },
//   },
// ];

// const initialEdges = [
//   {
//     id: 'e1-2',
//     source: '1',
//     sourceHandle: 'out1',
//     target: '2',
//     targetHandle: 'in1',
//     type: 'smoothstep',
//   },
//   {
//     id: 'e2-3',
//     source: '2',
//     sourceHandle: 'out1',
//     target: '3',
//     targetHandle: 'in1',
//     type: 'smoothstep',
//   },
// ];
const NODE_MIN_WIDTH = 260;
const PORT_ROW_HEIGHT = 28;

const ioColorByKind: Record<string, string> = {
  fastq: '#5B8FF9',
  bam: '#36CFC9',
  vcf: '#9254DE',
  matrix: '#73D13D',
  report: '#FAAD14',
  default: '#8C8C8C',
};

function inferPortColor(port: any): string {
  const kind = String(port?.type || port?.format || '').toLowerCase();
  return ioColorByKind[kind] || ioColorByKind.default;
}

function formatPortTitle(port: any): string {
  const primary = port?.display_name || port?.name || port?.id || 'port';
  const dataType = port?.type || port?.format || '';
  return dataType ? `${primary} (${dataType})` : primary;
}

export default function App({
  nodes,
  edges,
  setNodes,
  setEdges,
}: {
  nodes: Node[];
  edges: Edge[];
  setNodes: any;
  setEdges: any;
}) {
  const { token } = theme.useToken();
  const isDark = token.colorBgBase === '#000';

  const messageApi = useGlobalMessage();

  // useEffect(() => {
  //   setNodes(nodes)
  // }, [nodes])
  // useEffect(() => {
  //   console.log(nodes)
  // }, [nodes])

  const onNodesChange = useCallback(
    (changes: any) => setNodes((nodesSnapshot: any) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: any) => setEdges((edgesSnapshot: any) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  );
  const onConnect = useCallback(
    (params: any) => setEdges((edgesSnapshot: any) => addEdge(params, edgesSnapshot)),
    [],
  );

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  const deleteSelectedElements = useCallback(() => {
    const selectedNodeIds = new Set(
      nodes.filter((node: any) => node.selected).map((node: any) => node.id),
    );
    const selectedEdgeIds = new Set(
      edges.filter((edge: any) => edge.selected).map((edge: any) => edge.id),
    );

    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) {
      return;
    }

    setNodes((nodesSnapshot: any[]) =>
      nodesSnapshot.filter((node: any) => !selectedNodeIds.has(node.id)),
    );
    setEdges((edgesSnapshot: any[]) =>
      edgesSnapshot.filter(
        (edge: any) =>
          !selectedEdgeIds.has(edge.id)
          && !selectedNodeIds.has(edge.source)
          && !selectedNodeIds.has(edge.target),
      ),
    );

    messageApi.success('删除成功');
  }, [nodes, edges, setNodes, setEdges, messageApi]);

  useEffect(() => {
    const handleDeleteKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTyping =
        tagName === 'input'
        || tagName === 'textarea'
        || target?.isContentEditable;

      if (isTyping) {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelectedElements();
      }
    };

    window.addEventListener('keydown', handleDeleteKey);
    return () => window.removeEventListener('keydown', handleDeleteKey);
  }, [deleteSelectedElements]);

  // const loadData = async () => {
  //   const res = await axios.get(`/get-pipeline-dag/59bead89-13af-4956-951a-1dcef1b3b7a3`)
  //   console.log(res)
  //   const initialNodes = res.data.nodes.map((c: any, index: number) => ({
  //     id: c.component_id,
  //     // position: c.position,
  //     position: c.position || { x: 0, y: index * 100 },

  //     data: { label: c.component_id },
  //   }));
  //   setNodes(initialNodes)
  //   const initialEdges = res.data.edges.map((e: any) => ({
  //     id: `${e.source}-${e.target}`,
  //     source: e.source,
  //     target: e.target,
  //   }));
  //   setEdges(initialEdges)
  //   console.log(initialNodes)
  //   console.log(initialEdges)
  // }
  // useEffect(() => {
  //     loadData()
  // }, [])

  return (
    <div style={{ height: '60vh' }}>
      {/* <Button onClick={loadData}>loadData</Button> */}
      {/* {JSON.stringify(edges)} */}

      <ReactFlow
        className="pipeline-flow-theme"
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}

        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        deleteKeyCode={null}
        fitView
      >
        <Controls
          position="bottom-left"
          style={{
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 8,
            background: token.colorBgElevated,
            boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.35)' : '0 2px 8px rgba(0, 0, 0, 0.08)',
          }}
        />
        <Background gap={12} size={1} />
      </ReactFlow>
      <style>
        {`
          .pipeline-flow-theme .react-flow__controls-button {
            background: ${token.colorBgElevated};
            border-bottom: 1px solid ${token.colorBorderSecondary};
            color: ${token.colorText};
          }
          .pipeline-flow-theme .react-flow__controls-button:hover {
            background: ${token.colorFillSecondary};
          }
          .pipeline-flow-theme .react-flow__controls-button svg {
            fill: ${token.colorText};
          }
          .pipeline-flow-theme .react-flow__minimap {
            background: ${token.colorBgElevated};
          }
        `}
      </style>
      {/* {JSON.stringify(initialNodes,null,2)} */}

    </div>
  );
}

export const CustomNode = memo(({ data, selected, isConnectable }: any) => {
  const { token } = theme.useToken();
  const inputs = data.inputs || [];
  const outputs = data.outputs || [];
  const bioMeta = data.bioMeta || {};
  const componentType = data.componentType || 'script';
  const isDark = token.colorBgBase === '#000';
  const accentColor = data.color || token.colorPrimary;
  const baseBorder = selected ? token.colorPrimary : token.colorBorderSecondary;
  const cardBg = token.colorBgContainer;
  const titleColor = token.colorText;
  const subTextColor = token.colorTextSecondary;

  return (
    <div
      style={{
        background: cardBg,
        color: titleColor,
        padding: '10px 10px 8px 10px',
        borderRadius: 10,
        minWidth: NODE_MIN_WIDTH,
        position: 'relative',
        border: `1px solid ${baseBorder}`,
        boxShadow: selected
          ? `0 0 0 1px ${token.colorPrimaryBorder}, inset 3px 0 0 0 ${accentColor}`
          : `${isDark ? '0 1px 3px rgba(0, 0, 0, 0.4)' : '0 1px 3px rgba(0, 0, 0, 0.08)'}, inset 3px 0 0 0 ${accentColor}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 700,
            fontSize: 13,
            lineHeight: 1.3,
            maxWidth: 170,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={data.label}
        >
          <span
            style={{
              width: 8,
              height: 8,
              minWidth: 8,
              borderRadius: '50%',
              background: accentColor,
              boxShadow: selected ? `0 0 0 2px ${accentColor}33` : 'none',
            }}
          />
          {data.label}
        </div>
        <Tag
          color="default"
          style={{
            marginInlineEnd: 0,
            borderRadius: 999,
            border: `1px solid ${token.colorBorderSecondary}`,
            color: subTextColor,
            background: token.colorFillQuaternary,
            fontSize: 10,
            textTransform: 'uppercase',
          }}
        >
          {componentType}
        </Tag>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <Tag color="default" style={{ marginInlineEnd: 0, borderRadius: 999, fontSize: 10 }}>
          IN {inputs.length}
        </Tag>
        <Tag color="default" style={{ marginInlineEnd: 0, borderRadius: 999, fontSize: 10 }}>
          OUT {outputs.length}
        </Tag>
        {bioMeta?.assay ? (
          <Tag color="default" style={{ marginInlineEnd: 0, borderRadius: 999, fontSize: 10 }}>
            {String(bioMeta.assay).slice(0, 14)}
          </Tag>
        ) : null}
      </div>

      {(bioMeta?.organism || bioMeta?.reference) && (
        <div
          style={{
            fontSize: 11,
            color: subTextColor,
            marginBottom: 8,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={`${bioMeta?.organism || ''} ${bioMeta?.reference || ''}`.trim()}
        >
          {bioMeta?.organism || 'Unknown organism'}
          {bioMeta?.reference ? ` | Ref: ${bioMeta.reference}` : ''}
        </div>
      )}

      <div
        style={{
          position: 'relative',
          minHeight: Math.max(inputs.length, outputs.length) * PORT_ROW_HEIGHT + 4,
          padding: '2px 0',
        }}
      >
        {inputs.map((input: any, index: number) => {
          const top = 16 + index * PORT_ROW_HEIGHT;
          const portColor = inferPortColor(input);

          return (
            <Popover key={input.id || `${index}-in`} content={<div>{formatPortTitle(input)}</div>}>
              <>
                <Handle
                  type="target"
                  position={Position.Left}
                  id={input.id}
                  isConnectable={isConnectable}
                  style={{
                    top,
                    left: -8,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    border: `2px solid ${token.colorBgContainer}`,
                    background: portColor,
                    boxShadow: selected ? `0 0 0 2px ${portColor}33` : 'none',
                  }}
                />
                <Tooltip title={formatPortTitle(input)}>
                  <div
                    style={{
                      position: 'absolute',
                      top: top - 9,
                      left: 14,
                      maxWidth: 108,
                      fontSize: 11,
                      lineHeight: '18px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: subTextColor,
                    }}
                  >
                    {input?.display_name || input?.id}
                  </div>
                </Tooltip>
              </>
            </Popover>
          );
        })}

        {outputs.map((output: any, index: number) => {
          const top = 16 + index * PORT_ROW_HEIGHT;
          const portColor = inferPortColor(output);

          return (
            <Popover key={output.id || `${index}-out`} content={<div>{formatPortTitle(output)}</div>}>
              <>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={output.id}
                  isConnectable={isConnectable}
                  style={{
                    top,
                    right: -8,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    border: `2px solid ${token.colorBgContainer}`,
                    background: portColor,
                    boxShadow: selected ? `0 0 0 2px ${portColor}33` : 'none',
                  }}
                />
                <Tooltip title={formatPortTitle(output)}>
                  <div
                    style={{
                      position: 'absolute',
                      top: top - 9,
                      right: 14,
                      maxWidth: 108,
                      fontSize: 11,
                      lineHeight: '18px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      textAlign: 'right',
                      color: subTextColor,
                    }}
                  >
                    {output?.display_name || output?.id}
                  </div>
                </Tooltip>
              </>
            </Popover>
          );
        })}
      </div>

      <div
        style={{
          position: 'absolute',
          right: 8,
          bottom: 6,
          display: 'flex',
          gap: 6,
        }}
      >
        <Button
          type="text"
          size="small"
          icon={<CodeOutlined style={{ fontSize: 11 }} />}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            invoke.scriptCodeEdit.open(
              { component_id: data.script_id },
              {
                width: "60%",
                title: `Code - ${data.label}`,
              }
            );
          }}
          style={{
            color: subTextColor,
            background: token.colorFillTertiary,
            borderRadius: 6,
            width: 20,
            height: 20,
            minWidth: 20,
            padding: 0,
            lineHeight: 1,
          }}
        />
        <Button
          type="text"
          size="small"
          icon={<EditOutlined style={{ fontSize: 11 }} />}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // console.log("Edit details for node", data.script_id);
            invoke.createOrUpdateComponent.openAsync(
              {
                component_id: data.script_id,
                structure: {
                  component_type: "script",
                },
              },
              {
                width: "60%",
                title: `Edit - ${data.label}`,
              }
            );
          }}
          style={{
            color: subTextColor,
            background: token.colorFillTertiary,
            borderRadius: 6,
            width: 20,
            height: 20,
            minWidth: 20,
            padding: 0,
            lineHeight: 1,
          }}
        />
      </div>
    </div>
  );
});
