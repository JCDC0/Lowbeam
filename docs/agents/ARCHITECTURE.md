# Lowbeam: agent guide

The canonical guide for every agent working in this repo. `CLAUDE.md`, `AGENTS.md` and `GEMINI.md`
only point here. Who owns what and the open tasks are in `docs/agents/tasks/README.md`; read it
before you touch a file. The design plan, with the reasoning behind every system, is `docs/DESIGN.md`.
The history, version by version, is `docs/agents/CHANGELOG.md`. This file says what is true now.

## What this is

A PS1-style night driving game in the browser, in the line of Night-Runners Prologue, Tokyo Xtreme
Racer and Need for Speed: Most Wanted (2005). The current level is Kurogane, a 6 km island: a city on
a bay, Route 1 (an expressway loop with toll plazas and two viaducts) round it, the Bayshore Line, a
mountain pass, a forest and a lake, four gas stations, seven landmark lots (police HQ, three garages,
three hideouts). Five cars: Hayate RS-4 (rally tuner), Rampart 440 (muscle), Vespera GT (exotic),
Tsurugi GT-X (modern GT), Hikari 300ZR (1984 turbo coupe). Traffic, street racers with duels, a rally
time attack, the police helicopter and a first police pursuit are in. The police, the pursuit and
its HUD follow Most Wanted (2005); the world, the rendering and the driving follow Night-Runners
Prologue (`docs/DESIGN.md`).

## Commands

| What | Command |
|---|---|
| Install | `npm install` (dev only: `three` for types, `typescript`, the font packages) |
| Run | `npm start`, then open http://localhost:8040 |
| Test | `npm test` (`node --test tests/*.test.mjs`) |
| Type-check (the lint step) | `npm run check` (`tsc`, JSDoc types, no emit) |
| Car tuning bench | `npm run sim` (`node tools/sim.mjs`) |
| World-build bench | `npm run bench` (`node tools/buildbench.mjs`) |
| Music track list | `npm run music` (`node tools/music-manifest.mjs`; `-- --all` to re-measure) |

No build step and no bundler: the browser loads `src/` through the import map in `index.html`.
Three.js r185 is vendored in `vendor/`. `tools/devserver.mjs` serves with no-store caching, answers
range requests, and accepts `POST /__shot` (a canvas capture to `tools/shots/`, git-ignored) and
`POST /__file` (`{ name, ext, data }`, base64; wav, json, txt, png).

## Conventions

- Commit message: version prefix, a sentence, a body. `0.9.3: Add the spike strip model`. End with a
  Co-Authored-By trailer naming the agent. Bump `package.json`, `package-lock.json` and the changelog
  together, using only your own version range (tasks/README.md). The changelog stays sorted by
  version; `## Current state` below names the highest version.
- Stage your own files by name. Never `git add -A`. Never commit another agent's uncommitted work.
- Pure modules never import `three` or touch the DOM: `src/core/{mathx,rng}.js`, everything in
  `src/world/` except `build-*`, `props`, `gas-station`, `world`; `src/vehicles/{specs,surfaces,
  physics,gauges,thermal,exhaust,nitrous,dash}.js`, `src/vehicles/bodies/*`, `src/audio/{engine-dsp,env,songs,
  soundtrack,passby,siren,traffic-voices}.js`, `src/render/{pool-grid,skid-rules}.js`, `src/police/{heli,units,heat,roadblock,director,sight,lights}.js`,
  `src/race/*`, `src/traffic/{net,sim,kinds,manners}.js`, `src/ui/route.js`, `layoutPursuit` in
  `src/ui/pursuit.js`. Tests import only pure modules (and the canvas painters with a mock context).
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

- `npm start` (port 8040; reuse it if it is already running), open the page, and drive it through
  `window.__lowbeam`: `await enterWorld()`, `setState('drive' | 'free' | 'settings' | 'controls' |
  'garage')`, `drive` (the Drive: `start(spec, paint)`, `rig.mode` 0 chase to 4 cockpit, `gauges`,
  `traffic`, `pursuitView()`), `simulate(seconds, { throttle, brake, steer })` (runs the fixed-step
  loop with no frames), `shot(name)` (writes `tools/shots/<name>.png`), `world`, `input`.
- Screenshots at 1280 by 720. A hidden browser pane renders a 1 by 1 canvas and runs no animation
  frames: set the viewport size, and step menus by hand (`input.poll()`, `screen.update(input)`,
  `input.endFrame()`) when the loop is not running. Add `?v=N` to the URL to defeat caching.
- Models from Blender are checked in `tools/props.html?models=a,b` (night, a road, a car for scale,
  collider boxes, light markers, a report from `__props.check()`), landmarks in `tools/landmarks.html`.
