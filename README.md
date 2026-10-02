# FleetIO

A browser visual simulation of ten orange warehouse AGVs. React, Three.js and a deterministic Web Worker render and coordinate a 16 × 46 metre warehouse. This is a demonstration of MAPF-style coordination; it does not claim optimal routing or implement a robotics backend.

## Run locally

```sh
npm ci
npm run dev
```

Original downloads in Assets/ stay untouched. Prepared assets in public/models/ are committed for deployment. See public/models/ATTRIBUTION.md for sources and material changes. If the original download folders are present, node scripts/prepare-assets.mjs rebuilds runtime copies; cloning this repository does not require that step.

```sh
npm run build
npm run lint
npm test
```

## Demonstrate

Open Live, select a scenario and press Run. Guided demonstration advances only when required simulation outcomes occur. Individual scenarios can be restarted independently. Pause preserves the run, Stop preserves the final view, Play after Stop starts afresh, and Reset restores the selected fixture. Speed changes simulated time.

Select a robot in the scene or roster to inspect its task, battery, payload and route. Use Overview, Top and Follow camera controls; drag to orbit and scroll to zoom. Map expands the warehouse. Search locates robots, tasks, stations and JECs. Analytics uses measured simulation records.

Payload recovery waits for an explicit Recover robot action. A failed robot retains custody until recovered. Manual controls also expose robot failure, JEC outage/restoration, passage blockage/clearing and degraded communications.

## Architecture

- src/types.ts defines common snapshots and commands.
- src/simulation/layout.ts defines navigation and rack/station footprints.
- src/simulation/core.ts owns robot motion, tasks, arbitration and scenario outcomes.
- src/simulation/worker.ts provides the fixed-step clock and snapshots.
- src/simulation/engine.ts maintains one worker and rejects obsolete generations/sequences.
- src/components/WarehouseCanvas.tsx interpolates received poses without advancing simulation logic.

Reset clears bounded event/metric histories and increases snapshot generation. The worker uses 60 Hz simulation steps and 20 Hz snapshots. Reservations gate entry, occupied resources retain ownership, and peer arbitration uses the same policy during a JEC outage.

## Verification and limits

See GATES_3D.md for acceptance and recorded release evidence. Scenario success must follow actual tasks, motion and coordination. Browser performance depends on the GPU and resolution; the verification report records measured results rather than treating a successful build as visual proof.
