# Lowbeam: agent guide

The canonical guide for every agent working in this repo. `CLAUDE.md`, `AGENTS.md` and `GEMINI.md`
only point here. Who owns what and the open tasks are in `docs/agents/tasks/README.md`; read it
before you touch a file. The design plan, with the reasoning behind every system, is `docs/DESIGN.md`.
Since 2026-10-14 an overseer (Claude in the desktop app) briefs the workers, tests their branches and
is the only one who merges to `main` (`docs/agents/OVERSEER.md`); since 2026-10-17 every agent works in
its own git worktree on its own branch (`tasks/README.md`, "Working in your worktree"). CCC is the
main developer on the whole repo; agy, Hermes and OpenCode work from tickets and briefs, only in the
files each names. The history, version by version, is `docs/agents/CHANGELOG.md`. This file says what
is true now.

## What this is

A PS1-style night driving game in the browser, in the line of Night-Runners Prologue, Tokyo Xtreme
Racer and Need for Speed: Most Wanted (2005). The current level is Kurogane, a 6 km island: a city on
a bay, Route 1 (an expressway loop with toll plazas and two viaducts) round it, the Bayshore Line, a
mountain pass, a forest and a lake, four gas stations, twenty landmark lots (the police HQ and nine
stations, five garages, five hideouts). Five cars: Hayate RS-4 (rally tuner), Rampart 440 (muscle), Vespera GT (exotic),
Tsurugi GT-X (modern GT), Hikari 300ZR (1984 turbo coupe). Traffic, street racers with duels, a rally
time attack, the police helicopter and a first police pursuit are in. The police, the pursuit and
its HUD follow Most Wanted (2005); the world, the rendering and the driving follow Night-Runners
Prologue (`docs/DESIGN.md`).

## Commands

