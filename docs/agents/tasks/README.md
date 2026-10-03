# Task briefs for Antigravity

Self-contained tasks, written by Claude, that run in parallel with Claude's work on the
driving model (0.2.x), the new map (0.3.x), traffic (0.4.x) and the quality pass (0.5.x).
The overall plan and its reasoning are in `docs/DESIGN.md` and `docs/agents/ARCHITECTURE.md`.

| Brief | Start | What |
|---|---|---|
| [A1-dashboard.md](A1-dashboard.md) | now | Repair the cockpit dash: mirrored, blocks the view, unreadable |
| [A2-map-controls.md](A2-map-controls.md) | now | Tab map overlay, interact key moves to F, controls screen |
| [A6-garage.md](A6-garage.md) | with A2 | Garage handles any number of cars and shows the gear count |
| [A3-bodies-batch1.md](A3-bodies-batch1.md) | after A1 | Four rival bodies and four civilian bodies |
| [A4-bodies-batch2.md](A4-bodies-batch2.md) | after A3 is reviewed | Remaining rivals, civilians, vans, trucks, bus |
| [A5-buildings.md](A5-buildings.md) | after the new map layout lands | Building kit, facade atlas, street furniture |

## Rules for working in the shared tree

- Pull or check `git status` and `git log --oneline -5` before starting. Claude commits too.
- Claim the next free version number after reading `git log` (Claude is using 0.1.10, then
  0.2.x). Bump `package.json`, `package-lock.json` and `docs/agents/CHANGELOG.md` together.
- Stage your own files by name. Never `git add -A`.
- Prefer new files. In a shared file make small exact-string edits, re-read it right
  before editing, never rewrite it whole.
- Do not touch these (Claude owns them for this stretch): `src/vehicles/physics.js`,
  `gauges.js`, `specs.js`, `surfaces.js`, `thermal.js`, `src/audio/*`, `src/world/*`,
  `src/traffic/*`, `src/render/cameras.js`, `src/drive.js` (except hooks named in a brief),
  `tests/physics.test.mjs`. The gearbox in `physics.js` moved to Claude: the 0.1.9 manual
  transmission is being replaced by a full R N 1..7 gearbox.
- Conventions are in `docs/agents/ARCHITECTURE.md`: meters, north is -Z, car local +X is the
  car's LEFT, no em dashes, no single-line explanatory comments, materials from
  `src/render/psx.js`, pure modules never import `three`.
- Verify by looking: `npm start` (port 8040 may already be running, reuse it), then
  `window.__lowbeam`, `shot(name)` writes `tools/shots/<name>.png`. Run `npm test` and
  `npm run check` before every commit.
