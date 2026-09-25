import type {  WarehouseGraph, NodeId, RouteStep  } from '../types';

function heuristic(graph: WarehouseGraph, a: NodeId, b: NodeId): number {
  const nodeA = graph.nodes[a];
  const nodeB = graph.nodes[b];
  return Math.hypot(nodeA.x - nodeB.x, nodeA.y - nodeB.y);
}

export function aStar(
  graph: WarehouseGraph,
  start: NodeId,
  goal: NodeId,
  reservations: Record<string, string>,
  robotId: string,
  startTimeStep: number
): RouteStep[] | null {
  const openSet = new Set<NodeId>([start]);
  const cameFrom = new Map<NodeId, NodeId>();
  
  const gScore = new Map<NodeId, number>();
  gScore.set(start, 0);
  
  const fScore = new Map<NodeId, number>();
  fScore.set(start, heuristic(graph, start, goal));
  
  const timeStepMap = new Map<NodeId, number>();
  timeStepMap.set(start, startTimeStep);

  while (openSet.size > 0) {
    let current: NodeId | null = null;
    let lowestF = Infinity;
    
    for (const node of openSet) {
      const score = fScore.get(node) ?? Infinity;
      if (score < lowestF) {
        lowestF = score;
        current = node;
      }
    }
    
    if (!current) break;
    if (current === goal) {
      const path: NodeId[] = [current];
      let curr = current;
      while (cameFrom.has(curr)) {
        curr = cameFrom.get(curr)!;
        path.unshift(curr);
      }
      
      return path.map((nodeId, idx) => ({
        nodeId,
        x: graph.nodes[nodeId].x,
        y: graph.nodes[nodeId].y,
        timeStep: startTimeStep + idx
      }));
    }
    
    openSet.delete(current);
    const currTimeStep = timeStepMap.get(current) ?? startTimeStep;
    
    const neighbors = graph.nodes[current].neighbors;
    for (const neighbor of neighbors) {
      const nextTimeStep = currTimeStep + 1; // Simplified time increment
      
      const resKey = neighbor;
      if (reservations[resKey] && reservations[resKey] !== robotId) {
        // If simply blocked, skip
        continue;
      }
      
      const cost = Math.hypot(graph.nodes[current].x - graph.nodes[neighbor].x, graph.nodes[current].y - graph.nodes[neighbor].y);
      let penalty = 0;
      
      // small penalty for edges at perimeter to encourage internal aisles
      if (graph.nodes[neighbor].x <= 5 || graph.nodes[neighbor].x >= 55 || 
          graph.nodes[neighbor].y <= 8.5 || graph.nodes[neighbor].y >= 40) {
        penalty += cost * 1.5; // Significant penalty to actually avoid
      }
      
      const tentativeG = (gScore.get(current) ?? Infinity) + cost + penalty;
      
      if (tentativeG < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeG);
        fScore.set(neighbor, tentativeG + heuristic(graph, neighbor, goal));
        timeStepMap.set(neighbor, nextTimeStep);
        openSet.add(neighbor);
      }
    }
  }
  
  return null;
}
