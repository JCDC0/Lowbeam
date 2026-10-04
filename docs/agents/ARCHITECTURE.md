# Lowbeam: agent guide

The canonical guide for any agent (Claude, Hermes, Antigravity) working in this repo.
`CLAUDE.md`, `AGENTS.md` and `GEMINI.md` only point here. The design plan, with the
reasoning behind every system, is `docs/DESIGN.md`. Read both before changing code.

## What this is

A PS1-style night driving game in the browser. The long-term target is an open-world
street racer in the line of Night-Runners Prologue and Need for Speed: Most Wanted
(2005). The current milestone is one level, Kurogane: a 6 km square map with a city on
a bay, Route 1 (an expressway loop with toll plazas) round it, avenues that pass over the
loop on overpasses, a mountain pass in the west, a forest and a lake in the north, four
gas stations, and four cars (Hayate RS-4 tuner, Rampart 440 muscle, Vespera GT exotic,
Tsurugi GT-X grand tourer).
Traffic and the street racers are in; challenging a rival and the rally come next.

## Commands

| What | Command |
|---|---|
| Install | `npm install` (dev only: `three` for types, `typescript`) |
| Run | `npm start`, then open http://localhost:8040 |
| Test | `npm test` (`node --test tests/*.test.mjs`) |
| Type-check (the lint step) | `npm run check` (`tsc`, JSDoc types, no emit) |
| Car tuning bench | `npm run sim` (`node tools/sim.mjs`) |
| World-build bench | `npm run bench` (`node tools/buildbench.mjs`) |

No build step and no bundler. The browser loads `src/` directly through the import map
in `index.html`. Three.js r185 is vendored in `vendor/` (copied from
`node_modules/three/build/`). `tools/devserver.mjs` serves with no-store caching and
answers `Range: bytes=` requests (`206` with `Content-Range`, `416` past the end,
`Accept-Ranges: bytes` on every file), so a media element can seek inside a track. It
exports `createServer` and only listens when it is the entry point, so a test can start
it on a free port. It also accepts `POST /__shot` to write a canvas capture to
`tools/shots/` (git-ignored) and `POST /__file` (`{ name, ext, data }`, base64, ext one of
wav, json, txt, png) for other captures such as rendered audio.

## Conventions

- Commit message: version prefix, then a sentence, then a body. Example:
  `0.1.1: Add the loft modeler and the three car bodies`. End with the
  Co-Authored-By trailer when an agent made the commit.
- Version lives in `package.json` and in `docs/agents/CHANGELOG.md`. Bump both.
- Pure modules never import `three` or touch the DOM: `src/core/mathx.js`,
  `src/core/rng.js`, everything in `src/world/` except files named `build-*`, `props`,
  `gas-station`, `rally-dressing`, `world` (so `scatter.js` is pure), and
  `src/vehicles/{specs,surfaces,physics,gauges}.js`, `src/audio/{engine-dsp,env,songs}.js`,
  `src/render/pool-grid.js`, `src/police/heli.js`, `src/ui/pursuit.js` (`layoutPursuit`).
  Tests import only pure modules.
- Units are meters, seconds, kilograms. North is -Z, east is +X.
- Yaw 0 faces +Z. forward = (sin yaw, cos yaw), left = (cos yaw, -sin yaw). Path
  lateral offsets `d` are positive to the left of travel. Input steer is positive to
  the right and is negated inside physics.
- Every material comes from `src/render/psx.js` so it gets vertex snapping and,
  where wanted, baked vertex light (`bake` attribute).
- Code style: no single-line explanatory comments; doc comments on exported APIs
  and comments that record why a choice was made are fine. No em dashes anywhere.
- When behavior changes, update this file and the changelog in the same commit.
- Do not edit `vendor/`. Do not commit `node_modules/` or `tools/shots/`.

## Key files

