# Task briefs for Antigravity

Self-contained tasks, written by Claude, that run in parallel with Claude's work on the
driving model (0.2.x), the new map (0.3.x), traffic (0.4.x) and the quality pass (0.5.x).
The overall plan and its reasoning are in `docs/DESIGN.md` and `docs/agents/ARCHITECTURE.md`.

| Brief | Start | What |
|---|---|---|
| [A1-dashboard.md](A1-dashboard.md) | done (0.2.4) | Repair the cockpit dash: mirrored, blocks the view, unreadable |
| [A2-map-controls.md](A2-map-controls.md) | done (0.3.1) | Tab map overlay, interact key moves to F, controls screen |
| [A6-garage.md](A6-garage.md) | done (0.3.1) | Garage handles any number of cars and shows the gear count |
| [A7-backend-playtest.md](A7-backend-playtest.md) | now | Tach scale, blown idle, diagonal lane changes, fast racers, road joins, bigger city, rails |
| [A8-gearbox-traffic-fixes.md](A8-gearbox-traffic-fixes.md) | done (0.4.14 to 0.4.18) | Neutral limiter bug, N R 1 gear order, safe crawl downshift, lane flip-flop, prompt in cockpit view |
| [A9-rival-duels.md](A9-rival-duels.md) | now (Hermes) | Dev server range requests, gauge alias cleanup, rival duels with a `RaceEvent` base and HUD |
| [C1-kurogane-island.md](C1-kurogane-island.md) | now (Claude) | The map overhaul: island, built-up zones, real street network, viaduct, new buildings, lamps and light pools |
| [A10-junction-traffic-map-icons.md](A10-junction-traffic-map-icons.md) | now (Antigravity) | Traffic lights and give-way at any crossing or T junction, the island and new POIs on the map, a stats overlay |
| [A11-rally.md](A11-rally.md) | done (0.6.5, 0.6.8, 0.6.9) | Pace notes, the rally RaceEvent with gates, medals, penalties and a ghost, its HUD |
| [A18-pursuit-mw.md](A18-pursuit-mw.md) | after A16 (Antigravity) | The pursuit HUD grown for Most Wanted: heat banners, infractions, counters, radio chatter, the report, sight cones and roadblocks on the maps, the rap sheet |
| [A14-blinkers-passby.md](A14-blinkers-passby.md) | done (0.7.15, 0.7.16) | Blinkers on the civilian traffic, hazards on wrecks, the pass-by whoosh scaled by relative speed; then the police core |
| Claude (no brief) | next | The police units' bodies (patrol car with light bar, unmarked car, Rhino SUV, interceptor), spike strip and roadblock props, the pursuit breakers in the world |
| [A17-police.md](A17-police.md) | now (Hermes) | Patrols, heat, the pursuit RaceEvent, chasing and roadblocks, busts and escapes, sirens and the rotor sound, played like Most Wanted: unit tiers by heat, infractions, hiding spots and search, spike strips, pursuit breakers, radio chatter |
| [A16-cluster-styles.md](A16-cluster-styles.md) | part 1 done (0.8.10, with Claude's 0.8.3), parts 2 to 4 now (Antigravity) | HUD speedometer styles per car, the setting, the fonts across every screen, the controls settings with key rebinding |
| [A15-gps-waypoint.md](A15-gps-waypoint.md) | done (0.7.12, 0.7.13) | GPS waypoint: set it on the Tab map, the route along the roads on both maps, re-plan on a wrong turn |
| [A13-pursuit-hud.md](A13-pursuit-hud.md) | done (0.7.10, 0.7.11) | The pursuit HUD (heat, evade, cooldown, bust) and police and helicopter markers on both maps, against the pursuit contract |
| A12 (prompt in chat) | done (0.6.10 to 0.6.12) | Landmark icons on the minimap, `tools/landmarks.html` model viewer, `tools/buildbench.mjs` world-build bench |
| [A5-buildings.md](A5-buildings.md) | after A7 part 6 | Building kit, facade atlas, street furniture |
| [A3-bodies-batch1.md](A3-bodies-batch1.md) | cancelled | Claude builds every car body now |
| [A4-bodies-batch2.md](A4-bodies-batch2.md) | cancelled | Claude builds every car body now |

## Rules for working in the shared tree

- Pull or check `git status` and `git log --oneline -5` before starting. Claude commits too.
- `## Current state` in ARCHITECTURE.md names the highest version, and the changelog stays sorted
  by version (insert your entry in its place, not at the top, when a higher one exists).
- Use only your own version range: Hermes 0.6.9 (A11 part 3), then Claude 0.7.3 to 0.7.9,
  Antigravity 0.7.10 to 0.7.14, Hermes 0.7.15 to 0.7.19, then Claude 0.8.0 to 0.8.9,
  Antigravity 0.8.10 to 0.8.14, Hermes 0.8.15 to 0.8.24, Antigravity 0.8.25 to 0.8.29. Ask for a new range when it runs out. Bump `package.json`, `package-lock.json` and `docs/agents/CHANGELOG.md` together.
- Stage your own files by name. Never `git add -A`.
- Prefer new files. In a shared file make small exact-string edits, re-read it right
  before editing, never rewrite it whole.
- From A7 on, Antigravity owns the backend (physics, thermal, gauges, traffic sim, world
  generation, the HUD cluster) and Claude owns modeling (car bodies, cockpits and their
  gauges, vehicle rendering) and the planning. The table at the end of A7 lists the files.
  Do not edit the other side's files; ask in your report.
- Conventions are in `docs/agents/ARCHITECTURE.md`: meters, north is -Z, car local +X is the
  car's LEFT, no em dashes, no single-line explanatory comments, materials from
  `src/render/psx.js`, pure modules never import `three`.
- Verify by looking: `npm start` (port 8040 may already be running, reuse it), then
  `window.__lowbeam`, `shot(name)` writes `tools/shots/<name>.png`. Run `npm test` and
  `npm run check` before every commit.
