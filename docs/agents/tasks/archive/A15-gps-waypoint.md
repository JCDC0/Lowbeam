# A15: GPS waypoint (Antigravity)

Need for Speed: Most Wanted (2005) lets the player pick a place on the map and draws the way
there on the minimap. Lowbeam gets the same: set a waypoint on the Tab map, and a route along the
roads shows on the minimap and the Tab map until the car arrives. Read `docs/agents/ARCHITECTURE.md`
(Traffic, Tactical map) and the shared-tree rules in `README.md` first.

Version numbers: 0.7.12 (part 1) and 0.7.13 (part 2). Claude has 0.7.8 and 0.7.9, Hermes 0.7.15
to 0.7.19.

## Part 1 (0.7.12): the route, pure

New pure `src/ui/route.js` (no three, no DOM), tested in `tests/route.test.mjs`.

- The graph is the traffic network, read only: `drive.trafficNet.lanes` (`src/traffic/net.js`).
  Each lane is directed (traffic keeps left), has a `length`, points along its road, and `links`
  (`{ lane, at, toS, kind }`) to the lanes a car can go on to: at its end, at an exit, at a turn.
  Following lanes and links is exactly the set of legal moves, one-way carriageways and ramps
  included.
- `routeTo(net, from, to)`: `from` is the car (`{ x, z, yaw }`), `to` a point on the map. Snap both
  to the nearest lane (for `from`, prefer a lane whose direction agrees with the car's yaw), then A*
  over (lane, s) nodes with straight-line distance as the heuristic. Return the route as a polyline
  of world points every 10 m or so, its length in meters, and the lanes it uses, or null when there
  is no way.
- `RouteTracker`: holds the current route, `update(car)` reports the distance left, re-plans when the
  car is more than 40 m off the line for 2 s (a wrong turn), and clears it within 25 m of the
  destination (`arrived`).
- Tests on a small hand-built net (a loop with a one-way ramp, a T junction): the route obeys
  one-way lanes, it re-plans after a wrong turn, it reports arrival, and on the real network a route
  from G1 to the police HQ exists and is under 1.6 times the straight-line distance.
- Keep it fast: a cross-island route must plan in under 30 ms in Node.

## Part 2 (0.7.13): setting it and drawing it

- Tab map (`src/ui/map.js`): click (or Enter on the cursor) sets the waypoint; clicking a landmark
  icon (stations, garages, hideouts, the police HQ) snaps to it; right click or Backspace clears it.
  A waypoint pin, and the route as a bright line over the roads with the distance left.
- Minimap (`src/ui/minimap.js`): the route line, and an edge arrow toward the waypoint when it is off
  the minimap.
- HUD: a small distance readout (`420 M`) under the minimap while a route is set, and `ARRIVED`
  briefly at the end. Put it in your own new DOM element (do not edit `src/ui/hud.js`), mounted from
  `main.js`.
- The route needs the car pose and the network: read them through `window.__lowbeam.drive`
  (`car.state`, `trafficNet`), the same way the maps read the markers now. No edits to `drive.js`.
- Shots at 480 lines: the Tab map with a route across the island, the minimap following it.

## Rules

- Do not edit: `src/drive.js`, `src/ui/hud.js`, `src/traffic/*`, `src/race/*`, `src/world/*`,
  `src/audio/*`, `src/render/*`, `src/police/*`, `src/vehicles/*`, `assets/`, `tools/blender/`.
- `src/main.js` and `style.css` are shared: small exact-string edits, re-read right before editing,
  stage only your own hunks.
- The changelog stays sorted by version; the current state header names the highest version.
- `npm test` and `npm run check` green before each commit.