- `npm test` and `npm run check` before every commit.

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
| `src/main.js` | Boot, the state machine (title, menu, garage, settings, controls, loading, drive, pause, map, free), `window.__lowbeam` |
| `src/drive.js` | The drive: fixed-step loop, collisions, cameras, refuel, tow, reset, area names, tolls, duel, rally; feeds the police director and carries out its orders |
| `src/core/input.js` | Keyboard and gamepad, menu actions, `drive(dt)` with keyboard ramps, key bindings (`KEYS`, `rebind`, `keyLabel`, `setBindings`, saved under `keys`) |
| `src/core/store.js` | localStorage wrapper (`lowbeam.v1`): car, paints, money, settings, bests |
| `src/render/stage.js` | Renderer, low-line target (`RENDER_HEIGHTS` 240 to 1080, default 480), dither and 15-bit post pass, `shot()` |
| `src/render/psx.js` | Material factory: vertex snapping, light pools, flares |
| `src/render/pools.js`, `pool-grid.js` | Per-pixel light pools: every world light in a float texture and a 24 m grid of up to 12 lights per cell |
| `src/render/fonts.js` | `FONT` (display, seg7, seg14, mono, impact, jp, tech, race) and `loadFonts`, awaited before any canvas is drawn |
| `src/render/textures.js` | Canvas-drawn textures: glass, rims, plates, shop signs, awnings, noise |
| `src/render/cameras.js` | `CameraRig`: chase, car, hood, bumper, cockpit |
| `src/render/sky.js` | Gradient dome, stars, moon |
| `src/world/layout.js` | Authored data: roads, viaducts, the city frame, ramps, stations, tolls, lots, zones, rally, `AREA_JP` |
| `src/world/roads.js`, `spline.js`, `ground.js` | Road profiles (smoothing, grade clamp, lifts, junction blending), the arc-length path, `Ground.at(x, z, y)` |
| `src/world/heightfield.js`, `island.js` | Terrain and the coast |
| `src/world/citygen.js`, `junctions.js`, `merge.js`, `roadgen.js` | City streets, junctions, slip roads, generated road shapes |
| `src/world/buildings.js`, `props.js` | Building placement and the building kinds |
| `src/world/scatter.js` | Pure placement: lamps, trees, buildings, station furniture, lights, colliders |
| `src/world/highway.js`, `build-highway.js`, `toll.js` | Barriers, rails, toll plazas, the toll meter |
| `src/world/gas-station.js` | The Japanese gas stations |
| `src/world/lots.js`, `build-lots.js` | Landmark lots and the Blender model loader |
| `src/world/build-*.js` | Meshes: terrain, roads, bridges, trees |
| `src/world/collision.js` | Circles and oriented boxes in a grid; the car as three circles |
| `src/world/world.js` | `World.create(step)` builds the scene in stages; `update(camera, focus)` |
| `src/vehicles/specs.js` | The five cars: bars, mass, engine, gears, tires, fuel, paints, `dash.hud` |
| `src/vehicles/physics.js`, `surfaces.js`, `thermal.js`, `nitrous.js` | 120 Hz bicycle model, gearbox N R 1..n, wheel slip, engine heat, over-rev, damage, limp mode, the nitrous bottle |
| `src/vehicles/gauges.js` | The readings every gauge shows, from the physics |
| `src/vehicles/models.js`, `loft.js`, `bodies/*` | The lofted car bodies (player cars, racers, traffic) |
| `src/vehicles/cockpit.js`, `dash.js`, `instruments.js`, `screens.js` | The cockpit interior and each car's instruments; the canvas painters shared with the HUD |
| `src/vehicles/exhaust.js`, `exhaust-fx.js` | Flames, sparks, smoke |
| `src/traffic/net.js` | Every road as directed lanes, links, traffic lights; `lanesAt`, `locate` and `route` (Dijkstra over the lanes, U-turns included) |
| `src/traffic/sim.js` | `TrafficSim`: IDM following, lane changes with blinkers, spawn and despawn, wrecks, street racers; police units that route to the player, chase free on a clear line, search, park in roadblocks |
| `src/traffic/kinds.js`, `bodies.js`, `render.js` | Vehicle kinds, their geometry, instanced drawing with lamp flares |
| `src/traffic/manners.js` | The civilians' horns (passed on the wrong side, cut up, a red run in front of them, a scrape) and their panic in a pursuit |
| `src/race/event.js`, `duel.js`, `rally.js`, `pacenotes.js`, `pursuit.js` | `RaceEvent` and its kinds |
| `src/police/heli.js`, `heli-view.js` | The helicopter and its searchlight |
| `src/police/director.js` | `PoliceDirector`: the whole pursuit from the first notice to the report, as orders the Drive carries out |
| `src/police/units.js`, `heat.js`, `roadblock.js`, `sight.js`, `lights.js`, `pursuit-view.js` | Unit kinds and the roster per heat, attention and heat, roadblocks and spike strips, line of sight, the light bar's flash pattern, the strip on the road |
| `src/audio/*` | Engine synthesis (worklet), effects, ambience, pass-by, the engines of the cars around (`traffic-voices.js`), sirens and the rotor (`siren.js`), the recorded soundtrack and its moods |
| `src/ui/hud.js`, `cluster.js`, `cluster-styles.js` | The drive HUD and the speedometer styles |
| `src/ui/menus.js`, `garage.js` | Title, main menu, settings, controls, pause, loading, toasts; the garage |
| `src/ui/minimap.js`, `map.js`, `route.js`, `route-hud.js` | Minimap, Tab map, GPS route |
| `src/ui/pursuit.js`, `stats.js`, `screen-fx.js` | Pursuit HUD, F3 stats, the screen effects and their toggles |
| `tools/blender/` | Model scripts: `kit.py` (helpers and exporter), `police_hq.py`, `garage.py`, `hideout.py`, `heli.py` |
| `assets/models/` | Exported models (JSON) |
| `assets/fonts/`, `tools/vendor-fonts.mjs` | The bundled OFL faces and the script that vendors them |
| `assets/music/` | The recorded soundtrack and `tracks.json`, the list the game plays from (mood, title, measured loudness, vocal) |
| `tools/props.html`, `landmarks.html`, `models.html`, `bodies.html`, `trees.html`, `mapview.html`, `audio-lab.html` | Dev viewers |
| `tools/sim.mjs`, `mapcheck.mjs`, `buildbench.mjs`, `render-engines.mjs`, `render-passby.mjs`, `render-sirens.mjs`, `music-manifest.mjs` | Node benches, renders, the music track list |

