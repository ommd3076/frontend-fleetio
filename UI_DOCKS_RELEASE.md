# FleetIO UI and dock update

Verified source: the UI changes through commit fb46fbb. Publication adds this report and browser evidence in the tenth meaningful commit. The application bundle is `index-DpH3u0vj.js`, styles `index-xlr2mPWH.css`, worker `worker-CTDACov0.js`.

## Changes

- Brief panel/drawer/inspector entrances, hover/press feedback, keyboard focus, measured chart and battery transitions.
- Remembered reduced-motion preference; system preference also governs cameras, UI and charging lights.
- Keyboard search with selected-result highlighting and correct combobox semantics.
- Ten physical home docking bays and two exclusive chargers, using six shared instanced material groups.
- Snapshot-driven dock occupancy and faults; home docks do not claim charging. A moving robot keeps a pad occupied until its footprint clears it.
- Dock selection, a twelve-entry Map directory, and home-dock details in the inspector.

The simulation core is unchanged: SHA256 `2F91B3D731E5F597DA266B2FFD6325BAC680814E5D054BBBEF7A8492B5E8054A`.

## Verification

The complete `npm test` suite passed on the source that matches the publication checkout. Build and lint passed; 43 source/script files were linted with zero diagnostics. The added presentation check independently exercised 8,647 fleet snapshots from completed logistics and charging runs, with twenty delivered tasks, all ten home occupants restored and actual battery increases for R01/R02. All docks remain within the floor and clear graph paths plus the conservative robot turning circle by at least 30.68 mm. A deliberately invalid pedestal verifies the clearance oracle detects obstruction.

Parent browser review used the exact production publication bundle. All six views, twelve dock directory entries, physical dock selection, drag-versus-click, home location, top-down labels, Arrow Down/Enter search selection, settled search highlighting, camera presets and five repeated playback cycles worked. The repeated cycles retained one model set (90 renderer geometries at reset). This is a short renderer-resource observation, not a heap leak audit.

Reduced motion produced computed `animation:none` and zero-duration transitions and survived reload. Normal control transitions are 190 ms and data transitions 360 ms. A live charging run showed R01 stationary at CHG_1, battery increasing, actual Charging status, home dock Ready and a waiting R02. Pausing retained that real state. Source review confirms charging pulse is gated by actual charging, running status and motion preference.

At 390 × 844, the mobile inspector and home dock information fit without horizontal document overflow; Shift+Tab wrapped from Close to the last action, and Escape closed the drawer and restored focus to Inspector. Screenshots and browser records are in evidence/.

## Measured rendering

Low / Smooth quality, normal logistics running at 2×, approximately 120-frame rolling samples on the development machine. These are observations, not an FPS guarantee.

| Viewport | Main scene buffer | FPS | Frame p95 |
|---|---|---|---|
| 1440 × 900 | 908 × 614 | 56.3 | 19.8 ms |
| 2560 × 1440 | 1375 × 799 | 56.8 | 20.4 ms |
| 3840 × 2160 | 1384 × 794 | 56.6 | 19.5 ms |

4K uses the existing capped buffer and upscaling. No bloom, reflections, extra rendering dependency, or robotics backend was introduced. Existing assets remain unchanged. Home dock hardware is presentation geometry; only the two existing chargers affect battery. AGV and shelf author/license metadata still needs confirmation from the original downloads.

## Publication and hosted verification

Ten non-empty commits are pushed individually to existing `ommd3076/frontend-fleetio` main. Vercel's Git integration builds these pushes and updates https://frontend-fleetio.vercel.app/. The private dashboard required login in this browser; deployment status is verified through GitHub's Vercel check and the actual public site/bundle. The final hosted checks and exact SHA are recorded after the tenth push in the workspace evidence, avoiding another publication solely to add its own commit hash.

Final acceptance ledger: UI motion, docks and parent integration contain nine gates in total. Final remote/deployment gates are closed only after actual hosted verification.
