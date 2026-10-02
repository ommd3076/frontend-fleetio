# FleetIO 3D verification

## Scope

Browser visual simulation, with downloaded warehouse, shelving and orange AGV geometry. This report distinguishes simulation assertions, browser checks and hosted release checks. There is no robotics backend and no claim of optimal MAPF routing.

## Runtime evidence

The parent independently ran the finite 20-task, four-flow workload. All ten robots moved, delivered and returned idle. Independent oriented footprint tests sampled the 60 Hz simulation at 20 Hz and checked rack clearance, floor bounds, pairwise overlap and payload custody. Full guided verification retains 13 event-verified results across scenario transitions, rejects timeouts and clears results on an external reset.

The regression suite checks degenerate paths and arbitrary turns; exclusive ownership and prediction before junction holds; opposing narrow entry; measured following speed; congestion route reasoning; wait priority; recovery only after the blocker progresses; JEC peer fallback and stale authority; pre/post-pickup failure; completed-task failure without duplicate assignment; blocked-route and no-route clearing; battery eligibility, both charger returns and depletion.

`verify-engine.mjs` exercises the worker wrapper with a mock worker: one instance, five queued resets, obsolete generations/sequences and worker restart. This is separate from the real worker checks performed in the browser.

Final simulation core SHA-256: B148322B1346E6B01EFFEE45FF0DAFDE79232ECCF66478A7E54CB9DE1CD5F945. Layout SHA-256: 7C387C0A70DBD9A207A32A71AD731992D94156FCCF14644A7D55D49CD4FFD307.

Fresh independent review completed all 12 isolated coordination/failure scenarios with zero overlaps, and all 13 guided stages. The finite fleet completes at 744.02 simulated seconds; the guided suite completes at 1205.00 simulated seconds. Actual pose traces stay approximately between -0.851 and +0.752 m/s², excluding explicit failure/depletion stops. Parent geometry verification checks 14,879 sampled fleet frames. The last detour amendment corrects pickup metadata to the robot's physical J_2_2 position. The entire suite was rerun against that final core in the publication checkout and exited 0. Exact logs are in evidence/test-results.txt, evidence/build-results.txt and evidence/lint-results.txt.

## Browser evidence

Production previews were reviewed at 1440 × 900, 2560 × 1440, 3840 × 2160 and 390 × 844. All six navigation destinations were traversed. Robot/task/JEC/station search, mesh selection versus orbit dragging, overview/top/follow cameras, inspector/mini-map, playback, speed, five repeated pause/play/stop/reset cycles and manual recovery controls were exercised. The full final publication browser logistics run showed 20 completed, zero queued, all ten idle and zero overlap alerts, with the pass event at 00:12:23. Station search from Follow mode and JEC-3 resource-centre search were also rechecked after their fixes.

Low graphics mode caps the main drawing buffer at 1.1 million pixels. Measured on this development machine:

| Viewport | Main scene CSS size | DPR | Observed FPS | Frame p95 |
|---|---:|---:|---:|---:|
| 2560 × 1440 | 1906 × 1108 | 0.722 | 60.0 | 22.0 ms |
| 3840 × 2160 | 3186 × 1828 | 0.435 | 60.3 | 21.4 ms |

These are short browser telemetry windows, not a sustained performance guarantee. 4K mode upscales the capped buffer; it is not native-resolution 4K rendering. Full AGV geometry remains in the inspector and follow view; overview uses a 4,785-triangle derivative. Eight scene textures remained allocated across repeated resets. After five additional Play/Pause/Play/Stop/fresh-Play/Reset cycles on the final publication build, the ready scene reported 97 geometries and eight textures, versus 96–100 geometries during active runs. No monotonic allocation growth was observed in this short reset check; it is not a heap leak audit. evidence/control-cycles.json records the controls and counters.

Screenshots in `evidence/` document the desktop composition, mobile drawer and complete workload. Old development HMR connection errors were excluded from production checks; production asset/runtime errors must be checked separately.

## Remaining limitations

- Coordination is a deterministic demonstration on this warehouse graph, not an optimal planner, physics engine, certified safety controller or ROS integration.
- Task workloads and scenarios are built-in fixtures. Battery, communication loss/delay, pickup and operator recovery are simulated.
- Low quality prioritizes motion by reducing the drawing-buffer resolution on large displays. Labels can be dense on a narrow screen; the Labels toggle is available.
- Original AGV and shelving download packages contain no verifiable author/license metadata. Their redistribution details need confirmation from the download pages. Warehouse attribution is included in `public/models/ATTRIBUTION.md`.
- The main JavaScript bundle is approximately 1.3 MB before gzip; Vite emits its large-chunk advisory. Runtime models total approximately 13.9 MB before transfer compression/caching.

## Release checks

Pending exact-revision publication and hosted verification.
