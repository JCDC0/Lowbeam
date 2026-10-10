# Tasks and ownership

Read this and `docs/agents/ARCHITECTURE.md` before touching a file. Every file has one owner. If your
task needs a change in someone else's file, do not make it: say so in your report and the owner
makes it. Claude reviews every commit before the next task starts.

## The team

| Role | Agent | Version range | What it does |
|---|---|---|---|
| Orchestrator | Claude (Claude Code) | 0.9.0 to 0.9.19 and 0.9.70 to 0.9.99 (used), now 0.10.0 to 0.10.49 | Plans and briefs, reviews and verifies every commit, keeps the guide true; owns rendering, the world, the UI and fitting assets into the game |
| Backend | Gemini 3.8 Flash (Antigravity) from B2 part 3; Hermes (Claude Haiku 5.5) did parts 1 and 2 | 0.9.20 to 0.9.49 (0.9.34 next) | Game logic and its tests: police, traffic, races, physics, audio logic, the drive rules |
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
| [BUGS.md](BUGS.md) | Everyone, one owner per line | open: first (Jc, 2026-10-10: clean first, then the plans) | The bug board and the gates that say the game is clean: benches, audits, a screenshot tour, the HUD against Jc's drawing, outside models |
| [B1-police-repair.md](B1-police-repair.md) | Claude | done (0.9.3, part 3 with C1 part 2 in 0.9.8) | Fix the police logic, move it out of drive.js into a pure director, test whole chases, then busts, escapes, spike damage, line of sight, sirens |
| [G1-pursuit-props.md](G1-pursuit-props.md) | Assets | spike strip done; the rest after G3 | The trial: spike strip, police barrier, roof light bar, a scaffold pursuit breaker standing and fallen |
| [G2-racer-car-trial.md](G2-racer-car-trial.md) | Assets | done, passed in 0.9.53; Claude wires it in (C1 part 7) | One complete car in Blender: the Mazuma RX-Coupe street racer, to the player cars' standard, to replace its lofted body |
| [C1-claude-queue.md](C1-claude-queue.md) | Claude | parts 1 to 4 and 6 done (0.9.7 to 0.9.12), the part 5 expressway done (0.9.14), part 7 under way (0.9.17: the Mazuma and the cruiser); greenery waits for G4 | In order: other cars hit the world; red and blue light bars, lit blinkers and sirens; the music swell at 75 km/h and a track manifest; the instrument rework from Jc's sketch; a second-layer city expressway and greenery; nitrous; Gemini's models into the game |
| [G3-police-cars.md](G3-police-cars.md) | Assets | done, all four passed (0.9.54 to 0.9.57) and in the game (0.9.70) | The four police cars (cruiser, unmarked, Rhino, interceptor) with red and blue light bars, cruiser first |
| [G4-city-greenery.md](G4-city-greenery.md) | Assets | after G3, between racers when Claude needs it for the city | Street trees, planters, hedges, shrubs and benches for the city |
| [G5-street-racers.md](G5-street-racers.md) | Assets | done, all eleven built and in the game (0.9.58 to 0.9.69) | The other eleven street racers in Blender, two cars per review |
| [B2-driving-patch.md](B2-driving-patch.md) | Backend (Gemini) | done (0.9.20 to 0.9.28) | From Jc's test drive: tougher cars, bumped cars that drive on or get out of the way, every car solid (no phasing into roadblocks), racers that brake, police that drive like people, the assigned pool and reinforcements, helicopters that refuel, louder traffic and exhaust |
| [C3-patch-queue.md](C3-patch-queue.md) | Claude | done (0.9.81 to 0.9.96; part 7's banners came with B2) | From the same drive: the Kurogane Line median, Most Wanted's radar, the pursuit HUD after Jc's sketch, the HUD fishnet, vignette and blur, skid marks and smoke, more stations, hideouts and garages; then Route 1's sign gantries, the traffic signals, zebra crossings, vending machines, utility poles, direction signs |
| [C5-weather.md](C5-weather.md) | Claude | rain done (0.10.3), the day and night cycle with clouds done (0.10.5); what is left of the look is in the brief | Rain and a day and night cycle, as visuals first |
| [B3-wet-weather.md](B3-wet-weather.md) | Backend (Gemini) | parts 1 to 3 done and reviewed (0.9.30 to 0.9.33); part 4 (the hour of the day) after B4 and B5 | What rain and the hour do to the drive: grip, sound, traffic, the racers and the police |
| [C7-pursuit-hud-v2.md](C7-pursuit-hud-v2.md) | Claude (the backend's two fields in B5) | HUD done (0.10.22 to 0.10.27); `seen`, `resupply` and `heliFuel` wait for B5 | Jc's second pursuit sketch: a resupply clock, icons that fade in when seen, plain counts in the Japanese face, a glitch when a unit is destroyed |
| [C8-soundtrack.md](C8-soundtrack.md) | Jc (the tracks), Claude (the code and the manifest) | folders, shuffle and the pursuit mood done (0.10.28); stingers and more tracks later; the prompts are in `docs/music/flow-prompts.md` | A new soundtrack in five moods (a new `pursuit` mood with heat tiers, stingers, a vocal toggle) replacing the eight tracks |
| [C9-music-player.md](C9-music-player.md) | Claude | done (0.10.30): the player, the player's own folders and songs; gamepad focus and a loudness measure at import later | A music player in Settings: folders and their moods, lock, shuffle, vocals, previous, next, pause, and songs and folders the player adds |
| [C6-fill-the-map.md](C6-fill-the-map.md) | Claude (and Gemini for the model variants) | step 1 done (0.10.18: the lot search and ten police stations; 0.10.20: eighteen stakeout spots); gas stations, garages and hideouts next | More buildings outside the city, a police station in every district, many more hideouts, garages and gas stations |
| [B5-police-dispatch.md](B5-police-dispatch.md) | Backend (Gemini), with Claude's stakeout spots and HUD | after B4 | Stations dispatch the police, a one-minute resupply with one car left on the player, hidden undercover cars, and a heat system for the street racers up to heat 5 and three helicopters |
| [B4-civilian-world-collisions.md](B4-civilian-world-collisions.md) | Backend (Gemini) | done (0.9.34 to 0.9.37) | Civilians that turn along real curves, collide with the world and stay on the road, measured by `tools/clipbench.mjs` |
| [C4-kurogane-ramps.md](C4-kurogane-ramps.md) | Claude (and the backend for the links) | planned | The Kurogane Line's ramps down to downtown: slips off a deck, parapets, portals, streets, links |
| [C2-pursuit-overhaul.md](C2-pursuit-overhaul.md) | Claude | done (0.9.18 to 0.9.79) | Most Wanted's pursuit: one car physics for all, destructible police with a kill count, the detection bar and provoking, police chasing racers, up to three helicopters, a bottom-center pursuit HUD, banners with flair, a bigger minimap with the heat, and the audio expansion (pass-bys, horns, panic) |
| [G7-police-station.md](G7-police-station.md) | Assets & Backend | done (0.10.50, 0.10.51; backend wiring 0.9.29, barrier fixes 0.9.32) | A district police station with a roof pad, and the roadblock barrier |
| [G6-civilian-cars.md](G6-civilian-cars.md) | Assets | after G5 and G7 | The fourteen traffic kinds remade, and seven new ones (kei van, executive sedan, coupe, crossover, delivery van, garbage truck, ambulance) |

Finished and cancelled briefs are in `archive/`. Two still matter as references: the pursuit view
contract (`archive/A13-pursuit-hud.md`) and the Most Wanted design for the police
(`archive/A17-police.md`, section "The target").

## The final milestone: shipping to GitHub Pages

The game is a static page: `index.html`, `src/`, `assets/` and the vendored `vendor/`, no build
step and no server code (the dev server's `/__shot` and `/__file` endpoints are for development only
and the game must not need them). The last milestone is to ship it to GitHub Pages so anyone can play
it in a browser.

It is the last milestone on purpose. Every push to a repository that publishes with Pages (or that has
an Actions workflow) makes GitHub run a job, and this repository takes a commit every few minutes
while the agents work. So until the game is finished there is no `.github/workflows/` and Pages stays
off; at the milestone, deployment is one manual step (a `workflow_dispatch` workflow, or a push of a
release branch by hand), never a job on every commit.

Before it ships:
- The page works from a subpath (`https://<user>.github.io/Lowbeam/`): every path relative, the
  import map in `index.html` too (check it with the dev server's page moved to a subfolder).
- Size and loading: `assets/` is about 41 MB (the recorded soundtrack is most of it); the loading
  screen has to cover it on a slow line, and Pages' limits (1 GB, 100 MB a file) hold.
- Audio starts only after a click or key (browser autoplay rules): the title screen's first input does it.
- `localStorage` saves (`lowbeam.v1`) survive a version bump, with defaults for anything missing.
- No reference images (`concepts/` stays out of git) and nothing whose license is not clear: the
  music tracks, the fonts (`assets/fonts/` are OFL) and any model that came from outside.
- A playthrough in Chrome, Firefox and Safari at 1280 by 720 and at a laptop's size; the frame rate on
  a mid-range machine (nothing has been measured on real hardware yet).

Nobody sets this up before Jc says the game is done. It is not a task for any agent until then.

## Working in the shared tree

- Before starting: `git status` and `git log --oneline -8`. Another agent may be working; never
  touch or commit files you did not change.
- Stage your files by name, never `git add -A`. Commit each part as soon as it is green.
- `npm test` and `npm run check` before every commit; look at the result in the browser (Verification
  in the guide).
- Report at the end of each part: what changed, the commit hash, test counts, screenshots, anything
  you could not do and anything you need from another owner.
