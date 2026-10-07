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
the same commit as your work, with your own range. `package.json` always holds the highest version
committed so far: a commit numbered below it (0.9.2 after 0.9.51) adds its changelog entry in order
and leaves `package.json` alone.

## Open tasks

| Brief | Owner | Status | What |
|---|---|---|---|
| [B1-police-repair.md](B1-police-repair.md) | Claude | done (0.9.3, part 3 with C1 part 2 in 0.9.8) | Fix the police logic, move it out of drive.js into a pure director, test whole chases, then busts, escapes, spike damage, line of sight, sirens |
| [G1-pursuit-props.md](G1-pursuit-props.md) | Assets | spike strip done; the rest after G3 | The trial: spike strip, police barrier, roof light bar, a scaffold pursuit breaker standing and fallen |
| [G2-racer-car-trial.md](G2-racer-car-trial.md) | Assets | second fix round (0.9.53), see "Review of 0.9.52" | One complete car in Blender: the Mazuma RX-Coupe street racer, to the player cars' standard, to replace its lofted body |
| [C1-claude-queue.md](C1-claude-queue.md) | Claude | parts 1 and 2 done (0.9.7, 0.9.8); part 3 next | In order: other cars hit the world; red and blue light bars, lit blinkers and sirens; the music swell at 75 km/h and a track manifest; the instrument rework from Jc's sketch; a second-layer city expressway and greenery; nitrous; Gemini's models into the game |
| [G3-police-cars.md](G3-police-cars.md) | Assets | after G2 passes | The four police cars (cruiser, unmarked, Rhino, interceptor) with red and blue light bars, cruiser first |
| [G4-city-greenery.md](G4-city-greenery.md) | Assets | after G3, between racers when Claude needs it for the city | Street trees, planters, hedges, shrubs and benches for the city |
| [G5-street-racers.md](G5-street-racers.md) | Assets | after G3's cruiser | The other eleven street racers in Blender, two cars per review |
| [G6-civilian-cars.md](G6-civilian-cars.md) | Assets | after G5 | The fourteen traffic kinds remade, and seven new ones (kei van, executive sedan, coupe, crossover, delivery van, garbage truck, ambulance) |

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
