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
| [A11-rally.md](A11-rally.md) | now (Hermes, resume from `docs/agents/handoff/HANDOFF-A11.md`) | Pace notes, the rally RaceEvent with gates, medals, penalties and a ghost, its HUD |
| A12 (prompt in chat) | now (Antigravity) | Landmark icons on the minimap, `tools/landmarks.html` model viewer, `tools/buildbench.mjs` world-build bench |
| [A5-buildings.md](A5-buildings.md) | after A7 part 6 | Building kit, facade atlas, street furniture |
| [A3-bodies-batch1.md](A3-bodies-batch1.md) | cancelled | Claude builds every car body now |
| [A4-bodies-batch2.md](A4-bodies-batch2.md) | cancelled | Claude builds every car body now |

## Rules for working in the shared tree

- Pull or check `git status` and `git log --oneline -5` before starting. Claude commits too.
- Use only your own version range: Claude 0.6.7 and 0.7.x, Hermes 0.6.8 and 0.6.9,
  Antigravity 0.6.10 to 0.6.12. Ask for a new range when it runs out. Bump `package.json`, `package-lock.json` and `docs/agents/CHANGELOG.md` together.
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