| File | Role |
|---|---|
| `docs/DESIGN.md` | The plan: pillars, cars, map, driving model, rally, HUD, build order |
| `index.html`, `style.css` | Page shell with the import map; all UI styles and the display font |
| `src/main.js` | Boot, state machine (title, menu, garage, settings, controls, loading, drive, pause, free), `window.__lowbeam` |
| `src/drive.js` | Free roam: fixed-step loop, collisions, cameras, refuel, tow, reset, area names |
| `src/core/input.js` | Keyboard and standard-mapping gamepad; menu actions; `drive(dt)` with keyboard ramps |
| `src/core/store.js` | localStorage wrapper (`lowbeam.v1`): car, paints, money, settings |
| `src/ui/garage.js` | Showroom scene, turntable, the car card with bars and paints |
| `src/ui/menus.js` | Title, main menu, settings, controls, loading, pause and toast DOM screens |
| `src/ui/hud.js` | Driving HUD: area name, money, prompt, minimap slot, cluster slot |
| `src/ui/pursuit.js` | Pursuit HUD (`pursuitHud`, NFS: Most Wanted style) and pure `layoutPursuit(view)` |
| `src/ui/cluster.js` | Canvas arcade cluster (`Cluster`) and shared `drawCluster` for the cockpit binnacle |
| `src/vehicles/gauges.js` | Pure: mirrors temperature, exhaust, damage and the gear from the physics; boost or manifold vacuum, shift light |
| `src/vehicles/exhaust.js` | Pure: flame, sparks, smoke and pop events at the tailpipes, from the physics state |
| `src/vehicles/exhaust-fx.js` | Flame fins, spark and smoke particles at the pipe tips (`ExhaustFx`, owned by `Car`) |
| `src/vehicles/thermal.js` | Pure: engine temperature, exhaust temperature, over-rev, damage, the money shift, limp mode, repair |
| `src/ui/minimap.js` | Rotating canvas minimap with roads, pads, station, rally, landmark icons, and police/heli markers with rim indicators |
| `src/ui/stats.js` | DOM: F3 corner readout of FPS, draw calls, triangles and traffic count |
| `src/world/collision.js` | Pure: circles and oriented boxes in a grid; car as three circles; impulses |
| `src/vehicles/car.js` | `Car`: physics state, model, two spot headlights, cockpit, interpolated pose |
| `src/render/cameras.js` | `CameraRig`: chase, car (near, from behind), hood, bumper, cockpit |
| `assets/fonts/` | The vendored faces, all SIL OFL (`LICENSES.md`): Michroma (the display face), DSEG7 and DSEG14 Classic, Share Tech Mono, Dela Gothic One, M PLUS 1p; `fonts.css` is generated |
| `src/render/fonts.js` | `FONT` (the CSS stacks: display, seg7, seg14, mono, impact, jp) and `loadFonts`, which `World.create` awaits before drawing any canvas |
| `tools/vendor-fonts.mjs` | Copies the font packages from node_modules into assets/fonts/ and writes fonts.css (CJK faces stay split by unicode-range) |
| `src/world/layout.js` | Authored data for Kurogane: Route 1, avenues, pass, city grid, ramps, stations, tolls, zones, rally, economy |
| `src/world/roadgen.js` | Pure road generators: offset paths, dual carriageways, diamond interchange ramps |
| `src/world/citygen.js` | Pure: the city's local streets, district by district (`cityStreets`), and `polygonMask` for fast inside tests |
| `src/world/junctions.js` | Pure: crossings and T junctions found from road geometry (`findJunctions`), and the stretches of road inside them |
| `src/world/buildings.js` | Pure: building placement along every town road by district style (`placeBuildings`), with a 2 m road mask (`RoadMask`) |
| `src/world/lots.js` | Pure: where a landmark lot's model stands (`lotFrame`, `toWorld`) and its colliders and lights in world space (`lotContents`) |
| `src/world/build-lots.js` | Loads the landmark models (`loadModels`, `assets/models/<name>.json`), paints their signs, builds them on their lots (`buildLots`) |
| `assets/models/` | Landmark models exported from Blender as JSON (positions, normals, UVs, material groups, colliders, lights): `police_hq`, `garage`, `hideout` |
| `src/police/heli.js` | Pure: the police helicopter (`Heli`): spin up on the HQ roof pad, lift off, chase from behind and above, bank and pitch, return and land; the searchlight and whether it sees the target; `Skyline`, the highest ground or roof per 32 m cell |
| `src/police/heli-view.js` | Draws the helicopter from the Blender models (body, spinning main and tail rotors), the fading shaft of light, and the searchlight in a free headlight beam slot |
| `tools/blender/` | Blender scripts for the landmarks: `kit.py` (helpers and the JSON exporter), one script per model; run through the Blender MCP |
| `src/world/merge.js` | Pure: slip roads (an exit that grows out of a carriageway's edge, an entry that tapers into it), their shared stretch and gore (`slipMeta`), biarcs for connector ramps |
| `src/world/zones.js` | Pure: named zones, inside the loop, city and water amounts |
| `src/world/island.js` | Pure: `inland(x, z)`, meters inside the coast (`COAST` in layout.js), from a precomputed grid with a noisy shore |
| `src/world/mapdata.js` | Pure: roads, points of interest and zones as plain data for a full-screen map |
| `src/world/heightfield.js` | Natural terrain (`baseHeight`: two valleys, mountains, bay, lake, pass ledge, flat downtown), blur, the carved grid and triangle sampling |
| `src/world/spline.js` | Arc-length Catmull-Rom `Path`: sample, nearest, signed offset |
| `src/world/roads.js` | Road profiles (smoothing, grade clamp, bumps, lifts, twin carriageways, junction blending), grid queries |
| `src/world/ground.js` | `Ground.at(x, z)`: height and surface from roads, then pads, then terrain; carving |
| `src/world/scatter.js` | Pure placement: lamps, trees, buildings, station furniture, baked lights, colliders |
| `src/world/build-terrain.js` | Chunked terrain mesh (same diagonal as `Heightfield.at`), lake surface |
| `src/world/build-roads.js` | Road ribbons with skirts, forecourt pads with curbs |
| `src/world/highway.js` | Pure: Route 1's median barrier, guard rails, toll plazas (lanes, signs, ETC paint, masts) and their colliders |
| `src/world/build-highway.js` | Barrier and rail chunks; the toll plazas after the Shuto Expressway's: fascia, lane signs and signals from one atlas, booths, islands, masts, ETC lane paint |
| `src/world/toll.js` | Pure: `TollMeter` reads the speed and charges the toll as the car crosses a plaza line |
| `src/traffic/net.js` | Pure: every road as directed lanes with keep-left offsets, links between lanes (ends, exits, turns), traffic lights |
| `src/race/event.js` | Pure: the `RaceEvent` interface every race kind shares: state, `update(dt, world)`, `result()` |
| `src/race/duel.js` | Pure: `Duel`, the one-on-one race with a street racer; gauge drains for whoever is behind, prize and challenge rules |
| `src/race/pacenotes.js` | Pure: walks a stage every 5 m and grades each corner (`1` tightest to `6` flat) with hairpin, long, tightens, opens, crest and into |
| `src/race/rally.js` | Pure: `Rally`, the Kuro Pass time attack: gates, splits against a best time, medals, off-course abort, penalties and the ghost (`ghostAt(t)`) |
| `src/traffic/sim.js` | Pure: `TrafficSim`, agents with IDM car following, lights, lane changes, spawn and despawn around the player, wrecks, player collisions, T-junction give-way (`yieldClear`) and `rallyRoad` to keep a stage clear |
| `src/traffic/kinds.js` | Pure: the fourteen traffic vehicle kinds and the sixteen street racers (`RIVALS`: the racer models and the player cars), sizes, speeds and where each is common |
| `src/traffic/bodies.js` | Geometry per kind: the lofted body (`vehicleGeometry`) from the civilian models by kind id or from the kind's `model`; the old boxy stand-ins are the fallback |
| `src/vehicles/bodies/civilians.js` | Pure: the fourteen traffic bodies (`CIVILIAN_MODELS`): cars and vans from profiles, trucks, tanker, bus and semi as a lofted cab with cargo, extra axles |
| `src/vehicles/bodies/profile.js` | Pure: parametric body profiles (stations from a few dimensions) and detail helpers: lamps, grille, plates, mirrors, wing, pipes, scoop, skirts |
| `src/vehicles/bodies/racers.js` | Pure: the twelve street racer cars (`RACER_MODELS`): dimensions, speed, body profile and details |
| `src/traffic/render.js` | `TrafficRenderer`: one InstancedMesh per kind, tint per instance, brake lights |
| `src/vehicles/contact.js` | Pure: car against car contact with impulse and friction |
| `src/world/build-bridges.js` | Slab sides, underside, parapets and piers for roads that are lifted onto a deck |
| `src/world/forest.js` | Pure: nine tree species, habitats, stands, groves, the edge belt and thicket |
| `src/world/build-trees.js` | Nine low-poly tree geometries, instanced chunks, per-instance tint (`treeTint`) |
| `src/world/props.js` | Street lamps and the town: towers, offices, apartment blocks, houses, sheds, konbini, neon, and the small buildings: shophouses, walk-ups, townhouses, machiya, coin parking |
| `src/world/gas-station.js` | The stations, Japanese style: lit fascia canopy with a lamp grid, two-tone pillars, striped islands and bollards, self-service dispensers and hanging hose reels, the price pylon, a glass-fronted kiosk, vending machines, IN and OUT boards; service park tents, floods, rival cars |
| `src/world/world.js` | `World.create(step)`: builds the scene in stages; `update(camera, focus)` |
| `src/render/bake.js` | `LightGrid`, `bakeGeometry` (the `bake` attribute), `sampleLight` for movers |
| `src/render/pools.js` | `installPools`: uploads the world's lights and the cell grid as float textures for the per-pixel light pools |
| `src/render/pool-grid.js` | Pure: `poolGrid`, which lights each 24 m cell lists (12 at most, strongest first) |
| `src/render/sky.js` | Gradient dome, stars, moon; `MOON_DIR` |
| `src/vehicles/specs.js` | The four cars: bars, mass, engine, gears, tires, steering, fuel, paints |
| `src/vehicles/surfaces.js` | Grip, slip peak, slide falloff and rolling resistance per surface |
| `src/vehicles/physics.js` | 120 Hz bicycle model, N R 1..n gearbox, driven-wheel slip and engine rpm, traction control, jumps, fuel |
| `src/render/stage.js` | Renderer, low-line target (`RENDER_HEIGHTS` 240 to 1080, default 480), dither and 15-bit quantize post pass, `shot()` |
| `src/render/psx.js` | Material factory with vertex snapping and baked light |
| `src/render/builder.js` | `MeshBuilder`: quads, boxes, cylinders into grouped geometry; `smoothNormals` (crease-limited), `buildWheel` |
| `src/vehicles/loft.js` | Pure: monotone station curves, wheel arches, the 19-point crowned body ring with its bands, end bevel |
| `src/render/textures.js` | Canvas-drawn textures: glass, rims, plates, shadow, noise |
| `src/vehicles/models.js` | Loft modeler (`Kit`), body data per car (`BODIES`), `CarModel`, `vehicleGeometry` |
| `src/vehicles/cockpit.js` | `buildCockpit`: the interior and each car's modeled instruments (pods, bezels, faces, needles), `update(gauges, dt, time)` |
| `src/vehicles/dash.js` | Pure: each car's instruments (`DASHES`), gauge scales and needle angles |
| `tools/sim.mjs` | Headless tuning bench for the cars |
| `tools/models.html` | Dev model viewer: every car on a floor (keys 1 to 9 solo one), orbit, views, `shot()` |
| `tools/bodies.html` | Dev catalog: every racer and traffic kind through the game's instanced material; `__bodies.show(...ids)`, `grid`, `shot` |
| `tools/trees.html` | Dev tree viewer: the nine species in a 3 by 3 grid, orbit, `shot()` |
| `tools/landmarks.html` | Dev landmark viewer: police HQ, garage and hideout at night through `loadModels` and `buildLots`, light markers, collider wireframes (C), keys 1 to 3 solo, vertex counts, `__landmarks.shot(name)` |
| `tools/mapview.html` | Dev top-down map: hillshade, roads by class, overpasses, stations, tolls, zones; `__map.shot(name)` |
| `tools/mapcheck.mjs` | Node: every road's length, height range, steepest grade, cut and fill, and where roads cross |
| `tools/buildbench.mjs` | Node: world-build stage timings (median of 3 runs) and feature counts |
| `src/audio/audio.js` | The `audio` singleton: graph, channels and settings, engine voice, tires, wind, ambience, impacts, pump, menu chirps |
| `src/audio/engine-dsp.js` | Pure: per-sample engine synthesis (`EngineVoice`, `VOICES`) |
| `src/audio/engine-worklet.js` | AudioWorklet shell around `EngineVoice`, driven by k-rate parameters |
| `src/audio/env.js` | Pure: forest, town and lake amounts around a point, for the ambience |
| `src/audio/songs.js` | Pure: the four tracks composed as note events (`composeTrack`, `TRACKS`) |
| `src/audio/music.js` | `MusicPlayer`: streams the recorded soundtrack with crossfades; the synthesizer, look-ahead scheduling and speed-driven layer mix as the fallback |
| `src/audio/soundtrack.js` | Pure: the recorded tracks (`SOUNDTRACK`, mood, measured loudness), `MoodTracker`, `nextTrack` |
| `assets/music/` | The recorded soundtrack, eight MP3s made by Jc with Google's music tools |
| `docs/agents/tasks/` | Briefs for Antigravity: dashboard repair, Tab map, garage, vehicle bodies, buildings |
| `tools/render-engines.mjs` | Node: writes a drive-by WAV per car to `tools/shots/audio/` |
| `tools/audio-lab.html` | Browser: renders a scripted drive through the real audio graph offline, analyzes it, saves a WAV |

## Current state (0.8.1)

Done and tested:

- Fonts (0.8.0). Beside Michroma (`Lowbeam Display`, still the menus and the HUD) the game bundles
  DSEG7 and DSEG14 Classic (segment digits), Share Tech Mono, Dela Gothic One (heavy banners, with
  kana and kanji) and M PLUS 1p (Japanese), all OFL, vendored from npm by `tools/vendor-fonts.mjs`
  into `assets/fonts/` with `fonts.css` linked from index.html. The CJK faces are split into
  unicode-range pieces, so a page fetches only the characters it uses (3.7 MB on disk). `FONT` in
  `src/render/fonts.js` names the stacks; `loadFonts` (awaited by `World.create`, 4 s at most) fetches
  every face and the kana and kanji the canvas textures draw, so signs never bake a fallback face.
  Now in use: M PLUS 1p for every Japanese sign (neon, shop signs, toll plaza signs, station signs),
  Dela Gothic One for the plaza names, the brand names and the lot signs (police HQ, garages), DSEG7
  for the pylon prices, pump displays and plates. Reference images in `concepts/` are git-ignored.
- Smaller buildings and housing (0.7.7, `buildings.js`, `props.js`). Between the towers and the
  houses the town now has five more kinds: `shop`, a narrow shophouse of two to four floors with a lit
  shop under a striped awning and a lit signboard (`SHOP_SIGNS` in textures.js: ラーメン, 居酒屋 with
  red lanterns, 薬局, 書店, 喫茶, 理容, 酒, 寿司), air conditioners on its front and a water tank on its
  roof; `walkup`, a walk-up apartment block with an open corridor on every floor along the front, its
  rail, a row of doors, corridor lamps and a stair core at one end; `townhouse`, a narrow two-storey
  house with its gable to the street and a carport under the upper floor; `machiya`, a timber
  townhouse with a lattice front, a lean-to roof over the ground floor, a tiled roof along the street,
  a noren at the door and at some a red lantern; `parking`, a coin parking lot with marked bays, its
  parked cars (`Building.cars`, a collider each, the lot itself is open ground) and a lit P sign. The
  mix per district is in `STYLES`: downtown gains shophouses and a little parking; midtown is about a
  third offices, a fifth shophouses, then apartments, walk-ups, parking and the odd machiya;
  residential is houses and townhouses first, then walk-ups, apartments, a corner shop or a machiya.
  Shops, machiya, konbini and parking only stand on the street front; the row behind picks by weight
  from the rest. Parking only goes on ground flat to 0.6 m. About 10,700 buildings and 12,450 lights;
  a downtown view measured 124 draw calls and 503k triangles, residential 142 and 528k.
- Gas stations rebuilt (0.7.6, `gas-station.js`), in the same hand as the toll plazas: a canopy 1.4 m
  deep with a lit fascia band in the brand's colors (the emblem and the name every 9 m, a brand-lit
  trim under it), pillars clad in the brand color to 1.3 m, islands with hazard-striped ends and
  yellow bollards, a price pylon by the road square to the traffic (the brand, セルフ, then レギュラー,
  ハイオク and 軽油 in lit digits), a kiosk with a glass shop front, mullions and a lit band on its
  parapet, roof plant, two vending machines against it and the 入口 IN and 出口 OUT boards at the road
  edge. Since 0.7.9, after a reference photo the user supplied (kept locally in `concepts/`, which is git-ignored), the dispensers hang from
  the canopy as in Japan: a sign box across the island over each pump with the brand's swoosh, a
  lane number and its fuel in its color (ハイオク yellow, レギュラー red, 軽油 green), two coiled hoses
  dropping over each lane to a nozzle in that color, and only a payment post on the island; the
  ceiling is white linear slats with boxy square fixtures; the lanes are painted red-brown; the
  kiosk has a service bay (a lit workshop under a yellow タイヤ オイル バッテリー PRO PIT sign) with a
  tire rack beside it (`tires` in `stationLayout`, with a collider) and a yellow wash banner. Each brand's
  pictures are one canvas atlas plus a repeating fascia texture. `stationLayout` gains `vending` and
  `gates` (with colliders); the pylon's collider is 1 m.
