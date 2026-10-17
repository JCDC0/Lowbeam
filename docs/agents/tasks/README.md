# Tasks and ownership

Read this and `docs/agents/ARCHITECTURE.md` before touching a file. CCC owns the repo; every other
agent works only in the files its ticket or brief names. If your task needs a change outside your
files, do not make it: say so in your report. Everyone works in a worktree of their own and the
overseer tests every branch before it reaches `main` (see "Working in your worktree" below).

## The team

| Role | Agent | Version range | What it does |
|---|---|---|---|
| Overseer | Claude in the desktop app (since 2026-10-14; `../OVERSEER.md`) | 0.10.90 to 0.10.99 | The orchestrator and the first tester: Jc's design partner, turns Jc's choices into briefs with an opinion, writes the prompts Jc pastes, and tests every worker's branch itself (the tests it touches, the gate or bench it should move, the game in the browser pane) before the next prompt; merges the branches that pass into `main` (the only agent that does) and bumps `package.json`; keeps the roadmap and the briefs; builds no features |
| Main developer | CCC, Claude Code CLI (Opus 5.5, auto mode); before 2026-10-14 one Claude did both roles | 0.9.0 to 0.9.19, 0.9.70 to 0.9.99, 0.10.0 to 0.10.49 (used); now 0.11.0 to 0.11.49 | Builds what the overseer briefs, anywhere in the repo: the game logic, the world, rendering, the UI, fitting assets in, the audits and the tools; the second tester (tests and looks at its own work before it reports) |
| Patchwork | agy, Antigravity CLI: Gemini 4 Argon as the lead with Gemini 3.8 Flash subagents (Jc, 2026-10-17) | 0.9.20 to 0.9.47 (used); now 0.9.48 to 0.9.49, then 0.11.50 to 0.11.99 | Small bug fixes and patches by ticket: each ticket names the bug, the files it may touch and the test that proves it, one commit; no standing ownership of any part of the repo. Its first job under Argon is a trial, B6's pure module, graded against a holdout test; the scope widens only if it clears it |
| Backend, police | Hermes Agent, DeepSeek V4.1 Flash (Jc, 2026-10-17) | 0.12.0 to 0.12.49 (his 0.10.70 stays where it is) | B5 on branch `hermes/b5`, one part a commit, the overseer's review after each part. Owns B5's files only (below); one trial part before any more |
| Tickets | OpenCode, on OpenCode Go (Jc picks the model and it is written here: not chosen yet) | 0.12.50 to 0.12.99 | Bounded tickets, each with its files and the test that proves it, one commit; the first is the GPS turn cost (X-03); no standing ownership of any part of the repo |
| Outsourced | The Gemini app, Gemini 4 Argon in Task mode (Jc runs it) | none: CCC commits what it makes | 3D models built in code, textures, sourcing with license checks, self-contained code trials; files through `G:\My Drive\Lowbeam\` (`to-gemini`, `from-gemini`) |
| Off | The Assets seat (Flash with the Blender MCP, 0.9.50 to 0.9.69 and 0.10.50 to 0.10.69, used to 0.10.51) | none | Blender models scripted by Flash; ended with 0.10.51 |

Ask the overseer for a new range when yours runs out.

## Who owns which files

| Owner | Files |
|---|---|
| CCC | Everything: `src/`, `tests/`, `tools/`, `assets/`, `style.css`, `index.html`, `package.json` dependencies |
| agy, OpenCode | Only the files the current ticket names, for that ticket's commit (agy's B6 trial: `src/vehicles/nitrous-earn.js` and `tests/nitrous-earn.test.mjs`) |
| Hermes | B5's files: `src/police/` (`director.js`, `units.js`, `stations.js`, `heli.js`), the dispatch and parked-unit parts of `src/traffic/sim.js`, the police orders and `pursuitView()` in `src/drive.js`, and their tests (`tests/police-*.test.mjs`, `tests/stations.test.mjs`, `tests/island/police-*.test.mjs`). Never `src/ui/` (Claude's HUD) or the world |
| Overseer | `docs/` (the guide, the briefs, the boards, the roadmap, the prompts); every other agent also writes the guide's lines and the changelog entry for its own commits |

Jc set these seats on 2026-10-14: before then the backend (`drive.js`, `core`, `police`, `race`, the
traffic sim and net, physics, specs, audio and `tests/`) was agy's, and the old briefs still say
"Backend" for that work; read it as CCC's unless the overseer has cut a ticket for agy.

The changelog entry is everyone's: add it in the same commit as your work, in version order, with
your own range. `package.json`, `package-lock.json` and the version and test count in the guide's
`## Current state` are the overseer's: it sets them when it merges your branch, so `package.json`
always holds the highest version merged (a branch numbered below it leaves it alone).

## Open tasks

