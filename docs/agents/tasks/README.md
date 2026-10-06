# Tasks and ownership

Read this and `docs/agents/ARCHITECTURE.md` before touching a file. Every file has one owner. If your
task needs a change in someone else's file, do not make it: say so in your report and the owner
makes it. Claude reviews every commit before the next task starts.

## The team

| Role | Agent | Version range | What it does |
|---|---|---|---|
| Orchestrator | Claude (Claude Code) | 0.9.0 to 0.9.19 | Plans and briefs, reviews and verifies every commit, keeps the guide true; owns rendering, the world, the UI and fitting assets into the game |
| Backend | GPT 6 Sol (Codex) or Hermes on Xiaomi MiMo 2.6 Pro | 0.9.20 to 0.9.49 | Game logic and its tests: police, traffic, races, physics, audio logic, the drive rules |
| Assets | Gemini 3.8 Flash (Antigravity) with the Blender MCP | 0.9.50 to 0.9.69 | Models built as Blender scripts and exported as JSON, checked in the prop viewer |

Ask Claude for a new range when yours runs out.

## Who owns which files

| Owner | Files |
|---|---|
| Backend | `src/drive.js`, `src/core/*`, `src/police/*` except `heli-view.js`, `src/race/*`, `src/traffic/net.js`, `sim.js`, `kinds.js`, `src/vehicles/physics.js`, `surfaces.js`, `thermal.js`, `gauges.js`, `specs.js`, `exhaust.js`, `src/audio/*`, `tests/*`, `tools/sim.mjs`, `tools/render-*.mjs`, `tools/audio-lab.html` |
| Assets | `tools/blender/*` except `kit.py`, `assets/models/*` |
| Claude | Everything else: `src/render/*`, `src/world/*`, `src/ui/*`, `style.css`, `index.html`, `src/main.js`, `src/vehicles/models.js`, `loft.js`, `bodies/*`, `car.js`, `cockpit.js`, `dash.js`, `instruments.js`, `screens.js`, `exhaust-fx.js`, `src/traffic/bodies.js`, `render.js`, `src/police/heli-view.js`, `tools/blender/kit.py`, `tools/*.html` viewers, `assets/fonts/*`, `docs/*`, `package.json` dependencies |

The version bump in `package.json`, `package-lock.json` and the changelog is everyone's: make it in
the same commit as your work, with your own range.

## Open tasks

| Brief | Owner | Status | What |
|---|---|---|---|
| [B1-police-repair.md](B1-police-repair.md) | Backend | now | Fix the police logic, move it out of drive.js into a pure director, test whole chases, then busts, escapes, spike damage, line of sight, sirens |
| [G1-pursuit-props.md](G1-pursuit-props.md) | Assets | now | The trial: spike strip, police barrier, roof light bar, a scaffold pursuit breaker standing and fallen |
| Claude | Claude | after G1 | Fit the G1 props into the game; then the police car models; the Most Wanted pursuit HUD extras (`archive/A18-pursuit-mw.md`); the settings hint bar at 720 lines |

Finished and cancelled briefs are in `archive/`. Two still matter as references: the pursuit view
contract (`archive/A13-pursuit-hud.md`) and the Most Wanted design for the police
(`archive/A17-police.md`, section "The target").

## Working in the shared tree

- Before starting: `git status` and `git log --oneline -8`. Another agent may be working; never
  touch or commit files you did not change.
- Stage your files by name, never `git add -A`. Commit each part as soon as it is green.
- `npm test` and `npm run check` before every commit; look at the result in the browser (Verification
  in the guide).
- Report at the end of each part: what changed, the commit hash, test counts, screenshots, anything
  you could not do and anything you need from another owner.