- Police helicopter (0.7.5, `src/police/`). Modeled in Blender (`tools/blender/heli.py`, a light
  twin in white with a blue band, a glass bubble nose, skids, a four-blade main rotor and a
  two-blade tail rotor) and exported as three models (`heli`, `heli_rotor`, `heli_tail`) so the
  rotors spin; `World.create` loads them with the landmarks (`world.models`). It parks on the
  helipad on the police HQ's roof (`HELIPAD` in the HQ model's frame, `helipadOf`). `Heli` (pure)
  spins up over 5 s, lifts off, and chases a target from 32 m behind and 14 m to the side with
  1.2 s of lead, 55 m over the ground and never closer than 28 m over the highest roof or hillside
  near it or ahead of it (`Skyline`, which counts the towers and the landmark models), at up to
  75 m/s (270 km/h, so the fastest cars outrun it on a straight), easing in with 9 m/s2 and banking
  and pitching with its acceleration. Recalled, it flies home, lands and spins down over 8 s. Its
  searchlight follows the target with a lag (a hard turn shakes it) and cannot see through a deck:
  under a viaduct or an overpass the target is lost (`spot.sees`, `lost` counts the seconds).
  `HeliView` draws it, a shaft of light that fades out above the ground, and the spot on the ground
  through the headlight beams of the world shader (it takes the first slot the traffic left free).
  `Drive` owns it: `scrambleHeli()` and `recallHeli()` until the police core decides, and the A13
  contract's `policeMarkers()` (the helicopter and its spot) and `pursuitView()` (null for now).
  Its rotor sound comes with the police core.
- Landmarks (0.6.7). `LOTS` in layout.js lists seven flat paved lots beside the coast roads and West
  Ave, each made like a gas station forecourt (`road`, `near`, `side`, `w`, `d`) and kept clear by the
  street generator (`blocked`): the Kurogane Police HQ on Hanazaki Cape (x 2400, z -2150, 140 by
  110 m), three tuning garages (Tsurugi Works, Koga Speed, Hoshi Auto) and three hideout warehouses
  (Futo, Kita, Nishi). `Ground.lots` are pads with a `lot` instead of a station and are flattened
  like the forecourts. Each model is built in Blender from a script in `tools/blender/` (the HQ:
  the office block with a helipad on its roof, a five-bay motor pool for the patrol cars and a radio
  tower; the garage: a two-bay workshop with a lift, a glass office and a roof sign; the
  hideout: a rusting warehouse with its door rolled up, a dark inside and a carport) and exported
  as JSON with its colliders and lights, so no loader is vendored. `World.create` loads the models
  before the scatter, which adds their colliders and lights (so they join the light pools), and
  `buildLots` stands each model on its lot with its front to the road. The map and the tactical map
  show them as police, garage and hideout points. The police, the helicopter and hiding come later.
- F3 performance and scene stats overlay (0.6.6, A10 part 3). `src/ui/stats.js`: F3 toggles a corner
  readout of frames per second, draw calls, triangles (`renderer.info.render`), and traffic agent
  count with inline styles and zero `style.css` edits.
- Island tactical map and elevated viaducts (0.6.2, A10 part 2). `MapScreen` draws the sea outside
  the `water.coast` polygon with evenodd fill and fallback to `water.sea`. Elevated road runs are
  drawn above ground ribbons with dark outlines. New POI icons (`police` shield, `garage` wrench,
  `hideout` dashed square) and a tactical map legend are added.
- Traffic at any junction (0.6.1, A10 part 1). `TrafficNet.linkCrossings` links crossings between
  any two-way surface roads of class `street` or `arterial` unless lifted over 2 m. Light axes
  alternate per road at the junction rather than from world directions. T junctions provide yield stop
  data (`{ s, yield: { lanes, at } }`), two-way turns from the side road onto the through road, and
  turns into the side road from both directions. Crossings closer than 25 m and junctions with five or
  more arms merge into one light node.
- Kurogane Island (0.6.0, plan in `docs/agents/tasks/C1-kurogane-island.md`). The map is an island:
  `COAST` in layout.js is the shore polygon and `island.js` gives the distance inland. The terrain
  falls into the sea along it, in cliffs under the western mountains and onto a low shelf (about
  360 m) everywhere else; the bay is the same shore cutting in from the south. The east coast and a
  strip along the north shore are low land (`dEast`, `dNorth` in `baseHeight`) for the industrial
  district and the coast roads. One water sheet at sea level covers the whole map, so the sea and
  the lakes fill wherever the land drops below it, and driving into either resets the car. The edge
  forest belt and its thicket are gone; the shore is lined with black pines. New roads: the
  Higashi Coast Road (`higashi`, 4.8 km) from the port up the east coast to Hanazaki Cape, running
  on into the Kita Coast Road (`kita`, 2 km) west along the north shore and round Kami-ike into the
  forest village, where it runs straight on into Kuro Pass (the old hook where Route 18 met the
  pass end to end is gone). Route 18 now ends on the Kita Coast Road at a T east of the village,
  and East Ave ends on the Higashi Coast Road. G3 moved onto the Kita Coast Road. New zones:
  Hanazaki Cape, Kita Coast, Higashi Industrial. `mapData.water.coast` is the shore polygon.
