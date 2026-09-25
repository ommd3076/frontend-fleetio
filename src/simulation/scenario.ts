export interface FleetScenarioUnit {
  id: string;
  bay: string;
  pickup: string;
  drop: 'PACK_1' | 'PACK_2';
  priority: number;
}

export const FLEET_SCENARIO: FleetScenarioUnit[] = [
  { id: 'R01', bay: 'STG_01', pickup: 'B3_LEFT_SERVICE', drop: 'PACK_1', priority: 3 },
  { id: 'R02', bay: 'STG_02', pickup: 'C4_LEFT_SERVICE', drop: 'PACK_2', priority: 2 },
  { id: 'R03', bay: 'STG_03', pickup: 'A5_RIGHT_SERVICE', drop: 'PACK_1', priority: 1 },
  { id: 'R04', bay: 'STG_04', pickup: 'A2_RIGHT_SERVICE', drop: 'PACK_2', priority: 2 },
  { id: 'R05', bay: 'STG_05', pickup: 'B5_LEFT_SERVICE', drop: 'PACK_1', priority: 1 },
  { id: 'R06', bay: 'STG_06', pickup: 'C2_LEFT_SERVICE', drop: 'PACK_2', priority: 3 },
  { id: 'R07', bay: 'STG_07', pickup: 'A4_RIGHT_SERVICE', drop: 'PACK_1', priority: 2 },
  { id: 'R08', bay: 'STG_08', pickup: 'B1_RIGHT_SERVICE', drop: 'PACK_2', priority: 1 },
  { id: 'R09', bay: 'STG_09', pickup: 'C6_LEFT_SERVICE', drop: 'PACK_1', priority: 2 },
  { id: 'R10', bay: 'STG_10', pickup: 'A1_RIGHT_SERVICE', drop: 'PACK_2', priority: 1 }
];
