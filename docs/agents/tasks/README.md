# Tasks and ownership

Read this and `docs/agents/ARCHITECTURE.md` before touching a file. Every file has one owner. If your
task needs a change in someone else's file, do not make it: say so in your report and the owner
makes it. Claude reviews every commit before the next task starts.

## The team

| Role | Agent | Version range | What it does |
|---|---|---|---|
| Orchestrator | Claude (Claude Code) | 0.9.0 to 0.9.19 (used), now 0.9.70 to 0.9.99 | Plans and briefs, reviews and verifies every commit, keeps the guide true; owns rendering, the world, the UI and fitting assets into the game |
| Backend | Hermes (Claude Haiku 5.5), earlier GPT 6 Sol (Codex) | 0.9.20 to 0.9.49 | Game logic and its tests: police, traffic, races, physics, audio logic, the drive rules |
| Assets | Gemini 3.8 Flash (Antigravity) with the Blender MCP | 0.9.50 to 0.9.69, then 0.10.50 to 0.10.69 | Models built as Blender scripts and exported as JSON, checked in the prop viewer |

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
| [G2-racer-car-trial.md](G2-racer-car-trial.md) | Assets | done, passed in 0.9.53; Claude wires it in (C1 part 7) | One complete car in Blender: the Mazuma RX-Coupe street racer, to the player cars' standard, to replace its lofted body |
| [C1-claude-queue.md](C1-claude-queue.md) | Claude | parts 1 to 4 and 6 done (0.9.7 to 0.9.12), the part 5 expressway done (0.9.14), part 7 under way (0.9.17: the Mazuma and the cruiser); greenery waits for G4 | In order: other cars hit the world; red and blue light bars, lit blinkers and sirens; the music swell at 75 km/h and a track manifest; the instrument rework from Jc's sketch; a second-layer city expressway and greenery; nitrous; Gemini's models into the game |
| [G3-police-cars.md](G3-police-cars.md) | Assets | done, all four passed (0.9.54 to 0.9.57) and in the game (0.9.70) | The four police cars (cruiser, unmarked, Rhino, interceptor) with red and blue light bars, cruiser first |
| [G4-city-greenery.md](G4-city-greenery.md) | Assets | after G3, between racers when Claude needs it for the city | Street trees, planters, hedges, shrubs and benches for the city |
| [G5-street-racers.md](G5-street-racers.md) | Assets | 6 of 11 built (0.9.58 to 0.9.63); 5 in the game, the Hardtop back for its roof; two cars per review | The other eleven street racers in Blender, two cars per review |
| [B2-driving-patch.md](B2-driving-patch.md) | Backend | next (from 0.9.20) | From Jc's test drive: tougher cars, bumped cars that drive on or get out of the way, every car solid (no phasing into roadblocks), racers that brake, police that drive like people, the assigned pool and reinforcements, helicopters that refuel, louder traffic and exhaust |
| [C3-patch-queue.md](C3-patch-queue.md) | Claude | parts 1 and 2 done (0.9.81, 0.9.83) | From the same drive: the Kurogane Line median, Most Wanted's radar, the pursuit HUD after Jc's sketch, the HUD fishnet, vignette and blur, skid marks and smoke, more stations, hideouts and garages |
| [C2-pursuit-overhaul.md](C2-pursuit-overhaul.md) | Claude | done (0.9.18 to 0.9.79) | Most Wanted's pursuit: one car physics for all, destructible police with a kill count, the detection bar and provoking, police chasing racers, up to three helicopters, a bottom-center pursuit HUD, banners with flair, a bigger minimap with the heat, and the audio expansion (pass-bys, horns, panic) |
| [G7-police-station.md](G7-police-station.md) | Assets | after the G5 batch in hand (0.10.50 on) | A district police station with a roof pad, and the roadblock barrier |
| [G6-civilian-cars.md](G6-civilian-cars.md) | Assets | after G5 and G7 | The fourteen traffic kinds remade, and seven new ones (kei van, executive sedan, coupe, crossover, delivery van, garbage truck, ambulance) |

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