- World data and ground (Kurogane, 6 km square, 8 m terrain cells). Route 1: two one-way
  carriageways of 3 lanes (11 km each) with a 3.2 m median and median lamps, grades under
  3 %, a concrete median barrier, guard rails on both outer edges (open at ramps, forecourts
  and plazas), three toll plazas with speed-trap gates. Four avenues (Route 18 north, Harbor Ave
  south, West Ave, East Ave) pass over it on overpasses with a diamond interchange each
  (four ground-level ramps). Every ramp is a slip road (see Slip roads below). Kuro Pass: 6.4 km of
  2-lane asphalt from the forest village along the northern ridge and down the western mountain,
  climbing to 254 m at up to 8.5 %, on a ledge the terrain is cut around.
  Kurogane City (0.6.3) is a street network, not a grid. Frame roads in layout.js: Chuo-dori
  (`chuo`, Route 18 to Harbor Ave), Kurogane-dori (`dori`, West Ave to East Ave), the inner ring
  Naikan (`naikan`, an ellipse round downtown) and the outer ring Sotokan (`sotokan`), all with 3 m
  sidewalks. Between them `citygen.js` fills each district with its own streets: two families at
  the district's angle and spacing, each street bent by a slow wave, some broken off a block early,
  clipped to the district, carried on to the frame road it stops beside so it meets it at a T, and
  kept clear of the expressway, the ramps, lifted road and the pass. Districts: Ginza-machi
  (downtown, inside Naikan), Shinmachi and Minatomachi (midtown, inside Sotokan), Kitamachi and
  Higashimachi (residential, out to Route 1), Hamacho (south of Sotokan), and outside the loop
  Higashi Kogyo (industrial east coast), Kurogane Futo (the port behind the Bayshore Line) and
  Nishimachi (the west side under the mountains). About 400 streets, 2.4 m sidewalks (1.6 m
  residential, 1.2 m industrial). `junctions.js` finds every crossing and T junction from the road
  geometry (about 900); each is paved as one patch and the ribbons drop their skirts and sidewalks
  inside it. Road heights at junctions blend from one junction's correction to the next (so each is
  met exactly), fading out with distance. `cityStyle(x, z)` in layout.js says what a place is built
  like (downtown, midtown, residential, port, industrial); town ground is paved (`TERRAIN.paved`,
  surface `concrete`), all of it in the dense districts and the front yards in residential ones.
  Route 2, the Bayshore Line (`c2-f`, `c2-r`): 1.65 km of 2-lane dual carriageway along the bay
  (x -850 to 800, z 2420), with its own toll plaza (BAYSHORE TOLL) and a 7.4 m viaduct over the end
  of Harbor Ave, joined to Route 1 at both south corners by the Bayshore junctions: westbound it
  is a branch of Route 1's outer carriageway (`bay-ramp-er` leaves it at the south-east corner,
  `bay-ramp-wr` rejoins it at the south-west one, neither crosses the loop); eastbound
  `bay-ramp-wf` leaves the inner carriageway and flies over Route 1 onto the Bayshore and
  `bay-ramp-ef` flies back over it into the inner carriageway. The ramps are drawn as biarcs
  (`biarc` in merge.js), no curve tighter than 100 m, and meet the Bayshore end to end at its
  width. Each way Route 1 to Route 1 by the bay is about 3.6 km. Guard rails also line steep drops
  and slopes outside town (over 1.5 m), except on decks that have parapets. Four gas stations
  (Harbor, Route 1 east, Mori, Toge; Route 1 east moved north to z 450 in 0.4.19 to clear the
  east exit). Terrain: the loop
  valley rises gently to the north, a second valley holds the forest and Kami-ike, the
  rest climbs to 300 m and more, the bay is open sea. Ground build about 1 s.
  `node tools/mapcheck.mjs` prints the road numbers; `tools/mapview.html` draws the map.
- Vehicle physics for all four cars, tuned so the garage bars are honest. Bench
  output (`node tools/sim.mjs`):

  | Car | 0-100 | 1/4 mile | Top | 100-0 | Grip tarmac / gravel |
  |---|---|---|---|---|---|
  | Hayate RS-4 | 4.64 s | 13.10 s | 203 km/h | 34.7 m | 1.35 g / 0.80 g |
  | Rampart 440 | 3.74 s | 11.67 s | 245 km/h | 37.2 m | 1.20 g / 0.61 g |
  | Vespera GT | 4.20 s | 12.13 s | 293 km/h | 31.7 m | 1.46 g / 0.59 g |
  | Tsurugi GT-X | 4.37 s | 11.78 s | 323 km/h | 34.2 m | 1.43 g / 0.69 g |

  Tarmac grip was raised in 0.2.0 (`SURFACES.asphalt.mu` 1.0 to 1.28, concrete 1.24, brakes
  stronger) and 0.2.3 added downforce (`spec.aero`, N per (m/s)^2 per axle, hard surfaces
  only): the Vespera gains the most at speed, the Rampart the least. The tire curve shape
  (`peak`, `shape`) was left alone on purpose: measured, it already lets a keyboard
  player hold full lock at 1.1 to 1.3 g, and a sharper falloff only made that feel slipperier.
  Gravel, dirt, grass, sand are unchanged and a test guards gravel within 3 %.
- Drivetrain (`physics.js`). `gear` is -1 (R), 0 (N) or 1 to the top gear (Hayate and
  Rampart 5, Vespera 6, Tsurugi 7). The engine is tied to the driven wheels, which can turn faster
  than the road passes under them: `s.slip` (m/s) is that extra wheel surface speed.
  When the engine pushes more than the tires can pass on (`tc` times grip, then a
  slip-ratio curve per surface in `surfaces.js`: `slipPeak`, `slipEnd`, `slide`), the
  wheels spin up with the real rotating mass, engine rpm follows them to the limiter, and
  the sliding tires keep pushing while they spin down. Engine rpm comes from the wheel
  speed (`s.rpm`), never from the car's heading, so a spinning or sliding car does not
  swing its tach. The speedometer is `hypot(vx, vz)`. In first and reverse the clutch
  slips (`CLUTCH_SLIP`) so the needle climbs from the launch rpm instead of sitting on a
  number. Neutral free-revs with the engine's own inertia (`engine.inertia`) and bounces
  on the limiter: since 0.4.14 a running cut takes the throttle away in `freeRev` too, so
  full throttle in N peaks just above each car's redline and can never reach the 11,000 rpm
  blow rpm on its own.
  Auto shifts on road speed (not wheel speed) and holds brake at rest for reverse.
  Manual (Settings, store key `transmission`) goes N, R, 1 ... n with 0.1 s of clutch,
  at any speed, W always throttle and S always brake; nothing is refused. Since 0.4.15
  the manual selector runs up from the bottom N, R, 1 (`stepGear` in `physics.js`), so a
  downshift from 1 goes straight to R and R is the last rung below neutral. A downshift above
  1st picks `downGear`, the highest gear below the current one that would still turn the engine
  at 1.2 times idle (`CRAWL_RPM_FACTOR`) at the current road speed, so a car crawling in a tall
  gear drops straight to 1st on one tap; it never chooses a gear that over-revs, so the money
  shift above it still happens. Auto is unchanged.
- Engine health (`thermal.js`, state in the physics). `s.temp` 80 to 120 C, power falls
  from 108 C to 70 % at 120 C (`thermalDerate`); `s.exh` 300 to 900 C. Rpm past the
  redline (150 rpm dead zone) is `s.overrev` 0 to 1 toward `engine.blowRpm` (11,000 for
  every car): it heats the engine, builds `s.damage`, and the wheels drag the car back.
  Wheel-driven rpm at or above the blow rpm (a money shift: 3rd to 2nd at 144 km/h in the
  Hayate, anything into R above about 120 km/h) or damage reaching 1 sets `s.blown`,
  `s.blowCount`, `s.seize` (0.35 s of grab), pegs temp and exh, and puts the car in limp
  mode: a quarter of the torque, a rough idle at 1,000 to 2,000 rpm (`LIMP_RPM` 2,000) in all gears,
  clutch slipping so the wheels no longer set engine rpm, and torque fading out above 50 to 65 km/h.
  `repairEngine` clears it: hold the interact key at a pump (`repairCost`, 12,000 yen
  when blown) or tow with R (tow fee plus the repair).
- Exhaust effects (`exhaust.js` state in `s.fx`, drawn by `exhaust-fx.js`). A shift above
  80 % of the redline throws a 0.16 s flame and sparks and a bang; a lift-off from full
  throttle above 55 % of the redline crackles 2 to 4 times; over-revving, or sitting on
  the limiter at full throttle, crackles continuously with a constant stream of sparks;
  the moment the engine blows there is a smoke puff, then dense smoke while it stays
  blown (thin smoke from heavy damage). Flames are additive crossed fins parented to the
  body; sparks and smoke are pooled points in world space (`car.fx.group`, added to the
  scene root by `Drive.start`). Pipe tips for each car are the `TIPS` table in
  `exhaust-fx.js`; a body with its own `exhaust: [[x, y, z]]` list wins.