| What | Command |
|---|---|
| Install | `npm install` (dev only: `three` for types, `typescript`, the font packages) |
| Run | `npm start`, then open http://localhost:8040 |
| Test | `npm test` (`node --test --test-concurrency=4 tests/*.test.mjs`); one file: `node --test tests/<name>.test.mjs` or `tests/island/<name>.test.mjs` |
| Type-check (the lint step) | `npm run check` (`tsc`, JSDoc types, no emit) |
| Car tuning bench | `npm run sim` (`node tools/sim.mjs`) |
| Civilian clipping bench | `node tools/clipbench.mjs` (2 minutes: civilians inside static shapes, and off the carriageway) |
| Placement audit | `node tools/propaudit.mjs [n]` (gate 2: every solid shape against every lane and turn curve at the car's height; 6 s with the island) |
| Road seam audit | `node tools/seamaudit.mjs [n]` (gate 3: sidewalks across carriageways, carriageways over each other, holes and steps at junction patches; 3 s with the island) |
| World-build bench | `npm run bench` (`node tools/buildbench.mjs`) |
| Lot placement | `node tools/lotsearch.mjs check` (the rules on the lots in `layout.js`) or `police` (a station for every district that has none); it prints `LOTS` lines |
| Outside model import | `node tools/import-glb.mjs <model.glb, .gltf or .fbx> <name> --size L,W,H --auto` (`--report` lists its colors and materials, `--parts` the parts it made, `--head x,y,w,h` and `--tail x,y,w,h` lay lit lamps on the body where the rules find none; for a player car made to order, `--names` takes exact part names, `--drop-wheels` leaves out the `wheel_*` nodes, `--frame` keeps the car's own frame, `--out` writes elsewhere): a low poly .glb, .gltf or binary .fbx into `assets/models/<name>.json`, no Blender; look at it with `tools/props.html?day=1&models=<name>`; record it in `assets/models/SOURCES.md` |
| Music track list | `npm run music` (`node tools/music-manifest.mjs`: scans the folders in `assets/music/`, measures each file with ffmpeg and keeps the roles already set; `-- --all` to re-measure) |

No build step and no bundler: the browser loads `src/` through the import map in `index.html`.
Three.js r185 is vendored in `vendor/`. `tools/devserver.mjs` serves with no-store caching, answers
range requests, and accepts `POST /__shot` (a canvas capture to `tools/shots/`, git-ignored) and
`POST /__file` (`{ name, ext, data }`, base64; wav, json, txt, png).

## Conventions

- Commit message: version prefix, a sentence, a body. `0.9.3: Add the spike strip model`. End with a
  Co-Authored-By trailer naming the agent. Use only your own version range (tasks/README.md) and add
  your changelog entry in version order (the changelog stays sorted by version, newest first). Do not
  edit `package.json`, `package-lock.json` or the version and the test count in `## Current state`:
  the overseer sets them when it merges your branch (`package.json` holds the highest version merged).
- Work only in your own worktree and branch (`tasks/README.md`, "Working in your worktree"). `main`,
  the folder `C:\GitHub\Lowbeam`, is the overseer's: never edit, commit, test or run a server there.
  Stage your files by name, never `git add -A`, and commit with your paths named: `git add <new
  files>`, then `git commit -m "..." -- <your files>`. Before you report, `git rebase main` so your
  branch is `main` plus your commits; the overseer tests it and fast-forwards `main`.
- Pure modules never import `three` or touch the DOM: `src/core/{mathx,rng}.js`, everything in
  `src/world/` except `build-*`, `props`, `gas-station`, `world`; `src/vehicles/{specs,surfaces,
  physics,gauges,thermal,exhaust,nitrous,dash}.js`, `src/vehicles/bodies/*`, `src/audio/{engine-dsp,env,songs,
  soundtrack,library-rules,passby,siren,traffic-voices}.js`, `src/render/{pool-grid,skid-rules,weather,daylight,tail-lamps}.js`, `src/police/{heli,units,heat,roadblock,director,sight,lights}.js`,
  `src/race/*`, `src/traffic/{net,sim,kinds,manners}.js`, `src/ui/{route,radar}.js`, `layoutPursuit` in
  `src/ui/pursuit.js`. Tests import only pure modules (and the canvas painters with a mock context).
- A test that needs the island (the ground, the traffic net, the scatter) takes it from
  `tests/island.mjs` (`island()`, `trafficNet()`, `scattered()`, built on first use), never builds
  its own, and must not change it. Such a file lives in `tests/island/` and is imported by one of the
  four groups `tests/island-{traffic,police,roads,places}.test.mjs`, which `npm test` runs as one
  process each, so the island is built four times a run instead of thirty.
- Units are meters, seconds, kilograms. North is -Z, east is +X. Yaw 0 faces +Z; forward is
  (sin yaw, cos yaw), left is (cos yaw, -sin yaw). Path offsets `d` are positive to the left. Input
  steer is positive to the right and negated inside physics. A car model's local +X is its LEFT.
- Every material comes from `src/render/psx.js` (vertex snapping, light pools).
- Every typeface comes from `FONT` in `src/render/fonts.js` (canvas) or the `--font-*` variables in
  `style.css` (DOM). Never name a family directly, never fall back to a system font.
- Code style: no single-line explanatory comments; doc comments on exported APIs and comments that
  record why a choice was made are fine. No em dashes anywhere, in code or docs.
- When behavior changes, update this file and the changelog in the same commit.
- Do not edit `vendor/`. Do not commit `node_modules/`, `tools/shots/` or `concepts/` (reference
  images copied from the web; git-ignored).

## Verification

Tests prove the rules; the game is verified by looking at it.

- `npm start` (port 8040, `main` only; in a worktree `node tools/devserver.mjs <your port>`, below),
  open the page, and drive it through
  `window.__lowbeam`: `await enterWorld()`, `setState('drive' | 'free' | 'settings' | 'controls' |
  'garage')`, `drive` (the Drive: `start(spec, paint)`, `rig.mode` 0 chase to 4 cockpit, `gauges`,
  `traffic`, `pursuitView()`), `simulate(seconds, { throttle, brake, steer })` (runs the fixed-step
  loop with no frames), `shot(name)` (writes `tools/shots/<name>.png`), `world`, `input`.
- Ports. 8040 is `main`, the merged and tested game, the overseer's. Each agent runs the dev server of
  its own worktree on its own port (CCC 8042, agy 8043, Hermes 8044, OpenCode 8045: `node
  tools/devserver.mjs <port>` from the worktree); `tools/shots/` is per worktree. 8041 is Jc's, kept
  for when Jc asks to play without being interrupted: the worktree `C:\GitHub\Lowbeam-play`, detached on
  the latest commit of `main` (`post-commit` and `post-merge` hooks in `.git/hooks` move it; the hooks
  are not versioned, so if they are missing, `git -C C:/GitHub/Lowbeam-play checkout --detach main`). Claude starts it on
  request with the `play` configuration of `.claude/launch.json` (or `node
  C:/GitHub/Lowbeam-play/tools/devserver.mjs 8041`). No agent tests on 8041, starts or stops it, or edits
  that folder.
- Screenshots at 1280 by 720. A hidden browser pane renders a 1 by 1 canvas and runs no animation
  frames: set the viewport size, and step menus by hand (`input.poll()`, `screen.update(input)`,
  `input.endFrame()`) when the loop is not running. Add `?v=N` to the URL to defeat caching.
- Models from Blender are checked in `tools/props.html?models=a,b` (night, a road, a car for scale,
  collider boxes, light markers, a report from `__props.check()`), landmarks in `tools/landmarks.html`.
- `npm test` and `npm run check` once before every commit, not after every edit. A full run is
  about 17 s, four files at a time; the longest are the traffic group (14 s) and the roads group
  (13 s). Building the island costs about 5 s (ground 2 s, traffic net 2.6 s, scatter 1 s), so a
  file run alone (`node --test tests/island/traffic-solid.test.mjs`) takes 5 s or more. While
  working, run only the files your change touches, and never run the suite in a loop.

## Blender

Models are authored as Python scripts in `tools/blender/`, run in Blender through the Blender MCP
add-on (port 9876; only one agent may drive Blender at a time). Run `kit.py` first, then the model's
script. Never call `read_factory_settings` (it stops the MCP server); `clear()` empties the scene.
The kit works in game coordinates (x right, y up, z toward the street, the front faces +z) and
`export(name, path, only=None)` writes `assets/models/<name>.json`: `size`, `materials` (`name`,
`color`, `tex` one of '', window, metal, shutter, concrete, asphalt, `sign:<key>`, `emissive`,
`tile`), `groups`, `position`, `normal`, `uv`, `colliders` (`x, z, hx, hz, y0, y1`) and `lights`
(`x, y, z, c, range, spot`). `loadModels` and `buildLots` in `src/world/build-lots.js` load and draw
them with the game's materials; the scatter adds their colliders and lights. Helpers: `mat`, `box`,
`poly`, `prism`, `cylinder` (`axis` 'y', 'z' or 'x'), `loft`, `collider`, `light`. The exporter
reads the evaluated mesh, so modifiers count as they appear.

## Key files

| File | Role |
|---|---|
| `src/main.js` | Boot, the state machine (title, menu, garage, settings, controls, loading, drive, pause, map, free), `window.__lowbeam`; `frame` runs `step` in a try and always asks for the next frame, so an error is logged once and the loop goes on |
| `src/drive.js` | The drive: fixed-step loop, collisions, cameras, refuel, tow, reset, area names, tolls, duel, rally; feeds the police director and carries out its orders |
| `src/core/input.js` | Keyboard and gamepad, menu actions, `drive(dt)` with keyboard ramps, key bindings (`KEYS`, `rebind`, `keyLabel`, `setBindings`, saved under `keys`) |
| `src/core/store.js` | localStorage wrapper (`lowbeam.v1`): car, paints, money, settings, bests |
| `src/render/stage.js` | Renderer, low-line target (`RENDER_HEIGHTS` 240 to 1080, default 480), dither and 15-bit post pass, `shot()` |
| `src/render/psx.js` | Material factory: vertex snapping, light pools, flares, one-pixel lines (`psxLine`, the wires), wet road surfaces (`wet`, `uWet`), lights that go out by day (`lit`, `uLamp`) |
| `src/render/tail-lamps.js`, `light-trails.js` | When the player's car and the racers run their tail lamps (`tailLampsOn`: dusk to dawn, and rain) and how bright a light trail is by speed (`trailGlow`, `TRAIL`); the trails themselves, camera-facing ribbons through each lamp's recent positions (`LightTrails`, one draw call an owner) |
| `src/render/weather.js`, `rain.js` | The weather as numbers (`weatherLook`: wet, fog, streaks) and the rain, streaks moved in the vertex shader |
| `src/world/build-lamp-glow.js` | The glow round every street lamp's head within 190 m (one instanced flare mesh, off by day, a halo in rain) |
| `src/world/rain-cover.js` | Where it does not rain: the roof over any point (a deck, a canopy) and the grid of it round the camera the rain shader reads |
| `src/render/pools.js`, `pool-grid.js` | Per-pixel light pools: every world light in a float texture and a 24 m grid of up to 12 lights per cell |
| `src/render/fonts.js` | `FONT` (display, seg7, seg14, mono, impact, jp, tech, race) and `loadFonts`, awaited before any canvas is drawn |
| `src/render/textures.js` | Canvas-drawn textures: glass, rims, plates, shop signs, awnings, noise |
| `src/render/cameras.js` | `CameraRig`: chase, car, hood, bumper, cockpit |
| `src/render/sky.js`, `daylight.js` | The sky (`SkyView`: a gradient dome with banded clouds, stars, moon, sun) and the clock (`skyLook(hour, cloud)`: palettes, light, fog, lamps) |
| `src/world/layout.js` | Authored data: roads, viaducts, the city frame, ramps, stations, tolls, lots (`LOTS`, `LOT_ROADS`, `LOT_MARGIN`), the nine `DISTRICTS`, zones, rally, `AREA_JP` |
| `src/world/roads.js`, `spline.js`, `ground.js` | Road profiles (smoothing, grade clamp, lifts, junction blending), the arc-length path, `Ground.at(x, z, y)` |
| `src/world/heightfield.js`, `island.js` | Terrain and the coast |
| `src/world/citygen.js`, `junctions.js`, `merge.js`, `roadgen.js` | City streets, junctions, slip roads, generated road shapes |
| `src/world/buildings.js`, `props.js` | Building placement and the building kinds |
| `src/world/scatter.js` | Pure placement: lamps, trees, buildings, station furniture, lights, colliders |
| `src/world/highway.js`, `build-highway.js`, `toll.js` | Barriers, rails, toll plazas, the toll meter |
| `src/world/gantries.js`, `build-gantries.js` | Route 1's sign gantries before every exit and their green guide signs |
| `src/world/gas-station.js` | The Japanese gas stations |
| `src/world/lots.js`, `build-lots.js` | Landmark lots and the Blender model loader; `lotBays(pad)`, the world position and yaw of each police car bay of a station (three) or the HQ (five) |
| `src/world/stakeouts.js` | The undercover cars' eighteen waiting spots (`STAKEOUTS`, `placeStakeouts(ground)`, `world.stakeouts`), found by `tools/stakeoutsearch.mjs` |
| `src/world/build-*.js` | Meshes: terrain, roads, bridges, trees |
| `src/world/markings.js` | Zebra crossings and stop lines at the town's junctions |
| `src/world/vending.js`, `build-vending.js` | The street vending machines |
| `src/world/poles.js`, `build-poles.js` | Utility poles and their overhead wires on the back streets |
| `src/world/guide-signs.js`, `build-guide-signs.js` | The blue direction signs before the avenue crossings |
| `src/world/collision.js` | Circles and oriented boxes in a grid; the car as three circles |
| `src/world/world.js` | `World.create(step)` builds the scene in stages; `update(camera, focus)` |
| `src/vehicles/specs.js` | The five cars: bars, mass, engine, gears, tires, fuel, paints, `dash.hud` |
| `src/vehicles/physics.js`, `surfaces.js`, `thermal.js`, `nitrous.js` | 120 Hz bicycle model, gearbox N R 1..n, surface grip and wet scaling, wheel slip, engine heat, over-rev, damage, limp mode, the nitrous bottle |
| `src/vehicles/gauges.js` | The readings every gauge shows, from the physics |
| `src/vehicles/models.js`, `loft.js`, `bodies/*` | The lofted car bodies (player cars, racers, traffic); a player car's body def with `model` draws a converted model in its place (`HERO_MODELS`, `loadHeroModel`, `meshBody`; the dev switch `?hero=hikari:hikari_300zr`), the loft's stations still shaping the cockpit, cameras and lamps |
| `src/vehicles/cockpit.js`, `dash.js`, `instruments.js`, `screens.js` | The cockpit interior and each car's instruments; the canvas painters shared with the HUD |
| `src/vehicles/exhaust.js`, `exhaust-fx.js` | Flames, sparks, smoke |
| `src/traffic/net.js` | Every road as directed lanes, links, traffic lights; `lanesAt`, `locate` and `route` (Dijkstra over the lanes, U-turns included) |
| `src/traffic/sim.js` | `TrafficSim`: IDM following, lane changes with blinkers, spawn and despawn, wrecks, street racers; police units that route to the player, chase free on a clear line, search, park in roadblocks |
| `src/traffic/kinds.js`, `bodies.js`, `render.js` | Vehicle kinds, their geometry, instanced drawing with lamp flares |
| `src/world/signals.js`, `build-signals.js` | The traffic signals at every lit crossing, their lamps following the traffic's phases |
| `src/traffic/manners.js` | The civilians' horns (passed on the wrong side, cut up, a red run in front of them, a scrape) and their panic in a pursuit |
| `src/race/event.js`, `duel.js`, `rally.js`, `pacenotes.js`, `pursuit.js` | `RaceEvent` and its kinds |
| `src/police/heli.js`, `heli-view.js` | The helicopter and its searchlight |
| `src/police/director.js` | `PoliceDirector`: the whole pursuit from the first notice to the report, as orders the Drive carries out |
| `src/police/units.js`, `heat.js`, `roadblock.js`, `sight.js`, `lights.js`, `pursuit-view.js` | Unit kinds and the roster per heat, attention and heat, roadblocks, spike strips and barriers, line of sight, the light bar's flash pattern, the strip and barriers on the road |
| `src/audio/*` | Engine synthesis (worklet), effects, ambience, pass-by, the engines of the cars around (`traffic-voices.js`), sirens and the rotor (`siren.js`), the recorded soundtrack and its moods |
| `src/audio/catalog.js`, `library.js`, `library-rules.js` | The music the game can play: `assets/music/tracks.json` and the player's own folders and songs (IndexedDB, `library.js`) put together with the saved music settings (`catalog.js`: `loadCatalog`, `setOption`, `setLock`, `setFolderEnabled`, `toggleFolderMood`, `setTrackVocal`, `addFiles`, `removeUserFolder`, `onCatalogChange`); the pure rules (audio file names, titles, ids, grouping a pick into folders, saving and applying the settings) are `library-rules.js` |
| `src/ui/music-panel.js` | The music player in Settings: now playing and the transport, shuffle, vocals, the folders (on, roles, lock, songs, delete) and adding songs or a folder |
| `src/ui/hud.js`, `cluster.js`, `cluster-styles.js` | The drive HUD and the speedometer styles |
| `src/ui/menus.js`, `garage.js` | Title, main menu, settings, controls, pause, loading, toasts; the garage |
| `src/ui/minimap.js`, `radar.js`, `map.js`, `route.js`, `route-hud.js` | Minimap, Tab map, GPS route; `radar.js` is the minimap's frame (`radarFrame`: world point and heading to the canvas, ahead is up) and what sight to draw for a police marker (`sightOf`) |
| `src/ui/pursuit.js`, `stats.js`, `screen-fx.js` | Pursuit HUD, F3 stats, the screen effects and their toggles |
| `tools/blender/` | Model scripts: `kit.py` (helpers and exporter), `police_hq.py`, `police_station.py`, `police_barrier.py`, `garage.py`, `hideout.py`, `heli.py` |
| `assets/models/` | Exported models (JSON); `SOURCES.md` lists the outside ones (origin, author, license) |
| `tools/import-glb.mjs`, `fbx.mjs` | Outside low poly models (.glb, or binary .fbx through `fbx.mjs`) into the game's model JSON: flat color per triangle from the model's palette texture or its material, flat normals, parts by hue and place or by material name (`paint`, `glass`, `lamp`, `tail`, `tire`, `rim`, `plate`, `trim`, `under`; a lamp's two halves kept together), scaled to a traffic kind with round wheels |
| `assets/fonts/`, `tools/vendor-fonts.mjs` | The bundled OFL faces and the script that vendors them |
| `assets/music/` | The recorded soundtrack in folders (Chase, Chill, LeisureRacing: a folder is a playlist) and `tracks.json`, the list the game plays from (the folders with the moods each plays for; each track's title, measured loudness, vocal flag) |
| `tools/props.html`, `landmarks.html`, `models.html`, `bodies.html`, `trees.html`, `mapview.html`, `audio-lab.html` | Dev viewers |
| `tools/sim.mjs`, `mapcheck.mjs`, `buildbench.mjs`, `lotsearch.mjs`, `stakeoutsearch.mjs`, `render-engines.mjs`, `render-passby.mjs`, `render-sirens.mjs`, `music-manifest.mjs` | Node benches, renders, the music track list |

## Current state (0.10.94)

526 tests pass; the type check is clean. By area:

**World.** The island (`COAST`, `inland`), terrain falling into the sea, one water sheet. Route 1:
two 3-lane carriageways (11 km each) with a median, barrier, rails, three toll plazas after the Shuto
Expressway's (each carriageway widening outward round the booth islands) and two 12 m viaducts (north-east, north-west). Before every exit a steel sign gantry
(`gantries.js`, Shuto style): one about 500 m out with the distance, one where the exit lane opens
with an arrow down to it, each with a green guide sign (出口 EXIT, or JCT onto the Bayshore and
Kurogane Lines; the place in kanji and romaji and the road it joins) beside the loop's own sign
(Route 1's hexagonal shield, 内回り or 外回り); 22 in all, their posts solid. The Bayshore Line with its own plaza and
junctions. Four avenues on overpasses with diamond interchanges; every ramp is a slip road. The
Kurogane Line, the city's second layer (`kuroganeLine` in `layout.js`): a 3.2 km elevated road, two
lanes each way, that leaves Route 1's inner carriageway west of the Harbor interchange, climbs north
over the port streets and the outer ring, runs 12 m above the middle of Kurogane-dori across
downtown and comes back to Route 1 east of it. Its four ramps are slip roads that turn a quarter
circle and climb to 6 m where they meet the deck, which eases from 6 m at its ends to 12 m (a lift
`floor`). The avenue, its junctions and the streets crossing under it stay on the ground; over the
avenue the deck stands on portal frames on the sidewalks (`portalOver` in `scatter.js`), elsewhere
on round piers. A concrete barrier runs down its median the whole way and on past each end into
the fork of the ramps. Traffic, racers and police use it, and a reset on any deck puts the car back on the
deck; vehicles over 12 m (the semi) never plan a turn onto its ramps or spawn on them, since a 16 m rigid
box sweeps past the edge of their quarter circle (0.9.43). Minato Toll moved to x -160 to make room for its south-west junction. Kuro Pass
(6.4 km, to 254 m). Kurogane City: frame roads plus about 400 generated streets in nine districts,
about 900 junctions paved as one patch each (a zebra crossing on every arm with a sidewalk and a stop
line across its incoming lanes, about a meter ahead of where the traffic waits; `markings.js`), about 10,700 buildings in eleven kinds (towers to
houses, shophouses, walk-ups, townhouses, machiya, coin parking, warehouses), merged per 320 m cell.
About 1,000 vending machines on the town's sidewalks (`vending.js`), one to three together facing the
road, their fronts lit (a red, a blue, a white and a green design), each cluster throwing a small
cool pool on the pavement, solid, in one mesh. Utility
poles on the residential, port and industrial streets (`poles.js`; downtown and midtown are wired
underground): about 3,100 concrete poles 30 m apart on one side, with a crossarm, a transformer on
some, three power lines and two telephone lines sagging to the next pole as one-pixel lines. Blue
direction signs (`guide-signs.js`) on the avenues before the crossings where two avenues meet: the
crossing drawn as arrows, each way out labeled in kanji and romaji with the district or zone it
leads to (no place twice on a sign), never with a side street between the sign and its crossing.
About 120k instanced trees of nine species. Four Japanese gas stations (hanging dispensers, price
pylon, kiosk, pit bay). Twenty landmark lots with Blender models (nine stations on Gemini's `police_station`: two storeys, a lit canopy with the red globe, a roof helipad and a mast; Kitamachi, on Route 18 in the north, and Toge on the pass, and one in each of Ginza, Shinmachi, Minatomachi, Higashimachi, Hamacho, Higashi Kogyo and Nishimachi; the port's Futo is served from Hamacho's, ten stations with the HQ). Eighteen stakeout spots for the undercover cars of B5 (`world/stakeouts.js`: eight lay-bys on the avenues and coast roads, four shoulders behind Route 1's rail, three corners by the toll plazas, two side street mouths in the city, the foot of Kuro Pass; each off every lane, with a clear line to the road it watches, 80 m from a station, 250 m from each other); nothing uses them until the backend's part 3. Lights are per-pixel pools in seven
bands, street lamps as spot cones, each lamp within 190 m wearing a glow (a flare, `LampGlow`; off by
day, bigger and brighter in rain); about 13,350 lights. World build about 6 to 8 s. A downtown view is
about 124 draw calls and 500k triangles.

**Cars and driving.** Five cars with honest bars (`node tools/sim.mjs`):

| Car | 0-100 | 1/4 mile | Top | 100-0 | Grip tarmac / gravel |
|---|---|---|---|---|---|
| Hayate RS-4 | 4.64 s | 13.10 s | 203 km/h | 34.7 m | 1.35 g / 0.80 g |
| Rampart 440 | 3.74 s | 11.67 s | 245 km/h | 37.2 m | 1.20 g / 0.61 g |
| Vespera GT | 4.20 s | 12.13 s | 293 km/h | 31.7 m | 1.46 g / 0.59 g |
| Tsurugi GT-X | 4.37 s | 11.78 s | 323 km/h | 34.2 m | 1.43 g / 0.69 g |
| Hikari 300ZR | 5.20 s | 13.52 s | 269 km/h | 38.2 m | 1.32 g / 0.72 g |

Engine rpm comes from the driven wheels (wheelspin climbs to the limiter, a spin does not swing the
tach). Gearbox N, R, 1..n, auto or manual, any shift allowed: past 11,000 rpm the engine blows (money
shift) into limp mode, repaired at a pump or by tow. Heat, over-rev and damage are real. Exhaust
flames, sparks and smoke. Every car's sliding tires lay skid marks that fade over 40 s, and a
hard slide trails pale smoke (`render/skids.js`, `skid-rules.js`, driven from `traffic/damage-fx.js`). Nitrous (`nitrous.js`, held on N, L3 on a pad): an 8 s bottle of 45 % extra
peak torque at half throttle or more, 0.6 to 4 s off 0-160 km/h; it heats the engine about 10 C a
bottle and wears it a little (4 % a bottle on a clean run). Its torque is not cut by the rev limiter,
so held through a gear it drives the revs 600 to 1,400 rpm past the redline, over-revving and
wearing the engine three to five times faster. A blue flame, a hiss, a bar beside every HUD
speedometer and a strip on the cockpit binnacle; refilled at a pump (¥6,000 a bottle) once the tank
is full. Argon's Hikari body (`hikari_300zr`, C10, 0.10.49) is in behind `?hero=hikari:hikari_300zr` for Jc's side by side, its headlights shining from its own pop-up lenses (`headSpots`); the loft stays the default until Jc chooses. Cameras chase, car, hood, bumper, cockpit; the cockpit camera is solved per
car so the road shows from 5 m. The tail lamps run lit from dusk to dawn and in any rain (`tailLampsOn`),
with a red glow on each (the traffic's flares), off on a clear day and bright on the brake at any hour.
With them lit, from 100 km/h the tail lamps leave light trails, full at 180 km/h (Jc's long exposure
streaks, `render/light-trails.js`): a red ribbon from each lamp that lives 0.4 s, about 20 m at full
speed, brighter while braking, thinned where it passes the chase camera.

**Instruments.** Each car has its own cockpit instruments (`DASHES`): Hayate classic black dials with
an aftermarket racing tach and boost gauge (`tuner` face), Rampart cream dials, Vespera yellow dials,
Tsurugi a modern LCD, Hikari a 1984 fluorescent display. In the cockpit they are small and set back
as in a real car (`BINNACLE` in `cockpit.js`): the binnacle stands on the dash top under the
windshield at 58 % size, its dials at the back of a short hooded tunnel, the steering wheel framing it
from below; they read as moving needles and bars, not numbers. The HUD speedometer in the outside views is
the car's own style drawn with the same painters (`cluster-styles.js`): `tuner`, `twin`, `sport`,
`digital`, `vfd`, and the original `classic`; Settings can lock one style for every car. Every style
stands upright on a 300 by 400 canvas: the main dial at the bottom right, the small gauges climbing an
arc up its left side and over its top (`arcSpot`), the twin's speedometer above its tach, and the
digital styles a tall display whose rev bar curves up the side. Warnings are symbols in fixed places
inside the main dial (`dialLamps`).

**Traffic.** About 38 civilians of twenty-two kinds (the ambulance, fire engine, garbage truck and limousine since 0.10.39, all rare; the executive sedan, kei van, four-wheel drive and coupe since 0.10.43) around the player with IDM following, lights,
turns following cubic curves inside junction patches (0.9.34), exits, blinkers and lane holds; wrecks; a blob shadow on the road under each car within 160 m (one
draw call, black at 90 % by day and 45 % by night); lamp flares and headlight beams; a blinking
indicator flares larger and the three nearest throw a small amber pool. The traffic lights are seen:
at each of the 962 lit crossings every way in has a Japanese signal (`world/signals.js`), a pole on
the far left corner with an arm over its lanes and a horizontal head (blue-green, amber, red from the
left), its lamps following `lightState` on the traffic's own clock with a glow on the lit lamp near
the camera; about 2,300 heads at 961 of the 962 crossings, the poles solid (a pole under a deck ends under
its slab, and every pole keeps 0.6 m from the edge of every lane and of every curve a car takes through a
crossing, at its own height, `drivePaths`; a way in with no such corner has no pole of its own), made in `main.js` once the Drive has its traffic net
(`Colliders.addCircles`). Every car the player hits
answers by mass, the same contact rules as the player's car (`vehicles/contact.js`): a kei car is
thrown, a bus stops the player. A hit under 18 m/s closing (0.9.20) knocks a car off its line: it slides on
its tires (the sideways slide dies at 0.75 g, the driver brakes, the spin settles), hazards off, and
drives on from its lane within about a second (0.9.21). A civilian with the player or a racer closing
fast from behind moves over into a free lane, or speeds up when boxed in, and honks; a harder hit, or a car stranded off every lane for 6 s, is a wreck, which
slides at tire grip (0.7 g) until it stops. Every agent is a solid body in every mode (`drive`,
`knocked`, `wreck`, `parked`): `collideAgents` resolves overlap between any two agents by pushing them
apart along the contact normal in proportion to inverse mass; a hit below 3 m/s closing speed nudges
without knocking (0.9.22). Obstacle tracking in `leader` accounts for wrecks and parked roadblock units
across sibling lanes: a car brakes to an equilibrium stop 6 m before a roadblock and, where an adjacent
lane remains open, changes into it instead; a player ram over 6 m/s restores player momentum and punches
through (0.9.23). Knocked roadblock barriers flatten and lie flat on the road, damping their slide quickly with no yaw spin, faded barriers are hidden from PursuitView (0.9.34), and barriers and parked units do not count against the civilian spawn target (0.9.32). Knocked cars and moving wrecks hit the other traffic, so
one hit can push a car into the next. A car off its lane
(a wreck, a police unit driving free) hits walls, barriers and posts like the player's car: pushed
out, its speed into the wall taken, spun by an end hit, a unit losing hit points by the hit. Civilians in drive mode are solid against the world too (`collideWorld` runs in `drive` mode: overlaps pushed out along contact normal and speed into wall zeroed, continuous contact > 1 s brakes and waits, 0.9.35; ramp taper links and toll island protections eliminate clips and carriageway departures, 0.9.36), and turning civilians follow cubic Bezier curves inside junction patches (0.9.34). Civilians answer the player's driving (`traffic/manners.js`): passed on their left (the wrong side,
traffic keeps left), cut up close ahead (they brake too), crossed at speed while they wait at rest,
or knocked aside, they honk with their own horn (a kei car's high beep, a truck's air horn). In a
pursuit, cars within 45 m of the player or of a chasing unit panic: they brake to a crawl, edge
toward the curb, screech if they were moving and maybe honk. The traffic refills everywhere: before
0.9.79 no civilian spawned while the street racers were short, which far from Route 1 was always.
Five street racers on
Route 1 cruise at 200 to 260 km/h, look ahead up to 280 m (or 4 s of travel), apply emergency braking
up to 9 m/s² down to a leader's speed when unable to overtake, weave cleanly using safe lookaheads,
and maintain 140 m clearance on spawn (0.9.23). The Hikari is among the racers (rv-hikari, 0.9.39). The six nearest racers within 260 m leave light trails from their tail lamps as the player's car does (0.10.40). Kinds named in `KIND_MODELS`
(`traffic/kinds.js`) are drawn with Gemini's Blender models once they load (`modelGeometry` in
`traffic/bodies.js`: the paint tinted per car, lit head and tail lamps, the light bar flares on the
model's own lenses, the unmarked car's in its grille): the Mazuma RX-Coupe, Hoshi Kei-S,
Kagero Hot-GT, Kagero Lancer-X, Halden Drifter, Tsurugi Wedge, Kenro Hardtop, Hoshi Beat and Kagero
RS-Wide, Vespera Zero, Kenro Sakura S and Kagero Aristo VIP racers (all eleven of G5) and all four police units, and twenty civilian kinds with outside CC0 models converted by `tools/import-glb.mjs` (`assets/models/SOURCES.md`): Kenney's Car Kit for the sedan, hatchback, taxi, SUV, minivan, pickup, box truck and garbage truck, rgsdev's Free Low Poly Vehicles Pack for the panel van, bus, semi, ambulance, fire engine and limousine, KayKit's City Builder Bits for the wagon, the kei car (its boxy hatchback) and the executive sedan, Cosmo's Low Poly Cars for the kei van, the four-wheel drive and the coupe; the kei truck and tanker keep their boxy bodies.

**Time of day.** Night (the default), dusk, dawn, day or a cycle (`render/daylight.js`; Settings,
saved as `time`; `__lowbeam.time('day' | 18.5 | 'cycle')`). A cycle runs from 17:36 and a day takes 24
minutes. `skyLook(hour, cloud)` gives the dome's colors, the fog, the hemisphere and key light (the sun
by day, the moon by night, whichever is brighter), the stars, and how bright the lamps and the lit
windows are (`uLamp`, `uWindows`: street lamps, shops and windows are out by day and come on at dusk,
the lamp lenses, shop windows and canopy lamps dim to 12 % (`lit` materials), the lit windows go out
below a quarter of the night's lamp; headlight pools and flares keep 30 %). The dome is a shader (`SkyView`) with banded clouds, a sun and
a moon that cross the sky, a glow round the sun, the twilight's orange on the side of the sky the sun
is on (the west at dusk, the east at dawn, deep blue on the other) and the town's glow on the horizon at night. The world
applies it each frame (`World.stepSky`).

**Weather.** Clear, drizzle, rain or storm (`render/weather.js`; Settings, saved as `weather`;
`__lowbeam.weather('storm')`). The weather sets the cloud cover (a few wisps when clear, a solid grey
sky in rain: the stars and the moon go out, the sun dims, the sky and the fog turn grey). A level from 0 to 1 sets how wet the roads are (`uWet`: roads, lanes,
shoulders, sidewalks, zebras and stop lines darken and every street lamp throws a bright, stretched
reflection toward the viewer along the road), how far the fog closes in (420 m dry, 230 m in a storm),
and how many one-pixel rain streaks fall in a box round the camera (`RainView`, up to 3,200, placed in
the vertex shader, leaning back with the car's speed, and not drawn under a roof: a bridge or
viaduct deck, a gas station canopy or a toll plaza canopy, from a 64 m grid of roof heights round the
camera, `rain-cover.js`, refilled in about 3 ms every 9 m of travel). Rain affects grip (tarmac grip falls to 75 %, 0.9.30), sound (rain bed, patter, roof drumming, wet tire hiss, 0.9.31), traffic (civilians drive 12 % slower, brake earlier, follow further back) and police (sight scales with fog to 82.1 m, helicopter searchlight to 70 %, unit grip to 75 %, 0.9.33). One draw call; a reflection reaches only
as far as its lamp's light pool (about 15 m), not the whole way a real one would.

**Races.** `RaceEvent` with three kinds: the duel (Tokyo Xtreme Racer gauges, challenge with H), the
Kuro Pass rally time attack (gates, splits, medals, pace notes, ghost, F at the start line), and the
police pursuit.

**Police.** Most Wanted's loop, run by `PoliceDirector` (pure, tested as whole chases). A patrol
with a clear line notices the player within 60 m all round, and wears an amber mark over its roof (and
an amber blinking arrow on the minimap) while it does; the detection bar (`Heat.attention`, in the
orders as `detect`) fills over 1.5 s of speeding or racing in front of it and drains 1.5 s after no
unit sees the player. Two speed traps in a row (the cameras' share does not drain), ramming a unit or
shaving past one within 3.8 m at more than 22 m/s relative (`NEAR_MISS`) starts a pursuit at heat 1
or at the heat the police still hold. While no pursuit is on, a patrol that sees a street racer
speeding sometimes takes it up (`TAIL`): lights and siren on, driven like a pursuit with the racer as
its target, for up to 45 s; the racer pushes on 15 % faster, and a chase passing the player can
draw them in. Heat climbs a level per 90 s of pursuit and per infraction, stays after an escape and
cools a level per 120 s of quiet, and a bust wipes it. Chasing units see 150 m on a clear line
(scaling with the fog to 82.1 m in a storm; buildings and the hillside block it); searching units only in a 60 m cone ahead or 25 m round (notice radius scaled to 85 % in a storm).
Units take the lanes by the shortest route (U-turns included), drive straight at the player when
close with a clear line (`stepChase`), aiming at a delayed and smoothed target estimate (delay >= 0.18 s,
tau ~ 0.4 s per unit by id, so sudden player steering reaches them softened; 0.9.24). A unit's yaw rate is capped
at latGrip / speed rad/s (8 m/s² lateral grip, falling to 6 m/s² in a storm, 0.9.33), braking into corners when the desired turn exceeds grip. A free
chasing unit scans its forward corridor for traffic, wrecks and parked units, decelerating to stop without contact;
it drives flat out only when its path is clear and it is behind the player, matching player speed within 30 m and
shoving from heat 2. Every unit has hit points (cruiser
100, unmarked 80, interceptor 120, Rhino 260) and loses them to every hit, by the player, other cars
or a wall: the square of the closing speed times its share of the crash (`unitDamage`), so a Rhino
shrugs off what hurts a cruiser and a pillar is worst. Below half hit points a free unit wobbles slightly on its
aim (0.15 rad, 0.6 Hz sine, phase by id), its top speed falls smoothly from 100 % to 85 % between 50 % and 25 % HP,
then smoothly to limp speed (70 %) below 25 % with no step; at zero it is destroyed: a dark burnt wreck in
flames (`traffic/damage-fx.js`), its bar and siren dead, its kind's bounty paid into the pursuit
(¥5,000 to ¥20,000), counted as taken out, a little heat added, and a COP TAKEN OUT toast. The
director maintains an assigned pool for the pursuit (10 at heat 1, 20 at 2, 35 at 3, 50 at 4, 60 at 5,
raised as heat climbs; 0.9.25), decremented only when a dispatched unit actually spawns (0.9.27; failed
spawns leave the pool alone). Destroyed units are permanently gone from the pool. When on-scene units fall to 2 or fewer with the pool
under 5, reinforcements add 25 % of the heat's baseline pool with a REINFORCEMENTS banner. `pursuitView()`
in `drive.js` reports `assigned` and `byKind` (`police`, `police-fast`, `police-int`, `police-heavy`) to the HUD.
Helicopters (`helisFor`): one at heat 3 from the
HQ's roof, two at 4, three at 5, the backup two flying in from over the west and east hills and leaving
the same way (`sky`); each holds its own station on the player (`HELI_SLOTS`: behind, ahead on the
left, wide on the right) so their searchlights cover different streets. Each helicopter has 100 s of pursuit fuel
(115 s total, `heli.js`); at 15 s left it breaks off (CHOPPER BREAKING OFF) to the nearest of the three police stations
(HQ, Kitamachi, Toge, each with a pad via `helipadOf`) to refuel for 40 s, returning (CHOPPER BACK) if heat warrants
(0.9.26); its tank refills when parked at home, and its pad returns to basePad once refueled (0.9.28). Searchlights lose sight under decks and behind dense building blocks, and reach 70 % as far in a storm (133 m, 0.9.33). While no player pursuit is active,
a patrol tailing a street racer may summon one helicopter, with player pursuits taking precedence. The five landmark
garages repair the engine, damage and tires at pump prices without selling fuel or nitrous. From heat 4 a
roadblock of two or three units (Rhinos at 5) parks across the road 250 to 400 m ahead out of sight,
with a spike strip in its gap (half of them at 4, all at 5; Gemini's model): a parked unit stays
immovable against impacts up to 6 m/s closing speed, moving and knocking only when hit harder (0.9.22);
spiked tires lose 38 % grip and 28 % top speed for 22 s or until a pump, garage or tow. Out of sight: evading, cooldown (hideouts
and decks fill it three times faster), escaped with the bounty paid. Stopped with a unit within 12 m
for 3 s: busted, the fine (bounty plus 30,000 yen, what the player has) taken and the car towed to the
nearest police station. The end card shows for 6 s, then the units go home; `rapSheet` keeps the totals, units
destroyed among them. The pursuit
HUD (`ui/pursuit.js`) is Most Wanted's after Jc's sketches (and like Need for Speed Unbound's), in two
groups. At the top of the screen: while the police resupply, a red timer bar that closes toward the middle,
the clock under it (`resupply`, seconds and hundredths) and REINFORCEMENTS ARRIVING, which fade out when
the clock reaches 0 as the reinforcements are added; and always, a centered row of icons for the units on
the scene by kind (cruiser, unmarked, interceptor, Rhino) and the helicopters, each over its count in the
Japanese face (a plain 0, never 00): an icon fades in, and the row re-centers, the first time a unit of
its kind is in the player's sight, its count pops when units are added, it glitches when one is
destroyed, rests at 0 and fades out when the kind is gone and the row closes up, and a helicopter low on
fuel gets a yellow pump that turns red as it retreats (`seen`, `heliFuel`, `lostKinds`, `risenKinds`,
`iconStep`; `tasks/C7-pursuit-hud-v2.md`). At the bottom center, in Michroma, the board: the heat
marks, the bounty counting up and the time on one line; the units on the scene, assigned (the pursuit's
pool, a dash until the director keeps it) and destroyed, each a number over an icon; and along its bottom
the evade and busted meter split from the middle (a blue COOLDOWN bar while they search), or the result
card with the fine or the bounty at the end. Before a pursuit only the detection bar shows. The board
never fades or pulses, and the HUD shows only on the drive screen. `seen`, `resupply` and `heliFuel`
come from B5; until then an icon counts as seen while its kind has units, and there is no clock or pump. Events (a pursuit, a heat level,
a roadblock, a unit taken out, escaped, busted, a blown engine, a duel) are banners (`bannerer` in
`ui/menus.js`) that slam in, hold and leave, ruled by tone; a unit taken out also flashes the
screen white, jolts the camera and plays `audio.takedown()`. The markers
follow the A13 contract. The four units are Gemini's models (cruiser, unmarked
car, Rhino, interceptor). Light bars flash
red (left) and blue (right) in Most Wanted's quad pattern and the four nearest light the road, the
walls and the player's car; the three nearest are heard (wail, yelp up close, hi-lo in a roadblock,
with Doppler; a unit taken out winds its siren down over 1.8 s); the nearest helicopter's rotor thumps by distance; a pursuit is the intense music mood.

**Audio.** Synthesized engines per layout (flat-four, V8, V12, straight-six) in an AudioWorklet, tire
and gravel noise, impacts, ambience, the pass-by whoosh scaled by relative speed, the engines of the four nearest
cars (`traffic-voices.js`: each kind in a voice class, kei buzz, sedan, six, van, diesel truck, bus,
V8, flat-four and racer, its revs from its speed through a gearbox, its firing note Doppler shifted
and panned, with its tires on the road; `TRAFFIC_LEVEL` at 0.32, tires at 0.2, horns at 0.25, 0.9.27),
exhaust pops per engine layout (a V8 a deep thump, a flat-four a crackle, the V12 a sharp crack on lift at high revs
and on upshifts past 85 % of redline; `engine-dsp.js`, `exhaust.js`), recorded tracks
from the folders in `assets/music/` (a folder is a playlist and plays for the moods it is given: Chase for
the police chase, Chill for the drive and the menus, LeisureRacing for a race and the pass) in five moods
(`menu`, `cruise`, `intense`, `mountain`, `pursuit`) with crossfades and a swell that follows the speed:
silent below 30 km/h, full at 75 (60 on the pass). The tracks come from `assets/music/tracks.json`: drop a
file in a folder, run `npm run music`, and set the folder's moods in the JSON if it is a new one. Each
mood deals its tracks from a shuffle bag (the first track is a surprise, none comes round before every
track has played), a pursuit cuts in at once and a mood no folder plays for falls back to the nearest
(`MOOD_FALLBACK`); with no list the synthesized tracks play. The player sets the
music in Settings (the right half, the MUSIC tab; `ui/music-panel.js`): `OPTIONS` in `soundtrack.js`
(vocals, shuffle, lock one folder to play alone), each folder's switch and the moods it plays for
(`rolesOf`: a song follows its folder unless it names its own), previous, next, pause and a click on any
song (`MusicPlayer.previous/skip/pause/resume/playId`, `state()`); the settings and the marks on songs
that have a singer are saved under `music` in `localStorage`. The player adds songs or a whole folder with
the browser's pickers; the files are copied into IndexedDB (`lowbeam.music`) and played from object URLs,
never uploaded, so they stay in that browser (and are the player's own to license). A pause stays through
the modes until resumed. Police sirens (three voices, a
square and a saw through a band-pass, panned, muffled in the cockpit) and the helicopter's rotor
(`siren.js`; `node tools/render-engines.mjs`, `node tools/render-sirens.mjs` write check WAVs). Rain audio
(`rain.js`, 0.9.31): filtered pink noise bed following weather level, stationary car patter fading with speed,
roof drumming under canopies and bridges from rain cover (bed suppressed 88 %), and high-frequency wet tire
hiss on the player's car and passing traffic.

**UI.** Title, Ace Combat style main menu, garage, settings (transmission, render height, the
speedometer style, the weather, the time of day, the screen effects, audio channels, and on its right half the music player or the help, as two tabs), controls with key rebinding, pause, Tab map with GPS waypoint
routing, a 220 px minimap after Most Wanted's radar (the sea and the lake in blue, grey roads, the
places as round badges; the heat as a flame and "x N" at the top left and an amber rim arc filling
with the progress to the next level; police cars as small chevrons flashing red and blue, grey on
patrol and amber while watching, each with its sight as a red or blue cone fading with distance and a
white ring when it sees the player; helicopters as a disc with a tail and the searchlight's glow), area names with their Japanese names, F3 stats. Screen effects (`ui/screen-fx.js`, each a toggle
under SCREEN FX, on by default): a fishnet over the HUD panels, a vignette closing in from 120 km/h
(full at 260) and a slight radial blur from 200 km/h (full at 300), the last two in the post pass.
Typefaces: Michroma (`Lowbeam Display`) for labels and the area name, Orbitron for headings, Teko for
race numbers, Share Tech Mono for readouts and body text, DSEG7 and DSEG14 for segment digits, Dela
Gothic One for banners, M PLUS 1p for Japanese.

## Open work and known issues

- The pursuit breakers have no models yet (the roadblock barrier is done in 0.10.51 and placed at roadblocks in 0.9.29).
- Civilians driving on their lanes are checked against the static world and follow real turning curves (B4, 0.9.34 to 0.9.37): 0 clips and 0 off-carriageway samples across 34,111 samples in `tools/clipbench.mjs` (down from 15 clips and 10 off-carriageway before B4), and collision dimensions of all twenty-two civilian kinds match drawn models. Since T-01 (0.10.48) the bench also has 0 stalls and 0 world wrecks, and the placement audit 0 findings: the toll plazas widen their carriageways round the booth islands (`RoadDef.widen`), the Kurogane Line's portals keep their legs out of the Ginza cross streets, and a car leaves for an exit ramp 30 m before it lands on it.
- The soundtrack is Jc's own folders now (14 tracks: Chase 3, Chill 6, LeisureRacing 5); the generator
  prompts and lyrics in `docs/music/flow-prompts.md` are for more. The music player in Settings is in
  (0.10.30). Still to come: stingers for escaped and busted, and the vocal flags of the built-in tracks
  (the Japanese ones read as instrumental until marked VOCAL in the player), `tasks/C8-soundtrack.md`,
  `tasks/C9-music-player.md`.
- The map is thin outside the city: 10 police stations, 5 hideouts, 5 garages, 4 gas stations; the plan
  to fill it is `tasks/C6-fill-the-map.md`.
- RWD cars spin on gravel at full throttle and full lock (intended; judge with hands on the keys).
- Nothing has been checked at real frame rates on a gaming desktop yet.
- The game is not published. Shipping it to GitHub Pages is the last milestone (`docs/DESIGN.md`
  section 12), done by hand once, not on every commit: no workflows until then.
- The steepest streets climb 12.6 % over 10 m (Minatomachi and Shinmachi, just off the Sotokan
  ring); the Route 18 ramps climb at 6.5 %.
- The Kurogane Line joins only Route 1's inner carriageway (the outer one would need ramps flying
  over the loop) and has no ramps down to the city streets yet. City greenery waits for G4.