## Current state (0.9.87)

375 tests pass; the type check is clean. By area:

**World.** The island (`COAST`, `inland`), terrain falling into the sea, one water sheet. Route 1:
two 3-lane carriageways (11 km each) with a median, barrier, rails, three toll plazas after the Shuto
Expressway's and two 12 m viaducts (north-east, north-west). The Bayshore Line with its own plaza and
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
deck. Minato Toll moved to x -160 to make room for its south-west junction. Kuro Pass
(6.4 km, to 254 m). Kurogane City: frame roads plus about 400 generated streets in nine districts,
about 900 junctions paved as one patch each, about 10,700 buildings in eleven kinds (towers to
houses, shophouses, walk-ups, townhouses, machiya, coin parking, warehouses), merged per 320 m cell.
About 120k instanced trees of nine species. Four Japanese gas stations (hanging dispensers, price
pylon, kiosk, pit bay). Seven landmark lots with Blender models. Lights are per-pixel pools in seven
bands, street lamps as spot cones; about 12,450 lights. World build about 6 to 8 s. A downtown view is
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
is full. Cameras chase, car, hood, bumper, cockpit; the cockpit camera is solved per
car so the road shows from 5 m.

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

**Traffic.** About 38 civilians of fourteen kinds around the player with IDM following, lights,
turns, exits, blinkers and lane holds; wrecks; lamp flares and headlight beams; a blinking
indicator flares larger and the three nearest throw a small amber pool. Every car the player hits
answers by mass, the same contact rules as the player's car (`vehicles/contact.js`): a kei car is
thrown, a bus stops the player. A hit under 18 m/s closing (0.9.20) knocks a car off its line: it slides on
its tires (the sideways slide dies at 0.75 g, the driver brakes, the spin settles), hazards on, then
drives on from its lane; a harder hit, or a car stranded off every lane for 6 s, is a wreck, which
slides at tire grip (0.7 g) until it stops. Knocked cars and moving wrecks hit the other traffic, so
one hit can push a car into the next (`collideAgents`). A car off its lane
(a wreck, a police unit driving free) hits walls, barriers and posts like the player's car: pushed
out, its speed into the wall taken, spun by an end hit, a unit losing hit points by the hit. Civilians answer the player's driving (`traffic/manners.js`): passed on their left (the wrong side,
traffic keeps left), cut up close ahead (they brake too), crossed at speed while they wait at rest,
or knocked aside, they honk with their own horn (a kei car's high beep, a truck's air horn). In a
pursuit, cars within 45 m of the player or of a chasing unit panic: they brake to a crawl, edge
toward the curb, screech if they were moving and maybe honk. The traffic refills everywhere: before
0.9.79 no civilian spawned while the street racers were short, which far from Route 1 was always.
Five street racers on
Route 1 at 200 to 260 km/h. The Hikari is not among the racers yet. Kinds named in `KIND_MODELS`
(`traffic/kinds.js`) are drawn with Gemini's Blender models once they load (`modelGeometry` in
`traffic/bodies.js`: the paint tinted per car, lit head and tail lamps, the light bar flares on the
model's own lenses, the unmarked car's in its grille): the Mazuma RX-Coupe, Hoshi Kei-S,
Kagero Hot-GT, Kagero Lancer-X, Halden Drifter, Tsurugi Wedge and Kenro Hardtop racers and all four police units so far; the rest keep their lofted or boxy bodies until their models pass review.

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
(buildings and the hillside block it); searching units only in a 60 m cone ahead or 25 m round.
Units take the lanes by the shortest route (U-turns included), drive straight at the player when
close with a clear line, follow at the player's speed up to their own top speed (cruiser 190 km/h,
unmarked 250, Rhino 175, interceptor 300) and shove from heat 2. Every unit has hit points (cruiser
100, unmarked 80, interceptor 120, Rhino 260) and loses them to every hit, by the player, other cars
or a wall: the square of the closing speed times its share of the crash (`unitDamage`), so a Rhino
shrugs off what hurts a cruiser and a pillar is worst. Below half it smokes and dulls, below a quarter
it smokes black and limps at 70 % of its top speed, at zero it is destroyed: a dark burnt wreck in
flames (`traffic/damage-fx.js`), its bar and siren dead, its kind's bounty paid into the pursuit
(¥5,000 to ¥20,000), counted as taken out, a little heat added, and a COP TAKEN OUT toast. Backup
arrives one car every 1.5 s from `roster(heat)`. Helicopters (`helisFor`): one at heat 3 from the
HQ's roof, two at 4, three at 5, the backup two flying in from over the west and east hills and leaving
the same way (`sky`); each holds its own station on the player (`HELI_SLOTS`: behind, ahead on the
left, wide on the right) so their searchlights cover different streets. From heat 4 a
roadblock of two or three units (Rhinos at 5) parks across the road 250 to 400 m ahead out of sight,
with a spike strip in its gap (half of them at 4, all at 5; Gemini's model): spiked tires lose 38 %
grip and 28 % top speed for 22 s or until a pump or a tow. Out of sight: evading, cooldown (hideouts
and decks fill it three times faster), escaped with the bounty paid. Stopped with a unit within 12 m
for 3 s: busted, the fine (bounty plus 30,000 yen, what the player has) taken and the car towed to the
police HQ. The end card shows for 6 s, then the units go home; `rapSheet` keeps the totals, units
destroyed among them. The pursuit
HUD (`ui/pursuit.js`) is Most Wanted's after Jc's sketch: at the bottom center, in Michroma, a row of
the units on the scene by kind (cruiser, unmarked, interceptor, Rhino, each with its icon) and the
helicopters, over one panel with the heat marks, the bounty counting up and the time on one line,
the units on the scene, assigned (the pursuit's pool, a dash until the director keeps it) and
destroyed, a REINFORCEMENTS line while they come, and the evade and busted meter along the bottom
split from the middle (a blue COOLDOWN bar while they search); the result card with the fine or the
bounty at the end; before a pursuit only the
detection bar shows. It never fades or pulses, and it shows only on the drive screen. Events (a pursuit, a heat level,
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
and panned, with its tires on the road), eight recorded tracks
in four moods with crossfades and a swell that follows the speed: silent below 30 km/h, full at 75
(60 on the pass). The tracks come from `assets/music/tracks.json`: drop a file in the folder, run
`npm run music` (it measures the loudness with ffmpeg and keeps the moods already set), set the new
file's mood in the JSON; the game keeps its built-in list if a mood would have no track. Police sirens (three voices, a
square and a saw through a band-pass, panned, muffled in the cockpit) and the helicopter's rotor
(`siren.js`; `node tools/render-sirens.mjs` writes a check WAV).

**UI.** Title, Ace Combat style main menu, garage, settings (transmission, render height, the
speedometer style, the screen effects, audio channels), controls with key rebinding, pause, Tab map with GPS waypoint
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

- The roadblock barrier and the pursuit breakers have no models yet (task G1).
- The Hikari is left out of `RIVALS`: two traffic tests sit near their limits when a kind is added.
- The GPS route test measures planning time and can fail when the machine is busy.
- RWD cars spin on gravel at full throttle and full lock (intended; judge with hands on the keys).
- Nothing has been checked at real frame rates on a gaming desktop yet.
- Hillside streets can reach 20 % where a junction pulls them; the Route 18 ramps climb at 6.5 %.
- Route 1 has no overhead sign gantries.
- The Kurogane Line joins only Route 1's inner carriageway (the outer one would need ramps flying
  over the loop) and has no ramps down to the city streets yet. City greenery waits for G4.