- Render plumbing runs in the browser: `stage.js`, `psx.js`, `builder.js`.
- Car models (`src/vehicles/models.js`, `loft.js`), seen in `tools/models.html`. A body
  is authored as 9 to 11 cross sections. A station is `[z, y0, w0, y1, w1, y2, w2, y3, w3]`:
  rocker bottom, shoulder, belt line, roof edge (half widths). Since 0.4.4 the loft
  interpolates the stations with a monotone cubic (no overshoot past the nose or tail),
  adds 13 arch rings per axle (rocker raised on a circle of radius `wheelRadius + 0.08`,
  fender flared) and fills so no gap is over 26 cm. Each ring has 19 points (`ringOf`):
  Catmull-Rom mid points on the lower side, upper side and greenhouse, and a parabolic
  roof crown (`crownOf`, 4.5 cm on a full-width roof). The ring runs right side bottom to
  roof, then left side roof to bottom (local +X is the car's LEFT). Bands: lower side,
  upper side, greenhouse (glass by z range), roof (glass for windshield and rear window by
  z range), underside. The nose and tail get a 3 cm bevel ring before the cap. Normals are
  smoothed under a 38 degree crease (`smoothNormals`), so panels shade round and real edges
  stay sharp. `Kit` has helpers that put parts on the surface: `face` (end faces), `top`
  (follows the crowned roof band, `roofY(z, x)`), `side`, `stripes`, `ducktail`. Bodies
  come out at 1,700 to 2,000 triangles. Wheels (`buildWheel`): 16 sides, rounded tread
  shoulders, a sidewall, a rim lip and a dished face with the rim texture, 224 triangles. Wheels: pivot (steer about Y) > spin (rotation.x = wheelAngle) >
  mesh (rotated PI for right-side wheels). `CarModel.pose(state, dt)` places the car
  from a physics state and adds body roll and pitch. Material keys: paint, accent,
  glass, trim, under, chrome, lamp, tail, plate, tire, rim.
- Title screen and garage (`index.html`, `src/main.js`, `src/ui/garage.js`). Enter on
  the title opens the garage. Left and right change the car, up and down the paint,
  Esc goes back. The choice persists in localStorage. The camera centers the car in
  the space the card leaves free. Enter in the garage only shows a toast until the
  world exists.
- Display font: CSS family `Lowbeam Display` tries `local()` Microgramma D Extended
  and Eurostile Extended, then the vendored Michroma.
- World meshes (`World.create`, about 1.9 s in the browser pane): 24 by 24 terrain chunks
  with vertex colors per surface and a detail texture, road ribbons cut into 180 m chunks
  (7 columns: skirt, edge, three across, edge, skirt; higher priority roads sit 12 mm per
  priority higher so junctions never z-fight), bridges, concrete pads with curbs, about
  4,600 two-armed sodium lamps, about 10,700 buildings (`buildings.js`: a row along each side of
  every town road and a second row behind it in the denser districts; towers to 130 m in the middle
  of downtown, offices, apartment blocks with balconies, houses with pitched roofs, warehouses and
  factories in corrugated metal with roller doors and saw-tooth roofs, garages with lit shutters,
  konbini, vertical neon signs), merged per 320 m cell and hidden past the fog like the ground,
  road ribbons merged per 256 m cell and material, about 120k instanced trees in 250 m
  chunks (see Forest), four gas stations, a lake, the bay, sky and moon. Terrain and road
  chunks past the fog (`GROUND_DRAW` 620 m) are hidden like the trees. Views measured:
  downtown 90 to 100 calls and 150k triangles, the expressway about 140 and 255k, the
  pass about 70 and 355k, the edge belt about 70 and 315k.
- Forest (`forest.js`, `build-trees.js`): nine species, `TREE` in forest.js: spruce,
  broadleaf, sugi (tall cedar), birch, maple (red, orange or gold per instance),
  black pine, bamboo clump, shrub (no collider) and dead snag, 30 to 144 triangles
  each. Habitats weight the species: valley floor (mixed broadleaf, birch, maple),
  lake edge (bamboo, shrubs, birch), slopes (spruce, sugi) and the high ridge (spruce,
  snags). A noise field makes stands, so a hillside is mostly one species. Inside the
  loop it is farmland with a tree here and there and 36 groves of 34 to 68 m; outside it
  is forest (the forest valley has its own mix with a lot of sugi). The edge belt is
  Chebyshev distance 2900 to 2990 from the center: a dense forest of spruce and sugi
  plus the thicket, two staggered rows (rings 2927 and 2939) of big trees 3 m apart, each
  with a 1.3 m collider, so no gap is wider than 0.4 m. Nothing grows in the sea. The wall at
  2988 stays as the backstop. tests/forest.test.mjs floods a car-sized circle through
  the belt, treating water as blocked, and requires that it never gets past the first row.
- Audio (`src/audio/`, all synthesized, nothing loaded from a file). The page calls
  `audio.unlock()` on the first key or click, `setMode(state)` on every screen change,
  `setCar(spec)` when the car changes (the garage plays its idle with a blip) and
  `update(frame)` once per drive frame. Every call that depends on time takes an optional
  `at`, so the same code runs live and in an `OfflineAudioContext`.
  - Settings contract, for any menu: `audio.settings` is `{ master, engine, effects,
    ambience, music }`, each `{ volume: 0 to 1, on: boolean }`. `setVolume(channel, v)`,
    `setOn(channel, on)`, `toggle(channel)`, `onChange(fn)` (returns an unsubscribe) and
    `audio.ui('move' | 'select' | 'back' | 'error')` for menu chirps. Settings save
    themselves to localStorage under `audio`. `audio.level()` is the output RMS.
  - Engine health: new k-rate parameters `damage` (misfires, uneven firings, knock, rattle,
    lost power), `overrev` (harsh rasp and drive) and a `blow` trigger (bang, metal clank and a
    stumble). Exhaust pops come from `s.fx.pops` with the size in `s.fx.level`.
  - Engine: an AudioWorklet synthesizes each cylinder firing as an exhaust pulse at its
    place in the 720 degree cycle, through a throttle-controlled low pass and two exhaust
    resonances, plus intake noise. Flat-four (Hayate): unequal pairs, the burble, plus a
    turbo whistle that follows boost and a blow-off hiss on lift. V8 (Rampart): uneven
    banks, heavy low end, loud pops. V12 (Vespera): even and high, with gear whine. Straight-six (Tsurugi, `i6`): six even
    firings, a hard rasp, the whistle of two turbos and a little whine. All
    four crackle off throttle, cut on the limiter and dip on shifts.
  - Effects: tire squeal on tarmac (two narrow resonances that rise with speed and slip),
    gravel crunch and scrub on loose surfaces, road rumble, wind, impacts (thump, noise
    and a metallic ring scaled by closing speed), landing thumps, pump hum and clicks.
    A low-pass per camera (cockpit 1.7 kHz, hood 3.6 kHz, chase 9 kHz, bumper 12 kHz)
    muffles the vehicle sounds; the cockpit is also quieter.
  - Ambience: crickets (four gated tones), wind in the trees that follows forest density,
    lake lapping, town hum with a neon buzz, a 120 Hz fluorescent hum on a forecourt.
    All fade in a car going fast. `EnvMap` (pure) supplies forest, town and water.
  - Screens: title, loading mute the world; the garage plays the engine idle; pause mutes
    the world, keeps a faint ambience and ducks the music.
  - Music (`songs.js`, `music.js`): four tracks composed in code from a chord progression
    over a minor scale: NIGHT BRIEFING (menu, 76 bpm, F sharp minor), KIRIGAOKA NIGHTS
    (92 bpm, A minor), LOW BEAM (118 bpm, D minor) and RIDGE RUN (138 bpm, E minor, for
    the rally). Each has pad chords, a bass line (rolling, offbeat, gallop or pedal), an
    arpeggio, a lead melody built from rhythm shapes and nearest-chord-tone voice
    leading, and 16-step drums. The player synthesizes it with Web Audio nodes: detuned
    saw pads, filter-enveloped bass, plucked arpeggio, a lead with delayed vibrato, drum
    voices, a dotted-eighth echo and a generated reverb, with the pads and arpeggio
    ducking on every kick. Layers follow speed (`speedMix`): parked is pads and bass,
    the arpeggio comes in from about 5 km/h, hats and drums from 20 to 60, the lead from
    75 to 115. The menu track ignores speed. Title, garage and loading play the menu
    track; driving rotates Kirigaoka and Low Beam, two loops each, seamlessly. Notes are
    scheduled 1.4 s ahead so a throttled tab does not stutter, and late notes are
    skipped. `audio.music.hold('ridge')` and `release()` are for the rally stage.
  - Recorded soundtrack (0.4.20, `soundtrack.js`, `assets/music/`). In the browser the music is
    eight recorded tracks, two per mood: menu (Shibuya Rain, and its vocal version) on the title,
    garage and loading screens; cruise (Midnight Expressway, Night Highway Drift); intense
    (Redline Pact, Dirt to Crown); mountain (Touge Rush, Touge Overdrive). `MoodTracker` reads
    `audio.update`'s `mountain` (on Kuro Pass or in its zone) and `rival` (meters to the nearest
    street racer, from `Drive`): intense at once for a racer within 150 m or after 4 s above
    150 km/h, back to cruise only after 25 s below 110 km/h with no racer within 300 m; mountain
    after 3 s on the pass, gone 10 s after leaving it. The player switches early (3 s crossfade)
    only when the mood goes up and the current track has played 20 s; when it goes down the
    track finishes first. Tracks follow each other with a 3 s crossfade and never repeat back to
    back. They stream through media elements (decoding all eight would take about 500 MB) and
    are leveled to -16 LUFS from measured loudness (`lufs`); `FILE_LEVEL` sets them against the
    rest. A file that fails falls back to the other track of its mood, then to the synthesized
    track (menu, kirigaoka, lowbeam, ridge); offline contexts (audio-lab) always use the synth.
    Since 0.5.0 the music follows the speed while driving, as in Night-Runners (`SpeedSwell`,
    `SWELL` in soundtrack.js): silent below 50 km/h, swelling in toward full at 140 km/h (100 on
    the pass) at about 8 s from silence to full, falling slower and only after 3 s of lower speed;
    a racer within 150 m holds it at 0.55 or more. The swell drives the recorded tracks' gain and a
    low-pass that opens from 320 Hz, so a track comes in muffled and escalates with the speed. The
    mood counts as fast after 3 s above 140 km/h. Menus play at full; pause holds the swell.
    `audio.onTrack` gets each new track once it is audible; main.js shows `NOW PLAYING <TITLE>` while driving.
    `hold('ridge')` means the mountain tracks. `music.nowPlaying()` reports what is on. The dev
    server does not answer range requests, so a stream cannot be seeked there (playback is
    unaffected).
  - Verified by numbers, not by ear: `tests/engine.test.mjs` checks the spectrum sits on
    the firing harmonics for every voice, the V12 is even and the others are lumpy, load
    makes it louder and brighter, the limiter chops it and the whistle appears under
    boost. `tools/audio-lab.html` renders the real graph offline and compares band
    energies (squeal, gravel, cockpit muffling, ambience). Listen with
    `node tools/render-engines.mjs`.
