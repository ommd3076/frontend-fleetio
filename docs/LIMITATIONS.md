# Limitations

FleetIO is a browser visual simulation. It does not connect to physical robots, ROS 2, Gazebo, Nav2 or a production fleet backend. Simulated battery, communications, tasks and arbitration are demonstration state, not live warehouse telemetry.

Coordination uses a bounded, deterministic policy and arranged scenarios. MAPF-style routing, reservations and peer fallback do not establish an optimal or complete MAPF solver. Passing simulation clearance checks does not certify physical safety, real sensor behavior or operation in an actual warehouse.

Runs and analytics belong to the current browser session. Reset or a new scenario replaces current run state; the guide retains its stage results until reset. There is no shared fleet service, multi-user synchronization or durable task database. Remembered presentation preferences are local to the browser.

The warehouse asset records Nicholas-3D and CC-BY-4.0 attribution. The supplied AGV and shelf packages contain no verified author/license details; their redistribution terms remain unknown. See [asset attribution](../public/models/ATTRIBUTION.md). Do not infer a license for either asset from the warehouse license.

Rendering quality trades detail for cost: Low uses device pixel ratio 1; Balanced caps it at 1.25 and enables additional detail/shadows. The Three.js application bundle and downloaded models are substantial, so initial loading and frame time depend on network, GPU, viewport and browser. No universal 60 FPS or 4K performance guarantee is made.

Local lint/tests, static build checks, simulation outcomes and visual/hosted verification provide different evidence. Release documentation describes operation; it does not itself confirm that a particular revision is deployed or that every browser/device was tested. Any unresolved console, asset, scenario or performance issue should be recorded with the affected revision and reproduction steps.
