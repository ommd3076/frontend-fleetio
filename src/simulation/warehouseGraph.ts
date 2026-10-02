import {WAREHOUSE_LAYOUT} from './layout';
/** Compatibility accessor. Rendering and planning share the same metric map. */
export function generateWarehouse(){return structuredClone(WAREHOUSE_LAYOUT.graph);}