- Light: moonlight (directional) and a sky fill (hemisphere) are the only real lights.
  `scatter.js` lists about 170 baked lights (lamps, canopies, kiosks, konbini, neon,
  floods). `bakeGeometry` writes them into the `bake` attribute of static meshes; parked
  cars bake too (`CarModel(spec, paint, { light: 'baked' })`). Moving things use the
  local light instead: `World.update(camera, focus)` samples the same lights at the
  player car and sets `psxUniforms.uLocalColor` and `uLocalDir`; materials made with
  `local: true` add it. Light colors above 1 are deliberate: the bake multiplies
  albedo, and night albedos are dark.
  Since 0.5.1 the world lights are per-pixel light pools (`render/pools.js`): `World.create`
  calls `installPools(lights)`, which puts every light into a float texture and a 24 m grid over
  the map listing up to 12 lights per cell (`pool-grid.js`), and every `baked: true` material then
  lights each pixel from that list instead of the `bake` attribute (which stays for the garage and
  anything drawn before the world exists). A light with `spot: 1` is a street lamp head: a cone
  under it, full to about 50 degrees from straight down and gone by 66 (a pool about 16 m across
  from 7.2 m up), with a faint spill beyond; the rest are round point lights. The light is cut into
  7 bands (`POOL_BANDS` in psx.js), the PS1 way, so a pool reads as a shape on the road. Street
  lamps have two arms (`Lamp.back`): a pole in a median lights both carriageways at full reach, a
  roadside pole has a short, lower, dimmer arm (`LAMP_BACK` 1.1 m) over the sidewalk. Range 22 m.
- Driving (`src/drive.js`). Enter in the garage builds the world once (about 0.75 s)
  and puts the chosen car beside a pump at G1. Physics steps at 120 Hz in a fixed-step
  loop; the car is drawn interpolated between steps. Controls: W S or arrows for
  throttle and brake (hold brake at rest for reverse), A D steer, Space handbrake, C
  camera, R back onto the nearest road (or a tow for 5,000 yen when the tank is dry),
  E held at a pump to refuel (3 L/s, 168 yen/L), Esc pause (resume, garage, title).
  Gamepad: RT and LT, left stick, A or X handbrake, Y camera, B refuel, Back reset,
  Start pause. Keyboard throttle ramps to full in about 0.3 s and steering in about
  0.3 s; triggers and stick are read directly.
- Collisions (`src/world/collision.js`): the car is three circles of half its width;
  trees, lamp poles, canopy pillars, sign poles and tent legs are circles; buildings,
  kiosks and pump islands are oriented boxes; the valley edge is a wall. Contacts push
  the car out and apply an impulse at the contact point (restitution 0.22, friction
  0.35), so glancing hits turn the car. Driving into the lake resets onto the road.
- Overpasses (0.3.0). A road def can carry `lifts: [{ at, height, half, flat }]`: it is
  raised by `height` around the point `at`, flat on top for `flat` meters, with a cosine
  ease out to `half`. Lifts are applied after the junction blending, so the road still
  meets the one it crosses and then climbs from there. Above 2 m of lift a road counts as
  a deck: `RoadNetwork.query(x, z, out, extra, minPriority, y)` and `Ground.at(x, z, y)`
  only return a deck to something whose height `y` is within 1.6 m of its surface, so a
  car on the deck gets the deck and a car underneath gets the road below; with no `y` you
  get the ground, so trees, props and the terrain carve ignore overpasses. `stepVehicle`
  passes `s.y` for all four wheel samples and `placeVehicle` always places on the ground.
  Collision shapes may carry `y0`/`y1`, the heights they occupy: the parapet boxes along
  a deck block only cars at deck height and the piers only cars below it. Every bridge
  (scatter `bridges`) gets a pier under the middle of its lift and every 22 m wherever no
  road runs underneath. Approaches shorter than the grade cap allows are the author's
  problem: 7.5 m over `half` 150 with `flat` 50 peaks at 9.4 %.
  Since 0.7.1 Route 1 itself rides on two viaducts 12 m up (`C1_VIADUCTS` in layout.js, lifts on
  both carriageways): across the north-east corner between KITA TOLL and the Route 1 east gas
  station (about 1.5 km) and across the north-west corner between the West Ave and Route 18
  interchanges (about 1.5 km), climbing at under 4.5 %. Both stretches are clear of slip roads,
  plazas, pads and crossings, so nothing has to climb with them (a forecourt beside a lifted road
  would be raised with it). The two carriageways share one deck: the forward carriageway's slab
  runs on under the median to the far edge of the reverse one, the median is decked over and keeps
  its concrete barrier and its lamps (the only lamps that stand on a deck), there are no parapets or
  wall colliders on the median sides, and the guard rails give way to the outer parapets. The
  underside takes no light pools.
  Since 0.7.2 a lifted road whose ground climbs on its own (Route 18 over the ridge north of the
  loop, 11.1 % before) is raised, never lowered, until no step is steeper than its limit plus 2 %
  (`raise` in `applyLifts`), and a slip road's climb is eased into the stretch held at the
  carriageway's height (`easeSlip`), so the Route 18 ramps peak at 6.5 % instead of 8.8 %.
- Slip roads (0.4.19, `merge.js`). Every ramp onto or off an expressway is a lane the
  carriageway gains or loses, never a road laid beside it. An exit starts as a 0.15 m sliver on
  the carriageway's left edge, widens to full width over `taper` (60 m) with its inner edge on
  that edge, runs beside it for `parallel` (90 m) as a deceleration lane, and pulls away from the
  nose over `diverge` (140 m) to `spread` (24 m) off; an entry is the same in reverse. The road
  def carries `taper` (its width, read by `Road.hwAt`) and `slip` (`slipMeta`): the stretch of the
  carriageway it runs along (`attach`), the nose, the same stretch in the ramp's own arc length
  and how long the painted gore is. Everything reads `slip`: `blendJunctions` holds the ramp at
  the carriageway's height along the stretch and through the gore; the ribbons drop the skirt on
  both sides of the shared edge; `buildGores` paints the chevron wedge past the nose and a thick
  dashed line over the seam; `highway.js` opens the carriageway's rail from the taper to 30 m past
  the gore and runs a rail along the ramp's outer edge (not on decks); the traffic exit leaves at
  the start of the taper and the entry joins at its end. `RoadNetwork.query` and `influence` measure
  the true distance past the end of an open road (before, a point beyond a road's end counted as
  on it if it was in line with it, which carved trenches past road ends).
- Cameras (`CameraRig`, C cycles, the choice is saved by name under `cameraView`): chase
  (damped, leans toward the direction of travel in a slide, FOV 62 to 78 with speed), car
  (the standard near view: 5.6 m back, 1.8 m up, looking 7 m ahead of the car so the road shows
  over it, FOV 60 to 70), hood, bumper and cockpit. Since 0.8.1 the cockpit camera is solved per car
  (`cockpitCamera` and `COCKPIT_VIEW` in cockpit.js): 25 cm ahead of the modeled eye, raised (under
  the roof liner) until the sight line over the cowl meets the road 5 m ahead, pitched 0.17 rad down
  so the horizon sits a third of the way down the frame. The binnacle rises on the dash until its
  gauges sit 0.46 rad below the camera's level, and the steering wheel is placed by its tilted rim
  top just under them (a lighter rim and a yellow marker at twelve o'clock so it reads and shows its
  turn). Before, the eye sat low behind a high cowl in every car (the road was hidden for 33 to 100 m
  ahead) and the wheel was out of frame. The cockpit is a lofted
  interior (`buildCockpit`): dash, binnacle, gauge face (dark until the cluster
  lands), steering wheel turning at 4.5 times the road wheel angle, A-pillars, header,
  liner, door panels, mirror, console and passenger seat. It rides in the leaning body.
- Headlights: two spot lights per car (320 cd, decay 1.35, 95 m). Physical units:
  weaker values vanish on the dark ground.
- HUD: area name (fades), money, prompts, the minimap (rotates with the car, zooms
  out with speed, north marker, station and rally start icons) and the gauge cluster.
  In the cockpit view the prompt moves to the top of the screen (`hud.prompt(text, cockpit)`
  sets the `cockpit` class), so it never covers the modeled gauges.
- Gauge cluster (`src/ui/cluster.js`, bottom right, canvas, Michroma): a round tach
  sweeping 240 degrees with scale running to redline plus 1,000 rounded up to the next 1,000 for each
  car (Hayate 9,000, Rampart 8,000, Vespera 10,000, Tsurugi 9,000; blowRpm 11,000 is never drawn), a red
  band from the car's redline to the end of the scale flashing on limiter or over-rev, a lit arc behind
  the needle, five shift lights that fill toward the upshift point and flash at it, a flashing
  red zone on the limiter, digital speed and a gear box (handling R, N, and gears 1..7) in the open
  bottom of the dial, and four small dials around it: FUEL (liters, red under 15 %), TEMP (80 to
  120 C, red over 110, HOT lamp from 115 C), BOOST on the Hayate (-0.7 to +1.2 bar) or VAC on the other
  two (-0.8 to 0 bar), EXH (300 to 900 C, red over 820). Warning lamps include CHECK ENGINE (flashing
  when blown), DMG (steady when damage > 0.3), OVERREV (flashing when overrev > 0), and ENGINE OFF.
  The values come from `src/vehicles/gauges.js` (pure), stepped once per frame from the physics state:
  temperature and exhaust come from the physics (`thermal.js`), boost spools
  above `engine.turbo.spoolRpm` with `engine.turbo.lag` and dumps on shifts, vacuum
  follows the throttle, exhaust follows load and rpm. The Hayate and the Tsurugi have a
  `turbo` block. `drawCluster` applies uniform aspect ratio scaling (`Math.min(w/W, h/H)`).
  In the cockpit view the HUD cluster hides and the same `drawCluster` function paints a bold
  cockpit layout onto the binnacle texture (400 by 300, 4:3), updated every frame with fat needle
  (lineWidth: 7), bold glyphs (>= 22px), ticks only every 1000 rpm, bold speed (50px), and enlarged gear box (34px).