| Brief | Owner | Status | What |
|---|---|---|---|
| [ROADMAP.md](ROADMAP.md) | Claude (keeps it) | the whole plan in one place, 2026-10-14 | Everything planned and not built: the bug-bash, the planned features, the main objectives still to design (races, a career, car upgrades), shipping; and the decisions waiting on Jc |
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
| [C10-hero-cars.md](C10-hero-cars.md) | Claude (Jc runs Argon in the Gemini app) | a trial: Argon's first Hikari is in (2026-10-14), a revision round out; CCC builds the pipeline | The player's five cars on better bodies: Cosmo's free cars for the Hayate, Rampart and Vespera, Gemini 4 Argon for the Tsurugi and Hikari, through a mesh-body path in CarModel that keeps the cockpit, wheels, camera, lamps and exhaust |
| [C6-fill-the-map.md](C6-fill-the-map.md) | Claude (and Gemini for the model variants) | step 1 done (0.10.18: the lot search and ten police stations; 0.10.20: eighteen stakeout spots); gas stations, garages and hideouts next | More buildings outside the city, a police station in every district, many more hideouts, garages and gas stations |
| [B5-police-dispatch.md](B5-police-dispatch.md) | Hermes (DeepSeek), with Claude's stakeout spots and HUD | part 1 committed on `hermes/b5` (0.10.70), part 2 under way; the overseer reviews after part 2 | Stations dispatch the police, a one-minute resupply with one car left on the player, hidden undercover cars, and a heat system for the street racers up to heat 5 and three helicopters |
| [B6-nitrous-earned.md](B6-nitrous-earned.md) | agy (Argon 4), with Claude's HUD | the pure module first, as agy's trial (2026-10-17); the Drive's wiring after the bug-bash | Nitrous that fills while you drive: high speed, the oncoming lane and near misses, drafting, hitting and taking out police |
| [B4-civilian-world-collisions.md](B4-civilian-world-collisions.md) | Backend (Gemini) | done (0.9.34 to 0.9.37) | Civilians that turn along real curves, collide with the world and stay on the road, measured by `tools/clipbench.mjs` |
| [C4-kurogane-ramps.md](C4-kurogane-ramps.md) | Claude (and the backend for the links) | planned | The Kurogane Line's ramps down to downtown: slips off a deck, parapets, portals, streets, links |
| [C2-pursuit-overhaul.md](C2-pursuit-overhaul.md) | Claude | done (0.9.18 to 0.9.79) | Most Wanted's pursuit: one car physics for all, destructible police with a kill count, the detection bar and provoking, police chasing racers, up to three helicopters, a bottom-center pursuit HUD, banners with flair, a bigger minimap with the heat, and the audio expansion (pass-bys, horns, panic) |
| [G7-police-station.md](G7-police-station.md) | Assets & Backend | done (0.10.50, 0.10.51; backend wiring 0.9.29, barrier fixes 0.9.32) | A district police station with a roof pad, and the roadblock barrier |
| [G6-civilian-cars.md](G6-civilian-cars.md) | Assets, or outside models (Claude) | mostly done with outside CC0 models (0.10.38, 0.10.39, 0.10.43: twelve of the fourteen; of the new ones the garbage truck, ambulance, kei van, executive sedan and coupe, with a fire engine, a limousine and a four-wheel drive); the kei truck and tanker (no CC0 source), the crossover and the delivery van (the panel van stands in) are left | The fourteen traffic kinds remade, and seven new ones (kei van, executive sedan, coupe, crossover, delivery van, garbage truck, ambulance) |

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

## Working in your worktree

Since 2026-10-17 nobody shares a working tree: every agent has a folder, a branch and a port of its
own, and `main` is the overseer's. (One tree and one index for several agents had already put one
agent's files into another's commit, and an uncommitted edit had broken the suite for everyone else.)

| Who | Folder | Branch now | Port |
|---|---|---|---|
| Overseer | `C:\GitHub\Lowbeam` | `main`: merges and docs only | 8040 |
| Jc, to play | `C:\GitHub\Lowbeam-play` | detached on `main` (the hooks move it) | 8041 |
| CCC | `C:\GitHub\Lowbeam-ccc` | `ccc/junctions` | 8042 |
| agy | `C:\GitHub\Lowbeam-agy` | `agy/b6-earn` | 8043 |
| Hermes | `C:\GitHub\Lowbeam-hermes` | `hermes/b5` | 8044 |
| OpenCode | `C:\GitHub\Lowbeam-opencode` | `opencode/gps-turns` | 8045 |

A new task after a merge gets a new branch from `main` in the same folder: `git switch -c
<agent>/<topic> main`.

- Work, test, commit and run your server only in your own folder. Never open, edit or run anything in
  another agent's folder or in `C:\GitHub\Lowbeam`. The reference images (`concepts/`, git-ignored)
  exist only in `C:\GitHub\Lowbeam\concepts\`: read them from there if you must.
- `node_modules` in the new folders is a link to `main`'s: do not run `npm install`, ask the overseer
  if a dependency is missing.
- Before starting: `git status`, `git log --oneline -5` and `git log --oneline HEAD..main` (what `main`
  has that you lack). If `main` moved, commit your work (or `git stash`) and `git rebase main`. Never
  merge `main` into your branch: the history stays a straight line.
- If `git rebase main` conflicts anywhere but `docs/agents/CHANGELOG.md`, run `git rebase --abort`
  and report. In the changelog keep both sides' entries, newest version first, delete the markers,
  `git add docs/agents/CHANGELOG.md` and `git rebase --continue`.
- Stage your files by name, never `git add -A`, and commit with your paths named (`git commit -m "..."
  -- <your files>`). Commit each part as soon as it is green.
- `npm test` and `npm run check` before every commit; look at the result in the browser on your port
  (Verification in the guide).
- Report at the end of each part, or of the commit when the prompt gives you a list: `git rebase
  main`, `npm test` and `npm run check` once more, then say the branch, the head hash, what changed,
  test counts, the numbers you measured, the screenshots (the file names in your `tools/shots/`),
  anything you could not do and anything you need from another owner. Then stop and wait: the
  overseer tests that hash in a scratch tree and fast-forwards `main`. Work done after the reported
  hash goes in the next report; never rewrite a commit you have reported.
- Never `git push`, `git reset --hard`, `git branch -D`, `git stash drop` or `git worktree remove`,
  and never delete a file you did not create. If something looks broken, stop and report.
