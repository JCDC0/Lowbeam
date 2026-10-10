# Changelog

## 0.10.51 (2026-10-09)

The roadblock barrier model (police_barrier).

- `tools/blender/police_barrier.py` and `assets/models/police_barrier.json`: a 2.4 m wide, 1.1 m tall folding
  sawhorse barrier for police roadblocks.
- Two A-frame folding legs with horizontal spreader braces and top hinge blocks, two horizontal boards
  striped red and white with diagonal chevrons on both sides.
- Centered mounting bracket and flashing amber warning lamp on top with an emissive lamp material and a light point.
- Exactly one axis-aligned collider box (2.4 by 0.56 m, y 0 to 1.1 m).
- 174 triangles (budget 300), 5 materials, 1 collider, 1 light; checked in props.html beside the cruiser with 0 problems.

## 0.10.50 (2026-10-09)

The district police station model (police_station).

- `tools/blender/police_station.py` and `assets/models/police_station.json`: a two-storey Japanese district
  police station on a 36 by 28 m lot, facing +z toward the street.
- Main block 22 by 12 m with a 7.4 m roof deck, blue trim bands, a lit entrance canopy with two support columns,
  a koban red globe lamp over the door, the station name sign board (sign:police), and barred ground-floor windows.
- Helipad centered at local x = 0, y = 7.5, z = -6 exactly where helipadOf in heli.js expects it, with a painted
  yellow ring, an H marking, 12 perimeter green lamps, and edge lights.
- East wing carries a roof stairhouse and a steel radio mast up to y = 18 m with communications dishes and a red
  aviation obstruction beacon.
- Forecourt with three marked parking bays for police cars, concrete wheel stops, a floodlight pole, gate posts
  and boundary walls with colliders.
- 798 triangles (budget 4,000), 16 materials, 12 colliders, 10 lights; checked in props.html with 0 problems.

## 0.10.26 (2026-10-10)

The plan for a new soundtrack (`tasks/C8-soundtrack.md`) and the prompts to make it
(`docs/music/flow-prompts.md`). Docs only.

- Twenty-four tracks and two stingers in five moods (a new `pursuit` mood, tier A at heat 1 to 3 and tier
  B at 4 and 5, so a police chase no longer plays the racing mood): ten with vocals, fourteen without.
  Each has a style prompt for the generator, and the vocal ones original lyrics (nine in English and one
  in Japanese).
- The code it needs (the mood, the tiers, the stingers, a vocal toggle, the fallback for a list without
  a pursuit track) is the backend's, in the brief; the files and the manifest follow Jc's tracks.
- Also in the brief: the files' size, the license record (`source`) the shipping checklist needs.

## 0.10.25 (2026-10-10)

The pursuit HUD, corrected: 0.10.23 misread the sketch.

- The bar at the top of the sketch is the reinforcements' timer, not the evade and busted meter. The bar
  is back over the clock (draining over 60 s), and the meter is back along the bottom of the board, as
  it was before 0.10.23. What stays from 0.10.23: the centered icon row that opens and closes, and the
  clock counting whole hundredths.
- `tasks/C7-pursuit-hud-v2.md` is rewritten with the layout top to bottom, so the next change starts
  from it.
- Checked in the game's page at 1280 by 720: the bar over 38:42, five icons, the board with the meter
  at its bottom.

## 0.10.24 (2026-10-10)

The police bays, for B5's dispatch from the stations (`tasks/B5-police-dispatch.md`, part 1).

- `lotBays(pad)` in `src/world/lots.js`: where a police car stands in each bay of a lot, in world space
  (a center, the ground height and the yaw that points its nose at the street). Three for a district
  station (x -11.6, -8.8, -6.0 on the forecourt, from `police_station.py`), five for the HQ (one outside
  each shutter of the motor pool, from `police_hq.py`); none for a garage or a hideout. B5 had said
  x -9, -5.5, -2 for the station; the Blender script's bays are the ones painted on the forecourt.
- A test: every station has its bays, each on its lot, with the nose toward the street, and a car's body
  in each clear of the model's colliders.

## 0.10.23 (2026-10-10)

The pursuit HUD, rearranged after Jc's notes on the sketch (`tasks/C7-pursuit-hud-v2.md`).

- The evade and busted meter is the top of the column, on its own plate (it was along the bottom of the
  board); the clock under it has no bar of its own and the board is the plain panel at the bottom.
- The icons are a centered row that opens and closes: an icon opens and fades in when its kind is seen and
  has units, and when the last unit of a kind is gone it rests at 0 for 0.9 s, fades out and the row
  closes up and re-centers (`iconStep`). This replaces 0.10.22's resting slot (`ZERO_KEEPS_SLOT`).
- The clock read 36:89 for 36.9 s (a float a hair under): it counts whole hundredths now.
- Checked in the game's page at 1280 by 720: the meter over a 38:42 clock and five icons over the board; a
  destroyed Rhino glitching, resting at 0, fading, the row closing to four icons. One test more; 482.

## 0.10.22 (2026-10-10)

The pursuit HUD after Jc's second sketch (`tasks/C7-pursuit-hud-v2.md`).

- The unit icons are hidden until a unit of their kind has been in the player's sight, then fade in over
  0.7 s; they sit over their counts, in the Japanese face at 26 px; at 0 they rest dimmed showing 0.
- Counts are plain numbers: the DESTROYED tally read 00 and 01 and now reads 0 and 1.
- A destroyed unit's icon glitches for 0.75 s (a sliced clip, a red and cyan split, a flicker) and the
  DESTROYED number bumps; a unit that merely went home does not (`lostKinds`).
- A resupply header over the row: a bar draining over 60 s, the clock as 60:00 (seconds and hundredths) and
  REINFORCEMENTS ARRIVING, replacing the amber line inside the panel. It shows from `view.resupply`.
- `view.seen` and `view.resupply` are B5's to add; without them an icon counts as seen while its kind
  has units and there is no clock. Four tests; 481 in all.
- Looked at in the game's page with scripted views at 1280 by 720: the empty row, five icons with a
  38:42 clock, a destroyed Rhino resting at 0, a destroyed unmarked car mid-glitch.

## 0.10.21 (2026-10-10)

Review of Gemini's 0.9.31 (rain sound), 0.9.32 (the barrier fixes) and 0.9.33 (traffic and police in rain,
B3 part 3): all three pass; the review is in `tasks/B3-wet-weather.md`. Docs only.

- Driven in the game: a hard hit leaves a roadblock barrier knocked and flat with its yaw unchanged; a
  storm runs the drive loop with the audio context running and no console errors; the rain bed sits at
  gain 0.16 in a storm and fades over a few seconds after it clears, 13 dB under the engine at idle.
- One loose end for 0.9.34 (the start of B4): a barrier the sim has faded out can stay drawn until the
  roadblock comes down. One brittle spot: `unitSees` writes the fog's 230 and 420 into the notice scale (`FOG_STORM.far` and `FOG_DRY.far` exist).
- B4 is next (0.9.34), then B5; part 4 of B3 waits behind them.

## 0.10.20 (2026-10-10)

The stakeout spots for B5 (C6 step 1, second part).

- `src/world/stakeouts.js`: eighteen spots where an unmarked car can wait, pure data with `placeStakeouts(ground)`
  adding the height; `world.stakeouts` carries them to the drive. Each has an id, a kind, a name, a position,
  a yaw turned toward the road and the ids of the roads it watches (`lane.road.id`). Eight lay-bys on Route 18,
  Harbor, West and East Ave and the Higashi and Kita coast roads, four shoulders behind Route 1's rail, three
  corners by the toll plazas, two side street mouths on the Naikan ring and the foot of Kuro Pass.
- `tools/stakeoutsearch.mjs` finds them from a hint and a radius each: on land, level with the road it
  watches (never beside a deck), the car's footprint off every lane and every static shape, 80 m from every
  police station, 250 m from each other, and a clear line to at least four of the six stretches of road it can
  see (`clearLine`, as the police see). Coin car parks are left out: their bays are full of colliders.
- Tests in `tests/island/stakeouts.test.mjs` (the places group): the counts and kinds, the heights, on land
  and level, the spacing, a car's footprint clear of lanes, pads and shapes, and the view of the road; checked
  to fail by moving a spot onto Route 18.