- Traffic (`src/traffic/`). `TrafficNet` turns every road into lanes (`lanes` is the total
  across the road: a two-way road gives half in each direction; lane 0 is the outer, slow
  one and traffic keeps left) and links them: a lane's end joins whatever road starts, ends
  or passes within 12 m (a bend, a T, the village where Route 18 meets the pass), exit
  ramps leave the left lane of their carriageway part-way along, entry ramps merge at the
  end, avenues turn into entry ramps, and city crossings have traffic lights (13 s
  green, 2.2 s yellow, axes alternate) and left and right turns. `TrafficSim`
  keeps about 38 agents alive around the player (spawn 190 to 460 m out, picked from the lanes
  near the player through a grid of 40 m lane pieces since 0.6.3, forget beyond
  620 m, heavier on the expressway): each follows its lane with the Intelligent Driver
  Model, brakes for the car ahead (also across a link), the player, red lights and bends,
  changes lanes diagonally with smoothstep easing and actual motion steering (heading difference between
  1 and 12 degrees, lateral speed under 3 m/s), checks target lane gaps ahead and behind, yields to
  faster cars closing from behind, positions for exits and turns, and does not change lanes within 40 m
  of traffic lights, exits or a player alongside. Since 0.4.17 a civilian that finishes a lane change
  holds it for 8 s (`laneHold`, `LANE_HOLD`) unless a planned exit or turn or something stopped ahead
  says it must leave, and drifting back to the slow lane needs `slowLaneClear`: 120 m clear ahead in
  it and nothing faster within 60 m behind. Measured on the brief's seed 21 setup, civilian lane
  changes reversed within 6 s fell from 51.3 % to 3.3 %. Racers set `laneHold` to 0 and keep weaving.
  Since 0.7.15 a civilian signals before it moves: `signal` is -1 left, 0 off, +1 right and 2 for a
  wreck's hazards, in the driver's own frame (`signalSide`, since lane 0 is the leftmost on a
  keep-left road). `beginSignal` holds it for `SIGNAL_MIN` 1.2 to `SIGNAL_MAX` 2.5 s from the
  agent's own stream, and the checks the move needs live in `changeSafe`, called before the signal
  and again after, so a lane that fills up while the car waits cancels it (`clearSignal`). Exits and
  turns signal through `signalForTurn` about `SIGNAL_LEAD` 60 m out. The renderer puts an amber flare
  (`SIGNAL`) on the outer lamp of the signalling side, blinking at `BLINK` 0.33 s on and off with a
  phase per agent, reusing the existing flare mesh. Racers never signal; a wreck runs its hazards.
  Kinds: sedan, hatchback, kei car, wagon, taxi, SUV, minivan, panel van,
  pickup, kei truck, box truck, tanker, bus and semi, weighted by road class. A car the
  player hits becomes a wreck (`vehicles/contact.js`: three circles each, impulse and
  friction, heavy vehicles barely move) that slides to a stop and fades after 24 s.
  Agents are drawn by `TrafficRenderer`, one InstancedMesh per kind. Since 0.5.2 their lamps
  light up: every car within 420 m of the player gets four additive flares (`psxFlare` in psx.js,
  one draw call for all), white at the head lamps and red at the tail lamps, brighter and bigger
  when braking, placed from the body's own `lamp` vertices and shrinking to a dot when seen from
  the side; the 16 nearest cars throw a headlight beam (42 m, a cone of about 30 degrees aimed a
  little down) onto the world through the pool shader (`uBeamPos`, `uBeamDir`). Since 0.4.7 every kind
  is a lofted body (`vehicles/bodies/civilians.js`), 1,500 to 3,300 triangles: the trucks,
  tanker and semi are a lofted cab with a cargo box or tank and extra axles (`axles`), the
  cargo in a fixed color (`accent`) so only the cab takes the paint.
  The tick is about 0.07 ms; with traffic a downtown view is about 130 draw calls.
- Street racers (`RIVALS` in `kinds.js`, `TrafficSim.spawnRival`). Ten low, wide kinds
  (kei sports car, rotary coupe, hot hatch, boxer sedan, V8 drifter, wedge GT, hardtop,
  roadster, widebody, hypercar; ids `rv-*`) share the traffic sim but want 1.5 to 2.6
  times the limit (150 to 260 km/h on Route 1), spawn only on the fast lanes of the loop
  and never take an exit or turn. Five are kept alive (`rivals` option); the traffic target
  does not count them. In 0.4.10, racers use a racing lateral grip of 0.9 g (~8.83 m/s^2) for
  curve speeds, accelerated pull while below wanted speed, shorter IDM time headway (0.6 s) and a
  tighter 1.0 m minimum gap. When blocked within 140 m, racers weave into any open adjacent lane
  (including the slow lane) in a swift 1.5 s diagonal move, and return to faster lanes when clear.
  Rivals spawn on Route 1 fast lanes between 250 and 460 m from the player, balanced half ahead and
  half behind at full cruising speed (200 to 260 km/h with bursts higher). Over 3 minutes headless
  with traffic, racers average about 188 km/h over six seeds (one run lands anywhere from 170 to
  207) with tops above 270 km/h; the test asks for 180 over the six. `nearestRival(player, range)`
  gives the agent, distance and whether it is ahead; `Drive` shows it as the prompt
  `RIVAL <name> AHEAD <m> M` when no other prompt is up, or `H  CHALLENGE <name> <m> M` when the
  rival is close enough ahead to race (see Races below).
  Since 0.4.6 the racers are real cars: twelve racer models in `vehicles/bodies/racers.js`
  (Hoshi Kei-S, Mazuma RX-Coupe, Kagero Hot-GT, Lancer-X, RS-Wide and Aristo VIP, Halden
  Drifter, Tsurugi Wedge, Kenro Hardtop and Sakura S, Hoshi Beat open roadster, Vespera
  Zero), each a `profileStations` profile plus detail calls, and the four player cars
  (`rv-hayate`, `rv-rampart`, `rv-vespera`, `rv-tsurugi`) with their own bodies and paints.
  `vehicleGeometry(spec, def)` lofts a body with its four wheels into one geometry with a
  color per part, `aPaint` where the instance color tints (`psx.js` option `paint`), and
  `lamp` for head and tail lights; about 2,000 to 2,500 triangles a car. Racer speeds are
  1.8 to 2.7 times the limit (the player cars from their top speed bar).
- Toll plazas (`highway.js`, `build-highway.js`, `toll.js`). KITA, HIGASHI and MINATO
  TOLL on Route 1 and BAYSHORE TOLL on Route 2 straddle both carriageways. Since 0.7.0 they are
  built after the Shuto Expressway's Oi plaza (references in `concepts/`): a canopy 5.9 m up on
  blue columns with a fascia on each face (a dark beam with a round green signal and two amber
  lamps per lane, a gray band with a lit lane sign per lane, a glass and blue panel band, red
  fins at every column), the plaza's name plate (北 Kita, 東 Higashi, 港 Minato, 湾岸 Bayshore),
  three banners on top (ETC fee, ETC card, speed enforcement), red and white chevron boards over
  the island noses, booths with lit windows on 22 m islands with a striped impact cushion, a
  hazard pole, a fee board (普通 and 大型) and an orange カメラ稼働中 board at the approach end,
  an upright striped barrier arm past the booth, two 19 m light masts on the median, and the ETC
  only lanes painted blue with white bars for 36 m before the island noses. Each face signs only
  the lanes coming up to it. Lanes are counted from the median out (`PLAZA_PARTS` and the lane's
  `sign` in highway.js): on a three-lane carriageway the outer lane is 一般 (cash), the middle
  ETC/一般 and the inner ETC専用; on two lanes ETC/一般 and ETC専用. Every sign, signal and stripe
  of a plaza is one canvas atlas (`plazaAtlas`). The canopy lights are spot pools, the masts round
  ones that light the fascia. Islands, cushions, columns and masts have colliders; the lanes
  between are 3.7 m wide. `TollMeter` watches
  the line across the plaza between the road edges: on a crossing it returns the speed in
  km/h, the fee (700 yen), the lane and whether it is a new best; `Drive` charges what you
  can pay, saves `tollBest` per plaza and shows `KITA TOLL 161 KM/H 700 YEN NEW BEST`. Each gate
  charges once per 8 s. Rivals and traffic will use the same gate later.
