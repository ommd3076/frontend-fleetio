# Demo guide

Open **Live**. Expand the scenario selector, choose a demonstration and press **Run**, or start one from **Settings → Demonstrations**. Starting a scenario replaces the current run with its fixture and starts playback.

**Pause** freezes simulation progress; **Play** resumes a paused run. **Stop** retains the final view; Play after Stop starts a fresh run. **Reset** restores the current fixture. **0.5x / 1x / 2x** changes simulated time. Scenario progress reports measured outcomes, operator actions or timeouts; do not treat movement alone as completion.

## Scenarios

| Demonstration | What to observe |
| --- | --- |
| Guided demonstration | Thirteen individual stages, with saved outcomes in Analytics. The guide issues a simulated operator recovery command during its payload-recovery stage. |
| Normal logistics | Ten robots handling four logistics flows, then returning to their home bays. |
| Junction conflict | Reservation grant, waiting outside the resource, crossing and release. |
| Narrow passage | Exclusive access for opposing traffic. |
| Safe following | A trailing robot adjusts its speed to maintain separation. |
| Alternate route | A route changes to avoid congestion. |
| Priority aging | A waiting robot gains access after yielding. |
| Deadlock recovery | A wait cycle is resolved using a clear refuge and resumed progress. |
| JEC outage | Peer arbitration takes over and the controller is restored. |
| Robot failure | Work is reassigned after failure before pickup. |
| Payload recovery | The failed robot retains its package. Select it and press **Recover Robot** to resume delivery. |
| Blocked aisle | Replanning around an obstruction, followed by clearing. |
| Degraded communications | Delayed/lost simulated messages cause conservative waiting. |
| Battery & charging | Low-battery robots obtain exclusive charger access, replenish simulated battery and leave. |

For a short walkthrough, run Junction conflict, Robot failure, Payload recovery and Battery & charging individually. The full guide includes normal logistics and can take substantially longer; speed and browser responsiveness affect wall-clock duration.

## Inspect and control

Click a robot or JEC to inspect its state, route and waiting reason. **Robots** and **Tasks** provide searchable tables; **Analytics** shows measured charts, incidents and guided outcomes. **Map** expands the warehouse. Drag to orbit, scroll to zoom, and use Overview, Top or Follow camera buttons. Routes, Reservations, Labels and Intents toggle separate overlays.

Search locates robots, tasks, stations and JECs. Ctrl/Cmd+K focuses search, Arrow Up/Down chooses a result, Enter selects it and Escape dismisses results. On small screens, open Fleet or Inspector using the scene buttons; Escape or the close button dismisses a drawer.

**Recovery controls** manually fail/recover a chosen robot, disable/restore a JEC, block/clear the narrow passage, or degrade/restore communications. Robot and JEC inspectors expose corresponding actions.

## Docks and presentation

Ten home docks identify staging bays for R01–R10. Click a dock, use the Map dock directory, or choose **Locate Home Dock** in a robot inspector. Ready, Occupied and Fault status follow simulated occupancy and robot condition. Home docks are parking spaces: they do not replenish battery.

**Charge 1** and **Charge 2** are the two chargers. Charging status requires a robot in the `CHARGING` state; a robot passing over a pad only makes it occupied. Charging lights animate only during actual simulated charging while the run is active.

Settings provides Low / Smooth and Balanced rendering quality. **Reduce Motion** disables decorative UI/dock motion and makes camera changes immediate; it preserves robot simulation movement. The preference is remembered, and the operating system's reduced-motion preference takes precedence.
