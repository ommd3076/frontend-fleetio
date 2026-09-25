import type { WarehouseGraph, GridNode, NodeId } from '../types';

export function generateWarehouse(): WarehouseGraph {
  const width = 60;
  const height = 42;
  const nodes: Record<NodeId, GridNode> = {};

  const addNode = (id: string, x: number, y: number, type: GridNode['type']) => {
    if (!nodes[id]) {
      nodes[id] = { id, x, y, type, neighbors: [] };
    }
  };

  const addEdge = (id1: string, id2: string) => {
    if (nodes[id1] && nodes[id2]) {
      if (!nodes[id1].neighbors.includes(id2)) nodes[id1].neighbors.push(id2);
      if (!nodes[id2].neighbors.includes(id1)) nodes[id2].neighbors.push(id1);
    }
  };

  // 3 Columns: A, B, C
  // 6 Rows: 1 to 6
  // Racks are visually approx 8m wide, 2m deep.
  // Col A x=14, Col B x=30, Col C x=46
  // Row 1..6 y=6, 12, 18, 24, 30, 36
  const cols = [
    { name: 'A', x: 14 },
    { name: 'B', x: 30 },
    { name: 'C', x: 46 }
  ];
  const rows = [
    { name: '1', y: 6 },
    { name: '2', y: 12 },
    { name: '3', y: 18 },
    { name: '4', y: 24 },
    { name: '5', y: 30 },
    { name: '6', y: 36 }
  ];

  // Aisles are between the racks
  // Vertical aisles:
  // v1 (left of A) = 8
  // v2 (between A-B) = 22
  // v3 (between B-C) = 38
  // v4 (right of C) = 54
  const vAisles = [8, 22, 38, 54];
  
  // Horizontal aisles:
  // Above row 1, between rows, below row 6
  const hAisles = [3, 9, 15, 21, 27, 33, 39];

  // 1. Create Junctions at every crossing of vAisles and hAisles
  for (const v of vAisles) {
    for (const h of hAisles) {
      addNode(`J_${v}_${h}`, v, h, 'JUNCTION');
    }
  }

  // 2. Connect vertical aisles
  for (const v of vAisles) {
    for (let i = 0; i < hAisles.length - 1; i++) {
      addEdge(`J_${v}_${hAisles[i]}`, `J_${v}_${hAisles[i+1]}`);
    }
  }

  // 3. Connect horizontal aisles
  for (const h of hAisles) {
    for (let i = 0; i < vAisles.length - 1; i++) {
      addEdge(`J_${vAisles[i]}_${h}`, `J_${vAisles[i+1]}_${h}`);
    }
  }

  // 4. Create Racks and Service Points
  for (const col of cols) {
    for (const row of rows) {
      const rackId = `RACK_${col.name}${row.name}`;
      // Add rack visual node (for rendering)
      addNode(rackId, col.x, row.y, 'RACK');
      
      // Determine surrounding aisles
      const leftV = vAisles.find(v => v < col.x && v > col.x - 10)!;
      const rightV = vAisles.find(v => v > col.x && v < col.x + 10)!;
      
      // Create LEFT service node
      const leftSvcId = `${col.name}${row.name}_LEFT_SERVICE`;
      addNode(leftSvcId, leftV, row.y, 'PICKUP');
      // Connect to the junctions above and below it on the vertical aisle
      const hTop = hAisles.slice().reverse().find(h => h < row.y)!;
      const hBot = hAisles.find(h => h > row.y)!;
      addEdge(leftSvcId, `J_${leftV}_${hTop}`);
      addEdge(leftSvcId, `J_${leftV}_${hBot}`);

      // Create RIGHT service node
      const rightSvcId = `${col.name}${row.name}_RIGHT_SERVICE`;
      addNode(rightSvcId, rightV, row.y, 'PICKUP');
      addEdge(rightSvcId, `J_${rightV}_${hTop}`);
      addEdge(rightSvcId, `J_${rightV}_${hBot}`);
    }
  }

  // 5. Staging Area (10 Bays)
  // Place on the far left, connecting to vAisle 8
  for (let i = 1; i <= 10; i++) {
    const id = `STG_${i.toString().padStart(2, '0')}`;
    const sy = 4 + (i * 2.5); // Spread them out vertically
    addNode(id, 3, sy, 'STAGING');
    
    // Connect to vAisle 8
    const connectId = `J_8_${sy}`;
    addNode(connectId, 8, sy, 'AISLE');
    addEdge(id, connectId);
    
    const hTop = hAisles.slice().reverse().find(h => h < sy);
    const hBot = hAisles.find(h => h > sy);
    if (hTop) addEdge(connectId, `J_8_${hTop}`);
    if (hBot) addEdge(connectId, `J_8_${hBot}`);
  }

  // 6. Packing Stations
  // Place on the top-right
  addNode(`PACK_1`, 58, 6, 'DROP');
  addNode(`PACK_2`, 58, 10, 'DROP');
  
  addNode(`J_54_6_PACK`, 54, 6, 'AISLE');
  addNode(`J_54_10_PACK`, 54, 10, 'AISLE');
  
  addEdge(`PACK_1`, `J_54_6_PACK`);
  addEdge(`PACK_2`, `J_54_10_PACK`);
  
  // connect to nearest junctions on v54
  addEdge(`J_54_6_PACK`, `J_54_3`);
  addEdge(`J_54_6_PACK`, `J_54_9`);
  addEdge(`J_54_10_PACK`, `J_54_9`);
  addEdge(`J_54_10_PACK`, `J_54_15`);

  return { nodes, width, height };
}