- Looked at in the game with an unmarked car parked at three of them: on Route 18's verge, behind the rail on
  Route 1 and at the curb of a city side street. Seen: a parked car glows (its brake lights, `stepParked` sets
  `brake = 1`, and its headlamp flares), which would give a hidden car away; the backend's part 3 sets a
  `stakeout` flag and `brake = 0`, and `traffic/render.js` (Claude's) will skip the lamps for it
  (`tasks/B5-police-dispatch.md`).

## 0.10.19 (2026-10-10)

The RAIN AUDIO row. Settings built the new rain channel's row from `CHANNELS` but named it from `CH_NAMES` in
`ui/menus.js`, which had no entry for it, so the row would have read undefined: it now says RAIN AUDIO (the
backend's 0.9.31 asked for it; I had said the row would come by itself, which was wrong). Seen in Settings at
1280 by 720: the row, its pill and its meter at 85 %, above BACK.

## 0.10.18 (2026-10-10)

The lot search, and a police station in every district (C6 step 1, first part). Jc chose one per
district.

- `tools/lotsearch.mjs`: scans the roads a lot may front (`LOT_ROADS`: the avenues, the coast roads, the
  pass and the city's frame, both sides every 6 m) for a pad that is on land, within 3 m of flat against
  its road, clear of every other road (a street's center line 14 m from the pad, any other road 6 m from
  its edge) and 14 m clear of every other lot and forecourt; `check` runs the rules on the lots already
  in `layout.js`, `police` finds a station for each district with none near, and both print `LOTS`
  lines. The old lots were laid with the streets generated round them, so their final street centers can
  sit closer than 14 m (7 m at Tsurugi Works) and `check` says so; it is the new ones that must keep it.
- `layout.js` exports `DISTRICTS` (the nine, the same objects the street generator took), `LOT_ROADS`
  and `LOT_MARGIN`; `lotDefs` adds Harbor Ave and the city frame (Chuo-dori, Kurogane-dori, the Naikan
  and Sotokan rings), and a closed road's lot rectangle now follows the loop.
- Seven new `police_station` lots: Ginza (Chuo-dori), Shinmachi (Kurogane-dori), Minatomachi (Naikan
  ring), Higashimachi (Sotokan ring), Hamacho (Sotokan ring, which also serves Kurogane Futo, 390 m
  away: nothing fits in the port's grid), Higashi Kogyo (the coast road) and Nishimachi (West Ave). Ten
  stations with the HQ, Kitamachi (Route 18) and Toge; every district has one within 1,100 m of its
  center and eight of nine within 700 m (nothing fits beside Kitamachi's own streets; Route 18's station
  serves it).
- No street moved: a fingerprint of every road point (401 roads, 10,413 points) is the same before and
  after, and the world build is unchanged (about 3 s for the pure stages in `npm run bench`; 10,483
  buildings, 13,345 lights).
- Tests in `tests/island/lots.test.mjs`: ten stations with the HQ first, every district served, no two
  lots of a kind within 250 m, and the lots the search placed keep their margins.

## 0.10.17 (2026-10-10)

Review of Gemini's 0.9.29 (barriers at the roadblocks) and 0.9.30 (wet grip, B3 part 1). Docs only; the
reviews are in `tasks/B3-wet-weather.md` and `tasks/G7-police-station.md`.

- 0.9.30 passes. The dry numbers in `tools/sim.mjs` are unchanged (the guide's table, to the digit). In a
  storm the skidpad grip is 75 % of the dry for all five cars, and 100 to 0 km/h takes 25 to 31 % further
  (the brief asked for about a third; the drag that helps both runs accounts for the rest); half wet is
  about 11 % further. Gravel, dirt and grass do not move.
- 0.9.29 places and draws the barriers well: planned and spawned the way `stepPolice` does on the
  Harbor avenue, two striped sawhorses stand in front of two of the three cruisers, the lamp flashes, the
  gap stays open. Three fixes are owed, all in the backend's files: a parked barrier is heard as an idling
  sedan (`trafficVoices` skips only wrecks); a barrier hit at 25 m/s becomes a `wreck`, which spins away
  upright and never lies down (`flattened` is set only in the `knocked` path); and the barriers count
  against the civilians' target. No test covers a barrier stopping a car or traffic.
- The fixes go in 0.9.32; 0.9.31 stays the rain sound (part 2), and part 3 moves to 0.9.33.

## 0.10.16 (2026-10-09)

Plan: `tasks/B5-police-dispatch.md`, from Jc's list. The police stations dispatch the units from their
bays; when the pursuit runs low there is a one-minute wait with one car left on the player (and an
empty road if it is destroyed) before the nearest station sends more; hidden undercover cars wait at
stakeout spots (Claude places them, in C6) and wake for a speeder; and the street racers get the
player's pursuit, a heat of their own to 5 with the same rosters, roadblocks and up to three
helicopters, ending in an escape, a bust or a wreck. Docs only.

## 0.10.15 (2026-10-09)

Signal poles stay out of the lanes.

- A civilian turning at a corner cut it and drove into the signal pole standing there: 103 of the 118
  clips `tools/clipbench.mjs` measured. `placeSignals` now keeps each pole at least `SIGNAL.clear`
  (1.3 m) from every lane that passes through its crossing (sampled every 1.5 m from 6 m before its
  stop to 48 m after): it steps back from the road in 0.6 m steps, or the signal is left out, and it
  is checked again against the other roads' carriageways. The bench is down to 15 clips in 34,420
  samples, and a test holds that no lane center passes within a meter of a pole (12 samples of slack for
  the tight corners). `tasks/B4-civilian-world-collisions.md` records the rest and the ramp rails.

## 0.10.14 (2026-10-09)

Review of Gemini's 0.10.51, the roadblock barrier model: it passes (the G7 brief records it). The
backend's wiring of it at the roadblocks is the next commit from it.

## 0.10.13 (2026-10-09)

The invisible obstacles on the Kurogane Line; plans for the clipping and for filling the map.

- A car on the Kurogane Line was stopped by something invisible, and could drive on past it only from
  the side. The cause: the traffic signals' poles stand on the avenue's sidewalks under the elevated
  road, and their collider circles had no height, so they blocked at every height, including 12 m up
  on the deck over them. `signalCircles` (`world/signals.js`) gives a pole under a deck a ceiling just
  under the slab, so it stops the traffic below and not the car above. Two tests: a pole under a deck
  stops a street-level car and not a car on the deck, and nothing static stops a car on either lane of
  the Kurogane Line along its whole length. (The piers, lamps and the rest already had their heights;
  the audit of every road's lanes found only the signal poles.)
- `tools/clipbench.mjs` runs the traffic and counts civilians inside static shapes and off the
  carriageway: 118 clips and 10 off-road bodies in 34,420 samples, mostly corner-cutting turns that
  clip a signal pole on the narrow streets (the sim only checks wrecks and units against the world).
- Plans: `tasks/B4-civilian-world-collisions.md` (the backend: turns along curves, solid civilians,
  edges), `tasks/C6-fill-the-map.md` (a police station per district, more hideouts, garages, gas
  stations and buildings), a note in `G6-civilian-cars.md` that a model's size is its collision size.

## 0.10.12 (2026-10-09)

Review of Gemini's 0.10.50; the district stations in the game.

- Kitamachi and Toge stand on `police_station` (G7) instead of the garage model: 36 by 28 m lots,
  the lit canopy and red globe, the station sign, a roof helipad where `helipadOf` expects it. The G7
  brief records the review; the barrier is next.

## 0.10.11 (2026-10-09)

Street lamps glow.

- `world/build-lamp-glow.js`: `LampGlow` puts a soft additive flare on the head of every street lamp
  within 190 m of the camera, up to 720 in one draw call (the same `psxFlare` as the traffic's lamps),
  a sodium orange that goes out by day with the lamps (`look.lamp`) and swells by about 110 % in rain,
  where a lamp wears a halo. `World.update` runs it each frame.
- The wet reflection no longer blows out beside the camera: it fades over the first 14 m and its
  gain is 1.6 (was 2.2).

## 0.10.10 (2026-10-09)

Dawn and dusk are on their own sides of the sky.

- `skyLook` returns the twilight-warmed sky (`zenith`, `mid`, `horizon`) and the same sky without it
  (`zenithCool`, `midCool`, `horizonCool`); the dome shader blends them by the angle to the sun, so at
  dusk the west is orange and the east deep blue, and at dawn the other way round, instead of one
  uniform glow. At noon the two are the same. One test more (446 pass).

## 0.10.9 (2026-10-09)

Every car on the road has a shadow.

- `traffic/render.js`: an instanced flat quad with the soft ellipse (`shadowTexture`, the player's)
  under each civilian, racer and police car within 160 m, up to 64, in one more draw call. Black at 90 %
  by day and 45 % by night (from `uLamp`), so by day the cars sit on the road instead of floating over
  it. The player's own shadow was already there.

## 0.10.8 (2026-10-09)

By day the lamps and shop windows go out.

- `psxBasic({ lit: true })` marks a light that goes out by day: it dims to 12 % with `uLamp`. The
  street lamps' lenses, the shop windows, and the gantry, plaza and gas station lamps use it.
- `skyLook`'s `windows` is now `(lamp - 0.12) / 0.88`: at noon a clear sky's few percent of lamp had
  left brown squares where the night's lit windows are; they are dark now.

## 0.10.7 (2026-10-09)

Review of Gemini's 0.9.69; the Kagero Aristo VIP in the game, which closes G5.

- The VIP passes (the G5 brief records the review) and is in `KIND_MODELS`: all eleven street racers
  of G5 now draw from their Blender bodies. `tests/kind-models.test.mjs` checks its size, materials
  and groups.
- `B3-wet-weather.md` part 2 notes that the rain bed should go quiet under a roof, with the rain
  cover's lookup.

## 0.10.6 (2026-10-09)

The rain no longer falls through bridges, decks and canopies.

- `world/rain-cover.js` (pure) works out the height of the roof over any point: a lifted road (a
  viaduct, the Kurogane Line, an overpass) found from above, the gas stations' canopies and the toll
  plazas' canopies. `CoverGrid` keeps it for the 64 m round the camera in 1 m cells (about 3 ms to
  refill, every 9 m of travel) and closes the slits between two roofs, such as the median between
  the Kurogane Line's carriageways.
- `RainView` takes the grid as a float texture; the vertex shader hides a streak that is below the roof
  of its column, so there is no rain under a bridge or a canopy, and rain still falls on the deck.
- `tests/island/rain-cover.test.mjs` (in the places group): 4 tests. 445 pass.

## 0.10.5 (2026-10-09)

A day and night cycle, and clouds that come with the rain.

- `render/daylight.js` (pure): the hour and the cloud cover become the sky's colors, the fog, the
  hemisphere and key light (the sun by day, the moon by night), the stars, the sun and moon, and how
  bright the lamps and the lit windows are. Settings has a TIME OF DAY row: night (the default), dusk,
  dawn, day or a cycle that runs a day in 24 minutes from dusk; `__lowbeam.time(...)`.
- `render/sky.js` is now `SkyView`: the dome is a shader with banded clouds that drift, a glow round
  the sun, the town's glow on the horizon at night, the stars, and the moon and the sun crossing the
  sky (the moon used to stand still).
- `psx.js`: `uLamp` scales the street lamp, shop and neon pools and the wet reflections, `uWindows` the
  lit windows (a material with an `emissiveMap`); headlight pools and lamp flares keep 30 % by day, so
  a day looks like a day with the lamps out. The player's local light follows the lamps too.
- `world.js`: `setTime`, `startCycle`, `applySky` (hemisphere, key light, fog, background, uniforms)
  and `stepSky`, run each frame while driving.
- The weather brings the cloud (`weatherLook(...).cloud`: wisps when clear, 0.64 in a drizzle, a solid
  sky in rain and a storm): rain greys the sky and the fog, puts the stars and the moon out and dims
  the sun.
- Docs: the final milestone, shipping to GitHub Pages by hand once, not on every commit
  (`docs/DESIGN.md` section 12, the task list); `B3-wet-weather.md` gains part 4, what the hour does to
  the traffic, the racers, the police and the sound; `C5-weather.md` lists what is left of the look.
- `tests/daylight.test.mjs`: 10 tests (the sun's path, noon against midnight, the lamps at dusk,
  clouds, every hour finite and smooth, the weather's cloud, the clock). 441 pass.

## 0.10.4 (2026-10-09)

Review of Gemini's 0.9.67 and 0.9.68; the Vespera Zero and the Kenro Sakura S in the game.

- Both pass (the G5 brief records the review) and are in `KIND_MODELS`, so the racers draw from
  their Blender bodies: ten of the eleven G5 cars. `tests/kind-models.test.mjs` checks their sizes,
  materials and groups.

## 0.10.3 (2026-10-09)

Rain: wet roads, falling streaks and thicker fog, from a new WEATHER row in Settings.

- `render/weather.js` (pure) names four weathers, clear, drizzle, rain and storm, as levels 0, 0.35,
  0.7 and 1, and turns a level into numbers (`weatherLook`): how wet the roads are, the fog's
  distances (420 m dry down to 230 m in a storm), how many rain streaks and how hard they fall.
- `psx.js` materials take `wet` (with `baked`): the surface darkens and every street lamp whose pool
  reaches it throws a bright reflection stretched along the road toward the viewer (`wetStreak`, in
  the pool loop, banded like the pools, stronger in puddles). `build-roads.js` makes the roads, lanes,
  shoulders, sidewalks, zebras and stop lines wet.
- `render/rain.js`: 3,200 one-pixel streaks in a box round the camera, positioned in the vertex
  shader (nothing per streak on the CPU), leaning back with the car's speed. One more draw call (224
  to 225 in the view measured).
- `world.setWeather(level)` and `stepWeather(dt, vel)`; `window.__lowbeam.weather('storm')`; the
  drive starts in the saved weather.
- It is looks only. Grip, sound, traffic and the police are the backend's, briefed in
  `tasks/B3-wet-weather.md`; what is left of the look is in `tasks/C5-weather.md`.
- `tests/weather.test.mjs`: 5 tests. 431 pass (with the backend's two from 0.9.28).

## 0.10.2 (2026-10-08)

Docs only: the guide's current-state heading names 0.10.2 and the task list says the backend's next
version is 0.9.28 (the two helicopter fuel fixes from the B2 review).

## 0.10.1 (2026-10-08)

The test suite builds the island four times instead of thirty: a full run is 17 s, not 48.

- Thirty test files each built their own island (the ground about 2 s, the traffic net 2.6 s, the
  scatter 1 s), one process per file: 190 s of work, 48 s on the clock four files at a time, most of
  it building the same island again. They now take it from `tests/island.mjs` (`island()`,
  `trafficNet()`, `scattered()`, built on first use), live in `tests/island/`, and run in four
  groups, one process each: `island-traffic` (traffic, solid, blinkers, walls, evade; 14 s),
  `island-police` (the police files, roadblocks, the pursuit, rally traffic, refill, knocks; 7 s),
  `island-roads` (layout, route, Kurogane Line, signals; 13 s) and `island-places` (lots, poles,
  scatter, forest, audio env, vending, markings, guide signs, gantries, toll, world; 6 s).
- No test changed beyond its imports and where its island comes from; a few unused imports went
  with it. 424 pass. A moved file still runs alone (`node --test tests/island/signals.test.mjs`).
- The guide's Conventions say how a new test gets the island; Verification has the new times.

## 0.10.0 (2026-10-08)

Review of Gemini's 0.9.26 and 0.9.27, the end of B2.

- Both pass, with the two fixes owed from part 6 (the HUD's units by kind, the pool on a failed
  spawn). Two small fixes owed in `heli.js`: the tank refills only after a break-off, so a
  helicopter that ended one pursuit low breaks off 28 s into the next; and after refueling it keeps
  the station as its home. Recorded in the B2 brief. C3 is done (its part 7 banners came with B2).

## 0.9.99 (2026-10-08)

A second fix owed in B2 part 6, found in the game.

- In a forced heat 1 pursuit REINFORCEMENTS fired after 8 s with two units on the scene: the
  director takes a unit from the pool when it orders backup, and the Drive's `spawnUnit` often finds
  no spot, so the pool drained with no car arriving. Recorded in the B2 brief for the backend,
  with the `byKind` fix, to ship with part 7. The pursuit HUD otherwise shows the new numbers as
  briefed (on scene, assigned, destroyed, the units by kind).

## 0.9.98 (2026-10-08)

The test suite runs four files at a time; review of Gemini's 0.9.23 to 0.9.25.

- `npm test` is now `node --test --test-concurrency=4`. Node ran every test file at once, one
  process per file, and about 30 files each rebuild the whole island, so a full run kept all 16
  threads busy for 40 to 50 s; run after every small edit, that held Jc's machine at 100 % for an
  hour. The guide's Verification section now says to run only the files a change touches while
  working and the full suite once before a commit.
- B2 parts 4 to 6 pass review (the brief records it); one fix owed with part 7: the pursuit HUD's
  units by kind count idle patrols across town.
- Claude's new version range is 0.10.0 to 0.10.49 (0.9.99 is the last of the old one).

## 0.9.97 (2026-10-08)

The vending machines light the pavement; the signals start lit.

- Each vending cluster adds a light (`GLOW` in `vending.js`): a cool white (0.62, 0.7, 0.82) 1.1 m in
  front of the machines at 1 m, reaching 5.5 m, so the pavement glows as it does in front of a real
  one. It is dimmer than a street lamp, so in a light cell that is already full (12 lights, the pools
  keep the strongest) it gives way. The island has about 13,350 lights now.
- `SignalView` sets every lamp at build (`setLamps(0)`): until the first frame's update the lamps
  were black, which showed in shots taken with no frame running. `update` is now `setLamps` and
  `placeFlares`.
- `tests/vending.test.mjs`: every glow has machines behind it. 412 pass.

## 0.9.96 (2026-10-08)

Blue direction signs (案内標識) before the avenue crossings.

- `src/world/guide-signs.js` (pure): at the 15 crossings where two avenues meet (and that have three
  or more ways out), each avenue way in gets a cantilever sign 22 to 58 m before the crossing,
  wherever no side street lies between the sign and the crossing (else the arrows would point at the
  wrong junction) and the pole stands on the sidewalk. Each way out is an arrow at its real angle,
  labeled with the place its road reaches: the zone outside the town or the district 600 m on, then
  1.2 km on, then at its end, then the road's own name, so no place shows twice on one sign
  (straight on chooses first). 17 signs.
- `src/world/build-guide-signs.js`: the pole, its arm and braces and the panel, all panels on one
  canvas (white arrows and text on blue, the stem from the bottom), one mesh for the island.
- `AREA_JP` gains the nine districts' Japanese names (銀座町, 新町, 港町, 北町, 東町, 浜町, 東工業,
  黒鉄埠頭, 西町), which the signs use and the area name now shows under a district's streets.
- `tests/guide-signs.test.mjs`: every sign names each way once, in Japanese too, with a way straight
  on; it hangs over its own lanes and the first junction ahead is its avenue crossing, 20 to 80 m on.
  411 pass.

## 0.9.95 (2026-10-08)

Utility poles and overhead wires on the back streets.

- `src/world/poles.js` (pure): along every residential, port and industrial street with a sidewalk
  (downtown and midtown run their wires underground), concrete poles every 30 m on one side at the
  sidewalk's outer edge, shifted up to 6 m to keep 1.8 m from a lamp post, never in a junction or on
  another road; a span joins two poles less than 48 m apart, so the wires carry on across the
  junctions. 3,087 poles and 2,434 spans; each pole a solid circle. They are placed before the
  vending machines, which now step aside from them (970 machines).
- `src/world/build-poles.js`: a tapered pole, a crossarm with three insulators, a telephone bracket
  and on 18 % of them a transformer drum, baked and merged in 700 m chunks; three power lines at
  10.45 m and two telephone lines at 6.6 and 6.2 m, each a six-piece sag (1.8 % of the span) drawn
  with `psxLine`, new in `psx.js`: one-pixel fogged lines, since a wire as triangles flickers away at
  the low line count. The wires are a shade lighter than the night sky (black ones vanish against
  it). A residential view gains 4 draw calls and 17k triangles.
- `tests/poles.test.mjs`: poles and spans exist and spans are short, every pole stands on a
  sidewalk out of the carriageway, the junctions and the lamp posts, and is solid; no vending
  machine stands on one. 409 pass.

## 0.9.94 (2026-10-08)

Vending machines on the town's sidewalks; the Kurogane Line's downtown ramps planned (C4).

- `src/world/vending.js` (pure): along every town street with a sidewalk, a cluster of one to three
  machines every 70 to 150 m in the residential streets, 110 to 220 m in midtown and 160 to 300 m
  downtown, on a random side, at the sidewalk's outer edge with their fronts to the road. A cluster
  is dropped if any machine would stand within 1.2 m of a lamp post, near a junction, by a forecourt
  or on another road. 1,010 machines, placed in about 100 ms; each a box collider.
- `src/world/build-vending.js`: a cabinet and a lit front (unlit material, so it glows) in four
  designs drawn on one canvas, every machine in one mesh: 2 draw calls and 12k triangles for the
  island (chunked, they cost 8 calls downtown).
- `tests/vending.test.mjs`: every design is used, every machine is solid, on its sidewalk facing the
  road, out of the carriageway and the junctions. 406 pass.
- `docs/agents/tasks/C4-kurogane-ramps.md`: the plan for the Kurogane Line's ramps down to
  downtown, with what a slip road off a deck needs in the roads, the scatter, the bridges, the
  streets and the traffic links.

## 0.9.93 (2026-10-08)

Zebra crossings and stop lines at the town's junctions.

- `src/world/markings.js` (pure): at every junction, each arm with a sidewalk gets a zebra crossing
  (bars 0.45 m with 0.45 m spaces, running with the traffic, 3.2 m deep) 0.6 m past the edge of the
  road it crosses, and a stop line 0.4 m behind it across the lanes coming in (on their left, traffic
  keeps left). The traffic stops 3.5 m past the crossed road's edge plus its 2.2 m gap, so the line
  is about a meter ahead of the waiting bumpers. Paint that would fall inside a neighboring junction
  is left out. 4,094 zebras and 4,065 stop lines at 1,153 junctions, placed in 44 ms.
- `build-roads.js` draws them as one mesh (a repeating bar texture with an alpha test, and plain
  white), just over the junction patch.
- `tests/markings.test.mjs`: the junctions are painted, every mark lies on a road and outside the
  middle of its crossing, the stop line covers the incoming lanes and stays ahead of the stopped
  traffic. 404 pass.

## 0.9.92 (2026-10-08)

The traffic lights can be seen: a Japanese signal for every way into every lit crossing.

- The traffic net has had lights since 0.4 (`lightState`, a 30.4 s cycle per crossing, the cars stop
  at red), but nothing drew them, so a car waiting at an empty crossing looked stuck and the player
  could not see a red. `src/world/signals.js` (pure) places a signal for each lane direction with a
  stop at a lit crossing: a pole on the far left corner past the crossing (following the lane round a
  ring road's curve), an arm over that direction's lanes, the head at 5.3 m facing the cars it stops.
  Corners that fall in another carriageway get none. 2,996 signals at the 962 crossings, placed in
  22 ms.
- `src/world/build-signals.js`: poles, arms, hangers, the head and its three visors baked and merged
  in 700 m chunks culled with the ground; all the lamps in one mesh whose vertex colors are rewritten
  only for the signals whose phase changed (update ranges); a flare on each lit lamp within 260 m.
  Downtown it adds 5 draw calls and 46k triangles (125 against 120). `main.js` builds it once the
  Drive has its traffic net and steps it on the traffic's clock, so the lamps and the cars agree.
  The poles are solid (`Colliders.addCircles`, new).
- `tests/signals.test.mjs`: nine in ten crossings signed, every head over its own lanes past its
  crossing and facing its traffic, no pole in a carriageway, the lamps match `lightState` and the
  two ways of a crossing are never green together. 401 pass with 0.9.22's.
- The guide's note on steep streets was stale (20 %): measured now, the steepest is 12.6 % over 10 m.
- B2 brief: Claude's wording for the banners of B2's new events (reinforcements, a helicopter leaving
  and coming back) goes in parts 6 and 7, since the banner table is in `drive.js`.
- This entry and the guide's text for the signals went into the tree first and were committed with
  Gemini's 0.9.22 (the same slip as 0.9.21's); the code and the test land here.

## 0.9.91 (2026-10-08)

Route 1's sign gantries, after the Shuto Expressway's.

- `src/world/gantries.js` (pure) finds every exit off Route 1 (twelve: the four avenues each way, the
  Bayshore Line each way, the Kurogane Line twice from the inner loop) and stands a steel gantry
  across the carriageway where the exit lane opens (20 to 120 m before it) and another about 500 m
  before the nose (300 to 650 m, the distance on the sign rounded to 100 m). A spot is skipped in a
  plaza's reach, on a viaduct, where a post would stand on another road or a forecourt, or where the
  ground is more than 8 m below; no two gantries within 140 m on a carriageway. 22 stand: every exit
  has its near one, ten of twelve the far one (the Route 18 exit on the outer loop and the West Ave
  exit on the inner loop have a toll plaza where theirs would go). The posts (outside the rail and on
  the median barrier) are colliders.
- `src/world/build-gantries.js`: the truss (two chords and verticals on square posts down to the
  ground), and on its approach face a green guide sign for the exit (出口 EXIT or JCT in a white box,
  the distance or an arrow down to the exit lane, the place in kanji and romaji, the road it joins in
  a box) over the left lanes and the loop's sign (Route 1's hexagonal shield, 黒鉄高速, 内回り INNER
  LOOP or 外回り OUTER LOOP) over the right ones, with small lamps under each. All 24 signs on one
  canvas; each gantry is its own mesh, culled with the road chunks. The new kanji are added to the
  glyphs fetched before the textures are drawn.
- `tests/gantries.test.mjs`: every exit has its near gantry and most a far one at the right
  distance, junctions are signed JCT, the posts stand clear of other roads and of each other. 392
  pass.

## 0.9.90 (2026-10-08)

The Hoshi Beat and the Kagero RS-Wide race with Gemini's models.

- Gemini's 0.9.65 and 0.9.66 pass. The Beat: an open kei roadster, 0.86 m tall, twin roll hoops,
  louvers over the mid engine and side intakes ahead of the rear wheels. The RS-Wide: riveted bolt-on
  flares taking the body from 1.78 m to 1.95 m, a carbon splitter on stays, a fastback and a GT wing
  on swan necks just over the roof. Both match the G5 table and stay under the 2,600 triangle budget
  (2,190 and 2,448). `KIND_MODELS` gains `rv-roadster` and `rv-wide`; eight of the eleven G5 cars race.
- A slip in 0.9.21: Gemini's 0.9.66 changelog entry, written in the tree before its commit, went in
  with Claude's commit of Hermes' work. The entry is Gemini's own text and its model landed in
  0.9.66, so it stays.

## 0.9.89 (2026-10-08)

The backend seat moves to Gemini.

- Hermes' budget ran out during B2 part 2; Claude reviewed its uncommitted work, found it complete and
  tested (389 pass), and committed it as 0.9.21. Gemini (Antigravity) takes B2 from part 3 (0.9.22 on,
  the backend range) alongside its asset work; the brief and the task board say so.

## 0.9.88 (2026-10-08)

More places: two police stations, two garages, two hideouts (C3 part 6).

- `LOTS` gains six: Kitamachi Police Station on Route 18 north of the city and Toge (Kuro Pass) Police
  Station at the top of the pass, so the west and the middle of the island have a station as the
  north-east has the HQ; Sakura Motors on West Ave by the city and Mori Tuning on Route 18 in the
  north; Kawa Yard on East Ave past the Route 1 overpass and the Mine Shed on the northern ridge.
  Thirteen lots, all on the map and the minimap with their badges. The HQ stays first in the list.
- The district stations stand on the garage model under a police sign until Gemini's district
  station (G7) lands. Hideouts work at once (cooldown fills faster at any hideout lot). B2 part 7
  asks Hermes to send tows, units and helicopters to the nearest station and to let garages repair.
- Each spot came from a search over the outer roads that keeps the lot on land, flat, clear of every
  other road and 14 m clear of every city street, so the street generator lays exactly the same 401
  roads (checked by a fingerprint of every point). One spot beside East Ave's overpass raised the
  terrain into the ramp and moved past it.
- `lotDefs` takes Route 18, East Ave and Kuro Pass as lot roads.

## 0.9.87 (2026-10-08)

Skid marks and tire smoke for every car (C3 part 5).

- `render/skids.js`: one ring buffer of 3,000 road decals in one draw call; each sliding rear tire lays
  a 0.24 m dark strip a piece every 0.35 m, ending the strip when it grips again; a mark fades out over
  40 s and the oldest slot is reused when the buffer is full. Double-sided and offset onto the road so
  it never fights the tarmac.
- `render/skid-rules.js` (pure) decides how hard a car slides: the player's from the physics' slip
  (`skid` 1.6 to 5) or wheelspin, on asphalt and concrete only, never in the air; traffic, racers and
  police knocked aside or wrecked from their sideways speed (1.5 to 6 m/s), and driving cars from the
  grip their turn asks for (speed times yaw rate, 6.5 to 10 m/s2), so a unit turning hard at speed
  marks the road and a lane change does not.
- A slide past 45 % trails pale smoke from the rear wheels (a third pool of 260 puffs in
  `traffic/damage-fx.js`, which now drives the marks for the player and every car within 220 m).
- Tests: the player's rules (grip, slide, burnout, air, gravel) and the traffic's (straight, a lane
  change, a hard turn, knocked sideways or straight, parked). Checked with a full-lock slide at
  110 km/h on Route 1: two curved strips across the lanes and the smoke over them.

## 0.9.86 (2026-10-08)

The Kenro Hardtop races with Gemini's model; reviews of 0.9.20 and 0.9.64.

- Gemini's 0.9.64 passes: the roof is 1.25 m (z +0.25 to -1.0), the C pillar slopes to a short trunk at
  z -1.75 and the glass runs from z +1.35 to -1.75, so from the side it reads as a 70s hardtop, no
  longer a pickup. `KIND_MODELS` gains `rv-hardtop` (`rv_hardtop_full`).
- Hermes' 0.9.20 (B2 part 1) passes: `DAMAGE.k` 0.35 to 0.125 and `CIVIL_WRECK_HIT` 11 to 18 m/s,
  measured (a cruiser takes 14 bumps at 8 m/s, a 15 m/s wall costs it 34 %, a 30 m/s head-on still
  destroys it from every car, a Rhino takes 3.4 times as many rams). The guide's knock threshold
  (still 11 m/s) is brought up to date here; Hermes is asked to update `ARCHITECTURE.md` with each
  behavior change.

## 0.9.85 (2026-10-08)

The HUD fishnet, the speed vignette and blur, with toggles (C3 part 4).

- `ui/screen-fx.js`: three effects, each on by default and saved: `net` puts a fine diagonal mesh
  (two crossing hairline gradients) over the pursuit panel, the banners, the toasts and the prompt
  line; `vignette` darkens the corners by up to 62 % from 120 km/h, full at 260; `blur` smears the
  frame outward from the center (a six-tap zoom blur, at most 4.5 % of the distance to the center)
  from 200 km/h, full at 300. Both ramps are smoothstepped.
- The vignette and the blur are uniforms in the post pass (`stage.setSpeedFx`), so they are dithered
  and quantized with the frame; off the drive screen both are 0.
- Settings: a SCREEN FX row with three pills, NET, VIGNETTE and BLUR, each clicked to toggle, or A and
  D to pick one and Enter to toggle it. The keyboard rows are addressed by their ids now.
- Fixed: the settings screen's key hint bar sat on the screen's bottom edge over the last rows at 720
  lines (a known issue): it flows after the table now, the body scrolls on a short screen and the rows
  tighten under 820 px.
- Fixed: the title still read KIRIGAOKA NIGHT RALLY, the old map's name; it reads KUROGANE NIGHT RUN.
- Tests: the ramps (nothing slow, full fast, smooth, no blur under 200 km/h, off is off) and the
  toggles. Checked at 266 km/h (vignette full, blur 0.73) and in Settings at 720 lines.

## 0.9.84 (2026-10-08)

The pursuit HUD after Jc's sketch (C3 part 3).

- Over the panel, a row of the units on the scene by kind, each with a small side-view icon told
  apart by its roof (the cruiser's red and blue bar, the unmarked car's grille light, the
  interceptor's low bar, the Rhino's tall body) and its count, then the helicopters; a kind with none
  is dimmed. `main.js` counts them from the live units until the Drive's view carries `byKind`.
- In the panel: the heat marks, the bounty and the time on one line; ON SCENE, ASSIGNED and DESTROYED
  (two digits) large; a REINFORCEMENTS line while `reinforcements` is set; the evade and busted meter
  along the bottom. ASSIGNED shows a dash until B2 part 6 gives the director its pool. IN SIGHT is
  gone from the panel (the radar's white rings show it).
- The panel is no taller than before, so it still sits under the prompt line.
- Tests: the layout of the sketch (kinds in order, the dash, the padded count). Checked in a pursuit
  at heat 4 with three kinds on the scene, two helicopters and units destroyed.

## 0.9.83 (2026-10-08)

Most Wanted's radar (C3 part 2), after Jc's reference.

- The minimap is a dark disc with the sea and Kami-ike in blue (the coast polygon and the lakes) and
  the roads in greys (`drawRoads` takes a 'radar' style; the Tab map keeps its bright one).
- The heat: a flame with "x N" (the level) at the top left outside the disc, and an amber arc round
  the rim filling with the heat's progress to the next level (the fraction of `heat.value`), emptying
  as it cools. The five rim marks and the red and blue rim of 0.9.76 are gone. The minimap reads the
  heat through `__lowbeam.getHeat()` so the Drive's call stays as it was.
- Police markers simpler: a car is a small chevron flashing red and blue in a pursuit (units out of
  phase), grey on patrol, amber blinking while it watches; its sight is a cone in its own red or blue
  (a chaser 70 m, a searcher what the director sends) fading to nothing with distance, a patrol's a
  faint 60 m disc; a white ring on a unit that sees the player. A helicopter is a plain disc with a
  short tail (no spinning rotor) and its searchlight a soft glow.
- New icons for every place, on the minimap and the Tab map: round badges with a dark rim and a white
  glyph (a pump in the brand's colour, a star for the police, a wrench for a garage, a house for a
  hideout, a gate for a toll) and a checkered flag for the rally start.
- Checked in a pursuit at heat 3 with the progress at 62 %, a unit seeing the player behind, a patrol
  and a unit off the disc on the rim.

## 0.9.82 (2026-10-08)

Briefs from Jc's test drive.

- `tasks/B2-driving-patch.md` replaces the loose-ends brief for the backend seat (Hermes on Claude
  Haiku 5.5): tougher cars and units, bumped cars that drive on or get out of the way instead of
  standing with hazards, every car solid (no phasing into roadblocks), racers that brake when they
  cannot pass, police that react with a delay and within their grip, the assigned pool and
  reinforcements, helicopters that run out of fuel, the nearest station, louder traffic and exhaust.
  The Hikari and the route timing test move to its "Later".
- `tasks/C3-patch-queue.md`: Claude's half: Most Wanted's radar, the pursuit HUD after Jc's sketch,
  the HUD fishnet, vignette and blur with toggles, skid marks and smoke for every car, more police
  stations, hideouts and garages.
- `tasks/G7-police-station.md`: a district police station with a roof pad, and the roadblock barrier;
  Gemini's next range is 0.10.50 to 0.10.69.

## 0.9.81 (2026-10-08)

Fixed: a car could cross the Kurogane Line's median and fall through the deck where its ramps fork.

- The median barrier loop in `highway.js` built Route 1's and the Bayshore Line's barriers but never
  the Kurogane Line's (0.9.14 left it out). The median, drawn decked over, let a car cross into the
  oncoming carriageway, and at the deck's ends, where the two carriageways stop 10 m apart and the
  ramps fork, it drove off the edge and dropped 6 m to the street (Jc's "middle roads phase
  through"). The line now has its barrier, and a deck that ends in the air gets a nose: the barrier
  run to the very end and 6 m on into the fork.
- Found with a scan of the ground under every raised road and the strips between them; checked by
  driving 80 runs into the medians, forks and ramp ends at both ends of the line (none fall now; the
  east end fell before). A test checks the barrier runs the whole deck with no gap and past both
  ends.

## 0.9.80 (2026-10-08)

The Tsurugi Wedge races with Gemini's model; the Kenro Hardtop goes back; a brief for the backend.

- `KIND_MODELS` gains `rv-wedge` (`rv_wedge_full`) after review of Gemini's 0.9.62: a folded-paper
  wedge with its pop-ups up, the body set back over the rear axle, louvers and a full tail panel.
- Gemini's 0.9.63, the Kenro Hardtop, does not pass yet. The front is right (twin round lamps in a
  dark grille, chrome bumpers, fender mirrors), but the roof is 0.9 m long (z -0.95 to -0.05) and
  the cabin a short box on a deck as high as the hood, so from the side it reads as a pickup. A
  pillarless hardtop wants a longer, lower roof with a C pillar sloping down to a short trunk.
- `tasks/B2-backend-loose-ends.md` for the backend seat (Hermes): the Hikari among the street racers
  with the two lane change tests made robust over seeds, the route planning test made independent of
  the machine's load, and a unit's damage felt in how it drives before it limps.

## 0.9.79 (2026-10-08)

Horns, panic, and a city that refills (C2 part 8 done; the pursuit overhaul is complete).

- `traffic/manners.js` (pure), called by the sim each step: a civilian honks when the player passes
  it on its left (the wrong side, traffic keeps left), cuts in close ahead (it brakes too), crosses
  fast in front of it while it waits at rest (a red run), or knocks it aside (two taps). One honk per
  car per 3 s and one on the street per 0.3 s. Police units and racers never honk.
- In a pursuit (the sim's `heat`), civilians within 45 m of the player or 36 m of a chasing unit
  panic once per 7 s: they brake to 2 m/s for 3.5 s, edge 1.4 m toward the curb (`shy`, held in
  `stepDrive`), screech if they were above 9 m/s, and honk half the time.
- `audio.horn`: each voice class's two notes (`hornOf`; trucks and buses an air horn) as a tap, a long
  lean or two taps, panned and heard to 160 m. `audio.screech`: a narrow band of noise falling in
  pitch, longer from a higher speed. The Drive hands both over from `traffic.takeSounds()`.
- Fixed: the traffic stopped refilling away from Route 1. While fewer than five racers were out the
  sim only tried to spawn a racer, which fails anywhere more than 460 m from the expressway, so the
  city emptied once its first cars had gone (from 0.4.10). A failed racer now falls through to a
  civilian. A test drives 12 s on a street far from Route 1 (0 civilians before, 15 or more now).
- Checked in the game: 29 civilians in the city where there were none; a forced pursuit made the
  sedan ahead stop and edge to the curb, two screeches and a panic honk.
- Tests: the four horn reasons, the wrong side against the right one, the once-per-car limit, units
  never honking, panic near the player and near a unit, the horns by kind, the refill. 374 pass.

## 0.9.78 (2026-10-08)

The cars around the player have engines (C2 part 8, first half).

- `audio/traffic-voices.js` (pure): every kind in a voice class (`VOICE_OF`): kei (a three-cylinder
  buzz to 7,200 rpm), sedan, six (SUVs, pickups, the unmarked car), van, diesel (box truck, tanker,
  semi: low square to 2,300 rpm through eight gears), bus, V8 (the cruiser, the Rhino, the Rampart and
  Halden racers), flat-four (the Hayate and the Lancer-X) and racer. A car's revs come from its speed
  through its gearbox, its note from the revs and the cylinders, the pitch heard from the Doppler
  shift of the closing speed. A bus at 40 km/h is about 80 Hz, a racer at 250 about 250 Hz.
- `audio.js`: four voices, each an oscillator and the octave below through a low-pass that opens with
  the revs, plus band-passed tire noise, panned to the car's side and muffled in the cockpit like
  the rest. Each voice follows one car, so a pass sweeps down in pitch; the noise whoosh stays on top.
  A racer beside the player sits about 6 dB under the mix.
- A unit taken out no longer cuts its siren: it winds down over 1.8 s, the pitch sagging to a growl
  (`dyingSiren`).
- Tests: the voice classes, the revs and the gearbox, the bus against the racer, the Doppler and the
  pan, the nearest four, the dying siren. 365 pass.

## 0.9.77 (2026-10-08)

The Kagero Lancer-X and the Halden Drifter race with Gemini's models.

- `KIND_MODELS` gains `rv-boxer` (`rv_boxer_full`) and `rv-v8drift` (`rv_v8drift_full`) after review
  of Gemini's 0.9.60 and 0.9.61: the Lancer-X a four-door rally sedan with box flares, hood vents and
  scoop and a tall wing on uprights; the Drifter a long-hooded, low four-door with a ducktail and a
  full-width tail band. Checked in the game from behind: painted, the wing and the tail band read.
- Gemini's next pair is the Tsurugi Wedge and the Kenro Hardtop (0.9.62, 0.9.63).

## 0.9.76 (2026-10-08)

A bigger minimap with the heat on it (C2 part 7).

- The minimap grows from 168 to 220 px.
- The heat on the rim, as on Most Wanted's radar: five marks over the top, lit red up to the level
  in a pursuit, dimmer for the heat the police still hold after one, grey above it.
- In a pursuit the rim is red on the left and blue on the right, as the light bars; it holds and
  does not flash.
- Searching units draw their 60 m sight cone ahead of them in amber; a unit that sees the player
  wears a white ring (a pursuing unit too now, not only a watching patrol). The helicopters keep
  their searchlight circles.
- `Minimap.draw` takes the heat (`{ level, pursuit }`) from the Drive.

## 0.9.75 (2026-10-08)

The Hoshi Kei-S and the Kagero Hot-GT race with Gemini's models.

- `KIND_MODELS` gains `rv-kei` (`rv_kei_full`) and `rv-hothatch` (`rv_hothatch_full`), reviewed with
  Gemini's fix fd6f6cb (lamps and exhaust tips proud of the body, the hatch's tailgate). Checked in
  the game: both painted per car, lamps lit, at the size they collide with.
- Gemini's next pair is the Kagero Lancer-X and the Halden Drifter (0.9.60, 0.9.61).

## 0.9.74 (2026-10-07)

Banners with flair and the takedown hit (C2 part 6).

- `bannerer` in `ui/menus.js`: a big Michroma line in the middle of the screen that slams in (from
  1.9 times its size in 0.2 s), holds, and folds away; a rule above and below it by tone (police red
  over blue, green, red, amber, cyan) and an optional second line. A new banner replaces the one
  showing; nothing pulses.
- The police events, ESCAPED, BUSTED, ENGINE BLOWN and DUEL are banners now; toasts keep the small
  news (refuels, tolls, cameras) and slide in.
- A unit taken out: COP TAKEN OUT with the bounty and the unit, a white flash (`flasher`, 0.28 s), a
  camera jolt and `audio.takedown()` (the crash, a deep boom and a ring of torn metal).
- Reviewed Gemini's 0.9.58 (Hoshi Kei-S) and 0.9.59 (Kagero Hot-GT): both pass, under the 2,600
  triangle budget for a full car. Not yet in `KIND_MODELS`.
- Checked in the game with a takedown at 100 km/h.

## 0.9.73 (2026-10-07)

The Most Wanted pursuit HUD (C2 part 5).

- `ui/pursuit.js` and its styles rewritten: one panel at the bottom center (470 px, under the prompt
  line, between the minimap and the speedometer), every word and number in Michroma. The heat as five
  marks and the pursuit's time; the bounty in large amber digits, counting up as it grows; the evade
  and busted meter split from the middle, green to the left and red to the right, turning into a
  blue COOLDOWN bar while the police search; the units on the scene, the units in sight, the units
  taken out (the kill count) and a helicopter icon for each one up; at the end a BUSTED or ESCAPED
  card with the fine or the bounty, the meter hidden so the panel stays short.
- Before a pursuit, while a patrol watches, only the detection bar shows: amber, red past two thirds.
- No fades and no pulses. The panel shows only on the drive screen: the garage, the menus and the map
  no longer carry a pursuit HUD over them (the bug Jc saw entering a garage).
- `layoutPursuit` gains `helis`, `nearby`, `destroyed` and `fineText`; the Drive's `pursuitView` adds
  the helicopters up and the units in sight.
- Tests: the new layout fields. Checked in the game at heat 4 (7 on scene, 2 in sight, 2 taken out,
  2 helicopters), in cooldown, busted, and in the garage with a pursuit running. 359 pass.

## 0.9.72 (2026-10-07)

More helicopters (C2 part 4).

- `helisFor(heat)` (`police/units.js`): one helicopter at heat 3, two at 4, three at 5. The orders
  carry `helis`; the Drive keeps a list (`helis`, `heliViews`, `setHelis`) instead of one.
- The first takes off from the HQ's roof as before. The other two are backup with no helipad
  (`Heli` option `sky`): they arrive flying from a point 140 m over the west and east hills and,
  recalled, fly back there and are put away out of sight.
- Each holds its own station on the target (`HELI_SLOTS`): behind and to the right as before, ahead
  on the left, and wide on the right, so their searchlights land on different streets.
- The player is seen if any helicopter's light is on them; the rotor heard is the nearest one's;
  the maps show every helicopter off its pad.
- Tests: the count by heat; a backup helicopter arrives flying, three hold stations over 30 m apart,
  and a recalled one is put away in the sky. Checked in the game: three up at heat 5, two seen with
  their lights crossing on the car. 358 pass.

## 0.9.71 (2026-10-07)

Being noticed, provoking the police, and police chasing racers (C2 part 3).

- The detection bar (`Heat.attention`) drains 1.5 s after no unit sees the player (0.4 a second),
  never below what the speed cameras put on it, so two traps in a row still start a pursuit.
- A near miss provokes at once: passing a unit within 3.8 m at more than 22 m/s relative
  (`NEAR_MISS` in `director.js`; units now carry their velocity). It starts a pursuit like a ram,
  with a `provoked` event.
- The orders carry `detect`: the bar's level and the ids of the units that see the player. A
  watching patrol wears an amber mark over its roof, red once the bar is two-thirds full (a seventh
  flare per car); on the minimap patrols are grey arrows, a watching one blinks amber, pursuing ones
  flash red and blue. The bar itself goes into the new pursuit HUD (part 5).
- Police chase street racers (`TAIL`, `startTails`, `stepTail` in `sim.js`): while no pursuit of the
  player is on, a patrol that sees a racer above 1.25 times the limit within 80 m takes it up 30 %
  of the time, at most one at a time, bar and siren on, driven by the pursuit code with the racer as
  its target, for up to 45 s or until the racer is 380 m ahead or gone. The racer pushes on 15 %
  faster. A pursuit of the player drops it.
- `stepPursuit` takes its target and goals, so the same code chases the player or a racer.
- Tests: `tests/police-detect.test.mjs` (the bar fills and drains, the cameras' share holds, a near
  miss provokes and a slow or wide pass does not, the orders name the watchers, a patrol takes up a
  speeding racer and drops it when it is gone). Checked in the game: the bar fills in 1.5 s passing
  a patrol at 150 km/h and the amber mark shows over it. 356 pass.

## 0.9.70 (2026-10-07)

All four police units drive with Gemini's models (C1 part 7), and G3 passes review.

- `KIND_MODELS` adds the unmarked car (`police_unmarked_full`), the Rhino (`police_rhino_full`) and
  the interceptor (`police_interceptor_full`) to the cruiser and the Mazuma. The bar flares find each
  model's red lens, so the unmarked car flashes from its grille.
- Review of Gemini's 0.9.55 to 0.9.57 in `G3-police-cars.md`: all three pass with both notes from
  the cruiser applied. G3 is done; G5 (the street racers) is Gemini's next task.
- First version in Claude's new range (0.9.70 to 0.9.99).

## 0.9.69 (2026-10-09)

Street racers: Kagero Aristo VIP (`rv_vip`).

- `tools/blender/rv_vip.py`: Late-90s Japanese luxury VIP sedan in the Toyota Aristo JZS161 / Lexus GS300 / Celsior VIP spirit: 4.95 x 1.82 x 1.45 m, wheelbase 2.92 m (axles at z = +1.25 and -1.67 m), wheel radius 0.34 m at x = +-0.78.
- Long luxury sedan architecture: formal long hood, raked windshield with defined A-pillars, long executive roofline with black B-pillar door divider, formal C-pillar sail panels sweeping over the rear axle, and high executive trunk deck lid.
- Front styling: prestigious vertical chrome front grille with hood brow garnish, quad flush projector headlights with chrome backing bezels and white emissive lenses (`lamp`, z in [2.184, 2.198] m > 0), clean bumper face with set-in air intake and flush fog lamps, and front VIP chin spoiler lip to +2.200 m.
- Side styling: protective chrome waist rub strips along doors, slammed VIP side skirts along lower rocker, and deep-dish VIP luxury multi-piece dish rims.
- Rear styling: wide horizontal luxury taillight clusters with center bridge bar and chrome reverse inserts (`tail`, z in [-2.749, -2.735] m < 0), chrome executive trunk license garnish, Japanese license plate 'KG 88-88', and dual large-bore chrome exhaust tips (x = +-0.55) to -2.750 m with dark inner bores.
- 1,438 body triangles (budget <= 2,500), 2,270 full triangles with wheels (budget <= 3,200).
- `assets/models/rv_vip.json` and `assets/models/rv_vip_full.json`. Bounds: body x: [-0.9388, 0.9388], y: [0.1700, 1.4498], z: [-2.7500, 2.2000]; full x: [-0.9388, 0.9388], y: [0.0000, 1.4498], z: [-2.7500, 2.2000]. Checked clean in props.html with 0 problems.

## 0.9.68 (2026-10-08)

Street racers: Kenro Sakura S (`rv_sakura`).

- `tools/blender/rv_sakura.py`: Late-80s Japanese rear-drive coupe in the Silvia S13 / 180SX spirit: 4.45 x 1.70 x 1.32 m, wheelbase 2.53 m (axles at z = +1.17 and -1.36 m), wheel radius 0.31 m at x = +-0.74.
- Three-box notchback coupe architecture: distinct hood, raked windshield, level beltline with flush side glass, protective waist moldings, and crisp C-pillar to flat rear deck.
- Front styling: slim triple-projector headlights with chrome backing bezel and white emissive lenses (`lamp`, z in [2.010, 2.025] m > 0), horizontal grille slot, bumper air intake mouth, integrated fog lamps, and front chin spoiler lip to +2.030 m.
- Rear styling: wide dual-tier rectangular block taillights (`tail`, z in [-2.414, -2.405] m < 0) with chrome reverse inserts, rear deck lid lip spoiler wing, and single large-bore chrome cannon sports exhaust on left side (x = -0.48) to -2.420 m with dark inner bore.
- 1,196 body triangles (budget <= 2,500), 1,900 full triangles with wheels (budget <= 3,200).
- `assets/models/rv_sakura.json` and `assets/models/rv_sakura_full.json`. Bounds: body x: [-0.874, 0.874], y: [0.160, 1.320], z: [-2.420, 2.030]; full x: [-0.874, 0.874], y: [0.000, 1.320], z: [-2.420, 2.030]. Checked clean in props.html with 0 problems.

## 0.9.67 (2026-10-08)

Street racers: Vespera Zero (`rv_hyper`).

- `tools/blender/rv_hyper.py`: Exotic mid-engine hypercar in the Pagani Zonda / Koenigsegg / Vespera GT spirit: 4.65 x 2.04 x 1.13 m, wheelbase 2.70 m (axles at z = +1.55 and -1.15 m), wheel radius 0.34 m at x = +-0.85.
- Cab-forward teardrop canopy: narrow greenhouse (1.04 m wide across roof) over massive 2.04 m rear hips with sculpted mid-engine radiator side scoops.
- Aerodynamic nose: dipped front hood between muscular arched front fenders, carbon chin splitter with vertical endplates, dual corner canards, and slim LED headlights (`lamp`, z in [2.52, 2.58] m > 0).
- Long rear tail: louvered mid-engine cooling deck, twin swan-neck mounted carbon GT wing, full-width continuous red LED tail lamp bar (`tail`, z = -2.035 m < 0), and central twin chrome sports exhaust tips to -2.050 m with dark inner bores.
- Deep aerodynamic rear under-diffuser with 4 vertical fins in `accent`.
- 1,412 body triangles (budget <= 2,500), 2,116 full triangles with wheels (budget <= 3,200).
- `assets/models/rv_hyper.json` and `assets/models/rv_hyper_full.json`. Bounds: body x: [-1.020, 1.020], y: [0.110, 1.130], z: [-2.050, 2.600]; full x: [-1.020, 1.020], y: [0.000, 1.130], z: [-2.050, 2.600]. Checked clean in props.html with 0 problems.

## 0.9.66 (2026-10-08)

Street racers: Kagero RS-Wide (`rv_wide`).

- `tools/blender/rv_wide.py`: Widebody tuner coupe in the Rocket Bunny / Pandem GT coupe spirit: 4.60 x 1.95 x 1.39 m, wheelbase 2.67 m (axles at z = +1.25 and -1.42 m), wheel radius 0.33 m at x = +-0.80.
- Widebody stance: riveted bolt-on flares with visible chrome rivet heads standing out from a 1.78 m body waist to 1.95 m over both axles.
- Deep front carbon splitter on metallic support stays to z = +2.170 m, dual front bumper canards per corner, vented hood cooling extractor.
- Fastback coupe greenhouse with raked windshield and sleek sloping rear fastback glass (z in [-1.520, 0.850] m).
- Rear molded ducktail spoiler lip on deck lid; big GT wing on swan-neck mounts arching above the roof line (top crown height 1.390 m, roof at 1.360 m).
- Finned rear under-diffuser with four vertical aerodynamic fins; quad large-bore chrome exhaust tips to z = -2.430 m.
- Aggressive twin headlights per side (`lamp`, z in [2.144, 2.154] m > 0), twin round taillights (`tail`, z in [-2.420, -2.410] m < 0).
- 1,744 body triangles (budget <= 1,800), 2,448 full triangles with wheels (budget <= 2,600).
- `assets/models/rv_wide.json` and `assets/models/rv_wide_full.json`. Checked clean in props.html with 0 problems.

## 0.9.65 (2026-10-08)

Street racers: Hoshi Beat (`rv_roadster`).

- `tools/blender/rv_roadster.py`: Mid-engine kei roadster in the Honda Beat / Cappuccino spirit: 3.40 x 1.40 x 0.86 m, wheelbase 2.28 m (axles at z = +1.20 and -1.08 m), wheel radius 0.27 m at x = +-0.61.
- Open-top cockpit with low windshield frame and raked glass (z in [0.205, 0.445], y up to 0.845 m), interior tub with two sports bucket seats and steering wheel.
- Twin roll hoops behind seats reaching crown height 0.860 m.
- Mid-engine rear deck with five dark horizontal cooling louver slots behind cockpit (z in [-1.32, -0.68]).
- Sculpted side radiator cooling intakes ahead of rear wheels (z in [-0.82, -0.58]).
- Small round front headlamps (`lamp`, z in [1.734, 1.744] m > 0), slim horizontal tail lamps (`tail`, z in [-1.642, -1.634] m < 0), front chin lip to +1.750 m, rear bumper and chrome sports exhaust tip to -1.650 m.
- 1,486 body triangles (budget <= 1,800), 2,190 full triangles with wheels (budget <= 2,600).
- `assets/models/rv_roadster.json` and `assets/models/rv_roadster_full.json`. Checked clean in props.html with 0 problems.

## 0.9.64 (2026-10-08)

Street racers: Kenro Hardtop rework (`rv_hardtop`).

- `tools/blender/rv_hardtop.py`: Cabin proportions corrected per review: roof length extended to 1.25 m (z from +0.25 to -1.00 m, crown at y = 1.410 m); windshield raked ~33 degrees from base at z = +0.95 (cowl at y ~ 0.93) to roof front at z = +0.25; level belt line at y = 0.95 with one continuous pillarless side glass opening; wide C-pillar sloping down from roof (z = -1.00) to short flat trunk deck (y = 0.98, z from -1.75 to -2.39); hood at y ~ 0.92, giving the car a long low body.
- 1,662 body triangles (budget <= 1,800), 2,366 full triangles with wheels (budget <= 2,600).
- `assets/models/rv_hardtop.json` and `assets/models/rv_hardtop_full.json`. Checked clean in props.html with 0 problems.

## 0.9.63 (2026-10-08)

Street racers: Kenro Hardtop (`rv_hardtop`).

- `tools/blender/rv_hardtop.py`: 70s two-door pillarless hardtop in the Hakosuka KPGC10 / Celica / Laurel spirit. 4.40 x 1.66 x 1.41 m, wheelbase 2.57 m (axles at z = +1.15 and -1.42 m), wheel radius 0.30 m at x = +-0.70.
- Pillarless greenhouse: no B-pillar, one continuous side glass opening from A-pillar to notched fastback C-pillar; long hood (~1.68 m) and short trunk deck.
- Front and rear chrome bumpers standing proud of body; front chin spoiler under bumper; front/rear bumper overriders.
- Works-style bolt-on over-fenders on all four arches with visible rivet heads.
- Round twin headlights per side in a dark grille panel (`lamp`, z in [1.950, 1.960] m > 0); round twin taillights per side (`tail`, z in [-2.422, -2.412] m < 0); twin chrome exhaust tips to -2.430 m.
- Deep-dish dark Watanabe-style rims on viewer wheels.
- 1,776 body triangles (budget <= 1,800), 2,480 full triangles with wheels (budget <= 2,600).
- `assets/models/rv_hardtop.json` and `assets/models/rv_hardtop_full.json`. Checked clean in props.html with 0 problems.

## 0.9.62 (2026-10-08)

Street racers: Tsurugi Wedge (`rv_wedge`).

- `tools/blender/rv_wedge.py`: 80s twin-turbo wedge GT in the Countach / Supra A70 / Starion spirit. 4.40 x 1.86 x 1.16 m, wheelbase 2.55 m (axles at z = +1.50 and -1.05 m), wheel radius 0.32 m at x = +-0.79.
- Folded-paper body with flat panels and sharp creases; long low wedge nose rising in a straight line to a steeply raked windshield; pushed-back cabin stance over short rear axle.
- Pop-up headlamps shown UP with forward-facing emissive lenses (`lamp`, z in [1.935, 1.945] m > 0); slim dark intake slot in nose under headlamps; front chin splitter.
- Flat rear deck with integrated lip spoiler; slatted rear window louvers; full-width tail lamp band (`tail`, z in [-1.939, -1.929] m < 0); twin chrome exhaust tips to -1.950 m with dark bores.
- Strong beltline crease and angular NACA-style side intakes ahead of rear wheels.
- 1,426 body triangles (budget <= 1,800), 2,130 full triangles with wheels (budget <= 2,600).
- `assets/models/rv_wedge.json` and `assets/models/rv_wedge_full.json`. Checked clean in props.html with 0 problems.
- Add `tools/blender/__pycache__/` to `.gitignore`.

## 0.9.61 (2026-10-08)

Street racers: Halden Drifter (`rv_v8drift`).

- `tools/blender/rv_v8drift.py`: Big V8 four-door sedan built for drifting in the Mark II / Chaser or Commodore spirit. 4.78 x 1.92 x 1.39 m, wheelbase 2.72 m (axles at z = +1.30 and -1.42 m), wheel radius 0.34 m at x = +-0.80.
- Long hood (a third of total length, ~1.56 m long) with induction power bulge; set-back low greenhouse with raked glass, visible B/C pillars, door cut lines; short rear deck with integrated ducktail spoiler lip.
- Wide, low stance with muscular fender flares (1.9200 m wide), deep front drift chin lip, sports side skirts, and gunmetal drift wheels.
- Emissive headlights (`lamp`, z in [2.228, 2.240] m > 0), full-width continuous tail lamp band (`tail`, z in [-2.521, -2.511] m < 0) across tail, both proud of hull; quad chrome exhaust tips (two per side) to -2.530 m with dark bores.
- 1,634 body triangles (budget <= 1,800), 2,338 full triangles with wheels (budget <= 2,600).
- `assets/models/rv_v8drift.json` and `assets/models/rv_v8drift_full.json`. Checked clean in props.html with 0 problems.

## 0.9.60 (2026-10-08)

Street racers: Kagero Lancer-X (`rv_boxer`).

- `tools/blender/rv_boxer.py`: 4-door rally sedan in the Evo / Impreza spirit. 4.50 x 1.77 x 1.45 m, wheelbase 2.63 m (axles at z = +1.15 and -1.48 m), wheel radius 0.32 m at x = +-0.76.
- Three-box sedan architecture with distinct hood, 4-door cabin (visible B and C pillars, door cut lines, handles), and trunk deck.
- Hood vents (two dark slots) and hood scoop; tall rear rally wing on two uprights over trunk (blade at y = 1.42 m, 0.44 m clear of trunk lid, wing apex at 1.450 m).
- Front and rear box-flared arches (1.7700 m wide), rally mud flaps behind all four wheels, big front intake with intercooler mesh, front chin splitter, and bumper fog lamps.
- Emissive headlights (`lamp`, z in [2.026, 2.048] m > 0), block taillights (`tail`, z in [-2.437, -2.427] m < 0), both proud of hull; single chrome cannon exhaust to -2.450 m with dark bore.
- 1,732 body triangles (budget <= 1,800), 2,436 full triangles with wheels (budget <= 2,600).
- `assets/models/rv_boxer.json` and `assets/models/rv_boxer_full.json`. Checked clean in props.html with 0 problems.

## 0.9.59 (2026-10-07)

Street racers: Kagero Hot-GT (`rv_hothatch`).

- `tools/blender/rv_hothatch.py`: 90s Japanese 3-door hot hatch (Civic EK9 Type R mould):
  - Proportions: length 4.00 m (z from -2.18 to +1.82), width 1.70 m (x from -0.85 to +0.85, mirrors to +-0.8950 m), height 1.37 m, wheelbase 2.62 m (axles at z = +1.00 m and -1.62 m), wheel radius 0.30 m.
  - Plan view sports hatch silhouette: tapered nose 1.4000 m at bumper, front flared arches 1.6600 m, doors waist 1.5800 m, wide blister rear hips 1.7000 m, tapered tail 1.5500 m, cabin pulled in to 1.2800 m across roof.
  - Aerodynamic roof spoiler wing extending over rear hatch, with wing blade and endplates reaching peak height of exactly 1.3700 m.
  - Front styling: slim rectangular headlights with chrome bezels and white emissive `lamp` lenses (strictly at z = 1.802 m > 0), sports mesh grille, deep lower air dam intake, chin splitter, and front plate.
  - Rear styling: block taillight clusters with emissive red `tail` lenses (strictly at z in [-2.157, -2.148] m < 0) and chrome reverse inserts, rear plate, rear diffuser, and large cannon chrome sports exhaust.
  - Real wheel openings with dark inner wells (`under`), sports side skirts, and 4 wheels for the viewer (`wheel-*`, radius 0.30 m).
- `assets/models/rv_hothatch.json`: body-only model (1,424 triangles, under 1,800 budget; bounds x: [-0.8950, 0.8950], y: [0.1900, 1.3700], z: [-2.1800, 1.8200]), check() clean with 0 problems.
- `assets/models/rv_hothatch_full.json`: full model with wheels (2,128 triangles, under 2,600 budget; bounds x: [-0.8950, 0.8950], y: [0.0000, 1.3700], z: [-2.1800, 1.8200]), check() clean with 0 problems.

## 0.9.58 (2026-10-07)

Street racers: Hoshi Kei-S (`rv_kei`).

- `tools/blender/rv_kei.py`: tiny front-engine Japanese kei sports car (Cappuccino / Beat mould):
  - Proportions: length 3.30 m (z from -1.69 to +1.61), width 1.48 m (x from -0.74 to +0.74, mirrors to +-0.7925 m), height 1.18 m, wheelbase 2.24 m (axles at z = +1.06 m and -1.18 m), wheel radius 0.27 m.
  - Plan view Coke-bottle silhouette: tapered nose 1.1600 m at bumper, front fenders 1.4300 m, doors waist 1.3866 m, wide rear hips 1.4800 m, tapered tail 1.3300 m, cabin pulled in to 1.1200 m across hardtop roof.
  - Front styling: round headlights (chrome bezel with white emissive `lamp` lens at z = 1.606 m > 0), oval grille intake, chin splitter, and front plate.
  - Rear styling: dual round taillights per side (emissive `tail` lenses at z in [-1.677, -1.660] m < 0), rear plate, rear diffuser, and single chrome sports exhaust tip with dark bore.
  - Real wheel openings with dark inner wells (`under`), side mirrors, sports side skirts, and 4 wheels for the viewer (`wheel-*`, radius 0.27 m).
- `assets/models/rv_kei.json`: body-only model (1,514 triangles, under 1,800 budget; bounds x: [-0.7925, 0.7925], y: [0.1750, 1.1796], z: [-1.6900, 1.6100]), check() clean with 0 problems.
- `assets/models/rv_kei_full.json`: full model with wheels (2,218 triangles, under 2,600 budget; bounds x: [-0.7925, 0.7925], y: [0.0000, 1.1796], z: [-1.6900, 1.6100]), check() clean with 0 problems.

## 0.9.57 (2026-10-07)

Police car trial: interceptor supercar (`police_interceptor`).

- `tools/blender/police_interceptor.py`: mid-engine Japanese police supercar interceptor (NSX mould):
  - Supercar proportions: length 4.60 m (z from -2.30 to +2.30), width 2.00 m, height 1.24 m, wheelbase 2.76 m (axles at z = +-1.38 m).
  - Forward fighter-canopy cockpit, mid-engine glass inspection cover, integrated rear wing blade on pedestals, and rear diffuser with quad chrome exhausts.
  - Cruiser two-tone livery: white upper body carried down doors to handle height (0.76 m); black lower body, side skirts, and mid-engine intake scoops.
  - Aerodynamic 1.32 m wide roof light bar with 0.12 m tall lenses (left red `lens-l` 0xff2a2a, right blue `lens-r` 0x2a5aff, both emissive), top strictly at 1.24 m.
  - Wide low-profile sports wheels (radius 0.33 m, width 0.24 m), slender headlights with police star crest, and full-width taillight bar.
- `assets/models/police_interceptor.json`: body-only model (1,702 triangles, under 1,800 budget; bounds x: [-1.0000, 1.0000], y: [0.1700, 1.2400], z: [-2.3000, 2.3000]), check() clean with 0 problems.
- `assets/models/police_interceptor_full.json`: full model with wheels (2,406 triangles, under 2,600 budget; bounds x: [-1.0000, 1.0000], y: [0.0000, 1.2400], z: [-2.3000, 2.3000]), check() clean with 0 problems.

## 0.9.56 (2026-10-07)

Police car trial: Rhino heavy SUV (`police_rhino`).

- `tools/blender/police_rhino.py`: heavy boxy pursuit SUV in Japanese police two-tone (Land Cruiser / Patrol mould):
  - Proportions: length 4.90 m (z from -2.45 to +2.45), width 2.00 m, height 1.90 m, wheelbase 2.94 m (axles at z = +-1.47 m).
  - Heavy steel push bar / bull bar on the nose with rubberized push pads, cross tubes, and headlight protectors.
  - Cruiser two-tone livery: white upper body carried down doors to handle height (~1.08 m); black lower body, lower doors, flared wheel arches, and bumpers.
  - High-visibility roof light bar: 1.32 m wide, 0.12 m tall lenses (left red `lens-l` 0xff2a2a, right blue `lens-r` 0x2a5aff, both emissive), top strictly at 1.90 m.
  - Large SUV all-terrain wheels (radius 0.38 m, width 0.26 m), roof rails, rear step bumper, tow hitch, and vertical tail clusters.
- `assets/models/police_rhino.json`: body-only model (1,568 triangles, under 1,800 budget; bounds x: [-1.0800, 1.0800], y: [0.3000, 1.9000], z: [-2.4500, 2.4500]), check() clean with 0 problems.
- `assets/models/police_rhino_full.json`: full model with wheels (2,272 triangles, under 2,600 budget; bounds x: [-1.0800, 1.0800], y: [0.0000, 1.9000], z: [-2.4500, 2.4500]), check() clean with 0 problems.

## 0.9.55 (2026-10-07)

Police car trial: unmarked fast sedan (`police_unmarked`).

- `tools/blender/police_unmarked.py`: sporty 4-door pursuit sedan in dark metallic paint (`paint` 0x14161c):
  - Proportions: length 4.50 m (z from -2.25 to +2.25), width 1.85 m, height 1.34 m, wheelbase 2.70 m (axles at z = +-1.35 m).
  - Clean unmarked body without roof bar: sports chin splitter, rear lip spoiler, diffuser, dual chrome exhausts.
  - Emergency flasher strobes behind front grille: left red lens (`lens-l` 0xff2a2a, x > 0) and right blue lens (`lens-r` 0x2a5aff, x < 0), both 0.12 m tall and emissive for long-distance visibility.
  - Wheel arches with dark wells (`under`), side mirrors, and 4 wheels for the viewer (`wheel-*`, radius 0.32 m).
- `assets/models/police_unmarked.json`: body-only model (1,524 triangles, under 1,800 budget; bounds x: [-1.0000, 1.0000], y: [0.1900, 1.3394], z: [-2.2500, 2.2500]), check() clean with 0 problems.
- `assets/models/police_unmarked_full.json`: full model with wheels (2,228 triangles, under 2,600 budget; bounds x: [-1.0000, 1.0000], y: [0.0000, 1.3394], z: [-2.2500, 2.2500]), check() clean with 0 problems.

## 0.9.54 (2026-10-07)

Police car trial: Japanese police cruiser sedan (`police_cruiser`).

- `tools/blender/police_cruiser.py`: authentic Japanese patrol car in the Toyota Crown mould:
  - Big 4-door sedan proportions: length 4.70 m (z from -2.35 to +2.35), body width 1.80 m, height 1.45 m (including roof light bar), wheelbase 2.80 m (axles at z = +-1.40).
  - Japanese police two-tone livery: white upper body, hood, trunk, and pillars (`paint` 0xf4f4f2); black lower body, doors, and bumpers (`accent` 0x14161c).
  - Low roof light bar with chrome bracket, central white siren speaker housing, left red lens (`lens-l` 0xff2a2a, x > 0), and right blue lens (`lens-r` 0x2a5aff, x < 0), both emissive, top reaching exactly 1.45 m.
  - Front fascia: chrome grille surround with police sunburst star crest and black mesh, rectangular sedan headlights with chrome bezels, amber corner indicators, bumper rub strips, chin intake, and Japanese license plate.
  - Rear fascia: wide sedan taillights with red lens and white reverse insert, license plate in trunk recess, bumper rub strip, and chrome exhaust tip.
  - Wheel arches with dark inner wells (`under`), side mirrors on front doors, and 4 wheels for the viewer (`wheel-*`, radius 0.32 m).
- `assets/models/police_cruiser.json`: body-only model (1,630 triangles, under 1,800 budget; bounds x: [-0.9800, 0.9800], y: [0.2200, 1.4500], z: [-2.3500, 2.3500]), check() clean with 0 problems.
- `assets/models/police_cruiser_full.json`: full model with wheels (2,334 triangles, under 2,600 budget; bounds x: [-0.9800, 0.9800], y: [0.0000, 1.4500], z: [-2.3500, 2.3500]), check() clean with 0 problems.

## 0.9.53 (2026-10-07)

Mazuma RX-Coupe fix round (`rv_rotary`).

- `tools/blender/rv_rotary.py`: resolved all 3 review findings from 0.9.52:
  - Closed hole in the hood: underside floor clamped to y = 0.20 (preventing intrusion into the dipped hood) and clean non-wrapping topology across bilateral rings.
  - Authentic sports car silhouette in plan view: nose tapered to 1.5004 m at lamps (z = 1.70 m), doors waist pulled in to 1.6192 m (z = 0.00 m), rear hips flaring to 1.7600 m (z = -1.28 m), tail tapered to 1.6054 m at lip (z = -2.25 m), and cabin pulled in to 1.3000 m across the roof.
  - Eliminated the roof slab: continuous curvature profile connects the cowl seamlessly through windshield into roof peak and fastback rear glass without vertical steps or standing panels.
  - Rear lamps: bespoke tail lamp geometry with rear-facing cap normals (-Z) to prevent backface culling in Three.js renderer.
- `assets/models/rv_rotary.json`: body-only model (1,914 triangles, under 2,500 budget; bounds x: [-0.9750, 0.9750], y: [0.1800, 1.2150], z: [-2.2500, 2.0300]), check() clean with 0 problems.
- `assets/models/rv_rotary_full.json`: full car with wheels (2,618 triangles, under 3,200 budget; bounds x: [-0.9750, 0.9750], y: [0.0000, 1.2150], z: [-2.2500, 2.0300]), check() clean with 0 problems.

## 0.9.52 (2026-10-07)

Mazuma RX-Coupe fix round (`rv_rotary`).

- `tools/blender/rv_rotary.py`: reshaped to authentic FD RX-7 proportions addressing all 5 review findings:
  - Tail lamps (two per side, radius 0.06 m) and twin exhaust tips (with dark bores) now face rearward using `cylinder(..., axis='z')`.
  - Dimensions strictly bounded inside the required box: x in [-0.9750, 0.9750] (body width 1.76 m, mirrors to 0.975 m), y in [0.1800, 1.2150] (roof peak 1.215 m <= 1.22 m), z in [-2.2500, 2.0300].
  - Reshaped body: front fenders rise above a dipped hood center, Coke-bottle waist dips into wide rear hips (0.88 m half-width), integrated paint ducktail lip curves from the rear deck, bubble rear window wraps into quarter glass, low rounded nose with oval mouth and tucked chin lip.
- `assets/models/rv_rotary.json`: body-only model (1,895 triangles, well under 2,500 budget; size 1.95 x 1.04 x 4.28 m), verified clean in props viewer.
- `assets/models/rv_rotary_full.json`: full model with wheels (2,599 triangles, well under 3,200 budget; size 1.95 x 1.22 x 4.28 m), verified clean in props viewer.

## 0.9.51 (2026-10-07)

Racer car trial: Mazuma RX-Coupe (`rv_rotary`).

- `tools/blender/rv_rotary.py`: FD RX-7 inspired sports coupe with low sloping nose, raised pop-up headlights, curved waist, bubble rear window, ducktail spoiler, round tail lamps, and viewer wheels.
- `assets/models/rv_rotary.json`: body only model (2,012 triangles, under 2,500 budget), verified clean in props viewer.
- `assets/models/rv_rotary_full.json`: full model with wheels (2,716 triangles, under 3,200 budget), verified clean in props viewer.

## 0.9.50 (2026-10-07)

Pursuit props, first part: spike strip.

- `tools/blender/spike_strip.py`: accordion scissor lattice with 7 diamond bays, hollow metal spikes, yellow and black end caps, and a pull cord.
- `assets/models/spike_strip.json`: 270 triangles, 4.0 x 0.06 x 0.30 m, verified clean in props viewer.

## 0.9.34 (2026-10-10)

Turns that follow a curve, and roadblock barrier cleanup (B4 part 1).

- `src/traffic/net.js`: `buildTurn(q0, q1)` constructs a smooth cubic Bezier arc between incoming and outgoing lane positions and tangents. Traffic in left-hand drive takes a tight arc on left turns and a wide arc across the junction on right turns.
- `src/traffic/sim.js`: `moveTo` builds a turning curve when sharp or with significant heading change or distance (> 2.5 m), advancing the car along `a.curve` at `a.speed * dt` and keeping `a` in `byLane` for both incoming and outgoing lanes until the junction is cleared. Reset upon collision, knock or wreck.
- `src/drive.js`: filters `this.blockBarriers` before stepping `PursuitView.step` so faded or removed barriers are no longer drawn. Uses `FOG_DRY.far` for sight distance scaling.
- `src/police/director.js`: uses `FOG_DRY.far` (420) and `FOG_STORM.far` (230) from `render/weather.js` in `unitSees` instead of hardcoded magic numbers.
- `tests/island/roadblock.test.mjs`: verified a faded roadblock barrier is not drawn by PursuitView.
- `tests/island/traffic-turns.test.mjs`: tests over 18,000 junction turns across every junction of the island (`net.nodes`), verifying cars stay on the carriageway (`edge <= 0.1`) and clear of colliders at 8 and 14 m/s.

## 0.9.33 (2026-10-10)

Traffic and police in rain (B3 part 3).

- `src/police/director.js`: police sight distance scales with fog far distance (`weatherLook(level).fogFar / 420`), dropping chase sight range from 150 m dry to 82.1 m in a storm (230 m fogFar). Patrol notice radius scales to 85 % in a storm (60 m dry to 51 m storm). Searching cone distance and around radius scale by the same notice factor.
- `src/police/heli.js`: helicopter searchlight reaches 70 % as far in a storm (190 m dry to 133 m storm).
- `src/traffic/sim.js`:
  - Civilians drive 12 % slower in a storm (`v0` desired speed scaled by `1 - 0.12 * weather`).
  - IDM following model adjusts in wet weather: minimum gap `s0` and safe time headway `T` increase by 25 %, comfortable braking deceleration `b` drops by 15 %, and earlier brake threshold (-0.9 m/s² in storm vs -1.2 m/s² dry) causes traffic to follow further back and brake earlier.
  - Police and rival grip drops in rain: lateral cornering grip in `stepChase` scales down to 75 % (8 m/s² dry to 6 m/s² in a storm), `curveSpeed` grip drops to 75 %, and knocked slide grip scales down to 75 %.
- `src/drive.js`: passes world weather into `police.update`, `traffic.update`, and `heliWorld.weather`.
- `tests/wet-traffic.test.mjs`: added 6 tests covering police sight distance dry (150 m) vs storm (82.1 m), patrol notice radius dry (60 m) vs storm (51 m), unit losing the player in a storm at 100 m, helicopter searchlight range reaching 70 % in storm, civilian speed reduction by 12 % with earlier braking, and police cornering grip falling to 75 % in a storm.

## 0.9.32 (2026-10-10)

Roadblock barriers lie down, stay silent and stay out of the traffic count.

- `src/traffic/sim.js`:
  - Barriers never become a wreck: any hit (including hard hits > 18 m/s closing) takes the knocked path in `knock`, setting `flattened` to true, dampening slide and yaw rate exponentially (`exp(-dt * 4)` and `exp(-dt * 6)`), and fading out after `WRECK_TIME` (24 s). Barrier wall collisions in `collideWorld` also never convert to wrecks.
  - Civilian spawn target in `TrafficSim.update`: added `countCivilians()` counting only non-rival, non-unit, non-barrier, non-parked agents, so standing roadblocks (parked cruisers and barriers) do not reduce the civilian population around the player.
  - Soft hits under 6 m/s closing keep the barrier parked and upright (`flattened` false), stopping the approaching vehicle.
- `tests/island/roadblock.test.mjs`: added tests verifying that a soft hit stops the car while keeping the barrier parked and upright, a hard 25 m/s hit knocks and flattens the barrier without yaw spin and fades after 24 s, roadblocks and barriers do not count toward civilian spawn targets, and traffic brakes for a barrier across its lane.

## 0.9.31 (2026-10-10)

Rain sound: the bed, the patter, wet tires (B3 part 2).

- `src/audio/rain.js`: pure gain and filter calculations for the rain bed (filtered pink noise opening from 1600 Hz in drizzle to 4200 Hz in a storm), windshield and car patter (rises when the car stops, dies by 20 m/s), roof drumming (replaces the bed under a canopy or bridge deck with an 88 % bed drop), and wet tire hiss.
- `src/audio/audio.js`: added `rain` to `CHANNELS` and settings defaults, wired `viewRain` bus with cockpit lowpass muffling (1600 Hz, gain 0.55 vs 9500 Hz, gain 1.0 exterior) in `setView`, `modeRain` in `setMode`, and real-time automation of rain bed, patter, roof drumming, and wet tire hiss in `update`. Looser skid screech in wet weather (lower gain, longer duration).
- `src/audio/traffic-voices.js`: added `wet` parameter and `tireFilter` shifting up to 2400 Hz for high-frequency wet tire hiss on passing cars; skips roadblock barriers (`a.barrier`) so they do not take a voice slot as an idling engine.
- `src/drive.js`: samples `world.rain.cover` against camera height to detect shelter under roofs, passing weather level and `underRoof` into `audio.update`.
- `tests/rain-audio.test.mjs`: verified zero rain sound when dry, growth with weather level, roof suppression, stopped car patter, traffic voice wet tire hiss and filter shift, barrier voices skipped, and measured rain bed levels sitting safely below engine idle.

## 0.9.30 (2026-10-09)

Wet weather grip: tarmac grip falls with rain (B3 part 1).

- `src/vehicles/surfaces.js`: added `wetGrip` property (0.75 on tarmac: asphalt and concrete; 1.0 on loose
  surfaces: gravel, dirt, grass, sand, rock, water). `surface(name, wet)` scales tarmac grip down to 75 % at
  full storm (`wet = 1`). Added `wetFactor(surf, wet)`.
- `src/vehicles/physics.js`: vehicle state carries `wet: 0` (0 dry to 1 soaked). `stepVehicle` samples surfaces
  using `s.wet`, scaling peak tire grip (`capF`, `capR`), lateral forces, and braking force by the surface wet
  factor. Loose surfaces remain completely unaffected.
- `src/drive.js`: passes road wetness from `weatherLook(world.weather).wet` into `car.state.wet` each frame.
- Dry numbers in `tools/sim.mjs` and existing tests remain strictly identical down to the last decimal digit.
- Braking from 100 km/h on wet asphalt takes ~25 % to 31 % more meters (e.g. Hayate 34.7 m dry vs 43.3 m wet),
  while gravel and dirt braking distances remain unchanged.

## 0.9.29 (2026-10-09)

Put barriers at police roadblocks.

- `src/police/roadblock.js`: `planRoadblock` calculates and returns `barriers` (one or two 2.4 m wide
  sawhorse barriers positioned at the edge of the gap and between units, aligned along the road normal
  axis `nx, nz`, staying inside the carriageway, clearing the gap and parked units with longitudinal
  offset `ds = -2.2` m ahead of the roadblock, deterministic).
- `src/police/pursuit-view.js`: added `police_barrier` to `PURSUIT_MODELS`, created barrier mesh group and
  procedural fallback box, flashing the emissive amber warning lamp at 2 Hz (`0xff9c14` / `0x221100`).
- `src/traffic/kinds.js`: registered `BARRIER_KIND` (`police-barrier`, 2.4 m wide, 0.6 m deep, 1.1 m high,
  mass 600 kg) in `KIND_BY_ID`.
- `src/traffic/sim.js`: `spawnBarrier` creates roadblock barrier obstacles as parked agents.
  `bodyOfAgent` sets `yaw: a.barrier ? a.yaw + Math.PI / 2 : a.yaw` to span contact circles across the road.
  Solid contact uses parked unit rules (immovable below 6 m/s closing speed); hard collisions knock the
  barrier aside, set `flattened: true` to tilt the barrier flat onto the road, and slow down the car.
  `stepKnocked` applies ground friction and spin damping without resuming lane drive. Traffic brakes for
  the barrier as for a parked unit.
- `src/drive.js`: manages `this.blockBarriers`, spawns them with `orders.roadblock`, fades/clears them with
  `orders.clearRoadblock` and `orders.release`, and steps `pursuitView3d`.
- `tests/island/roadblock.test.mjs`: verified barrier count, width, carriageway bounds, gap clearance, unit
  clearance, and deterministic generation (9 passing tests).

## 0.9.28 (2026-10-08)

Helicopter tank refills when parked at home, and pad resets to basePad after refuel.

- `src/police/heli.js`:
  - Tank refills to full (`HELI.fuel`) when the helicopter parks at home (on its base pad or when a backup is put away in the sky), preventing an early break-off during the next pursuit if the previous chase ended low on fuel.
  - After completing a refuel at a police station, `this.pad` resets to `this.basePad` (and sky backups restore their position to `basePad`), allowing HQ helicopters to return to HQ upon pursuit end and preventing sky backups from remaining hidden on station roofs or relaunching from station pads.
- `src/police/director.js`: added doc comment to the exported `unitSpawned()` API.
- Measured before and after:
  - Pursuit after low fuel recall: before, a helicopter ending pursuit with 35 s fuel remaining broke off 20 s into the next pursuit; after, fuel is restored to 115 s upon parking and chases 50 s without break-off.
  - Pad assignment: before, `pad` remained station pad after 40 s refuel; after, `pad` restores to `basePad` upon refuel completion.
- Tests: `tests/heli.test.mjs` (14 pass).

## 0.9.27 (2026-10-08)

Louder traffic, louder horns, exhaust pops per layout, and backup pool spawn fix (B2 part 8).

- `src/audio/audio.js`: `TRAFFIC_LEVEL` doubled from 0.16 to 0.32, `TRAFFIC_TIRE_LEVEL` doubled from 0.1 to 0.2, and `HORN_LEVEL` increased 2.5x from 0.1 to 0.25.
- `src/audio/engine-dsp.js`: exhaust pops synthesized per engine layout (`popStyle`):
  - Cross-plane V8 (`v8`, Rampart 440): a deep resonant low-frequency thump and body.
  - Flat-four boxer (`boxer`, Hayate RS-4): an irregular sputtering crackle and spit with crisp transients.
  - V12 (`v12`, Vespera GT): a razor-sharp whip-like crack with high-frequency snap and rapid decay.
  - Straight-six (`i6`, Tsurugi GT-X, Hikari 300ZR): a punchy mid rasp and bark.
- `src/vehicles/exhaust.js`: exhaust pops triggered on throttle lift at high revs and on every upshift past 85 % of redline (`SHIFT_FLAME_RPM = 0.85`, requiring `shiftTo > shiftFrom`).
- `src/police/director.js` and `src/drive.js`: backup units consume from the assigned pool only when `traffic.spawnUnit` successfully spawns the unit (`director.unitSpawned()`), preventing pool drain and premature reinforcements when no spawn spot is found.
- Measured before and after:
  - Traffic engine level: `TRAFFIC_LEVEL` 0.16 to 0.32; racer beside player RMS 0.026 to 0.040 (+3.8 dB, level with player mix).
  - Horn level: `HORN_LEVEL` 0.1 to 0.25; civilian horn beside player RMS 0.017 to 0.043 (+7.1 dB over player cruising engine).
  - Exhaust pop peaks (`node tools/render-engines.mjs`):
    - Hayate RS-4: peak 0.58 to 0.62, RMS 0.133 to 0.134.
    - Rampart 440: peak 0.55 to 0.62, RMS 0.150 to 0.157 (deep thump).
    - Vespera GT: peak 0.52 to 0.61, RMS 0.143 to 0.144 (sharp crack).
    - Tsurugi GT-X: peak 0.54 to 0.57, RMS 0.144 to 0.144.
    - Hikari 300ZR: peak 0.56 to 0.57, RMS 0.143 to 0.143.
  - Backup pool: failed spawns over 6 s leave `dir.assigned` at 10 instead of draining to 5.
- Tests: `tests/engine.test.mjs`, `tests/exhaust.test.mjs`, `tests/traffic-voices.test.mjs`, `tests/police-director.test.mjs`.

## 0.9.26 (2026-10-08)

Helicopters run out of fuel, police stations with helipads, garages repair, and pursuit byKind fix (B2 part 7).

- `Heli` in `src/police/heli.js`: tracks fuel (115 s total, 100 s pursuit flight). At 15 s left it breaks off with a CHOPPER BREAKING OFF banner (`heliLeaving`) and returns to the nearest police station helipad to refuel for 40 s (`HELI.refuelTime`), returning with a CHOPPER BACK banner (`heliBack`) if target remains active. Searchlights lose line of sight when blocked by building colliders or under decks.
- Police stations and pads: `helipadOf` and `nearestStation` support all three police stations (HQ, Kitamachi, Toge). Busted pursuits tow to the nearest station rather than always HQ.
- Garages: all five landmark garage lots repair engine damage, blown engines, and tires at pump repair prices without offering fuel or nitrous.
- Racer tails: when no player pursuit is active, a patrol unit chasing a street racer can summon one helicopter; player pursuits take priority.
- `pursuitView()` fix in `src/drive.js`: filters `byKind` counts to include only units in the active pursuit (`u.pursuit`), ignoring idle patrols across town.
- Measured before and after:
  - Pursuit HUD byKind: previously counted all island units (including idle patrols across town); now counts only units in this pursuit (`u.pursuit`).
  - Helicopter fuel: 115 s total fuel; breaks off after 100 s chase at 15 s reserve; refuels on pad for 40 s before returning to pursuit.
  - Busted tow destination: player busted near Kitamachi or Kuro Pass tows to KITAMACHI POLICE STATION or KURO PASS POLICE STATION instead of KUROGANE POLICE HQ.
  - Garage repair: damaged car repairs at 5 landmark garages (damage 0.5 repaired for ¥4,000 in 1.5 s).
- Tests: `tests/heli.test.mjs` (fuel runs out and returns, dense block sight loss, nearest station tow), `tests/garage.test.mjs` (five garages verified with repair pricing).

## 0.9.25 (2026-10-08)

The pursuit's numbers, Most Wanted's: assigned pool by heat level, reinforcements on low points, and on-scene unit counts by kind for the HUD (B2 part 6).

- `PoliceDirector` in `src/police/director.js`: maintains an `assigned` pool (10 at heat 1, 20 at 2, 35 at 3, 50 at 4, 60 at 5), incremented as heat climbs. Each unit dispatched via `backup` decrements the pool; destroyed units are permanently removed and never return to the pool.
- Reinforcements: when on-scene active units fall to 2 or fewer while the pool is under 5, the pool gains 25 % of the heat's baseline quota (3 at heat 1, 5 at 2, 9 at 3, 13 at 4, 15 at 5), firing `{ type: 'reinforcements', count }` once per low point until force recovers.
- `pursuitView()` in `src/drive.js`: exports `assigned` and `byKind: { police, 'police-fast', 'police-int', 'police-heavy' }` tallying non-wreck units on scene for the HUD layout.
- `policeEvent` in `src/drive.js`: adds the banner entry for reinforcements: `['REINFORCEMENTS', { sub: '+<count> UNITS ASSIGNED', tone: 'police' }]`.
- Measured before and after:
  - Heat 1 pursuit pool: initial assigned pool 10 (was untracked before); pool decremented to 9 on first unit dispatched, 8 on second unit; pool remains 8 upon unit destruction (no resurrection).
  - Low point reinforcements: pool at 4 with on-scene units <= 2 gained +3 units (+25%), emitting a reinforcements event once (0 repeated events during the low point); recovery to > 2 on-scene units re-armed the low point trigger.
  - HUD view contract: `pursuitView()` supplies non-empty `assigned` and `byKind` counts matching Jc's sketch and `layoutPursuit`.
- Tests: `tests/police-director.test.mjs` (pool falls on backup dispatch, destroyed units do not return, reinforcements fire once per low point), `tests/pursuit-hud.test.mjs` (layoutPursuit formats kinds, assigned, destroyed and reinforcements). 419 tests pass; type check clean.

## 0.9.24 (2026-10-08)

Police that drive like people: reaction delay and smoothing, lateral grip cap with corner braking, obstacle corridor awareness, and progressive damage scaling (B2 part 5).

- `estimatedPlayer` in `src/traffic/sim.js`: records player trajectory history and supplies chasing units with a delayed (delay >= 0.18 s) and low-pass smoothed target estimate (tau ~ 0.4 s per unit by id), preventing instantaneous steering flicks from reaching units unfiltered.
- Grip cap & corner braking in `stepChase` (`src/traffic/sim.js`): caps unit yaw rate at 8 / speed rad/s (8 m/s² lateral grip limit). When the required turn angle exceeds grip, reduces target speed and applies corner braking deceleration so units lift and brake into corners.
- Path obstacle avoidance in `stepChase` (`src/traffic/sim.js`): free chasing units scan up to 90 m ahead in their forward corridor for traffic, wrecks, and parked units, applying Newtonian braking to decelerate and halt with a safe buffer without contact. Units only drive flat out when the corridor is clear (> 70 m) and behind the player; within 30 m of the player they match the player's speed.
- `unitHealthScale` in `src/police/units.js` and aim wobble in `src/traffic/sim.js`: unit top speed scales smoothly from 100 % to 85 % between 50 % and 25 % HP, then smoothly to limp speed (70 %) below 25 % with no step. Below 50 % HP a free chasing unit wobbles slightly on its aim (0.15 rad, 0.6 Hz sine, phase per unit id).
- Measured before and after:
  - Player heading step response: unit steering reaction delay 0.18 s (was 0.00 s instantaneous twitch before); maximum unit yaw rate at 20 m/s 0.400 rad/s (was up to 3.400 rad/s before).
  - Stopped car in chase corridor at 25 m/s: unit decelerates and comes to a complete standstill at 5.8 m clearance behind the stopped vehicle with 0 contacts (was 0 m / violent collision before).
  - Health scale continuity: 1.000 at 50 % HP, 0.850 at 25 % HP, 0.700 at 0 % HP with zero step discontinuity (was discontinuous step directly from 100 % to 70 % at 25 % HP before).
- Tests: `tests/police-driving.test.mjs` (reaction delay >= 0.15 s and grip cap, obstacle stop without contact, continuous non-rising speed curve, aim wobble below 50 % HP). 417 tests pass; type check clean.

## 0.9.23 (2026-10-08)

Racers fast but not blind: street racers brake hard when trapped and overtake cleanly without collisions; player punches through roadblocks above 6 m/s (B2 part 4).

- `collideWithPlayer` in `src/traffic/sim.js`: saved player physical state (`x, z, vx, vz, yawRate`) before the initial infinite-mass parked unit contact; restored upon hits over 6 m/s before testing against actual masses, allowing high-speed rams through roadblocks to preserve player forward momentum and displace the roadblock unit.
- `leader` in `src/traffic/sim.js`: extended rival obstacle lookahead to `Math.max(280, a.speed * 4)` meters (was 90 m). During lane transitions, evaluates leaders across both current lane and source lane (`changeFromLane`) to avoid clipping obstacles in either corridor.
- `stepDrive` in `src/traffic/sim.js`: Newtonian emergency braking deceleration applied when closing on an obstacle ahead (`neededBrake = (closing * closing) / (2 * brakeDist)`), decelerating up to 9 m/s² down to the leader's speed when unable to change lanes.
- `startLaneChange` and `sortLanes` in `src/traffic/sim.js`: records `changeFromLane` and immediately registers transitioning vehicles in the target lane list inside `this.byLane`, preventing cars evaluated later in the same frame from attempting concurrent lane changes into the same slot.
- `changeSafe` and `maybeChange` in `src/traffic/sim.js`: extended rival overtaking lookahead to 220 m (was 140 m); required minimum gap before initiating lateral turns (`minLeadGapToTurn = (a.speed - lead.v) * 0.8 + 2.0`); removed 50 m cap on behind clearance check; enforced time-to-hit safety thresholds (> 2.5 s) for faster approaching vehicles in destination lanes.
- `spawnRival` and `crowded` in `src/traffic/sim.js`: rival spawn clearance increased to 140 m (was 40 m); `crowded` checks sibling lanes for transitioning vehicles.
- Measured before and after:
  - Headless 3 minutes across 6 seeds on Route 1: racer contacts in `collideAgents` above 6 m/s closing 0 after (was 40 before); mean racer speed 203.7 km/h after (was 192.7 km/h before, required > 180 km/h); top speed 287.2 km/h after (was 288.0 km/h before, required > 240 km/h).
  - Player roadblock ram at 20 m/s: player retains positive forward speed (+2.52 m/s forward speed) and displaces parked unit by 0.064 m (was bouncing backwards at -4 m/s with 0.000 m unit movement before).
- Tests: `tests/traffic.test.mjs` (3-minute 6-seed run asserts 0 racer hard hits above 6 m/s closing alongside mean speed > 180 km/h and top speed > 240 km/h), `tests/traffic-solid.test.mjs` (player 20 m/s ram test moves roadblock unit and keeps forward momentum). 413 tests pass; type check clean.

## 0.9.22 (2026-10-08)

Every car is solid: agents resolve overlap by inverse mass without phasing, and traffic avoids or stops 6 m before roadblocks (B2 part 3).

- `collideAgents` in `src/traffic/sim.js`: every agent in every mode (`drive`, `knocked`, `wreck`,
  `parked`) is treated as a physical body. Overlaps are resolved by pushing cars apart along contact
  normals in proportion to inverse mass. Impacts below 3 m/s closing speed nudge without knocking;
  impacts at 3 m/s or higher knock agents into free bodies.
- Parked roadblock units: infinite mass and inertia against impacts up to 6 m/s closing speed,
  staying completely stationary; hits above 6 m/s knock the parked unit and transition it to a
  free body.
- `leader`: indexes wrecks and parked roadblock units across all lanes they overlap. Obstacle
  following calculates an equilibrium stopping gap 6 m before a roadblock.
- Lane changing at obstacles: where an adjacent lane remains open past a roadblock, approaching
  vehicles select the clearest lane and change into it instead of stopping. `changeSafe` prevents
  lane changes into vehicles transitioning or signaling across adjacent lanes.
- Measured before and after:
  - 60 s run overlaps (1800 steps, with roadblock): maximum penetration depth 0.003 m after (was
    1.513 m before, with 19 deep overlap events exceeding 0.3 m); deep overlaps (> 0.3 m) 0 after
    (was 19 before); ending overlaps 0 after (was 1 pair before).
  - Roadblock across two of three lanes: car detects roadblock ahead, moves into the third open lane,
    and passes cleanly with 3.75 m lateral clearance (was phasing through before).
  - Roadblock across all lanes: car smoothly brakes to an equilibrium stop with 6.00 m clearance
    (was stopping inside roadblock units with 0 m clearance before).
  - Parked unit hit at 4 m/s (under 6 m/s): 0 m displacement, stays parked (was phasing through before);
    hit at 10 m/s (above 6 m/s): 0.129 m displacement and knocked into a free body.
  - Moving car hit at 2 m/s (< 3 m/s): pushed apart along contact normal without knock (mode stays
    drive); hit at 5 m/s (>= 3 m/s): knocked.
- Tests: `tests/traffic-solid.test.mjs` (60 s overlap run, 2-lane roadblock pass, 3-lane roadblock stop,
  parked unit hit threshold, 3 m/s knock threshold). 397 tests pass (392 before, plus five); type check
  clean.

## 0.9.21 (2026-10-08)

A bumped car drives on, and a civilian gets out of the way (B2 part 2). Hermes' work, finished and
committed by Claude when Hermes' budget ran out before its commit.

- A knock under the wreck threshold no longer turns the hazards on (`stepKnocked` leaves `signal`
  alone); the slide ends when its sideways speed falls under 0.6 m/s (`KNOCK.slide`, replacing the old
  4 m/s total-speed `rejoin`), and the car takes its lane and drives on. Every knock from 5 to 17 m/s
  is back in `drive` within 1.5 s.
- `AVOID`: a civilian with the player (in its lane, within 25 m behind) or a racer (in its lane)
  closing at 8 m/s or more moves over into a free lane at once, without its signal wait, or with no
  lane free raises its wanted speed to 1.2 times for 4 s; either way it honks a short warning (the
  manners' horn limits, once per car per 3 s). Units and racers do not yield this way.
- Tests: `traffic-knock` (hazards off, back in drive within 1.5 s at four hit speeds) and
  `traffic-evade` (moves over within 3 s with a warning honk; a racer behind makes it move at once;
  boxed in it speeds up, never past 1.2 times; a slow approach changes nothing; the horn limit). 389
  pass.

## 0.9.20 (2026-10-08)

Tougher cars: a cruiser takes 14 bumps at 8 m/s instead of 5, and a civilian hit under 18 m/s is knocked, not wrecked.

- `DAMAGE.k` in `src/police/units.js` from 0.35 to 0.125 (hit points a unit loses per (m/s)^2 of closing speed). Measured in the sim with the Hayate (1290 kg) against a cruiser (100 hit points): a wall hit at 15 m/s costs 33.8 % of its hit points (was 94.5 %); rams at 8 m/s to destroy it 14 (was 5), at 9 m/s 11 (was 4); four bumps at 30 km/h cost 32 % (was 90 %); a 30 m/s head-on destroys it from every car in `CARS` (104 % of its hit points from the Hayate, was 291 %).
- The Rhino: 47 rams at 8 m/s against 14 for a cruiser, 3.4 times (was 17 and 5, also 3.4 times). Hit points are unchanged.
- `CIVIL_WRECK_HIT` in `src/traffic/sim.js` from 11 to 18 m/s closing. The Hayate hitting a sedan: 12, 15 and 17 m/s now knock it (all three wrecked it); 18.5 and 20 m/s wreck it.
- The wall rule (under 35 % at 15 m/s) and two old assertions cannot all hold under the same square law: a wall hit at 70 km/h now costs a cruiser 57 % (was 159 %), so the assertion that a pillar at 70 km/h destroys it is dropped; the ceiling of eight rams at 9 m/s (now 11) is dropped with it. The rams test asks for six or more at 8 m/s, the brief's rule.
- Tests: `police-damage` (the wall rule replaces the pillar line; the rams test at 8 m/s; a head-on for every car; the Rhino about three times a cruiser's rams); `traffic-knock` (a hit at 17 m/s knocks, at 19 m/s wrecks). Three old tests now need harder hits under the new law: `police-units` (the hard hit is 30 m/s, was 25; the soft unit is cleared first, since its impulse lowered the closing speed of the hard one); `traffic-walls` (the unit starts 20 m out, hits at 27 m/s; from 40 m it braked to 23 m/s, which costs 77 % and no longer wrecks it).
- 379 tests pass (376 before, plus three); the type check is clean.

## 0.9.19 (2026-10-07)

Police cars that can be destroyed (C2 part 2).

- Unit kinds have hit points and a bounty (`police/units.js`): cruiser 100 and ¥5,000, unmarked 80
  and ¥8,000, interceptor 120 and ¥12,000, Rhino 260 and ¥20,000. `unitDamage(hit, other, own)`:
  0.35 times the closing speed squared times the unit's share of the crash (a wall counts 1.2),
  nothing under 2 m/s. About five rams at 30 km/h destroy a cruiser; a pillar at 70 does it at once.
- The sim takes hit points on every hit, the player's, other cars' (`collideAgents`) and walls'
  (`collideWorld`), replacing the old wreck threshold of 9 m/s (`hurt`, `destroy`). Below a quarter
  of its hit points a unit limps at 70 % of its top speed. A destroyed unit is a wreck with its bar,
  siren, lamps and hazards off, lost to the pursuit and reported by kind (`takeEvents().destroyed`).
- The director pays each destroyed unit's bounty into the pursuit (`Pursuit.disable(bounty)`),
  counts it as taken out, adds an infraction's worth of heat and raises a `destroyed` event, shown
  for now as a COP TAKEN OUT toast with the bounty (the slam-in banner is part 6). The rap sheet
  keeps a running total of units destroyed.
- `traffic/damage-fx.js`: grey smoke from under the hood below half, black and thicker below a
  quarter, and flames with a column of black smoke on a destroyed unit; two pooled point clouds, one
  draw call each. A hurt unit's paint dulls, a destroyed one is burnt black.
- Version ranges: Claude's 0.9.0 to 0.9.19 is used up; Claude goes on at 0.9.70 to 0.9.99. The
  backend range stays reserved.
- Tests: `tests/police-damage.test.mjs` (damage by speed squared and mass, walls worst; rams wear a
  cruiser down to destroyed, reported by kind; the director pays the kind's bounty). 351 pass.

## 0.9.18 (2026-10-07)

One set of car physics for everybody (C2 part 1).

- A car the player hits is no longer wrecked by any touch. Under 11 m/s closing (about 40 km/h) it
  is `knocked`: a free body on its tires (`stepKnocked`: the sideways slide dies at the tires' grip,
  7.5 m/s2, the driver brakes at 4.5, the spin settles), hazards on, its place on its lane following
  it so the cars behind see it; slow and straight on a lane facing its way, it drives on. A harder
  hit wrecks it, and so does sitting off every lane for 6 s. A unit in a pursuit is still only
  shoved (`knock`).
- Knocked cars and moving wrecks collide with the rest of the traffic by the same mass-and-impulse
  contacts as the player's car (`collideAgents`), so a hit can push one car into the next.
- A wreck slides at the grip of sliding tires (6.8 m/s2 and a light drag) instead of stopping from
  120 km/h in two seconds.
- A duel ends only when the rival is wrecked, not when it is knocked.
- Tests: `tests/traffic-knock.test.mjs` (a tap knocks a car and it drives on within 6 s, a hard hit
  wrecks it, mass counts both ways, a knocked car knocks the next one). Checked in the game: a hatch
  tapped at 15 km/h spins, settles and drives on 1.7 s later. 348 pass.

## 0.9.17 (2026-10-07)

Gemini's models drive in traffic (C1 part 7, the first two).

- `KIND_MODELS` (`traffic/kinds.js`) names a Blender body per kind: the Mazuma RX-Coupe racer
  (`rv_rotary_full`, G2) and the patrol cruiser (`police_cruiser_full`, G3). The world loads them
  with the other models; `TrafficRenderer` takes them and `modelGeometry` (`traffic/bodies.js`)
  turns each into the traffic format: the `paint` material tinted per car, `lamp` faces at the front
  lit as head lamps and `tail` faces as tail lamps, the light bar's lenses dark with the flares set
  on the red lens's own spot. Until a model loads, or for kinds without one, the lofted or boxy
  body stays.
- The C2 plan's pursuit HUD uses Michroma (`FONT.display`), Jc's choice, already bundled.
- Tests: `tests/kind-models.test.mjs` (each named model exists, has the paint, lamp, tail and lens
  materials, and matches its kind's size within 0.35 m). 344 pass.

## 0.9.16 (2026-10-07)

The plan for Jc's pursuit requests: `docs/agents/tasks/C2-pursuit-overhaul.md` (one set of car
physics for every car, destructible police and a kill count, the detection bar, police chasing
racers, more helicopters, a Most Wanted pursuit HUD at the bottom center, banners with flair, a
bigger minimap with the heat on it, the audio expansion). `docs/DESIGN.md` and `ARCHITECTURE.md`
now say what each inspiration governs: Most Wanted (2005) the police and the pursuit, Night-Runners
Prologue the world, the rendering and the driving.

## 0.9.15 (2026-10-07)

Review of Gemini's 0.9.54 police cruiser: passes (`G3-police-cars.md`). Two notes for the other three
cars: taller light bar lenses, and the white livery carried down the doors. The rest of G3 comes
before G5, so the police can be wired in together.

## 0.9.14 (2026-10-07)

The Kurogane Line, a Shuto-style elevated expressway over the city (C1 part 5, the expressway).

- `layout.js` `kuroganeLine()`: a dual carriageway (`c3-f`, `c3-r`, two lanes each way, 80 km/h)
  from Route 1's south side up over the port streets and the outer ring, 12 m above the middle of
  Kurogane-dori across downtown, and back down to Route 1. Its junctions are on the inner
  carriageway, which has its slips on the city side, so no ramp crosses the loop: an exit and an
  entry 550 m apart at each end (`c3-ramp-wx`, `wn`, `ex`, `en`, KUROGANE JCT). The south side was
  the only stretch of the inner carriageway with room for both; Minato Toll moved from x -700 to
  x -160, between the Harbor ramps, to clear the south-west entry.
- Its priority sits just under Kurogane-dori's, so before the lifts it takes the avenue's profile and
  rides exactly 12 m over it. A new lift `floor` (`roads.js`) keeps the deck at 6 m to its ends,
  where the ramps, lifted to 6 m at theirs, meet it with no lip.
- Streets pass under it with no junction (lifted roads never form one) and buildings keep out from
  under it. Over the avenue the deck stands on portal frames, two legs on the sidewalks and a
  crossbeam (`portalOver`, drawn in `build-bridges.js`); elsewhere on round piers. The longest span
  is 68 m. The underside has a faint glow so it reads as a ceiling from the avenue.
- `net.js`: a road end joins a road it touches when their heights match, not when the other is
  unlifted, so the deck's ends link to the lifted ramps (and a road under a deck still does not).
- A reset (R) on a deck, the Kurogane Line or Route 1's viaducts, puts the car back on the deck
  instead of the road below (`placeVehicle` takes a height).
- Tests: `tests/kurogane-line.test.mjs` (the deck 12 m over the avenue, streets under it with no
  junction, routes on and off at both ends both ways); the ramp count is 24; the lamp test checks a
  pole on a deck's median against the deck; the cross-city route test samples city lanes only (the
  seeded player now stands by the south-east junction). 343 pass.

## 0.9.13 (2026-10-07)

Review of Gemini's 0.9.53 fix round: the Mazuma RX-Coupe passes (`G2-racer-car-trial.md`). The
hood is closed, the roof flows into the glass, the nose and tail taper. G3 (the police cars, the
cruiser first) is Gemini's next task; the Mazuma goes into the game with C1 part 7.

## 0.9.12 (2026-10-07)

Nitrous, as Jc asked: more heat, a little engine damage, a real risk of over-revving (C1 part 6).

- `src/vehicles/nitrous.js` (pure): `NITROUS` (8 s a bottle, 45 % of peak torque, from half
  throttle, 2.6 C a second, damage 0.004 a second plus 0.012 near the limiter, ¥6,000 a bottle),
  `stepNitrous` and `refillCost`. The state gains `n2o` (the bottle) and `n2oOn`.
- `physics.js` adds the nitrous torque after the rev limiter's cut, so held through a gear it drives
  the revs past the redline into over-rev (and its own damage). Bench: 0-160 km/h 0.6 to 4.0 s
  quicker; a clean run costs 4 to 6 % damage and 10 C; held in 3rd from 90 km/h, 600 to 1,400 rpm
  past the redline and 11 to 22 % damage a bottle. The dry bars do not move.
- Input: `nitrous` on N and right Shift, L3 on a pad; in the controls list and the briefing.
- Pump: once the tank is full, HOLD F TO FILL NITROUS for the empty part of the bottle.
- HUD: a bottle bar with its symbol beside the main dial in every style (`paintNitrous`, `N2O_BAR`;
  lower on the tall digital screens), glowing while it flows, the symbol blinking when empty. The
  cockpit binnacle gets a thin blue strip at its right edge. A new `nitrous` icon in `paintIcon`.
- A long blue exhaust flame while it flows (`fx.n2o`), a high hiss, a solenoid thunk on and a purge
  off.
- Tests: `tests/nitrous.test.mjs` (5): when it flows, the bottle's length, heat and damage, every car
  quicker, the over-rev when held on the limiter, the refill price. 340 pass.

## 0.9.11 (2026-10-07)

Small, recessed cockpit instruments, from Jc's sketch (C1 part 4, the cockpit).

- The cluster binnacle moved from the dash lip (about a third of a meter from the camera, raised into
  view, a third of the frame) onto the dash top under the windshield, 0.12 m past the lip, at 58 %
  size (`BINNACLE` in `cockpit.js`; `podFrame` takes a scale). Its hood is a short dark tunnel with
  sides and a sill, so the dials sit in a recess. The dash-top boost gauge and the center stack
  shrink to 80 %.
- The steering wheel rises into view: its rim sits just under the binnacle as the camera sees it,
  so the wheel frames the cluster from below. `COCKPIT_VIEW.gauges` is gone.
- Checked in the game for all five cars (analog: two to four small dials; digital: a wide low
  screen). 335 tests pass.

## 0.9.10 (2026-10-07)

The HUD clusters stand upright, from Jc's sketch (C1 part 4, the outside view).

- One upright 300 by 400 canvas for every style (`CLUSTER_W`, `CLUSTER_H`; CSS width 200 to 300 px):
  the main dial at the bottom right (`MAIN`), the small gauges on one arc up its left side and over
  its top (`arcSpot`), the way the classic cluster first placed them. The twin's speedometer stands
  above its tach; the sport's five shift lights follow the tach's rim.
- The warning symbols moved inside the main dial (`dialLamps`: a row across the face, or an arc
  round the hub on the busy racing tach). The classic HUD's CHECK ENGINE, OVERREV, DMG and ENGINE
  OFF words are now symbols like the others'.
- The digital and VFD styles are a new tall display: the rev bar curves from the bottom left up the
  side and over the top, thickening as it climbs; the gear, the warnings and big speed digits sit
  inside the curve, the boost, fuel and temperature bars in its corner.
- Tests: the check-engine symbol lights on the classic HUD instead of the words; the layout stands
  upright with the small gauges clear of each other. 335 pass.

## 0.9.9 (2026-10-07)

The music comes in earlier and new tracks drop in without code (C1 part 3).

- The swell: silent below 30 km/h, full at 75, 60 on the pass (was 50, 140 and 100).
- `assets/music/tracks.json` lists the tracks (id, title, file, mood, loudness, `vocal`, optional
  `enabled: false`); `MusicPlayer` loads it at start through `parseManifest` and `setSoundtrack`,
  and keeps the built-in list when the file is missing or leaves a mood without a track.
- `npm run music` (`tools/music-manifest.mjs`) builds it from the folder: measures each new file's
  loudness with ffmpeg, keeps the moods, titles and flags already set, adds new files as `cruise`
  for Jc to set, drops files that are gone, and warns about a mood with no track.
- Tests: the swell at the new speeds; the manifest names real files and covers every mood; defaults,
  skipped entries and a refused list. 334 pass.

## 0.9.8 (2026-10-07)

Lights and sirens (C1 part 2, and B1 part 3).

- The world shader's moving lights take a color each (`uBeamCol` in `psx.js`). The traffic renderer
  fills them in order: the light bars of the four nearest units (red or blue as they flash, a wide
  light above the roof that reaches the road and the walls), the three nearest blinking
  indicators (a small amber pool), then headlight beams. `addBeamLight` puts the same light on the
  player's car.
- `police/lights.js`: Most Wanted's quad flash, red twice on the car's left, blue twice on its right,
  a phase per car. The bar flares are red and blue, larger, and face the player (they were two red
  dots facing the sky, so they showed at a seventh of their size from the side). A blinking
  indicator's flare grows by a third.
- `audio/siren.js`: the three nearest units with their bars on are heard: wail far, yelp within 70 m,
  hi-lo for a roadblock; Doppler from the closing speed; gain by distance to 380 m; panned. The
  helicopter's rotor by distance with its own Doppler. Three siren voices and the rotor are built in
  `audio.js` and play through the effects channel, muffled in the cockpit.
- A pursuit puts the music in the `intense` mood at once (even on the pass) and holds the swell at
  0.85 through cooldown.
- `tools/render-sirens.mjs` writes a check WAV: a unit closing from 300 m, passing, pulling away, then
  a roadblock. `tests/sirens.test.mjs`: the flash pattern, the patterns' range, Doppler, gain, the
  voice choice and panning, the rotor, the pursuit mood. 332 pass.

## 0.9.7 (2026-10-07)

Other cars hit the world (C1 part 1).

- `TrafficSim.hitWorld`, set by the Drive to `Colliders.probe`: every car off its lane (a wreck, a
  police unit driving free at the player) collides as three circles along its length, is pushed
  out, loses its speed into the wall (a 0.2 bounce, a 0.35 scrape along it) and is spun by a hit
  at the nose or the tail. A unit that hits a wall above 9 m/s is wrecked and lost to the pursuit.
  Lane followers are not tested (their lanes are clear), so the traffic costs nothing more.
- Wrecks keep to the ground under them as they slide.
- `tests/traffic-walls.test.mjs`: a sliding wreck stops at a building's face, an angled hit spins,
  a free unit aimed through a block stops and wrecks, lane followers are untouched. 325 pass.

## 0.9.6 (2026-10-07)

Briefs G5 (the other eleven street racers in Blender, with their fixed dimensions from
`bodies/racers.js`) and G6 (the fourteen traffic kinds remade and seven new ones). The Gemini order
is G2, G3's cruiser, G5 two cars at a time, the rest of G3, G1, G4, G6.

## 0.9.5 (2026-10-07)

The plan after the police rebuild, from Jc's requests: `C1-claude-queue.md` (other cars hit the
world; red and blue light bars that light their surroundings, lit blinkers, sirens; the music in at
30 and full at 75 km/h with a track manifest; the instrument rework; a second-layer city expressway
and greenery; nitrous with heat, damage and over-rev risk; Gemini's models into the game),
`G3-police-cars.md` (four police cars) and `G4-city-greenery.md`. The old Claude rows in the task
list fold into C1.

## 0.9.4 (2026-10-07)

Review of the Mazuma fix round (0.9.52), in the G2 brief: the lamps, the tips and the box are fixed;
a hole in the hood, a rectangular plan view and a slab on the roof go to a second fix round (0.9.53).
The task list also records Jc's instrument rework: vertical HUD gauges with the small dials curving
round the main one and the warning lamps inside it, and small recessed cockpit instruments.

## 0.9.3 (2026-10-07)

The police, rebuilt (task B1 parts 1 and 2, taken by Claude while the backend seat is empty).

- New `src/police/director.js`: `PoliceDirector` runs the whole pursuit and returns orders the Drive
  carries out (spawn, chase or search or patrol, the helicopter, a roadblock, flat tires, money, the
  HUD view). `Drive.stepPolice` only feeds it and obeys. Fixes every bug in the B1 list: the pursuit
  ends and clears after a 6 s report so a second one can start; a toll trap is one event, not a
  state; heat has an attention stage (1.5 s of watching) before level 1; a duel only counts when a
  unit sees it; roadblocks find the player's lane from the traffic network; dodged roadblocks are
  counted when passed; spike strips reach the physics; line of sight is a real line.
- `heat.js`: attention, then heat 1 to 5 (a level per 90 s of pursuit and per infraction), kept
  after an escape and cooling a level per 120 s, wiped by a bust.
- New `src/police/sight.js` and `Colliders.solidAt`: buildings and the hillside block sight.
- `traffic/net.js`: `lanesAt`, `locate` and `route` (Dijkstra over lane links with U-turns).
- `traffic/sim.js`: chasing units route to the player along the lanes, drive free at them when close
  with a clear line (on the ground under them), follow the player with IDM instead of piling in,
  shove from heat 2, search the last known position, park in roadblocks, go home when released;
  police ignore lights; a hit sets a unit's speed from the impact and only a hard one wrecks it.
  Unit kinds have a top speed (`top`, km/h) and chase at the player's pace up to it.
- `roadblock.js`: blocks span the road from its center (they were centered on one lane), the strip
  sits in the gap (an operator precedence bug put it 1.7 m off the lane), the hit test uses the
  strip's length and depth, and tires go flat within 1.5 s.
- `physics.js`: `tireGrip` and `tireTop` in the state scale grip and drag.
- Busted: the fine is taken, the car towed to the police HQ and mended. Escaped: the bounty is paid.
  Lifetime totals under `rapSheet`. The spike strip is drawn from Gemini's model
  (`police/pursuit-view.js`); parked roadblock units flash their bars.
- Tests: `police-director.test.mjs` (eleven whole chases on a fake world), `police-units.test.mjs`
  (routing, chasing by the lanes, the free chase, search, roadblock units, release, hits); the heat
  tests rewritten for the new rules. 321 pass.

## 0.9.2 (2026-10-07)

Review of the asset agent's first two commits, and a kit fix the car needed.

- `tools/blender/kit.py`: `cylinder` takes `axis` ('y' upright as before, 'z' along the car, 'x'
  across), so round lamps and exhaust tips can face backward. Before this, every cylinder stood up.
- G2 review (in the brief): the spike strip (0.9.50) is accepted. The Mazuma (0.9.51) passes the
  process but goes back for a fix round (0.9.52): lamps and tips upright, outside the fixed box
  (4.45 m long, roof 1.256 m), and the shape reads as a generic wedge rather than the FD.
- `tasks/README.md`: `package.json` holds the highest version committed, so a lower-range commit
  leaves it alone.

## 0.9.1 (2026-10-07)

Brief G2 (a street racer as a Blender car), and the prop viewer grows options for it.

- `tools/props.html`: `&budget=` sets the triangle budget per model, `&smooth=38` smooths the normals
  under the game's crease (the exporter writes flat normals) so a car shows as it will in the game,
  `&car=0` hides the reference car.
- New brief `G2-racer-car-trial.md`: the Mazuma RX-Coupe modeled in Blender to the player cars'
  standard, before the rest of G1.

## 0.9.0 (2026-10-07)

A new team and a guide that says what is true now; one set of typefaces everywhere.

- The team: Claude orchestrates and owns rendering, the world and the UI; a backend agent (GPT 6 Sol
  or Hermes on Xiaomi MiMo 2.6 Pro) owns the game logic and tests; Gemini 3.8 Flash builds models in
  Blender. One owner per file, ranges 0.9.0 to 0.9.19, 0.9.20 to 0.9.49, 0.9.50 to 0.9.69
  (`docs/agents/tasks/README.md`). The old briefs moved to `tasks/archive/`.
- `ARCHITECTURE.md` rewritten from about 800 lines to the current state, the conventions, how to
  verify, the Blender workflow and the known issues (the police bugs). New briefs: B1 (police repair,
  backend) and G1 (pursuit props, assets).
- New `tools/props.html`: any exported model at night on a road beside a game car, with collider and
  light markers and a `check()` report, for the asset agent to test in a browser.
- Fonts: the classic cluster and the Tab map used their own stack with an Arial Black fallback, the
  page body Arial Narrow, plates, the coin parking sign and the gas station signs the system sans
  serif or monospace; all now use `FONT` and the `--font-*` variables (`--display` and `--body` are
  gone). The settings help says six speedometer styles.

## 0.8.18 (2026-10-04)

Roadblocks and spike strips (A17 part 4).

- New pure `src/police/roadblock.js`. `planRoadblock` lays two or three units across the player's
  lane 250 to 400 m ahead at heat 4 and up, splitting the road into slots and leaving one slot
  open at an end as the gap to thread; `shouldSetRoadblock` and `tooNearBlock` keep one block at
  a time, set up out of sight of the player. `planSpikes` lays a strip across that gap,
  `hitSpikes` says when the car runs over it, and `spikePenalty` is the flat-tire curve: grip and
  top speed fall over the first seconds and mend after `FLAT_TIME` 22 s (or at a pump).
- `src/drive.js`: the block and strip are planned and tracked in `stepPolice`, and the flat-tire
  timer runs from the frame.
- Tests: new `tests/roadblock.test.mjs`, seven cases covering the placement distance, the heat
  gate, the gap, the one-at-a-time rule, the strip and the tire curve.

## 0.8.17 (2026-10-04)

The police chase (A17 part 3): units leave their lanes, the pursuit is wired in.

- `src/traffic/sim.js`: `stepChase`. A pursuing unit within `CHASE_RANGE` 120 m stops following
  its lane and drives at the player, aiming where the player will be (`CHASE_LEAD` 1.2 s ahead),
  braking for the traffic in its way and steering at `CHASE_STEER`. At heat 4 and up a cruiser
  aims at the player's flank to PIT; a Rhino (`headOn`) drives straight at the player. Units
  carry a `pursuit` flag and `sim.heat` decides how hard they drive.
- `src/drive.js`: the police core is wired into the drive frame as `stepPolice`. It feeds the
  heat what they notice (speeding past a unit, a toll speed trap, a duel in sight), starts the
  pursuit when the heat first reaches a level, sends out the roster for that heat, flags the units
  to chase, scrambles the helicopter at heat 3 and over and recalls it on an escape or a bust,
  and steps the pursuit event. `pursuitView()` and `policeMarkers()` now return the A13 contract:
  every unit plus the helicopter with its searchlight, a searching unit's sight cone, and where
  they last saw the player.
- Verified live at 480 lines: forcing the heat to 4 brought out three cruisers, the unmarked fast
  units and the Rhinos, scrambled the helicopter, and filled the HUD view and the map markers.

## 0.8.16 (2026-10-04)

The pursuit as a RaceEvent (A17 part 2).

- New pure `src/race/pursuit.js`: `Pursuit` extends `RaceEvent`, the same shape as `Duel` and
  `Rally`, so the drive loop does not care it is running. Its states are the A13 `PursuitView`
  ones the HUD already draws: `pursuit`, `evading`, `cooldown`, `busted`, `escaped`.
- Losing them: out of sight the evade bar fills (faster the lower the heat, as Most Wanted lets a
  newcomer slip away); back in sight it drains and the pursuit is on again. A full evade bar starts
  the cooldown, where they search the last known position, which widens with time; the helicopter
  seeing you, or any unit, drops you straight back into pursuit.
- The bust: below about 10 km/h with a unit alongside, the bust bar fills over `BUST_TIME` 3 s;
  pulling away empties it again.
- Infractions, each once per pursuit, each adding bounty: speeding, reckless driving, hit and run
  (a civilian wrecked), ramming a police vehicle, resisting arrest (30 s), driving off road,
  damage to property, and a toll gate run at speed. `bounty` rises with time, heat, each
  infraction and the cost to state. `disable()` and `involve()` track units out and involved.
- `view()` returns exactly the A13 `PursuitView` fields (heat, evade, cooldown, bust, units,
  heli, bounty, time), plus the grown MW fields (`infractions`, `cost`, `disabled`, `involved`,
  `hiding`, `report`), so the HUD built in A13 keeps working.
- Tests: new `tests/pursuit.test.mjs`, fifteen cases over the states, the bars, the infractions and
  the end-of-pursuit report.

## 0.8.15 (2026-10-04)

Police patrols and heat (A17 part 1).

- New pure `src/police/units.js`: the four police unit kinds and the Most Wanted roster that decides
  which are on the road at each heat. `police` (the cruiser, the black and white sedan) from heat 1,
  `police-fast` (an unmarked sports car in dark paint with hidden lights, `hidden`) at 3,
  `police-heavy` (the Rhino SUV, `headOn` because it drives at you from ahead) at 4, and
  `police-int` (a supercar in police paint) at 5. Until Claude's police models land, every unit
  borrows an existing body through its `model` id, so the swap later is one line per kind.
  `buildKindGeometry` now resolves a civilian `model` id too and threads the kind's `accent`
  (the black of the two-tone) into `vehicleGeometry`.
- The units live outside the weighted civilian `KINDS` pool so the traffic weights never pick one
  by accident; `kinds.js` registers them in `ALL_KINDS` so the renderer builds their meshes.
- `src/traffic/render.js`: a police light bar is drawn as two extra roof flares, alternating left
  and right at 2 Hz while the unit is chasing, on the same flare mesh (no new draw call). The flare
  budget is now `FLARES_PER_CAR` 6 rather than 4.
- `src/traffic/sim.js`: `spawnUnit` sends one unit out of the motor pool onto a lane near the
  player, `units()`, `countUnits()` and `unitsNear(player, range)` let the police core and the HUD
  find them. Agents carry a `pursuit` flag the renderer reads.
- New pure `src/police/heat.js`: what the police notice. `noticesSpeeding` (a patrol within 60 m
  sees a car more than 40 km/h over the limit), `noticesTrap` (a toll speed trap above 160 km/h),
  and `Heat`, which rises with what they see and with every second of a pursuit (a full five in
  about a minute) and cools after a quiet spell.
- Tests: new `tests/police-heat.test.mjs`, ten cases covering the unit kinds, the roster, the heat
  model and spawning a unit on the network.

## 0.8.13 (2026-10-04)

The controls settings: key rebinding (A16 part 4, by Antigravity; committed by Claude after its session
was halted, with two JSDoc type fixes).

- `src/core/input.js`: `CONTROL_ACTIONS`, `ACTION_LABELS`, `PAD_LABELS`, `keyLabel(code)` (W, UP, SPACE,
  SHIFT), `rebind(map, action, slot, code)` (swaps a key already in use, refuses Escape and Enter),
  `loadBindings()` and `setBindings(map)` with the bindings saved under `keys`.
- The controls screen (`controlsScreen` in menus.js) is a settings screen: two key slots per action and
  the gamepad button, Enter to listen (PRESS KEY), Esc to cancel, RESET TO DEFAULTS, the old briefing in
  a column beside it. Reached from the main menu, Settings and Pause, and returns to where it came from.
- Tests: `tests/controls.test.mjs`.

## 0.8.12 (2026-10-04)

Typography update across the UI with Orbitron, Teko, Dela Gothic One, Share Tech Mono and M PLUS 1p (A16 part 3).

- `style.css`: added all eight font variables to `:root` (`--font-display`, `--font-tech`, `--font-race`, `--font-mono`, `--font-seg7`, `--font-seg14`, `--font-impact`, `--font-jp`). Replaced direct font usages across UI screens.
- Title screen: LOWBEAM in Orbitron 900 with wide tracking, Japanese subtitle 黒鉄ナイトラン in Dela Gothic One, and footer/prompt in Share Tech Mono.
- Main menu: item labels in Orbitron 700 with small Japanese subtitles in M PLUS 1p (ドライブ, ガレージ, 設定, 操作設定), telemetry numbers in Share Tech Mono.
- Settings and Controls: section headings in Orbitron 700, row labels in Michroma, values and keys in Share Tech Mono, audio segment bar readouts in DSEG14.
- Garage: car name in Orbitron 900 with katakana subtitle in M PLUS 1p (ハヤテ, ランパート, ヴェスペラ, ツルギ, ヒカリ), specifications in Share Tech Mono.
- Drive HUD: area name in Michroma with Japanese subtitle in M PLUS 1p from `AREA_JP` in `src/world/layout.js`, money and rally time/splits in Share Tech Mono, rally countdown and toast numbers in Teko 700, headings in Dela Gothic One.
- Pursuit HUD: state banners (PURSUIT, EVADING, BUSTED, ESCAPED) in Dela Gothic One, heat, bounty and timer in Teko.

## 0.8.11 (2026-10-04)

Speedometer settings and garage style readout (A16 part 2).

- `src/ui/menus.js`: added `SPEEDOMETER` row to Settings screen with options `PER CAR` (default) or lock to any style (`CLASSIC`, `TWIN DIAL`, `SPORT TACH`, `DIGITAL LCD`, `1984 VFD`), saved under `clusterStyle` in local storage.
- `src/ui/garage.js`: garage card displays the selected car's HUD cluster style name (`CLUSTER` row).
- `src/drive.js`: passes the stored `clusterStyle` preference when initializing or updating the HUD gauge cluster.
- `src/main.js`: dynamically updates active drive gauge cluster when settings are adjusted.
- `src/ui/cluster.js`: `Cluster` constructor and `setSpec` support stored `clusterStyle` override.

## 0.8.10 (2026-10-04)

Speedometer styles for the HUD cluster (A16 part 1).

- `src/ui/cluster-styles.js`: `CLUSTER_STYLES` (`classic`, `twin`, `sport`, `digital`, `vfd`) and `drawStyled` providing each car with an arcade HUD speedometer matching its dashboard character:
  - `twin`: Rampart 440 twin white dials with red needles in chrome housing, gear window, shift lamp and fuel/temp bars.
  - `sport`: Vespera GT central yellow tachometer with embedded digital speed readout, shift lights and vertical gauges.
  - `digital`: Tsurugi GT-X modern LCD screen in a bezel with gear and warning lamps.
  - `vfd`: Hikari 300ZR 1984 vacuum fluorescent bar-graph display in green, amber, cyan with phosphor ghosting.
- `src/ui/cluster.js`: reads `spec.dash?.hud ?? 'classic'`, caches dial faces per car, and draws the styled clusters.
- `clusterStyleOf`: pure resolver for spec dash style and manual overrides.
- `warningLamps` and `shiftLightsLit`: pure warning lamp (CHECK, DMG, REV, ENG OFF, HOT) and shift light calculations.
- Tests: `tests/cluster.test.mjs` expanded with tests for `CLUSTER_STYLES`, `clusterStyleOf`, warning lamps, shift lights, and multi-style rendering.

## 0.8.7 (2026-10-04)

Symbols for the warnings, fuel and temperature as gauges, the gear inside the gauges, bigger screens.

- `instruments.js`: `paintIcon` (engine, wrench, overrev, battery, temp, fuel, turbo); the LCD and VFD
  use symbols for their bars and warnings; the tuner face shows a symbol for boost, temp and fuel.
- `cluster-styles.js`: warnings in fixed slots (`lampIcons`), faint when off; `warningLamps` gains
  `icon` and a FUEL lamp; small fuel and temperature gauges on twin, sport and tuner; the gear in the
  Rampart's tach and in the Vespera's speed window; the digital strips scaled up.

## 0.8.6 (2026-10-04)

The HUD clusters float instead of sitting on boards, and the Hayate gets a racing tach.

- `cluster-styles.js`: no housings; `twin` and `sport` float with shadows, `digital` and `vfd` are bare,
  leaned and glowing like Cyberpunk 2077's car displays, the analog styles show a lamp only when lit;
  new style `tuner` (racing tach, small boost and temperature gauges, fuel bar).
- `instruments.js`: the `tuner` face, `paintTunerReadout`, `paintNeedle` takes the face, `paintScreen`
  takes `bare`. `dash.js`: face `tuner`, `dialAngle`. The Hayate's tach and boost gauge are racing
  gauges, its HUD style `tuner`; the cockpit's racing tach shows the live speed in its LCD.
- Settings and garage name the new style (RACING TACH).
- Tests: the racing sweep and face, the style list.

## 0.8.5 (2026-10-04)

Japanese area names, and the briefs for Most Wanted style chases and the rest of the UI.

- `AREA_JP` in layout.js: the Japanese name of every zone, named road, toll and fallback area name, for
  the subtitle under the area name (A16 part 3).
- Briefs: A16 parts 2 to 4 (the speedometer setting, every face across every screen, a controls
  settings screen with key rebinding), A17 grows a Most Wanted section (unit tiers by heat, infractions
  and cost to state, hiding spots and search, spike strips and roadblocks, pursuit breakers, radio
  chatter, the report), new A18 for Antigravity (that HUD). Ranges: Hermes 0.8.15 to 0.8.24,
  Antigravity 0.8.25 to 0.8.29.

## 0.8.4 (2026-10-04)

Two more typefaces for the UI.

- Orbitron (bold, black) as `FONT.tech` for the title screen and menu headings, and Teko (medium, bold)
  as `FONT.race` for big race and pursuit numbers. Both OFL, vendored by `tools/vendor-fonts.mjs`
  (latin only), licenses in `assets/fonts/`, loaded by `loadFonts`.

## 0.8.3 (2026-10-04)

One set of instrument painters for the cockpit and the HUD (the base of the 0.8.10 HUD styles).

- New `src/vehicles/instruments.js`: the dial face, needle and screen painters moved out of `cockpit.js`
  and `screens.js` (`paintDial` draws at any center and radius, `paintNeedle`, `paintScreen` for `lcd`
  and `vfd`, `readingOf`, `FACES`). The cockpit looks the same; `cluster-styles.js` draws the HUD with
  them.
- The LCD's CHECK ENGINE moved to the top-left corner, clear of the speed digits.
- Tests: `tests/instruments.test.mjs` (numerals on the dial faces, both screens, every HUD style for
  every car).

## 0.8.2 (2026-10-04)

Give every car its own instruments, and add the Hikari 300ZR with a fluorescent dash.

- `dash.js`: gauge faces (`classic`, `white`, `yellow`) and screen pods (`lcd`, `vfd`); the Rampart's
  dials are cream, the Vespera's yellow, the Tsurugi's cluster an LCD, the Hikari's a VFD;
  `segmentsLit` and `tachZone`.
- New `screens.js`: the LCD and VFD drawn with DSEG7, DSEG14 and Share Tech Mono.
- `cockpit.js`: faces with numerals and red needles; screen pods; the wheel marker smaller and the rim
  lower so it never covers a display.
- New car `hikari` in specs.js and models.js (1984 turbo coupe, pop-up lamps, fastback); every spec
  names its HUD cluster style (`dash.hud`) for A16. Not a street racer yet (traffic test samples).
- Tests: faces and screens per car, the bar graph tach; the gear count list has five cars.

## 0.8.1 (2026-10-04)

Fix the cockpit view: see the road, the gauges and the wheel in every car.

- `cockpit.js`: `cockpitCamera` solves the camera per car from its eye, cowl and roof so the road shows
  from 5 m ahead (it was hidden for 33 to 100 m); the binnacle is raised to sit in frame under the road;
  the steering wheel is placed by its tilted rim top under the gauges, with a lighter rim and a yellow
  marker. `COCKPIT_VIEW` holds the numbers. The header strip is slimmer.
- `cameras.js` reads the camera from the cockpit instead of fixed offsets.

## 0.8.0 (2026-10-04)

More typefaces: segment digits, a monospace, a heavy display face and a Japanese face.

- New dev dependencies `dseg`, `@fontsource/share-tech-mono`, `@fontsource/dela-gothic-one`,
  `@fontsource/m-plus-1p` (all OFL); `tools/vendor-fonts.mjs` copies them into `assets/fonts/` and
  writes `fonts.css` (linked from index.html); `assets/fonts/LICENSES.md` lists every face.
- New `src/render/fonts.js`: `FONT` stacks and `loadFonts`, awaited by `World.create` before any canvas.
- Signs: M PLUS 1p for the Japanese, Dela Gothic One for plaza, brand and lot names, DSEG7 for prices,
  pump displays and plates.
- `concepts/` (reference images from the web) is git-ignored and out of the history.

## 0.7.15 (2026-10-04)

Blinkers on the civilian traffic (A14 part 1).

- `src/traffic/sim.js`: agents carry `signal` (-1 left, 0 off, +1 right, 2 for hazards) in the
  driver's own frame. A civilian that decides to change lanes signals first and only moves after
  `SIGNAL_MIN` 1.2 to `SIGNAL_MAX` 2.5 s from its own random stream, then looks again; if the gap
  closed the signal goes off and the change is dropped. The signal stays on through the move and
  goes off when it ends. The checks a move has to pass are now `changeSafe`, called both before the
  signal and again after it, so a lane that fills up while the car waits cancels it.
- Turns and exits signal the same way: `signalForTurn` starts the signal about `SIGNAL_LEAD` 60 m
  before a planned exit or turn, an exit to the right and a turn whichever way the target lane is.
- Street racers never signal; they weave. A wreck runs its hazards on both sides until it fades.
- `src/traffic/render.js`: the flare on the outer head and tail lamp on the signalling side goes
  amber (`SIGNAL`) while the indicator is lit, blinking at about 1.5 Hz (`BLINK` 0.33 s on and off)
  with a phase per agent so a queue does not blink in unison. It uses the flares that were already
  there, so there is no extra draw call, and `update` now takes the clock as its third argument.
- Tests: new `tests/blinkers.test.mjs`, seven cases: a fresh agent has no signal, a lane change is
  signalled on the correct side for at least 1.2 s before the move starts, the signal runs 1.2 to
  2.5 s across five seeds, a change dropped because the gap closed turns the signal off, racers
  never signal, a wreck runs its hazards, and a car signals about 60 m out for an exit.
- Civilian lane changes reversed within 6 s stay at 0.0 % on the brief's seed 21 setup, so the
  blinkers did not make the dithering worse.

## 0.7.16 (2026-10-04)

The pass-by whoosh, as strong as the speed between you (A14 part 2).

- New pure `src/audio/passby.js`. `PassBy` tracks every traffic agent within `RANGE` 80 m and
  watches the relative position and velocity: when their dot product turns from negative (closing)
  to positive (opening) that is the closest approach, and only then, within `MISS` 14 m and over
  `MIN_SPEED` 4 m/s relative, does it emit one `{ speed, dist, side, heavy, kind }` event. One
  event per pass: a car that has whooshed stays fired until it goes out of range and comes back,
  so a car matching your speed beside you is silent and a pass is never heard twice.
- `passbyGain` is the loudness curve in one place, read by the voice and the tests: strong at
  30 m/s and up, falling with the miss distance so a car 13 m away is nearly nothing. A 120 km/h
  pass is violent and a 15 km/h creep is barely there. `passbyDuration` shortens as the speed
  rises (0.25 + 6 / speed s).
- `renderPassby` is the voice as pure DSP: white noise through a state-variable band-pass whose
  center sweeps down through the pass (Doppler), a swell and decay envelope, and a low rumble
  layer for the heavy vehicles (over `HEAVY_MASS` 4 t: trucks, buses, tankers, semis).
- `src/audio/audio.js`: `passbyVoice` plays that same voice live through the effects channel and
  the camera low-pass, so the cockpit muffles it exactly as it muffles the tires, and pans it to
  the side the car went past on a new `StereoPanner` (the sides follow the repo convention, so
  at yaw 0 the player's left is +X). `update` takes `f.traffic` and runs the tracker each frame.
- `src/drive.js`: one hook, the traffic agents passed into `audio.update`.
- `tools/render-passby.mjs` writes `tools/shots/audio/passby.wav`: a scripted pass at 20, 60 and
  120 km/h relative (plus a semi at 60 for the rumble), measured gains 0.06, 0.61 and 1.34.
- Tests: new `tests/passby.test.mjs`, ten cases: one event per pass, never two for one car,
  a car matching speed beside you silent, a creep and a 30 m miss silent, the left and right
  sides, the heavy flag, louder for faster and closer, and the render's swell and scaling.

## 0.7.13 (2026-10-04)

Set and draw GPS waypoint route on tactical map, minimap and HUD (A15 part 2).

- `src/ui/map.js`: clicking on the tactical map sets a GPS destination, snapping to nearby landmarks or gas stations within 20 screen pixels; Enter sets a waypoint at the map center; Backspace and context menu (right-click) clear the destination. Renders the active route polyline with an amber glow and a pulsing destination pin with a distance tag.
- `src/ui/minimap.js`: draws the active route polyline on top of the road network, draws the destination pin when in range, and clamps a directional indicator arrow to the minimap rim when the waypoint is off-screen.
- New `src/ui/route-hud.js`: DOM component mounted beneath the minimap displaying the remaining route distance (e.g. `420 M` or `3.5 KM`) with styling in `style.css`; flashes an `ARRIVED` banner for 3 seconds upon arrival.
- `src/main.js`: wires `RouteTracker` to the traffic network, updates `tracker` and `routeHud` in the frame loop, syncs visibility in `setState`, and exposes `setWaypoint`, `clearWaypoint`, and `getRoute` on `window.__lowbeam`.
- Tests: `tests/map.test.mjs` expanded with unit tests for map click/key waypoint interaction, route line rendering, edge marker clamping, and `routeHud` distance formatting and arrival state.

## 0.7.12 (2026-10-04)

The GPS waypoint route, pure (A15 part 1).

- New pure `src/ui/route.js`: `routeTo(net, from, to)` snaps car and destination to the nearest directed lanes
  (preferring a lane whose direction agrees with car yaw), runs A* over `(lane, s)` nodes with straight-line
  Euclidean heuristic, and generates a polyline every 10 m with total length and lane list.
- `RouteTracker`: holds the current route, `update(car, dt)` returns the remaining distance, detects arrival
  within 25 m of the destination (`arrived`), and re-plans when the car is more than 40 m off the polyline for 2 s.
- Tests: new `tests/route.test.mjs` verifying directed one-way lanes, T-junction turns, off-course re-planning,
  arrival detection, G1 to Police HQ route existence under 1.6x straight-line distance, and planning in under 30 ms.

## 0.7.11 (2026-10-04)

Police and helicopter markers on the minimap and Tab tactical map.

- `src/ui/minimap.js`: takes markers getter; draws police cars as directional chevrons flashing between red and blue with a 0.4 s siren rhythm; draws the helicopter with a spinning rotor glyph and translucent searchlight circle of radius `r`; clamps markers outside the minimap circle to the rim as edge indicator arrows.
- `src/ui/map.js`: `MapScreen` accepts markers getter; renders police chevrons and helicopter rotor glyphs oriented along heading and translucent searchlight spots in world space.
- Tests: `tests/map.test.mjs` extended with checks for police and helicopter markers, searchlight circles, heading rotation, and rim edge clamping.

## 0.7.10 (2026-10-04)

The pursuit HUD (NFS: Most Wanted 2005 style).

- New `src/ui/pursuit.js`: `pursuitHud` DOM component and pure `layoutPursuit(view)`.
  Displays five heat pips, status banner (`PURSUIT`, `EVADING`, `COOLDOWN`, `BUSTED`, `ESCAPED`),
  units count, helicopter tag, dual bars (evade/cooldown + conditional bust bar), bounty and time footer.
- `style.css`: `.pursuit-hud` with skewed amber heat marks, colored state banners, progress bars and smooth terminal fade-out.
- `src/main.js`: mounts `pursuitHud`, steps it in frame loop, exports `window.__lowbeam.pursuitDemo(state, markers)` and `getMarkers()`.
- Tests: `tests/pursuit-hud.test.mjs` verifying heat calculation, state banner formatting, bar fills, bust bar activation and terminal states.

## 0.7.9 (2026-10-04)

Hang the gas stations' dispensers from the canopy, after the user's photo.

- `gas-station.js`: hanging sign boxes over the pumps (brand swoosh, lane number, fuel in its color),
  coiled hoses to colored nozzles, payment posts on the islands, a white slatted ceiling with boxy
  square fixtures, red-brown lanes, a PRO PIT service bay with its yellow sign, a tire rack and a wash
  banner at the kiosk.
- `scatter.js`: `stationLayout` places the tire rack (with a collider) and moves the vending machines to
  the shop's end.

## 0.7.8 (2026-10-04)

Brief A15 for Antigravity: the GPS waypoint.

- New `docs/agents/tasks/A15-gps-waypoint.md`: a pure route over the traffic lanes (`routeTo`,
  `RouteTracker`), set from the Tab map and drawn on both maps with the distance left. A13 marked done.

## 0.7.7 (2026-10-04)

Fill the town with smaller buildings and housing.

- New kinds in `buildings.js` and `props.js`: shophouses (lit shop, awning, signboard), walk-up
  apartments (open corridors, doors, lamps, stair core), narrow townhouses (street gable, carport),
  machiya (timber lattice front, lean-to roof, noren, red lantern) and coin parking lots (bays, parked
  cars with colliders, P sign). New district mixes in `STYLES`; street-front-only kinds; the back row
  picks by weight; parking only on flat ground.
- `textures.js`: `shopTexture`, `shopSignAtlas` (`SHOP_SIGNS` and the P sign), `awningTexture`,
  `latticeTexture`, `parkingTexture`; the gas stations use the shared shop texture.
- Lights for shop fronts, walk-up corridors, parking lots and machiya lanterns.

## 0.7.6 (2026-10-04)

Rebuild the gas stations the Japanese way, to match the toll plazas.

- `gas-station.js`: a deep canopy with a lit brand fascia and a lamp grid, two-tone pillars, striped
  islands with bollards, self-service dispensers with lit price heads and colored nozzles, hose reels
  hanging from the canopy, a price pylon square to the road, a glass-fronted kiosk with a lit band,
  vending machines, and IN and OUT boards. One atlas and one fascia texture per brand.
- `scatter.js`: `stationLayout` places the vending machines and the boards, `placeStation` gives them
  colliders; the pylon's collider grows to 1 m.

## 0.7.5 (2026-10-04)

The police helicopter: modeled in Blender, parked on the HQ roof, flying and lighting the target.

- New `tools/blender/heli.py` and `assets/models/heli*.json`: body, main rotor and tail rotor as
  three models; `kit.py` gains `loft` (a body from elliptical stations, split into materials) and an
  object filter on `export`.
- New pure `src/police/heli.js` (`Heli`, `Skyline`, `helipadOf`) and `src/police/heli-view.js`.
- `World.create` loads the helicopter's models (`world.models`); `Drive` parks it on the HQ roof, steps
  and draws it, and answers the A13 contract (`policeMarkers`, `pursuitView`); `scrambleHeli` and
  `recallHeli` stand in for the police core.
- Tests: `tests/heli.test.mjs` (spin up before lift off, follows a car at 100 km/h with the light on it,
  never under the clearance over a 130 m tower, outrun by a fast car, lost under a deck, lands and spins
  down on the pad, banks and pitches).

## 0.7.4 (2026-10-04)

Brief A14 for Hermes, the next plan, and the changelog back in version order.

- New `docs/agents/tasks/A14-blinkers-passby.md`: blinkers on the civilian traffic (signal before a
  lane change, a turn, an exit or a merge; hazards on wrecks) and the pass-by whoosh scaled by the
  relative speed (a pure `PassBy` and its voice).
- Task index: A11 and A12 done, A13 (Antigravity) and A14 (Hermes) running, and Claude's next work:
  the helicopter, the gas stations modeled after the toll plazas, smaller buildings and housing.
- The changelog is sorted by version again (the agents' version ranges interleave in time).
- ARCHITECTURE's current state header follows the highest version, not the latest commit.

## 0.7.3 (2026-10-04)

Brief A13 for the pursuit HUD, ahead of the helicopter and the police.

- New `docs/agents/tasks/A13-pursuit-hud.md`: the contract the helicopter, the police core and the HUD
  share (`drive.pursuitView()`, `drive.policeMarkers()`), the pursuit HUD and the police markers on
  both maps for Antigravity. New version ranges per agent in the task index.
- ARCHITECTURE: lamp and building counts corrected from `npm run bench` (4,600 lamps, 8,900 buildings).

## 0.7.2 (2026-10-04)

Even out the steep spots where overpasses and slip roads meet the ground.

- `roads.js` `applyLifts`: a lifted road is raised (never lowered, so clearance holds) where the lift
  eases onto ground that climbs on its own; Route 18 over the ridge goes from 11.1 % to 7.5 %, Harbor
  Ave from 8.2 % to 7.5 %.
- `roads.js` `easeSlip`: a slip road's climb is eased into the stretch held at the carriageway's height;
  the Route 18 ramps go from 7.6 and 8.8 % to 6.5 %. Both ends of every ramp still meet exactly.

## 0.7.1 (2026-10-04)

Put Route 1 on two viaducts across the north corners.

- `C1_VIADUCTS` in layout.js: Route 1 rises 12 m across the north-east corner (KITA TOLL to the Route 1
  east gas station) and the north-west corner (West Ave to Route 18), clear of every ramp, plaza and pad.
- One deck for both carriageways (`build-bridges.js`): the forward slab spans the median to the far
  edge, the median is decked over, no median parapets or wall colliders (`scatter.js`).
- Median lamps stand on the deck (pole colliders only at deck height); the guard rails stop where the
  parapets start (`highway.js`); the underside is a separate material outside the light pools.

## 0.7.0 (2026-10-04)

Rebuild the toll plazas after the Shuto Expressway's Oi plaza.

- `build-highway.js`: a new plaza: blue columns, a fascia on each face with lit lane signs (ETC専用,
  ETC/一般, 一般), round signals and amber lamps, a glass and blue panel band and red fins, the name
  plate in kanji and romaji, three banners on top, chevron boards over the islands, booths with lit
  windows, striped impact cushions, hazard poles, fee and camera boards, barrier arms, light masts.
  All signs of a plaza come from one canvas atlas. The mirrored green name board is gone.
- `highway.js`: lanes carry a `sign` counted from the median out (the cash lane is now the outer
  lane on both carriageways), the ETC only lanes get blue paint strips along the carriageway
  (`paint`), `PLAZA_PARTS` sizes the islands, cushions and masts; colliders for the longer islands,
  the outer columns and the masts; the canopy lights are spot pools and the masts light the fascia.

## 0.6.12 (2026-10-04)

World-build bench (A12 part 3).

- `tools/buildbench.mjs`: Node benchmark timing each world-build stage (`layout import`, `citygen streets`,
  `Ground` construction and carve, the junction finder, `placeBuildings`, `scatterWorld`, `forest`)
  over 3 runs using pure modules only.
- Prints a table of median ms, percentage share, and element counts (roads, streets, junctions,
  buildings, lamps, trees, lights).
- Added `npm run bench` script to `package.json`.

## 0.6.11 (2026-10-04)

Landmark model viewer (A12 part 2).

- `tools/landmarks.html`: the police HQ, a garage and a hideout side by side on a floor at night, loaded
  through `loadModels` and built by `buildLots` with its materials, lit by the models' own lights through
  `installPools`. Each light is a small marker (L toggles them), each collider a green wireframe box (C
  toggles them). Keys 1 to 3 solo a model, 0 shows all, drag orbits, the wheel zooms. The readout lists
  vertices, triangles, colliders and lights per model. `window.__landmarks.shot(name)` writes
  `tools/shots/<name>.png`. The page sets `<base href="/">` because `loadModels` fetches a relative URL.

## 0.6.10 (2026-10-04)

Landmarks on the minimap (A12 part 1).

- `minimap.js`: the police HQ, garages and hideouts (`ground.lots`) are drawn with the tactical map's
  icons (`drawPoiIcon`, shield, wrench, dashed square) at 0.8 scale. They are placed like the station
  icons: positions turn with the map, the icons stay upright, all inside the minimap's circular clip.
- The tactical map already labels every point of interest with its name, lots included.
- `tests/map.test.mjs`: the minimap draws a lot's icon inside the clip when it is near the car and
  skips a far one.

## 0.6.9 (2026-10-04)

Starting the Kuro Pass run, the rally HUD, and the T-junction give-way (A11 part 3).

- `src/drive.js`: the run, marked like the duel. Stopped within 15 m of the start line the prompt
  reads `F  KURO PASS TIME ATTACK` and F begins a run: `placeOnRallyStart` puts the car on the line
  facing down the stage, `audio.music.hold('ridge')` runs, `audio.beep('count')` and
  `audio.beep('go')` come from the race events, and R during a run puts the car back on the stage
  with the 5 s penalty. A new best and its ghost are saved per car under `rallyBest` and
  `rallyGhost`. The stage road comes from `ground.roads.byId.get(RALLY.road)` every time, never a
  cached position.
- `src/traffic/sim.js`: `rallyRoad` stops spawning on that road and fades out any agent still on it,
  so the stage belongs to the player while a run is going.
- `src/traffic/sim.js`: the T-junction give-way Antigravity's net.js left as data is now read. A
  stop carrying `yield: { lanes, at }` holds a side-road car while anything on the through road could
  reach the junction in less than `YIELD_TIME` 4.5 s (`yieldClear`, looking `YIELD_LOOK` 45 m up the
  road), and lets it go once the road is clear. Every yield line sits about 11 m short of the lane
  end, so a car waiting there waits `YIELD_LINE` 0.4 m short of it rather than on top of it, which
  would creep it to a standstill and never let it turn in.
- `src/ui/hud.js` and `style.css`: the rally panel, the clock, the split at each gate (green ahead,
  red behind), the next two pace notes as big text, the off-course countdown and the result card for
  4 s. It sits at the top, so it stays clear of the gauges in the cockpit view.
- `src/audio/soundtrack.js`: a `rally` flag on the swell scene, like `rival`, holding the level at
  `SWELL.rallyFloor` 0.7 so a run is never silent below 50 km/h. Threading it to the swell needed
  one extra line in `music.js` (`setScene`) and one in `audio.js`, which were outside the part's
  stated file list; both were authorized as one-line edits.
- Tests: new `tests/rally-traffic.test.mjs` (five cases: the network has yield stops, an agent
  stops at one while traffic approaches, the same agent goes once it is clear, a rally road clears
  traffic and keeps it from spawning and gives it back afterwards, and other roads are unaffected)
  and two more in `tests/rally.test.mjs` (gates count in order and only then does the finish count,
  and a run that cannot pass a gate never finishes however far it drives).
- Verified in the browser at 480 lines: the prompt reads `F  KURO PASS TIME ATTACK`, F starts the
  countdown, the panel shows the clock and both pace notes on the pass, and a full run through every
  gate finishes gold with the splits alternating behind and ahead of a stored best.

## 0.6.8 (2026-10-04)

The Kuro Pass time attack, the second RaceEvent (A11 part 2).

- New pure `src/race/rally.js`: `Rally extends` the A9 base. `new Rally(carId, cfg, road, opts?)`
  takes the stage road (a `world/roads.js` Road through `path.length`, or anything with a plain
  `length`), starts at `cfg.startS` and finishes `cfg.finishEndOffset` short of the end, with
  `cfg.checkpoints` gates spread evenly between. Gates only count when the car is actually on the
  road, so cutting one does not finish the run; `nextGate()` is the next required gate.
- Splits are recorded at every gate and at the finish as `{ at, against, ahead }` and compared
  against the saved best for that car, passed in as `opts.best` and `opts.bestSplits`. Medals come
  from `cfg.medals` (average km/h targets, gold first) and the prize from `cfg.prize`.
  `penalize()` adds `PENALTY` 5 s for putting the car back on the stage.
- Off course: more than `OFF_COURSE` 25 m from the road for `OFF_LIMIT` 3 s starts an `OFF_GRACE`
  10 s countdown, then the run aborts with no result. Coming back on the road clears the timer.
- Ghost: `recordGhost(t, pose)` stores `x`, `z` and `yaw` as whole centimeters and centi-radians
  every `GHOST_STEP` 0.1 s, and `ghostAt(t)` interpolates between samples, returning null outside
  the recorded span so the caller knows not to draw anything. Drawing the ghost car is Claude's.
- Pure module: it never reads or writes the save, so `Drive` owns `rallyBest` and `rallyGhost`.
- Tests: `tests/rally.test.mjs`, 15 cases: the 3 s countdown holds the clock, gates evenly spaced
  between start and finish, a run through every gate finishes with a time and a medal, skipping a
  gate does not finish, the penalty adds exactly 5 s, the off-course countdown aborts and coming
  back clears it, `ghostAt` interpolates and returns null outside the span, ghost samples are
  stored as integers, splits compare against a best time (and are null with no best), medals and
  prize come from the config, a fast run wins gold, and `RALLY` is left as authored.
- Verified against the real Kuro Pass road read through `ground.roads.byId.get(RALLY.road)`: a
  5,913 m stage from s 400 to 6,313 with gates at 1583, 2765, 3948 and 5130, gold at 251.9 km/h.
  Positions are read from the road, never hard-coded, since the map is still moving.

## 0.6.7 (2026-10-04)

Model the police headquarters, garages and hideouts in Blender and place them on lots.

- New `LOTS` in layout.js: the police HQ on Hanazaki Cape, three tuning garages and three hideout
  warehouses, each a flat lot beside a road; the city streets keep clear of them (`blocked` in
  `cityStreets`).
- `Ground.lots`: landmark pads, flattened and paved like the forecourts (pad offset now counts the
  road's sidewalk).
- New `tools/blender/` (kit and one script per model) and `assets/models/*.json`, built with the
  Blender MCP and exported with box-projected UVs, colliders and lights.
- New pure `src/world/lots.js` and `src/world/build-lots.js`; the scatter adds the lots' colliders and
  lights, `World.create` builds the models; map points for police, garages and hideouts.
- Tests: `tests/lots.test.mjs` (frame, contents, every lot flat and clear of streets).
- Task brief index: A12 (Antigravity) and the A11 resume (Hermes); version ranges per agent.

## 0.6.6 (2026-10-04)

F3 stats overlay displays performance and scene metrics.

- New `src/ui/stats.js`: F3 toggles a corner readout of frames per second, draw calls, triangles (`renderer.info.render`), and traffic agent count.
- Hooked into `src/main.js` with inline styles and zero `style.css` edits.

## 0.6.5 (2026-10-04)

Pace notes for the Kuro Pass rally (A11 part 1).

- New pure `src/race/pacenotes.js`: `paceNotes(path, heightAt?)` walks a stage every 5 m
  (`NOTE_STEP`) and returns one note per corner, `{ s, dir, grade, mods }`. The radius comes from
  the heading change over that step and `gradeFor` maps it to 1 (tightest) through 6 (nearly
  flat). `dir` is left or right from the sign of the yaw change, the same convention as
  `vehicles/physics.js`. Mods: `hairpin` under `HAIRPIN_R` 20 m, `long` past `LONG_M` 60 m,
  `tightens` and `opens` when the radius changes by half (`CHANGE_R`) across the corner, `crest`
  where a climb tops out, and `into` when the next corner starts within `INTO_S` 30 m. A crest is
  a mod on the nearest corner rather than a note of its own. `path` only needs `length` and
  `sample(s)`, which `world/spline.js` `Path` already provides; `heightAt(s)` is optional and is
  what turns crests on.
- Tests: new `tests/pacenotes.test.mjs`, ten cases on synthetic paths: radius 15 is a hairpin,
  radius 150 grades 5 or 6, a left bend reads left and a right bend reads right, an S calls the
  second corner `into`, a corner over 60 m is `long`, a changing radius is `tightens` or `opens`,
  a climb topping out is a `crest`, every note carries an `s` inside the path with a valid grade
  and dir, a straight road produces nothing, and `HAIRPIN_R` is 20.

## 0.6.3 (2026-10-04)

Kurogane City becomes a real street network, built up from the waterfront to the expressway.

- New pure `src/world/citygen.js`: frame roads (Chuo-dori, Kurogane-dori, the Naikan and Sotokan
  rings) are authored; each district fills with its own streets at its own angle and spacing, bent,
  broken off a block early here and there, meeting the frame roads at T junctions, clear of the
  expressway, the ramps, lifted road and the pass. Nine districts, inside and outside the loop
  (downtown, midtown, residential, the port, the industrial east coast, the west side). About 400
  streets replace the 28-street grid; `GRID` and `streetGrid` are gone, and the avenues no longer
  taper to meet it.
- New pure `src/world/junctions.js`: crossings and T junctions from the road geometry. The road
  builder paves each as one patch and drops skirts and sidewalks inside it; the old grid-only
  crossing and curb builder is gone.
- Roads can have sidewalks (`walk` on the def): a 16 cm curb and a concrete walk on each side,
  part of the ribbon; the ground counts them as road. Lamps stand at the sidewalk's edge and never in
  a junction. Ribbons are merged per 256 m cell and material.
- New pure `src/world/buildings.js`: a row of buildings along each side of every town road and a
  second row behind in the denser districts, by district style (`cityStyle` in layout.js): towers
  and offices downtown, offices and apartment blocks in midtown, houses and small blocks in the
  residential districts, warehouses, garages and factories in the port and the industrial east,
  a house now and then on country roads. A 2 m road mask and a building hash keep it fast (about
  13,000 buildings).
- `props.js`: the town is merged per 320 m cell and culled like the ground, and each kind has a
  shape: stepped tower crowns with an aviation lamp, apartment balconies, pitched house roofs,
  corrugated sheds with roller doors, lit garage shutters, saw-tooth factory roofs.
- Town ground is paved (`TERRAIN.paved`); no trees grow on it. The east coast has a wider shelf.
- Faster build: district polygons are rasterized (`polygonMask`), road queries visit only the
  roads near the point, terrain far from every road skips the road lookup, and once the light pools
  are on `bakeGeometry` writes zeros instead of baking.
- Road heights at junctions run from one junction's correction to the next instead of averaging
  them (the average left steps beside a junction); the shortest junction blend is 50 m (was 35).
  Terrain is carved to the lowest road within reach, so it never pokes through a street beside
  another on a hillside.
- `traffic/sim.js`: spawns pick from the lanes near the player (40 m lane pieces in a 160 m grid);
  with ten times the lanes, picking from the whole island left the player's surroundings empty.
  Expressway traffic density 4.5 (was 3).
- Tests: town roads that cross at grade are joined by a paved junction; at-grade crossings are only
  forbidden for expressways and ramps; joins at Chuo-dori, Kurogane-dori and the coast roads;
  lamps may stand on sidewalks; streets may reach 20 % at hillside junctions.

## 0.6.2 (2026-10-04)

Island map rendering, elevated viaduct runs, new tactical POI icons and legend.

- `src/ui/map.js`: renders sea outside `water.coast` polygon with evenodd winding rule and fallback
  to `water.sea`. Maps elevated road runs on top of ground ribbons.
- `src/ui/map.js`: adds dedicated vector icons for `police` (shield), `garage` (wrench), and `hideout`
  (dashed square) next to existing station, toll, and rally markers, with a tactical map legend.
- `src/ui/minimap.js`: `drawRoads` renders lifted road runs above ground roads with dark outlines.
- `tests/map.test.mjs`: tests for island coast, elevated road overlays, and all POI icons with mock data.

## 0.6.1 (2026-10-04)

Traffic junctions at any angle, T junctions with yield stops, and multi-arm node merging.

- `src/traffic/net.js`: `linkCrossings` supports crossings between any two-way surface roads of class
  `street` or `arterial`. Crossings where either road is lifted more than 2 m are skipped as bridges.
- Light axes are assigned per road at the junction node (road A axis 0, road B axis 1) rather than from
  world direction octants, preserving alternation on curved and non-orthogonal intersections.
- T junctions: a road ending on another surface road's side receives a stop line with yield data
  (`{ s, yield: { lanes, at } }`), turn links onto both directions of the through road, and mid turn
  links from both through road directions into the side road.
- Crossings with five or more arms and junctions closer than 25 m merge into one light node.
- `tests/net.test.mjs`: unit tests for angled crossings, T junctions, bridge clearance, and node merging.

## 0.6.0 (2026-10-04)

Kurogane becomes an island, and the pass no longer ends in a hook by the lake.

- `COAST` in layout.js and new pure `src/world/island.js` (`inland`, the distance inside the
  shore, precomputed on a 24 m grid with a noisy shore). `heightfield.js` drops the land into the
  sea along it: cliffs under the western mountains, a low shelf elsewhere. The east coast and the
  north shore are low land for the industrial district and the coast roads. The bay is part of the
  same shore; `SEA` no longer shapes the terrain.
- `build-terrain.js`: one water sheet at sea level under the whole map replaces the lake discs and
  the bay sheet.
- `forest.js`: the edge belt and the thicket are gone (the sea is the edge now); trees within
  150 m of the shore are mostly black pine.
- New roads: the Higashi Coast Road (port to Hanazaki Cape up the east coast) and the Kita Coast
  Road (cape to the forest village along the north shore), which runs straight on into Kuro Pass.
  Route 18 ends on the Kita Coast Road at a T, East Ave on the Higashi Coast Road. G3 moved onto
  the Kita Coast Road. New zones: Hanazaki Cape, Kita Coast, Higashi Industrial.
- `mapData.water.coast` for the map screens; `waterAmount` reads the shore.
- Tests: the island is ringed by sea, the shore is lined with pines, and the terrain test checks
  the island's shape; the edge belt tests are gone.

## 0.5.2 (2026-10-04)

Traffic drives with its lights on.

- `src/traffic/render.js`: every car within 420 m of the player gets four flares, white at the
  head lamps and red at the tail lamps (brighter and bigger when braking), found from the body's
  `lamp` vertices (`lampSpots`), one instanced draw call for all of them. The 16 cars nearest the
  player throw a headlight beam onto the road, walls and buildings. `update(agents, focus)` takes
  the player; `drive.js` passes it.
- `src/render/psx.js`: `psxFlare`, an additive camera-facing quad that flares toward where the
  lamp faces and fades with the fog; the pool shader adds the beams (`BEAMS` 16, `uBeamPos`,
  `uBeamDir`), banded like the lamp pools.
- `src/render/textures.js`: `flareTexture`.

## 0.5.1 (2026-10-04)

Street lamps throw real pools of light, and every lamp has two arms.

- New `src/render/pools.js` and pure `src/render/pool-grid.js`: every world light goes into a float
  texture, and a 24 m grid over the map lists up to 12 lights per cell, strongest first.
  `World.create` installs them; `psx.js` materials made with `baked: true` then light each pixel
  from the cell's list instead of the per-vertex `bake` attribute, whose glow followed the 8 m
  terrain cells and the road ribbon columns and had no shape.
- Lamp heads are cone lights (`spot: 1` on the light): a pool about 16 m across with a visible edge
  and a faint spill outside it. All pool light is cut into 7 bands (`POOL_BANDS`).
- `scatter.js`, `props.js`: lamps have two arms. A pole in a median (Route 1, the Bayshore Line)
  lights both carriageways; a roadside pole also has a short, lower, dimmer arm over the sidewalk.
  Lamp light reach is 22 m (was 19).
- Tests: `tests/pools.test.mjs` for the grid (a light is listed in every cell it reaches and no
  other; a crowded cell keeps the strongest first and never overflows).

## 0.5.0 (2026-10-04)

Music that follows the speed, a sharper default picture, and cameras that look out over the car.

- `src/audio/soundtrack.js`: `SpeedSwell` and `SWELL`. While driving, the recorded music is
  silent below 50 km/h and swells in toward full at 140 km/h (100 on the pass), about 8 s from
  silence to full, falling slower and only after 3 s of lower speed. A racer within 150 m holds
  it at 0.55 or more. The fast mood now starts after 3 s above 140 km/h (was 4 s above 150).
- `src/audio/music.js`: the swell drives a gain and a low-pass (320 Hz at zero, opening an octave
  per sixth of the swell) on the recorded tracks, so a track comes in muffled and escalates with
  the speed. Menus play at full, pause holds the swell. `NOW PLAYING` shows once a track is audible.
- `src/render/stage.js`: `RENDER_HEIGHTS` 240, 360, 480, 600, 720 and 1080 lines, `DEFAULT_LINES`
  480. `main.js` applies the stored height at boot (it was only applied when changed in settings).
- `src/render/cameras.js`: the car view is 5.6 m back and 1.8 m up and looks 7 m ahead of the car,
  so the road shows over it; the cockpit camera sits 22 cm ahead of the modeled eye and looks
  less far down, so the windshield fills the top half instead of the roof header and the dash.
- `src/ui/cluster.js`: the TEMP and EXH readouts showed `Â°C` (a mis-encoded degree sign).
- Tests: three for the swell in `tests/soundtrack.test.mjs`.

## 0.4.23 (2026-10-03)

Challenging a street racer, the first RaceEvent (A9 part 3).

- New `src/race/`, pure like the rest of the physics: `race/event.js` holds the `RaceEvent`
  interface every race kind shares (`id`, `kind`, `state`, `time`, `participants`,
  `update(dt, world) -> events[]`, `result()`, plus `abort()`), and `race/duel.js` holds `Duel`.
- `src/race/duel.js`: Tokyo Xtreme Racer rules. Both gauges start at 1; whoever is behind loses
  gauge at a rate that grows with the gap (nothing under `GAUGE_FREE` 10 m, worst at `GAUGE_FAST`
  150 m, `DRAIN_MAX` 0.22 per second), the leader recovers `RECOVER` 0.02 per second, a wall or
  traffic hit costs the driver who caused it `HIT_DRAIN` 0.06, first gauge to 0 loses, and a gap
  past `WIN_GAP` 500 m wins at once for the leader. A 3 s countdown (`COUNTDOWN`) comes first with
  the gauge held still. The countdown beeps and the go tone are returned as events for the caller
  to play, not played here. Prize is `duelPrize`: `4000 + 6000 * rival speed factor` rounded to 500,
  nothing for a loss.
- `src/traffic/sim.js`: a `duel` flag on the agent. While set, the racer aims for
  `kind.speed[1]` instead of its cruising `factor`, and `maybeChange` only moves it to get past
  something or take a clearer line, so it never drifts back to the slow lane mid-duel. No other
  agent's behavior changes.
- `src/drive.js`: `startDuel`, `stepDuel`, `endDuel` and `duelPanel`, clearly marked. The
  challenge is refused unless the rival is ahead, within `CHALLENGE_RANGE` 60 m and on Route 1 or
  the Bayshore Line (`canChallenge`, `DUEL_ROADS`); the prompt offers it when it is allowed. Wins
  are counted per rival kind id in the save under `duelWins`.
- `src/core/input.js`: the `challenge` action on `KeyH`. The brief asked for gamepad RB, but RB
  and LB are already the manual gears, so it is on R3 (button 11) and the controls screen says so.
- `src/ui/hud.js` and `style.css`: the duel panel, two gauge bars with the rival's name, the
  countdown digits and `YOU WIN  ¥8,500` or `YOU LOSE` for 3 s. It sits at the top, so it stays
  clear of the gauges in the cockpit view like the prompt does.
- Music is untouched: it already turns intense when a racer is within 150 m.
- Tests: new `tests/race.test.mjs` (13 cases: the base shape, the countdown blocking the gauge
  with three counts and one go, the drain growing with the gap, leader recovery, hits costing
  gauge, first to zero losing, a 500 m lead winning at once either way, abort, the prize rounding
  to 500, a win paying and a loss paying nothing, and the challenge rules), plus
  `an agent in a duel aims for its top speed and ignores the slow lane` in `tests/traffic.test.mjs`.

## 0.4.22 (2026-10-03)

Remove the deprecated gauge aliases (A9 part 2).

- `src/vehicles/gauges.js`: the `WATER_MIN` and `WATER_MAX` exports are gone, along with the
  `water` field in `createGauges` and the `g.water = s.temp` line in `stepGauges`. The module now
  speaks only `temp`, `TEMP_MIN` and `TEMP_MAX`.
- `src/ui/cluster.js`: the cluster reads `gs.temp ?? 84` instead of `gs.temp ?? gs.water ?? 84`.
  The HUD cluster has read `temp` first since the rename, so no gauge changes.
- `docs/agents/ARCHITECTURE.md`: the "Open work and known issues" line about the aliases is deleted.
- Tests: `the gauges expose no deprecated water aliases` asserts the two constants are not exported
  and that neither `createGauges` nor `stepGauges` sets a `water` field.
- The `water` in `audio/env.js`, `world/surfaces.js` and the lake tests is the lake and sea amount,
  a different thing, and is untouched.

## 0.4.21 (2026-10-03)

The dev server answers range requests (A9 part 1).

- `tools/devserver.mjs`: `Range: bytes=` is honored with `206 Partial Content`, `Content-Range`,
  `Content-Length` and `Accept-Ranges: bytes` on every file, and `416` with `bytes */<size>` for a
  range that starts past the end. All three forms work (`a-b`, `a-`, `-n` for the last n bytes), a
  range that runs past the last byte is clamped, and an unparseable header falls back to the whole
  file. The no-store caching is unchanged, so a media element can now seek inside a track.
- `tools/devserver.mjs` exports `createServer` and the module only listens when it is the entry
  point, so `tests/devserver.test.mjs` can start the server on a free port instead of taking 8040.
- Tests: new `tests/devserver.test.mjs` with eight cases: `parseRange` over the three forms and a
  past-the-end range, a `206` slice of `package.json`, an open ended range, a suffix range, a `416`
  with the real length, a plain request still getting the whole file with `Accept-Ranges`, a ranged
  request for a missing file still a `404`, and ROOT being the repo.

## 0.4.20 (2026-10-03)

The recorded soundtrack: eight tracks that follow the driving.

- `assets/music/`: Jc's eight tracks, renamed to plain file names.
- `src/audio/soundtrack.js` (new, pure): the track list with mood and measured loudness, leveling
  to -16 LUFS, `nextTrack` (never the same twice running) and `MoodTracker` (menu, cruise,
  intense, mountain; up fast, down slow).
- `src/audio/music.js`: streams the tracks through media elements with 3 s crossfades, switches
  early only when the mood rises, falls back to the other track of a mood and then to the
  synthesized music when a file fails; offline rendering still uses the synth.
- `src/audio/audio.js`: `update` takes `mountain` and `rival` for the mood; `onTrack` hook.
- `src/drive.js`: works out whether the car is on the pass and how far the nearest racer is,
  three times a second. `src/main.js`: `NOW PLAYING` toast while driving.
- Tests: every file exists, the tracks level to the same loudness, rotation, and the mood rules.

## 0.4.19 (2026-10-03)

Ramps become slip roads, the Bayshore Line joins Route 1, and the street grid fills the city.
The street racer speed test averages four seeds.

- `src/world/merge.js` (new, pure): `slipRamp` builds the part of an exit or entry that runs
  beside its carriageway (a sliver widening over 60 m, a 90 m parallel lane, a 140 m diverge to
  24 m), `slipMeta` measures the finished ramp (shared stretch, nose, gore), `biarc` draws two-arc
  connectors with no bunched-up curvature, `inStretch` handles stretches across a closed road's seam.
- `src/world/roadgen.js`: `diamond` builds its four ramps from `slipRamp`; the old gore metadata is
  replaced by `slip` and a width `taper`.
- `src/world/roads.js`: a slip road takes its carriageway's height along the shared stretch and the
  gore. `query` and `influence` use the true distance past the end of an open road.
- `src/world/build-roads.js`: no skirts on either side of a shared edge, gores from `slip`, a thick
  dashed line over the seam of every added lane, city crossings from `GRID`.
- `src/world/highway.js`: the carriageway rail opens from the taper to 30 m past the gore, every
  slip road has a rail on its outer edge (not on decks), toll plazas take their lane count from the road.
- `src/world/layout.js`: the Bayshore Line is 2 lanes each way along the bay (x -850 to 800) and four
  junction ramps join it to Route 1 at the south corners, two of them flying over the loop; the street
  grid grows to 9 by 19 (`GRID`), West Ave and East Ave meet its middle street at the edges, the 16
  suburb stubs are gone; MINATO TOLL moves to x -700, the Bayshore toll to x 450, station G2 to z 450.
- `src/traffic/net.js`: no exit is offered at the very end of an expressway that a ramp continues.
- Tests: slip roads start as a sliver and share the carriageway's edge (within 12 cm) and height
  (within 2 cm) for over 120 m; the Bayshore joins Route 1 both ways at the same width and height,
  and traffic can drive Route 1 to the Bayshore and back; rails under a bridge do not count as on
  the ramp above.
- `tests/traffic.test.mjs`: the racer speed check averages seeds 77, 1, 2 and 3 instead of one seed; a
  single 3-minute run lands anywhere from 170 to 207 km/h, so one seed failed on any network change.

## 0.4.18 (2026-10-03)

Cockpit prompt out of the way, racer speed check restored (A8 part 5, written by Hermes, committed
by Claude after Hermes stopped).

- `src/ui/hud.js`, `style.css`, `src/drive.js`: `hud.prompt(text, cockpit)` toggles a `cockpit`
  class that moves the prompt from the bottom to 12 vh from the top, clear of the modeled gauges.
- `tests/traffic.test.mjs`: every racer kind must want more than 1.4 times the limit again (it had
  been loosened to 1.0).

## 0.4.17 (2026-10-03)

Civilians stop flip-flopping between lanes (Antigravity's A8 part 4).

- `src/traffic/sim.js`: a civilian that finishes a lane change sets `laneHold` to 8 s
  (`LANE_HOLD`) and will not move again until it passes, unless it has to: a planned exit or
  turn inside 250 m or something stopped ahead within 38 m outrank the hold. Racers set
  `laneHold` to 0 and keep weaving. Moving back to the slow lane now goes through the new
  `slowLaneClear`, which needs 120 m clear ahead in it (`SLOW_LANE_GAP`) and nothing faster
  closing within 60 m behind.
- Measured with the brief's setup (seed 21, 3 minutes on Route 1, player at 108 km/h): civilian
  lane changes 591 with 303 reversed within 6 s (51.3 %) before, 121 with 4 reversed (3.3 %)
  after. Racer mean speed in the 3 minute headless test is 192.0 km/h (top 279.7), unchanged,
  and the existing yield test still passes.
- The yield thresholds (within 45 m behind, closing by more than 3 m/s) are deliberately
  unchanged. Tightening them to the brief's 40 m and 8 m/s was measured and it drops racer
  mean speed to 172 km/h, under the 190 km/h target, because every extra civilian lane change
  is another car manoeuvring in front of a racer. The 8 s hold is what removes the dithering.
- Tests: `fewer than one civilian lane change in ten is reversed within 6 s` (the brief's
  setup, requires more than 100 changes to judge and under 10 % reversed).
- Also in this commit: `package-lock.json` was still at 0.4.13, so its two version fields now
  match `package.json`; and `gearRpm` in `src/vehicles/physics.js` no longer takes an unused
  `s` and its doc comment says it returns engine rpm rather than road speed.

## 0.4.16 (2026-10-03)

A downshift at crawling speed drops to the gear that fits (Antigravity's A8 part 3).

- `src/vehicles/physics.js`: a manual downshift in a forward gear above 1st now goes to `downGear`,
  the highest gear below the current one that would still turn the engine at least 1.2 times idle
  (`CRAWL_RPM_FACTOR`) at the current road speed, and to 1st when no gear does. A car sitting in 5th
  at walking pace after a crash drops straight to 1st on one tap instead of three, and at 100 km/h a
  tap still gives 4th. It never picks a gear that over-revs, so the money shift above it still blows
  the engine. 1st, R and N are fixed rungs.
- Tests: `a downshift at crawling speed drops straight to the gear that fits` (5th at 2 m/s gives 1
  with no damage, 5th at 28 m/s gives 4) and `a crawl downshift picks the gear the engine can
  actually pull` (every car from its top gear at walking pace lands in 1 and pulls without blowing
  or passing the redline). The money shift test is unchanged and still passes.

## 0.4.15 (2026-10-03)

Manual gear order runs N, R, 1 to the top gear (Antigravity's A8 part 2).

- `src/vehicles/physics.js`: new `stepGear` returns the next rung along N, R, 1 ... n for a
  manual shift, so shifting down from 1 lands in R and R is the last rung below neutral, and
  shifting up from N goes to R and from R to 1. Gear values are unchanged (-1 for R, 0 for N),
  only the order moved. The money-shift rule into R is unchanged, so a careless double tap down
  from 1 at speed still blows the engine. Auto mode is untouched.
- `src/ui/menus.js`: the settings notice and the pause key list now read (N, R, 1..7).
- Tests: `the manual selector runs N, R, 1 to the top gear for every car, at any speed` and the
  new `the manual selector steps N, R, 1 with a single tap, in both directions` (all four cars,
  single taps in both directions, N as the bottom stop). Tests that walked to R or N by tapping
  were adjusted for the new order.

## 0.4.14 (2026-10-03)

Neutral hits the rev limiter (Antigravity's A8 part 1).

- `src/vehicles/physics.js`: `freeRev` takes the throttle away while a limiter cut is running, so
  full throttle in N bounces on the redline like it does in gear. Peak rpm in neutral over 4 s fell
  from 13,684 to 7,840 (Hayate), 11,397 to 6,377 (Rampart), 16,463 to 8,634 (Vespera) and 13,938 to
  7,710 (Tsurugi); the limiter now fires about 30 times in those 4 s instead of once, and neutral can
  never reach the 11,000 rpm blow rpm on its own.
- Tests: `neutral bounces on the limiter without driving the car or blowing` replaces the old weak
  check and asserts, for all four cars, that rpm stays under redline + 150, the limiter cuts at least
  4 times, the car does not move, and the engine still falls back to idle when the throttle is lifted.

## 0.4.13 (2026-10-03)

Bayshore Line, a larger city rect with suburbs, and rails on steep drops (Antigravity's A7 part 6,
committed by Claude from its handoff, `docs/agents/tasks/HANDOFF-A7-part6.md`).

- `src/world/layout.js`: Route 2, the Bayshore Line (`c2-f`, `c2-r`, 4.6 km, 3 lanes each way,
  100 km/h) along the bay with a 7.4 m lift over Harbor Ave; `toll-bayshore`; `CITY` grows to
  x -1280 to 1280, z 520 to 2020; 16 suburb streets (`k-sub-*`, 40 km/h).
- `src/world/highway.js`: median barrier and side rails on both expressways, plazas found by
  `toll.road`, guard rails on drops and slopes over 1.5 m outside town (not on decks with parapets).
- `src/world/scatter.js`: lower, wider-spaced blocks in the suburban band, towers only in the core.
- `src/traffic/sim.js`: `populate` tries `target * 8` spawns to fill the larger network.
- Tests: four plazas across both carriageways; the Bayshore Line is 4 to 6 km and dual.
- Known gaps: the Bayshore Line has no ramps and cannot be reached; the suburb streets are stubs
  and the street grid itself is unchanged.

## 0.4.12 (2026-10-03)

Road joins and city grid: gore tapers, crossing patches, and corner curbs.

- `src/world/roadgen.js`: diamond interchange ramp departure and arrival tangents align strictly
  with the normal vector of the arterial tangent, and the ramp inner edge aligns flush with the
  carriageway outer edge at the gore split. Ramp definitions include gore metadata.
- `src/world/roads.js`: `Road.hwAt(s)` supports width tapers between arterials and street grids;
  `blendJunctions` links ramp heights with carriageways and arterials while preventing main roads
  from warping to ramps; `RoadNetwork.query` prioritizes paved roadway surface over unpaved skirts.
- `src/world/build-roads.js`: painted chevron gores fill triangles between Route 1 outer edge and
  ramp inner edge; city intersections receive seamless asphalt crossing patches and concrete corner
  curbs with rounded sidewalk corner fans; ribbon skirts suppress in gores and crossings.
- `src/world/highway.js`: guard rail verges open cleanly along the ramp throat from taper to gore nose.
- `src/world/layout.js`: Route 18, Harbor Ave, West Ave, and East Ave taper width between 7.0 m and
  4.6 m to join city streets flush; station g1 moved to [0, 1940] to keep clear of the harbor ramp gore.
- Tests: `tests/layout.test.mjs` verifies 0 lips and grade breaks at joins, and flush gore heights;
  `tools/mapcheck.mjs` confirms 0 unexplained crossings and max grade break under 2%.

## 0.4.11 (2026-10-03)

- Gauge faces lose their numerals and labels: ticks, the red zone and the needle only, since
  numbers cannot be read at 240 lines. Major ticks every 1,000 rpm and 40 km/h.

## 0.4.10 (2026-10-03)

Fast street racers and aggressive highway weaving.

- `src/traffic/sim.js`: street racers use racing lateral grip of 0.9 g (~8.83 m/s^2) for curve speeds,
  accelerate with double nominal acceleration when far below wanted cruising speed, and use a shorter
  IDM time headway of 0.6 s with a tighter 1.0 m minimum gap.
- `src/traffic/sim.js`: when blocked within 140 m, racers weave into any open neighboring lane (including
  the slow lane) in a 1.5 s diagonal move, with reduced safety margins for tight gaps, and move back to
  faster lanes once clear ahead.
- `src/traffic/sim.js`: rivals spawn exclusively on Route 1 fast lanes, 250 to 460 m from the player,
  balanced half ahead and half behind so vehicles pass the player, initialized at full cruising speed.
- Tests: `tests/traffic.test.mjs` verifies that over 3 minutes headless with traffic, racers maintain a
  mean speed above 190 km/h and top speed above 240 km/h.

## 0.4.9 (2026-10-03)

Real dashboards.

- `vehicles/cockpit.js` (new): the cockpit moves out of `models.js` and gets modeled instruments
  per car: hooded pods facing the driver, gauges with depth cans, chrome bezels, canvas faces and
  turning needles, a gear readout, a shift lamp and a warning lamp. The painted 2D cluster on the
  dash is gone (`drive.js` calls `cockpit.update`).
- `vehicles/dash.js` (new, pure): `DASHES` (Hayate with a boost pod, Rampart with two gauges only,
  Vespera without boost or exhaust, Tsurugi with a three-gauge center stack), `gaugeScale`,
  `needleAngle`.
- Steering wheel lowered and the cockpit camera tilted down so the cluster shows over the rim.
- Tests: `dash.test.mjs` (every car has its dash, the differences, no overlaps, tach range,
  needle sweep).

## 0.4.8 (2026-10-03)

Diagonal lane changes and civilian yielding.

- `src/traffic/sim.js`: lane changes replace exponential strafe decay with a smoothstep lateral
  move over duration scaled by road speed (2.5 s at 60 km/h to 4 s at 200 km/h). Yaw follows the
  actual motion vector (lane tangent plus lateral rate) so the nose steers into the new lane during
  the crossing and straightens upon completion.
- `src/traffic/sim.js`: comprehensive gap checks ahead and behind in the target lane prevent cutting
  off faster traffic; lane changes are blocked within 40 m of traffic lights, planned exits, or a
  player alongside.
- `src/traffic/sim.js`: civilians change lanes to pass slower traffic, yield to faster vehicles
  (racers or the player) closing from behind when the left lane is free, and position for planned exits.
- Tests: `tests/traffic.test.mjs` verifies lane change heading difference stays between 1 and 12 degrees
  with lateral speed under 3 m/s, and that a civilian yields to a faster car closing from behind within 3 s.

## 0.4.7 (2026-10-03)

The traffic is real vehicles too.

- `vehicles/bodies/civilians.js` (new, pure): sedan, hatchback, kei car, wagon, taxi with its roof
  sign, SUV, minivan, panel van, pickup with its bed, kei truck, box truck, tanker, city bus and
  semi, each lofted from a profile; trucks are a cab plus cargo with extra axles.
- `profile.js`: `bodyModel` builds a model from dimensions, a profile and details.
- `models.js`: a body can carry extra `axles` and a fixed `accent` color; `loft.js` only cuts
  arches that fall inside the body.

## 0.4.6 (2026-10-03)

Street racers drive real cars.

- `vehicles/bodies/profile.js` (new, pure): a body from a profile (nose, hood, deck and tail
  heights, cabin positions, roof, tapers) plus detail helpers.
- `vehicles/bodies/racers.js` (new, pure): twelve racer cars with their own shapes and details.
- `kinds.js`: `RIVALS` is the twelve racers plus the four player cars, sixteen kinds, each with a
  `model`; speeds raised to 1.8 to 2.7 times the limit.
- `models.js`: `vehicleGeometry` bakes a lofted car with wheels into one instancing geometry.
  `psx.js`: a `paint` option so the instance color only tints the paint. The traffic material is
  Phong now.
- `tools/bodies.html`: catalog of every racer and traffic kind.

## 0.4.5 (2026-10-03)

Blown engine idle: rough idle at 1,000 to 2,000 rpm in gear or neutral.

- `src/vehicles/thermal.js`: `LIMP_RPM` reduced from 3,500 to 2,000.
- `src/vehicles/physics.js`: when `s.blown`, engine rpm uses `freeRev` targeting a rough idle
  between 1,100 and 1,850 rpm (derived deterministically from vehicle state, not `Math.random`)
  and clamped to `LIMP_RPM` (2,000 rpm) in all gears. The wheels no longer drive the engine,
  slipping the clutch while limp torque (`LIMP_TORQUE`) continues to push the car. Shifting
  between gear 2, N and 1 keeps the same idle range without jumping.
- Tests: `tests/physics.test.mjs` verifies that after blowing the engine at 120 km/h in 2nd,
  rpm stays between 900 and 2,000 rpm for 5 s across gear 2, N and 1 while the car continues
  moving forward in gear.

## 0.4.4 (2026-10-03)

Rounder cars: the modeler upgrade.

- `vehicles/loft.js` (new, pure): monotone cubic station curves, wheel arches with 13 rings
  per axle, the 19-point ring with a crowned roof and Catmull-Rom side curves, the end bevel.
- `models.js`: `Kit` lofts from it (rings at most 26 cm apart), bevels the nose and tail, and
  `top` follows the crown (`roofY`). Bodies go from about 600 to about 1,900 triangles.
- `builder.js`: `smoothNormals` (crease-limited, area-weighted) and `buildWheel` (16 sides,
  tread shoulders, sidewall, rim lip, dished textured face).
- Tests: `loft.test.mjs` (no overshoot, ring symmetry and bands, ring spacing, arches, bevel).

## 0.4.3 (2026-10-03)

Tachometer scale fix: the tach never shows the blow rpm.

- `src/ui/cluster.js`: `maxRpmOf(spec)` is the redline plus 1,000, rounded up to the next
  1,000 (Hayate 9,000, Rampart 8,000, Vespera 10,000, Tsurugi 9,000).
- The blow rpm (`engine.blowRpm`, 11,000) stays in the logic but is never drawn on the dial.
- Replaced the two-part red and danger band with a single red band running from redline to
  the end of the scale, flashing on limiter or over-rev.
- The needle pins at the end stop (`TACH_END`) when rpm exceeds the scale, never wrapping.
- Tests: `tests/cluster.test.mjs` verifies scale bounds for all cars, absence of blow rpm
  numerals, and end-stop needle pinning.

## 0.4.2 (2026-10-03)

The fourth car.

- `specs.js`: TSURUGI GT-X, a 3.0 L twin-turbo straight-six grand tourer, rear-wheel drive,
  seven gears, bars 10 / 7 / 8. Bench: 0-100 4.37 s, quarter mile 11.78 s, 323 km/h, 34.2 m
  from 100, 1.43 g tarmac and 0.69 g gravel.
- `engine-dsp.js`: the `i6` voice (six even firings, turbo whistle, a little whine); the engine
  tests cover it for evenness, the whistle and damage.
- `models.js`: a provisional fastback body (`BODIES.tsurugi`), right-hand drive, four tailpipes
  (`TIPS` in `exhaust-fx.js`). It will be rebuilt with the new modeler.
- `tools/models.html` shows any number of cars.

## 0.4.1 (2026-10-03)

Street racers.

- `traffic/kinds.js`: ten racer kinds (`RIVALS`, ids `rv-*`) that want 1.5 to 2.6 times the
  limit; `ALL_KINDS` is what the renderer draws. `bodies.js` draws them as low, wide stand-ins
  with a wing and big wheels.
- `traffic/sim.js`: `spawnRival` (fast lanes of Route 1 only, out of sight), `countRivals`,
  `nearestRival`, a `rivals` option (default 5) kept apart from the traffic target. Racers stay on
  the loop, change lanes earlier and pick the most open neighbouring lane (`openAhead`).
- `Drive` shows the nearest rival within 220 m as a prompt.
- Tests: 102 passing (racers cruise far above the limit, stay on Route 1 and are replaced;
  nearest rival distance and side).

## 0.4.0 (2026-10-03)

Traffic.

- `traffic/net.js`: the road network as 80 directed lanes with keep-left offsets, links for
  continuing roads, exits, entries and turns, and traffic lights at the 99 city crossings.
  Ramps carry `link` data (the arc lengths on the roads they join) from `roadgen.diamond`.
  Arterials are four lanes now (two each way).
- `traffic/sim.js`: about 38 agents with IDM following, red lights, bends, overtaking,
  chance exits and turns, spawn out of sight and despawn behind, wrecks.
- `traffic/kinds.js`, `bodies.js`, `render.js`: fourteen kinds drawn as boxy stand-ins, one
  InstancedMesh per kind with paint tint, lit like the player's car, head and tail lights
  with brake boost (`psx.js` gets a `lamp` option).
- `vehicles/contact.js`: car against car, used when the player hits traffic.
- `Drive` runs the traffic each frame, collides it with the player (camera shake and an
  impact sound) and fills the roads when a drive starts.
- Verified: headless runs of the network and the sim in three places, a lit downtown street
  and Route 1 in the browser.
- Tests: 100 passing (`traffic.test.mjs`: lanes, connectivity, lane geometry, lights, the sim over
  two minutes in three places, a red light, a collision, momentum).

## 0.3.3 (2026-10-03)

Route 1 gets its furniture, and the toll plazas work.

- `highway.js`: a concrete median barrier along the whole loop, steel guard rails on both
  outer edges, and three toll plazas. Rails and barrier leave gaps at ramps, forecourts and
  plazas. Every piece has a collider with a height range, so cars on the overpasses are not
  stopped by what is below them.
- `build-highway.js`: barrier and rail in 180 m chunks that are culled with the road; the
  plaza canopy, columns, islands, booths with lit windows, lane lights, barrier arms and a
  name board.
- `toll.js`: `TollMeter` detects the crossing, reads the speed and keeps the best per plaza.
  `Drive` charges the 700 yen toll, saves `tollBest`, and shows the speed trap result.
- Lane markings: expressway carriageways draw lane lines and tire bands; ramps draw edge lines only.
- Nothing grows or stands under an overpass deck (`clearOfRoads` now looks for decks).
- Verified by driving a Hayate through KITA TOLL at 161 km/h: 700 yen charged, toast shown, no collision.
- Tests: 92 passing (`toll.test.mjs`: crossing, cooldown, saved best, lanes, barrier and booth colliders).

## 0.3.2 (2026-10-03)

Kurogane replaces the Kirigaoka valley.

- A new 6 km map (`layout.js`, `heightfield.js`, `zones.js`, `roadgen.js`, `mapdata.js`):
  Route 1, a 11 km expressway loop of two 3-lane one-way carriageways with a median;
  four avenues that pass over it on overpasses with diamond interchanges; Kuro Pass
  (6.4 km, up to 254 m on a terrain ledge); a 20 street downtown grid with towers; the
  forest valley with Kami-ike; a bay in the south; four gas stations; three toll plaza
  positions; 70 km of road.
- Roads: twin carriageways share one height profile, closed roads obey the grade limit
  across the seam, junction blending spreads a correction over enough road to stay
  climbable and blends neighbouring junctions into each other.
- Terrain carving: a lifted road shapes the ground only where it is cut into it.
- Scatter: median lamps along the loop, lamp runs for a full road, no poles on decks, bigger
  and taller downtown buildings, trees by zone (forest outside the loop, farmland inside),
  buildings indexed in a grid (tree scatter went from 8.3 s to 0.6 s), nothing planted in the sea.
- Render: terrain and road ribbons in chunks hidden past the fog, a bay, the camera far plane.
- `buildMapData(ground)` for a full-screen map (roads, pois, zones).
- Tools: `tools/mapview.html` (top-down map with hillshade, `__map.shot()`) and
  `tools/mapcheck.mjs` (road numbers and crossings).
- Tests: 87 passing (new `layout.test.mjs`: roads inside the map, Route 1 closed with equal
  carriageway heights, interchange ramps, roads cross only at overpasses, tolls, zones,
  terrain, map data).

## 0.3.1 (2026-10-03)

Full-screen tactical map overlay, controls update, render height setting, and dynamic garage scaling.

- Tactical map overlay (Task A2): Tab key opens and closes a full-screen tactical map of the whole world, pausing simulation while continuing to render the 3D scene behind a translucent dark veil.
- Road hierarchy and POIs: cached offscreen road rendering sharing `drawRoads` with the minimap (thick white expressway, rally trails, mountain passes, arterials, and ramps). Displays gas stations with brand badges, rally start checkered flag, Kirigaoka valley zone names, north compass, adaptive scale bar, and vehicle arrow with live heading, model name, speed, and gear telemetry.
- Navigation controls: map supports click-drag and WASD/arrow panning, mouse wheel and +/- zooming, and Home recentering on the player vehicle.
- Keybinding conflicts resolved: interact key moved from E to F (`KEYS.interact = ['KeyF']` and `INTERACT_KEY = 'F'` in `src/drive.js`). Manual shift keys unified: shift up (`ShiftLeft`, `ShiftRight`, `KeyE`), shift down (`ControlLeft`, `ControlRight`, `KeyQ`). Map bound to Tab and gamepad Back / Select.
- Controls briefing screen updated with R, N, 1..7 manual gear order, Tab tactical map, F refuel & repair, C camera views (5 views), and R reset.
- Render height setting: added display scanline selector (240, 360, 480 lines) persisted under `store.get('renderHeight', 240)` and applied to stage configuration.
- Dynamic garage scaling (Task A6): garage card and selector handle any number of cars in `CARS` with left/right wrapping and responsive card sizing. Displays drivetrain layout, gear count (`${spec.gears.length}-SPEED`), and live transmission mode (`AUTO` / `MANUAL`). Clamps bar values cleanly to 10 segments.
- Unit tests: added `tests/map.test.mjs` (road hierarchy, POIs, and fallback data extraction) and `tests/garage.test.mjs` (spec metrics, 3-car and 5-car wrapping).

## 0.3.0 (2026-10-03)

Overpasses: roads can leave the ground.

- `lifts` on a road def raise it over the road it crosses (flat top, cosine ease), applied
  after junction blending. Above 2 m a road is a deck.
- `Ground.at(x, z, y)` and `RoadNetwork.query(..., y)` return a deck only to something at
  or above its surface. The physics passes the car's own height, so a car can drive over
  and under the same spot. Without `y` you get the ground, so props, trees and the terrain
  carve ignore decks.
- Collision shapes get `y0`/`y1` height ranges: deck parapets and piers no longer stop the
  traffic on the other level.
- `build-bridges.js`: slab sides that reach down to the ground on embankments, an underside,
  parapets and piers. `scatter.bridges` lists them with their wall and pier colliders.
- `roadgen.js`: helpers for the new map (offset paths, dual carriageways, street grids and
  ramps), in use from the next version.
- Verified in the browser with a temporary overpass on Route 7: the car climbs onto the
  deck, drives over a road it passes under, and comes back down.
- Tests: 74 passing (new `bridge.test.mjs`: lift profile, layered queries, terrain
  carve, a car under and over, collider heights).

## 0.2.4 (2026-10-03)

Dashboard repair, bold 240p cockpit cluster, and gauge contract implementation.

- Mirrored gauge fix: corrected gauge quad texture mapping in `src/vehicles/models.js` so
  driver's left (+X) maps to u=0 and driver's right (-X) maps to u=1. Verified with a test
  canvas showing un-mirrored text with red on driver's left and blue on driver's right.
- Sightline clearing: lowered binnacle hood to rise at most 4 cm above dash top (`beltY + 0.04`),
  recessed face low (`beltY - 0.19`) and tilted toward eye, framed cleanly through the steering wheel.
- Compact rearview mirror (14 by 3.5 cm) tucked high against roof header out of forward sightline.
- Cabin sealing: sealed binnacle side cheeks, dash front face, firewall, and floor pan with DoubleSide
  materials and zero see-through gaps.
- 240p bold cockpit layout: `drawCluster` in `src/ui/cluster.js` supports high-contrast interior layout
  with fat needle (`lineWidth: 7`), bold numerals (>= 22px), tick marks only every 1000 rpm, bold
  speed digits (50px), and enlarged gear box (34px). Fixed aspect ratio scaling to uniformly preserve
  circle geometry (`Math.min(w/W, h/H)`).
- Gauge contract: WATER dial renamed to TEMP (red over 110 C, HOT lamp from 115 C). Tachometer scale runs
  to 11,000 rpm for all cars with normal red band and darker danger band. Added warning lamps: CHECK ENGINE
  (flashing when blown), DMG (steady when damage > 0.3), OVERREV (flashing when overrev > 0). Gear box displays
  R, N, and forward gears 1..7.
- Tests: added pure unit tests in `tests/cluster.test.mjs` verifying gauge contract, tach scale, and HUD/cockpit layouts.

## 0.2.3 (2026-10-03)

Aero grip and the car camera.

- `spec.aero = { front, rear }`: downforce in N per (m/s)^2, added to each axle's load on
  hard surfaces only (gravel numbers are untouched). Vespera 0.5 and 0.9, Hayate 0.15 and
  0.45, Rampart 0.05 and 0.15. Tarmac grip: 1.35, 1.20 and 1.46 g at the bench speed.
- New `car` view next to `chase`: the standard near view from behind. The camera choice is
  saved by name (`cameraView`) so reordering views never changes a saved choice.
- Tests: 67 passing from the physics, engine, exhaust and gauge suites.

## 0.2.1 (2026-10-03)

Exhaust flames, sparks, smoke and a damaged-engine sound.

- `exhaust.js` (pure) turns the physics state into flame, sparks, smoke and pop events:
  a flame on a shift at high revs, lift-off crackle, constant sparks and crackle while
  over-revving, a smoke puff then dense smoke once the engine is blown.
- `exhaust-fx.js` draws them at each car's pipe tips: additive flame fins on the body, pooled
  spark and smoke particles in world space.
- Engine voice: `damage` (misfires, knock, rattle, less power), `overrev` (rasp) and a `blow`
  event (bang, clank, stumble) in the worklet and the DSP. Exhaust pops now come from the
  physics events. Verified live: the graph takes the new parameters and reacts to a money shift.
- Limp mode could not pull away in first gear (the clutch floor sat above the rpm cap);
  fixed and tested for every car.
- `tools/render-engines.mjs` also writes `engine-<car>-moneyshift.wav`.
- Tests: 66 passing.

## 0.2.0 (2026-10-03)

Driving model: rpm from the driven wheels, a real gearbox, heat, the money shift, tarmac grip.

- Engine rpm now comes from a driven-wheel speed state (`s.slip`), not from the car's
  forward speed. A loose or over-powered launch revs to the limiter, the needle no longer
  sits on a constant number, and a car spinning or sliding sideways keeps its rpm. The
  speedometer shows the speed of travel. The clutch slips in first and reverse so the
  launch rpm climbs with speed. Auto shifts on road speed.
- Gearbox R, N, 1 to n at any speed, nothing refused. Hayate 5, Rampart 5, Vespera 6
  gears. Manual W is always throttle and S always brake.
- `thermal.js`: temperature (renamed from water) is real and derates power from 108 C
  to 70 % at 120 C; exhaust temperature; over-rev damage; money shift above 11,000 rpm
  blows the engine, pegs temp and exh, leaves a limp mode (quarter torque, 3,500 rpm
  cap). Repair at a pump (hold interact) or by tow. Toasts for a blown or hot engine.
- Tarmac grip raised (1.0 to 1.28 on asphalt) and brakes strengthened; gravel unchanged.
  Bench: Hayate 1.34 g, Rampart 1.20 g, Vespera 1.41 g on tarmac; 100 to 0 in 35, 37
  and 32 m.
- Gauges mirror the physics and gain `gears`, `overrev`, `damage`, `blown`. `water` stays
  as a deprecated alias of `temp`.
- Tests: 59 passing.

## 0.1.10 (2026-10-03)

Task briefs for Antigravity, ahead of the 0.2 to 0.5 work.

- `docs/agents/tasks/`: A1 dashboard repair (mirrored image, hood blocking the view,
  unreadable at 240p, the new gauge contract), A2 Tab map and controls (interact moves to
  F), A6 garage for any number of cars, A3 and A4 vehicle bodies for rivals, traffic,
  vans, trucks and a bus, A5 buildings and street furniture.
- Plan ahead: 0.2.x driving model (rpm from a driven-wheel state, R N 1..7 gearbox,
  temperature, money shift and limp mode, exhaust flames, tarmac grip, near chase view),
  0.3.x a 6 km map with a city, an expressway with toll plazas, a mountain pass and a
  forest section, 0.4.x traffic and rivals, 0.5.x quality pass.

## 0.1.9 (2026-10-02)

Cockpit overhaul, manual transmission, arcade main menu and settings.

- Cockpit interior fixes: exterior materials and cabin panels set to DoubleSide
  so the hood and pillars are solid from the driver's POV rather than backface-culled.
  Sealed dash-to-windshield gap by extending the dash to the cowl line, and added cabin
  firewall and floor pan to eliminate ground light leaks.
- Unified gauge cluster: refactored Cluster.draw in src/ui/cluster.js into shared
  drawCluster function used by both the 3rd person HUD and the cockpit binnacle texture
  (420 by 300), deleting the separate drawDash. The hooded binnacle is raised on top
  of the dashboard with full visibility of the round tachometer, sweeping needle,
  shift indicator LEDs, speedometer, gear readout box, and satellite dials.
- Sequential manual transmission: added manual gearbox mode with sequential shifting
  (shiftUp, shiftDown). Supports keyboard (Shift/Ctrl and E/Q) and gamepad bumpers (RB/LB).
  Engine rev limiter cuts ignition and bounces at redline without automatic upshifting.
  Over-rev downshifts that exceed engine redline are electronically refused.
- Ace Combat and Japanese arcade styled menus:
  - mainMenuScreen with tactical wireframe framing, telemetry readout card, and sound chirps.
  - settingsScreen with transmission toggle (Auto vs Manual) and audio controls for all
    five channels (Master, Engine, Effects, Ambience, Music) with volume steps and mutes,
    bound to the audio DSP API and persisted to localStorage.
  - controlsScreen briefing with keyboard and gamepad bindings.
  - Updated pauseScreen with access to settings and main menu.
- Tests: 47 passing (including manual shift hold at redline and over-rev rejection).

## 0.1.8 (2026-10-02)

Music.

- `src/audio/songs.js` (pure): four tracks composed from chord progressions, with pad,
  bass, arpeggio, lead and drum patterns. Deterministic, in key, melodies that move by
  step and end on a chord tone. Tests.
- `src/audio/music.js`: the synthesizer and player. Look-ahead scheduling, kick-driven
  ducking, echo and reverb, layers that build with speed, a menu track for the title and
  garage, seamless rotation of the two driving tracks, and `hold` for the rally track.
- `audio.js` hooks the player into the mode and per-frame update. `tools/audio-lab.html`
  renders tracks offline with a speed ramp for measuring and listening.

## 0.1.7 (2026-10-02)

Vehicle sound and ambience.

- `src/audio/engine-dsp.js` (pure) and `engine-worklet.js`: a per-sample engine
  synthesizer in an AudioWorklet. Three voices from the three cars: the Hayate's flat-four
  burble with turbo whistle and blow-off, the Rampart's lumpy V8 with pops, the
  Vespera's even V12 with gear whine. Rev limiter, shift dips and decel crackle.
- `src/audio/audio.js`: the `audio` singleton with five channels (master, engine,
  effects, ambience, music), each with a volume and an on switch saved to localStorage,
  and a small API for a settings menu. Tire squeal, gravel, road, wind, impacts, pump,
  per-camera muffling, menu chirps, countdown beeps.
- Ambience from the new `src/audio/env.js`: crickets, wind in the trees by forest
  density, lake, town hum, forecourt hum.
- Hooks in `main.js` (unlock on first input, mode per screen, the garage idles the chosen
  engine) and `drive.js` (car, impacts, pump, per-frame update).
- `tools/render-engines.mjs`, `tools/audio-lab.html`, and `POST /__file` on the dev
  server. Tests for the engine spectrum and the environment map.

## 0.1.6 (2026-10-02)

Trees and the edge forest.

- `src/world/forest.js` (pure): nine species in habitats with noise stands, 18 groves on
  the valley floor, a dense belt forest along the map edge and a thicket of two
  staggered rows of big trees with overlapping colliders that no car fits between.
- `src/world/build-trees.js`: spruce, broadleaf, sugi, birch, maple, black pine,
  bamboo, shrub and snag geometries; maple tints red, orange or gold per instance.
  Tree code moved out of `props.js`.
- About 48k trees (was 25k) in 250 m chunks; world build time is unchanged at about
  0.75 s.
- `tools/trees.html` species viewer. Tests for the species mix, trees off roads, and a
  flood fill that proves the belt cannot be crossed.

## 0.1.5 (2026-10-02)

Arcade gauge cluster.

- `src/vehicles/gauges.js` (pure): coolant temperature, turbo boost with spool lag and
  blow-off on shifts (Hayate), manifold vacuum (Rampart, Vespera), exhaust gas
  temperature, shift light. `engine.turbo` in the Hayate spec. Tests.
- `src/ui/cluster.js`: canvas cluster in the bottom right with a round tach, red zone,
  shift lights, digital speed and gear, and FUEL, WATER, BOOST or VAC, EXH dials, set
  in Michroma. `drawDash` paints the same readings onto the cockpit binnacle.
- The cockpit binnacle sits higher, in the upper opening of the steering wheel. The
  interim digital readout is gone.

## 0.1.4 (2026-10-02)

Driving.

- `src/drive.js`: free roam in the valley with a fixed 120 Hz step and interpolated
  drawing, refueling at the pumps, tows when the tank runs dry, R back onto the nearest
  road, a lake guard, area names and money that persists.
- `src/world/collision.js` (pure): circles and oriented boxes in a grid, the car as
  three circles, contact impulses that turn the car on a glancing hit. Tests.
- `src/vehicles/car.js`: physics state, model, two spot headlights, cockpit, pose.
- `src/render/cameras.js`: chase, hood, bumper and cockpit cameras.
- `buildCockpit` in models.js: dash, binnacle, gauge face, turning steering wheel,
  pillars, header, liner, door panels, mirror, console and passenger seat.
- `src/core/input.js`: driving axes with keyboard ramps, gamepad triggers and stick,
  camera, reset, refuel and pause actions.
- `src/ui/hud.js`, `src/ui/minimap.js`, pause menu in `src/ui/menus.js`.

## 0.1.3 (2026-10-02)

World meshes.

- `src/world/scatter.js` (pure): street lamps from the road `lamps` runs, about 25k
  trees on a jittered grid, town buildings along the streets (two konbini, neon signs),
  gas station furniture, about 170 baked light sources and the collider lists.
- Builders: chunked terrain with per-surface vertex colors and the same diagonal as
  `Heightfield.at`; road ribbons with skirts and painted lines; forecourt pads with
  curbs; lamps; instanced tree chunks; town with lit windows; three gas stations with
  canopies, pumps, kiosks and brand signs; the service park with tents, floodlights and
  two parked rival cars; the lake; a sky dome with stars and the moon.
- `src/render/bake.js`: light grid, per-vertex bake and a light sampler for moving
  objects. `psx.js` materials take `local: true` for the sampled light; cars use it.
- Garage Enter now builds the world (about 0.75 s) and opens a free camera at G1.
- Tests for lamp, tree, building and pump placement (14 tests).

## 0.1.2 (2026-10-02)

Title screen and garage.

- `index.html`, `style.css` and `src/main.js`: the first playable page. Boot, a
  title, garage state machine and `window.__lowbeam` for browser checks.
- `src/ui/garage.js`: showroom with a turntable, spot and rim lights and neon strips.
  The card shows maker, name, class, blurb, the three bars as ten-segment meters,
  layout, engine, gearbox, weight and four paint swatches. Keyboard, gamepad and mouse.
- `src/core/input.js` (keyboard and gamepad menu actions), `src/core/store.js`
  (localStorage), `src/ui/menus.js` (title, loading, toast).
- Michroma (SIL OFL) vendored in `assets/fonts/` with its license. The CSS stack
  prefers an installed Microgramma or Eurostile Extended.
- `stage.shot()` re-renders the last drawn scene instead of the default one.

## 0.1.1 (2026-10-02)

Car models.

- `src/vehicles/models.js`: loft modeler that builds each body from cross sections,
  cuts wheel arches with extra stations at each axle and flares the fenders. Part
  helpers place lamps, grilles, plates, scoops, wings, stripes, louvers and intakes on
  the body surface. `CarModel` adds wheels (steer and spin), a blob shadow, paint
  swaps, brake lights and body lean.
- Hayate RS-4: boxy sedan, hood scoop, big wing, mudflaps, gold six-spoke rims.
  Rampart 440: long hood, fastback, hood scoop, twin stripes, ducktail, chrome
  bumpers. Vespera GT: wedge nose, cab-forward glass, engine louvers, side intakes,
  carbon sills, wing, quad exhausts.
- `src/render/textures.js`: canvas-drawn glass, rim, plate and shadow textures.
  `psxPhong` in `src/render/psx.js` for paint, glass and chrome.
- `tools/models.html`: dev viewer for the models.

## 0.1.0 (2026-10-02)

First commit. Plan, scaffold and the pure core.

- `docs/DESIGN.md`: the plan for the night rally milestone, including the arcade gauge
  cluster, the cockpit camera and the long-term open-world direction.
- Scaffold: vendored Three.js r185, import-map setup, `tools/devserver.mjs` with canvas
  capture, `tsc` type-checking, `node --test`.
- World: seeded valley terrain, spline roads with smoothed and grade-clamped profiles,
  junction blending, carved heightfield, three gas station pads, `Ground.at`.
- Vehicles: three car specs and a 120 Hz bicycle-model physics with load transfer,
  traction control, automatic gearbox, reverse, jumps and fuel. Tuned so the garage
  bars match the sim.
- Render plumbing (not yet run): low-res target with dither and 15-bit quantize,
  PSX materials with vertex snapping and baked light, `MeshBuilder`.
- `tools/sim.mjs` tuning bench. 11 tests.
