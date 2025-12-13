/**
 * Context Graph Visualizer
 * Professional graph visualization using Cytoscape.js
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import cytoscape, { Core, NodeSingular, EdgeSingular } from 'cytoscape';

interface ContextGraphVisualProps {
  nodes: any[];
  edges: any[];
  onNodeSelect?: (node: any | null) => void;
  selectedNodeId?: string | null;
  filterStage?: string | null;
}

// Risk level color mapping
const RISK_COLORS: Record<string, string> = {
  critical: '#d32f2f',
  high: '#f57c00',
  medium: '#fbc02d',
  low: '#388e3c',
  safe: '#90a4ae',
  none: '#90a4ae',
};

// Get color for risk level
function getRiskColor(riskLevel: string | undefined | null): string {
  if (!riskLevel) return RISK_COLORS.safe;
  const normalized = riskLevel.toLowerCase();
  return RISK_COLORS[normalized] || RISK_COLORS.safe;
}

// Get safe risk level from node data
function getSafeRiskLevel(data: any): string {
  return data?.risk_level || data?.risk || data?.level || 'safe';
}

// Extract stage from node
function extractStage(node: any): string {
  return (
    node?.stage ||
    node?.pipeline_stage ||
    node?.step ||
    node?.context_stage ||
    'analysis'
  );
}

// Check if node has drift
function hasDrift(node: any): boolean {
  const driftScore = node?.drift_score;
  const riskBefore = node?.risk_before || node?.previous_risk;
  const riskAfter = node?.risk_after || node?.current_risk;
  const hasChanged = node?.changed === true || node?.has_changed === true;
  
  return (
    (typeof driftScore === 'number' && driftScore > 0) ||
    hasChanged ||
    (riskBefore && riskAfter && riskBefore !== riskAfter)
  );
}

// Convert nodes/edges to Cytoscape format
function convertToCytoscape(
  nodes: any[], 
  edges: any[], 
  filterStage: string | null = null,
  selectedNodeId: string | null = null
): { nodes: any[]; edges: any[]; nodeIdMap: Map<string, string> } {
  // Filter nodes by stage if filterStage is provided
  let filteredNodes = nodes;
  if (filterStage !== null) {
    filteredNodes = nodes.filter((node) => extractStage(node) === filterStage);
  }
  // A) Node mapping with guaranteed unique string ID
  const nodeIdMap = new Map<string, string>(); // Maps original ID to guaranteed unique ID
  const cyNodes = filteredNodes.map((node, idx) => {
    // Guaranteed unique ID logic:
    // 1. If node.id exists → use node.id (ensure it's a string)
    // 2. Else if node.label exists → use "node_" + index
    // 3. Else → use "node_" + index
    let id: string;
    if (node.id && typeof node.id === 'string') {
      id = node.id;
    } else if (node.label && typeof node.label === 'string') {
      id = `node_${idx}`;
    } else {
      id = `node_${idx}`;
    }
    
    // Ensure uniqueness by appending index if duplicate
    let uniqueId = id;
    let counter = 0;
    while (nodeIdMap.has(uniqueId)) {
      uniqueId = `${id}_${counter}`;
      counter++;
    }
    nodeIdMap.set(uniqueId, uniqueId);
    
    const label = node.label || id || `Node ${idx}`;
    const riskLevel = getSafeRiskLevel(node);
    const color = getRiskColor(riskLevel);
    const nodeDrift = hasDrift(node);
    const isSelected = selectedNodeId && (uniqueId === selectedNodeId || node.id === selectedNodeId);

    return {
      data: {
        id: uniqueId,
        label,
        type: node.type || 'unknown',
        risk_level: riskLevel,
        stage: extractStage(node),
        hasDrift: nodeDrift,
        __rawNode: node, // Store original node for callbacks
        ...node, // Include all original properties
      },
      style: {
        'background-color': color,
        'border-color': nodeDrift ? '#ff6b6b' : (isSelected ? '#2563eb' : '#333'),
        'border-width': isSelected ? 4 : (nodeDrift ? 3 : 2),
        'label': label.length > 20 ? label.substring(0, 20) + '...' : label,
        'text-valign': 'center',
        'text-halign': 'center',
        'color': '#fff',
        'font-size': '12px',
        'font-weight': 'bold',
        'width': isSelected ? '70px' : '60px',
        'height': isSelected ? '70px' : '60px',
        'shape': 'ellipse',
      },
    };
  });

  // B) Edge mapping validation - skip if source or target is missing
  // Also filter edges to only include those where both nodes are in filtered set
  const filteredNodeIds = new Set(cyNodes.map(n => n.data.id));
  const cyEdges: any[] = [];
  edges.forEach((edge, idx) => {
    // Validate source and target exist
    if (!edge.source || !edge.target) {
      console.warn(`Edge ${idx} skipped: missing source or target`, edge);
      return; // Skip this edge
    }
    
    // Map source/target to actual node IDs
    const sourceId = nodeIdMap.get(String(edge.source)) || String(edge.source);
    const targetId = nodeIdMap.get(String(edge.target)) || String(edge.target);
    
    // Verify source and target nodes exist in filtered set
    const sourceExists = filteredNodeIds.has(sourceId);
    const targetExists = filteredNodeIds.has(targetId);
    
    if (!sourceExists || !targetExists) {
      // Silently skip if filtering by stage (expected behavior)
      if (filterStage !== null) {
        return;
      }
      console.warn(`Edge ${idx} skipped: source or target node not found`, { sourceId, targetId });
      return; // Skip this edge
    }

    const relation = edge.relation || edge.label || 'related';

    cyEdges.push({
      data: {
        id: `edge_${idx}`,
        source: sourceId,
        target: targetId,
        relation,
        label: edge.label || relation,
        ...edge, // Include all original properties
      },
      style: {
        'width': 2,
        'line-color': '#666',
        'target-arrow-color': '#666',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'label': relation.length > 15 ? relation.substring(0, 15) + '...' : relation,
        'font-size': '10px',
        'color': '#333',
      },
    });
  });

  return { nodes: cyNodes, edges: cyEdges, nodeIdMap };
}

export default function ContextGraphVisual({ 
  nodes, 
  edges, 
  onNodeSelect,
  selectedNodeId,
  filterStage 
}: ContextGraphVisualProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
  const layoutRunRef = useRef<boolean>(false); // Track if layout has been run

  useEffect(() => {
    // C) Fix layout crash on empty graph - early return
    const safeNodes = Array.isArray(nodes) ? nodes : [];
    const safeEdges = Array.isArray(edges) ? edges : [];

    if (safeNodes.length === 0) {
      // Cleanup previous instance
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
      return; // Do NOT initialize cytoscape layout
    }

    if (!containerRef.current) return;

    // Cleanup previous instance
    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
      layoutRunRef.current = false;
    }

    // Convert to Cytoscape format
    const { nodes: cyNodes, edges: cyEdges } = convertToCytoscape(
      safeNodes, 
      safeEdges, 
      filterStage || null,
      selectedNodeId || null
    );

    // Default layout (grid)
    let layoutOptions: any = {
      name: 'grid',
      rows: safeNodes.length > 0 ? Math.ceil(Math.sqrt(safeNodes.length)) : 1,
      cols: safeNodes.length > 0 ? Math.ceil(Math.sqrt(safeNodes.length)) : 1,
    };

    // Try to load and use cose-bilkent layout
    import('cytoscape-cose-bilkent')
      .then((module) => {
        const coseBilkent = module.default || module;
        cytoscape.use(coseBilkent);
        layoutOptions = {
          name: 'cose-bilkent',
          idealEdgeLength: 100,
          nodeRepulsion: 4500,
          edgeElasticity: 0.45,
          nestingFactor: 0.1,
          gravity: 0.25,
          numIter: 2500,
          tile: true,
          animate: true,
          animationDuration: 1000,
          animationEasing: 'ease-out',
        };
      })
      .catch(() => {
        console.warn('cose-bilkent layout not available, using grid fallback');
      })
      .finally(() => {
        if (!containerRef.current) return;

        // Initialize Cytoscape
        const cy = cytoscape({
          container: containerRef.current,
          elements: [...cyNodes, ...cyEdges],
          style: [
            {
              selector: 'node',
              style: {
                'background-color': 'data(background-color)',
                'border-color': 'data(border-color)',
                'border-width': 'data(border-width)',
                'label': 'data(label)',
                'text-valign': 'data(text-valign)' as any,
                'text-halign': 'data(text-halign)' as any,
                'color': 'data(color)',
                'font-size': 'data(font-size)',
                'font-weight': 'data(font-weight)',
                'width': 'data(width)',
                'height': 'data(height)',
                'shape': 'data(shape)',
              } as any,
            },
            {
              selector: 'edge',
              style: {
                'width': 'data(width)',
                'line-color': 'data(line-color)',
                'target-arrow-color': 'data(target-arrow-color)',
                'target-arrow-shape': 'data(target-arrow-shape)',
                'curve-style': 'data(curve-style)',
                'label': 'data(label)',
                'font-size': 'data(font-size)',
                'color': 'data(color)',
              },
            },
          ],
          minZoom: 0.1,
          maxZoom: 4,
          wheelSensitivity: 0.2,
        });

        // D) Fix cose-bilkent crash with try-catch
        // E) Performance: Run layout ONLY once after initialization
        if (!layoutRunRef.current) {
          try {
            const layout = cy.layout(layoutOptions);
            layout.run();
            layoutRunRef.current = true;
          } catch (e) {
            console.warn('Layout failed, trying grid fallback:', e);
            try {
              cy.layout({
                name: 'grid',
                rows: safeNodes.length > 0 ? Math.ceil(Math.sqrt(safeNodes.length)) : 1,
                cols: safeNodes.length > 0 ? Math.ceil(Math.sqrt(safeNodes.length)) : 1,
              }).run();
              layoutRunRef.current = true;
            } catch (fallbackError) {
              console.error('Grid layout also failed:', fallbackError);
            }
          }
        }

        // E) Tooltip on hover - nodes (with null safety)
        cy.on('mouseover', 'node', (evt: any) => {
          try {
            const node = evt.target as NodeSingular;
            const data = node.data() || {};
            const riskLevel = getSafeRiskLevel(data);
            const label = data.label || data.id || 'Unknown';
            const type = data.type || 'unknown';
            
            const tooltipContent = `
              <div class="p-2">
                <div class="font-semibold text-sm">${String(label)}</div>
                <div class="text-xs mt-1">Type: ${String(type)}</div>
                <div class="text-xs">Risk: ${String(riskLevel)}</div>
              </div>
            `;

            const position = node.renderedPosition();
            const container = containerRef.current;
            if (container) {
              const rect = container.getBoundingClientRect();
              setTooltip({
                x: rect.left + position.x,
                y: rect.top + position.y - 80,
                content: tooltipContent,
              });
            }
          } catch (err) {
            console.warn('Tooltip error:', err);
          }
        });

        cy.on('mouseout', 'node', () => {
          setTooltip(null);
        });

        // E) Tooltip on hover - edges (with null safety)
        cy.on('mouseover', 'edge', (evt: any) => {
          try {
            const edge = evt.target as EdgeSingular;
            const data = edge.data() || {};
            const relation = data.relation || data.label || 'relation';
            const source = data.source || 'unknown';
            const target = data.target || 'unknown';
            
            const tooltipContent = `
              <div class="p-2">
                <div class="font-semibold text-sm">${String(relation)}</div>
                <div class="text-xs mt-1">${String(source)} → ${String(target)}</div>
              </div>
            `;

            const position = edge.midpoint();
            const container = containerRef.current;
            if (container) {
              const rect = container.getBoundingClientRect();
              setTooltip({
                x: rect.left + position.x,
                y: rect.top + position.y - 60,
                content: tooltipContent,
              });
            }
          } catch (err) {
            console.warn('Edge tooltip error:', err);
          }
        });

        cy.on('mouseout', 'edge', () => {
          setTooltip(null);
        });

        // Node click handler
        cy.on('tap', 'node', (evt: any) => {
          try {
            const node = evt.target as NodeSingular;
            const data = node.data() || {};
            const rawNode = data.__rawNode || data;
            
            if (onNodeSelect) {
              onNodeSelect(rawNode);
            }
          } catch (err) {
            console.warn('Node select error:', err);
          }
        });

        // Deselect on background click
        cy.on('tap', (evt: any) => {
          if (evt.target === cy) {
            if (onNodeSelect) {
              onNodeSelect(null);
            }
          }
        });

        // Store reference
        cyRef.current = cy;
      });

    // Cleanup
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
      layoutRunRef.current = false;
      setTooltip(null);
    };
  }, [nodes, edges, filterStage, selectedNodeId, onNodeSelect]);

  // Empty state - C) Fix layout crash on empty graph
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeEdges = Array.isArray(edges) ? edges : [];

  if (safeNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-500">No graph data available</p>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div
        ref={containerRef}
        className="w-full h-96 border border-gray-200 rounded-lg bg-white"
        style={{ minHeight: '400px' }}
      />
      
      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 text-white rounded-lg shadow-lg pointer-events-none px-3 py-2"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translateX(-50%)',
          }}
          dangerouslySetInnerHTML={{ __html: tooltip.content }}
        />
      )}

      {/* Controls hint */}
      <div className="mt-2 text-xs text-gray-500 text-center">
        <span>Zoom: Scroll wheel | Pan: Click and drag</span>
      </div>
    </div>
  );
}