- Races (`src/race/`, pure, since 0.4.23). `race/event.js` is the `RaceEvent` interface every
  race kind shares: `id`, `kind`, `state` (`countdown`, `running`, `won`, `lost`, `aborted`),
  `time`, `participants`, `update(dt, world) -> events[]`, `result()` and `abort()`. Later kinds
  (point to point, the rally, police escapes, a racer joining mid-race) plug into the same shape,
  so the HUD and the drive loop do not care which one runs. `race/duel.js` is the first kind:
  `Duel` races the player against one street racer on Tokyo Xtreme Racer rules, with a gauge per
  driver that drains for whoever is behind, faster the bigger the gap, and a prize of
  `4000 + 6000 * rival speed factor` yen rounded to 500. The pure module never plays a sound: it
  returns `count`, `go` and `end` events for the caller. `canChallenge` and `DUEL_ROADS` decide
  whether a rival can be challenged at all: ahead, within 60 m, on Route 1 or the Bayshore Line.
  The racer agent gets a `duel` flag and races at its top speed while it lasts. Wins are saved per
  rival kind id under `duelWins`.
  `race/pacenotes.js` (since 0.6.5) reads a stage ahead of time: it walks the path every 5 m
  (`NOTE_STEP`), takes the radius from the heading change over that step, and grades each corner
  from 1 (tightest) to 6 (nearly flat) at `gradeFor`. It also names the mods the HUD shows:
  `hairpin` under `HAIRPIN_R` 20 m, `long` past `LONG_M` 60 m, `tightens` and `opens` when the
  radius changes by half (`CHANGE_R`) across the corner, `crest` where a climb tops out, and
  `into` when the next corner starts inside `INTO_S` 30 m. A note is `{ s, dir, grade, mods }`,
  with `dir` left or right read from the sign of the yaw change, matching the convention in
  `vehicles/physics.js` (yaw 0 faces +Z). A crest is a mod on the nearest corner rather than a
  note of its own.
  `race/rally.js` (since 0.6.8) is the timed run. `new Rally(carId, cfg, road, opts?)` reads the
  stage length off the road (`path.length` on a `world/roads.js` Road, or a plain `length`), starts
  at `cfg.startS` and finishes `cfg.finishEndOffset` short of the end, with `cfg.checkpoints` gates
  spread evenly between (`gates`, `gatesHit`, `nextGate()`). Gates only count when the car is on
  the road, so cutting one does not finish the run. `splits` is one entry per gate plus the finish,
  each `{ at, against, ahead }`, compared against the saved best for that car. Medals come from
  `cfg.medals` (average km/h) and the prize from `cfg.prize`, gold first, and `penalize()` adds
  `PENALTY` 5 s for putting the car back on the stage. More than `OFF_COURSE` 25 m off the road for
  `OFF_LIMIT` 3 s starts an `OFF_GRACE` 10 s countdown, then the run aborts with no result.
  `recordGhost(t, pose)` stores whole centimeters and centi-radians every `GHOST_STEP` 0.1 s and
  `ghostAt(t)` interpolates between samples, returning null outside the span. Pure: it never reads
  or writes the save, so Drive owns `rallyBest` and `rallyGhost`.
  Driving one is in `drive.js` (`rallyRoad`, `atRallyStart`, `placeOnRallyStart`, `startRally`,
  `stepRally`, `endRally`, `rallyPanel`), marked like the duel. Stopped within `RALLY_NEAR` 15 m of
  the start line the prompt reads `F  KURO PASS TIME ATTACK` and F begins a run: the car is placed on
  the line facing down the stage, `audio.music.hold('ridge')` runs and the music is held at
  `SWELL.rallyFloor` 0.7 so it is never silent on the pass, `audio.beep('count')` and
  `audio.beep('go')` come from the race events, and R during a run puts the car back on the stage
  with the 5 s penalty. A new best time and its ghost are saved per car under `rallyBest` and
  `rallyGhost`. `TrafficSim.rallyRoad` then stops spawning on that road and fades out any agent
  still on it, so the stage belongs to the player. The HUD panel (`Hud.rallyPanel`) shows the clock,
  the last split green ahead or red behind, the next two pace notes as `L4 LONG` style text, the
  off-course countdown, and the result card for 4 s.
- Cockpit (`cockpit.js`, since 0.4.9). The interior is lofted from the body (dash top, a
  rounded lip and face, firewall, floor, console, vents, A-pillars, header, liner, door
  panels and sills, mirror, passenger seat) and each car has its own real instruments, not a
  painted image: `DASHES` in `dash.js` lists the pods and gauges. Hayate: speedometer, tach,
  fuel and temp in the binnacle plus a boost gauge in a pod on the dash top. Rampart: only a
  big speedometer and a big tach. Vespera: tach in the middle, speedometer, temp and fuel, no
  boost or exhaust gauge. Tsurugi: the four-gauge cluster plus a center stack of boost, oil
  pressure and volts. A pod is a backing plate turned to face the driver's eye, sides buried in
  the dash and an arched hood over the top. A gauge is a depth can, a chrome bezel, a canvas
  face (ticks every 1,000 rpm or 20 km/h and the red zone, no numerals: at 240 lines they
  cannot be read, the needle against the ticks is enough) and a needle in its own group;
  `update` turns the needles toward the readings (tach and boost fast, the rest slower), sets
  the gear readout in the tach, the shift lamp over the tach and a warning lamp (blinking when
  blown). The tach ends 1,000 to 2,000 rpm past the redline; the blow rpm is never drawn. The
  steering wheel sits low enough that the cluster shows over its rim, and the cockpit camera
  looks a little further down. The HUD cluster (`ui/cluster.js`) is only for the outside views.
- Ace Combat and Japanese arcade styled menus:
  `mainMenuScreen` (tactical wireframe, telemetry card, audio chirps),
  `settingsScreen` (Auto vs Manual transmission toggle, Render Height target lines [240, 360, 480, 600, 720, 1080], default 480 since 0.5.0 and applied at boot from the store,
  Master, Engine, Effects, Ambience, Music channels with volume steps and mutes saved to localStorage),
  `controlsScreen` briefing (N R 1..7 manual gear order, Tab tactical map, F refuel & repair, C 5 camera views),
  and updated `pauseScreen`.
- Tactical map overlay (`src/ui/map.js`): Tab opens a full-screen tactical map of the whole world,
  pausing simulation while continuing to render the 3D scene behind a translucent dark veil. Tab or Esc
  closes it. Cached offscreen road network shares `drawRoads` with `src/ui/minimap.js`, displaying road
  classes (expressway, ramp, arterial, rally, mountain), gas stations with brand badges, rally start marker,
  valley zones, north compass, adaptive scale bar, and player vehicle arrow with live heading, model name,
  speed, and gear telemetry. Supports drag/WASD/arrow pan, wheel/+/- zoom, and Home recenter.
- Controls: interact key moved from E to F (`KEYS.interact = ['KeyF']` and `INTERACT_KEY = 'F'`). Shift keys
  unified: shift up (`ShiftLeft`, `ShiftRight`, `KeyE`), shift down (`ControlLeft`, `ControlRight`, `KeyQ`).
- Garage (`src/ui/garage.js`): dynamically handles any count of cars in `CARS` (left/right wrapping,
  responsive card layout), displays drivetrain layout, gear count (`${spec.gears.length}-SPEED`), and live
  transmission mode (`AUTO` / `MANUAL`). Clamps bar values cleanly to 10 segments.
- `__lowbeam.simulate(seconds, input)` runs the drive loop without frames, for checks
  in a hidden tab; `__lowbeam.setState('free')` gives the development free camera.
- Tests: 206 passing for this milestone (`npm test`), including `tests/rally-traffic.test.mjs` for
  the T-junction give-way and the cleared stage, `tests/rally.test.mjs` for the
  Kuro Pass time attack, `tests/pacenotes.test.mjs` for the
  rally pace notes and `tests/race.test.mjs` for the duel
  rules, `tests/devserver.test.mjs` for the dev server's range
  requests, `tests/map.test.mjs` for the tactical map and
  `tests/garage.test.mjs` for the garage card. Pure unit test suites pass cleanly.
  `npm run check` is clean for all project UI, input, and main modules.

Not started: the rally event and everything after it in the build order in
`docs/DESIGN.md`.

## Next steps (in order)

1. **Rival challenge**: flash headlights or pull alongside to start a duel with a rival, a
   `RaceEvent` interface so races, mid-race joins, cops and escapes can plug in.
2. **Rally**: start, countdown, checkpoints, pace notes from curvature, results,
   ghost. Config is `RALLY` in layout.js (start at s = 130 m). The rally should call
   `audio.music.hold('ridge')`, `audio.beep('count')` and `audio.beep('go')`.
3. Tune engine, music and mix levels from listening in a real drive session.

## Verification

The game is verified by looking at it. Start the dev server, open the page in a
browser, and use `window.__lowbeam` (set in `main.js`) to force a state
(`setState('garage')`) and call `shot(name)`, which re-renders the last drawn scene
and writes `tools/shots/<name>.png`. `tools/models.html` does the same for the bare
car models. The first session ran
on a Linux laptop with weak graphics; continue on the gaming desktop for real frame
rates.

## Open work and known issues

- RWD cars spin on gravel at full throttle and full lock (Rampart and Vespera reach
  90 degrees of slide in the bench). Intended character; the keyboard throttle ramp
  exists now (`RAMP` in input.js). Needs a real drive with hands on the keys to judge.
- The Hayate shows a light yaw oscillation in a high-speed step steer. Watch it in play.
- Neither the HUD nor the cockpit has been seen at real frame rates on the gaming
  desktop yet; all checks so far used `__lowbeam.simulate` and canvas captures.
- Hillside streets (the west side, the industrial coast) can reach 20 % where a junction pulls them
  to another street's height; the test allows it for streets only.
- The world build is about 6 s in the browser with the city (layout 0.35 s, ground 2 s, scatter
  0.5 s, meshes); `buildings.js` and `citygen.js` are the next places to make faster.
- The ridge between the loop and the forest valley is left wooded; the city stops at Route 1 in
  the north.
- A 2-lane Bayshore ramp merges into Route 1 as one 7.4 m wide added lane that tapers away; a real
  junction would drop to one lane first. Fine at this scale, revisit with lane markings.
- The Route 18 ramps climb about 17 m to the avenue at up to 6.5 % (since 0.7.2), because the slip
  road holds the carriageway's height through the gore.
- Route 1 has no overhead signs yet (task A5 builds the highway sign gantries).
- `LAKE` and `TOWN` in layout.js are aliases for the first lake and the city rect, kept
  for the map screen until it moves to `world.mapData`; remove them then.
- `Ground.at` scans every pad on each call. Fine with 3 pads; add a grid if pads grow.
- Neon signs draw Japanese text with the system font (Yu Gothic, Meiryo, MS Gothic or
  Noto Sans CJK). A machine without any of them shows boxes.
