# B5: Police dispatch, stakeouts and racer chases (Hermes, DeepSeek V4.1 Flash, from 2026-10-17)

Part 1 is committed on `hermes/b5` (0.10.70) and part 2's director logic and tests are written,
uncommitted, in `C:\GitHub\Lowbeam-hermes`; the branch is 33 commits behind `main` and must be
rebased first (`tasks/README.md`, "Working in your worktree"). Part 2 is the trial: one commit, the
overseer's review, then part 3. The HUD and the minimap stay CCC's.

Jc's list (2026-10-09): the police stations dispatch the police; when the pursuit runs low there is a
minute's wait, with one car still on the player, before the nearest station sends more; undercover cars
that wait hidden; and a heat system for the street racers too, so a chase of an NPC racer can climb to
heat 5 with three helicopters like the player's.

Read `src/police/director.js` (`PoliceDirector`, `backup`, `ASSIGNED_BY_HEAT`, the `reinforcedLow` rule),
`src/police/units.js` (`roster`, `helisFor`), `src/police/heat.js`, `src/traffic/sim.js` (`TAIL`,
`stepTail`, `spawnUnit`, `chasedBy`) and `drive.js` (`orders.spawn`, `setHelis`) first. After B3 and B4.

## 1. Stations dispatch

- Today a unit is put on a lane 150 to 420 m from the player (`spawnUnit(player, kind, 150, 420, 900)`),
  out of nowhere. Make it come from a station: the nearest police lot (`LOTS` with `kind: 'police'`; there
  are 3 now and C6 adds one per district) to the player at the moment of the call. The unit appears in one
  of the station's marked bays (`lotBays(pad)` in `src/world/lots.js`, Claude's, 0.10.24: three at a
  district station, five at the HQ, each `{ x, y, z, yaw }` with the nose to the street; the pads are
  `world.ground.lots`, one per `LOTS` entry with `kind: 'police'`) with its lights on, and drives out to the road and to the player by
  the shortest route, as a unit does now. A bay that is occupied is skipped; with none free the call
  waits a second.
- A station has a stock (HQ 12 cars, a district station 6) that falls as it dispatches and refills one
  car a minute while it is idle. A station out of stock does not dispatch: the next nearest does.
- A unit that goes home (`release`) drives back to the nearest station and is put away there, instead of
  leaving once out of sight, and its car returns to that station's stock.
- Units already on the road (patrols, tails) are not part of a station's stock.
- Tests (pure, `src/police/` plus the island): the nearest station is chosen, a bay is free or the call
  waits, a station's stock falls and refills, a returning unit is stocked.

## 2. Running low: one minute, one car left

- The pursuit's pool and units: when the cars on the scene fall to 2 or fewer and the pool is under 5 the
  director today adds 25 % of the heat's pool at once (REINFORCEMENTS). Replace that with a wait.
- When the pool runs low while the chase goes on, a resupply timer of 60 s starts (`RESUPPLY_TIME`, 60).
  The banner says REINFORCEMENTS IN 1:00 and the pursuit HUD shows the countdown (Claude draws it from
  `pursuitView().resupply` seconds left, null otherwise: add the field). Also add `pursuitView().seen`,
  the kinds and `'heli'` that have been in the player's sight in this pursuit (the exact rule is in
  `C7-pursuit-hud-v2.md`, "What waits for the backend"); the HUD fades each icon in on it. And `pursuitView().heliFuel`: 'low' while any helicopter has under
  15 s of fuel, 'leaving' once it has broken off to refuel, null otherwise (the HUD pops a yellow pump
  beside the helicopter icon and turns it red). Jc: there is always one cop car on the player unless the
  player physically cannot be chased; this is the last-unit rule above.
- One car stays on the player while it runs. If the units are heavily exhausted (the pool at zero and the
  cars lost, wrecked or out of the chase), the last unit on the scene is not recalled, is not counted
  out of the chase by the pool, keeps trying to chase the player, and drives as hard as its hit points
  allow. If it is destroyed, the road stays empty until the timer ends (no spawns, no patrols pulled into
  the chase; the helicopters, if any, stay).
- At 0:00 the nearest station to the player at that moment dispatches 25 % of the heat's baseline pool
  (as today), one car every `BACKUP_EVERY`, from its bays as in part 1, and the pool is refilled by that
  count. The banner says REINFORCEMENTS and the station's name (`DISPATCHED FROM KITAMACHI POLICE`).
- The timer does not restart while it runs, and does not start again until the new cars have been on the
  scene. It stops (and the pool is not refilled) if the chase ends. A pursuit at heat 5 resupplies the same
  way.
- Tests: the timer starts at the low point and runs 60 s, a last car is never recalled while the timer
  runs, an empty road stays empty until it ends and then the nearest station sends the cars, a chase that
  ends stops the timer.

## 3. Undercover cars that wait

- Hidden unmarked cars (`police-fast`, the unmarked unit) parked at stakeout spots, lights off, engine
  off, not on the minimap, with a driver who is watching. Claude places the spots (`world/stakeouts.js`,
  pure, with C6: about 16: lay-bys on Route 1 and the avenues, a side street mouth on a main road, a
  coin car park, beside a toll plaza, the foot of Kuro Pass; each a position, a yaw facing the road, and
  the road it watches) and the list is in `drive.js` through the world.
- The backend: `TrafficSim` keeps one parked unit at each spot near the player (spawned within 500 m,
  put away beyond 700 m), mode `parked` with a new `stakeout` flag. It watches the road: a car on that
  road within 60 m with a clear line (`sight.js`) moving more than 1.4 times the limit (the same test as a
  patrol's `noticesSpeeding`) fills the detection bar twice as fast. A racer is noticed the same way and
  taken up as a tail (part 4). The player is noticed the same way and the unit pulls out, lights and
  siren on, and starts a pursuit at heat 1 through the director (the same `start` as a patrol's notice),
  with its marker appearing on the minimap from that moment.
- A stakeout car that has been seen (the player passes slowly within 15 m with its lights off) stays put:
  the player has to be speeding to wake it. Smart play (slow past, or take another road) avoids it.
- Tests: a stakeout wakes for a speeder and not for a car at the limit, a racer is taken up, it is not on
  the minimap list until it is awake, it is put away when far.
- The spots are done (Claude, 0.10.20): `world.stakeouts`, eighteen of `{ id, kind, name, x, y, z, yaw,
  roads }` (`kind` one of `layby`, `route1`, `toll`, `mouth`, `pass`; `roads` are the ids to match with
  `a.lane.road.id`: Route 1's spots list both carriageways, `c1-f` and `c1-r`). `yaw` points the nose
  toward the road. Read them in `Drive` from `world.stakeouts` and give `TrafficSim` the list; spawn a
  unit with `spawnParked('police-fast', spot, lane, s)` where `lane` is `net.lanesAt(x, z, y, 16)[0]`
  (the spot is a few meters off the lane, so pass a reach). Spawn them only while the player is within
  500 m: the sim removes an agent farther than `KEEP` from the player.
- What the game shows when one is parked (checked in the browser): the car glows. `stepParked` sets
  `brake = 1`, so its tail lamps burn, and the nearest cars wear headlamp flares. A hidden car must be
  dark: give the agent `stakeout: true`, keep `brake` at 0 for it (`stepParked` must not set it), and
  Claude will make `traffic/render.js` skip the lamp flares and beams for a `stakeout` agent until it
  wakes (tell me the flag's name when it exists; the lamp change is one commit of mine).

## 4. A heat for the racers

- Jc (2026-10-10): each racer has a heat of its own, so the police come for it in different strengths.
  Every racer carries a notoriety from 1 to 5 (the five on Route 1 spread over the levels, the fastest
  kinds highest), which is the heat its pursuit starts at; from there it builds the way the player's does,
  and at each level the swarm is the player's at that level (the roster, the pool, roadblocks, spikes, one
  to three helicopters). A racer that escapes keeps its heat and cools as the player's does.
- Racers (the NPC street racers on Route 1) get the player's pursuit as a whole: a `Pursuit` and a
  `Heat` per chased target, run by the director (or a sibling `RacerPursuit` using the same pieces, your
  call). The police tail of a racer (`TAIL`) becomes heat 1 of a racer pursuit. One racer pursuit at a
  time, and it never runs while the player is chased (the player's takes precedence, as the tail does).
- Heat climbs as the player's: a level per 90 s of chase and per infraction (the racer's speeding past a
  patrol, hitting a unit or a civilian, a wreck beside it), to 5. At each heat the same roster, pool and
  helicopters as the player's (`roster`, `ASSIGNED_BY_HEAT`, `helisFor`: one at heat 3, two at 4, three
  at 5), roadblocks ahead on the racer's lane route (the planner takes a route rather than the player's
  heading), spike strips from heat 4.
- The racer flees harder as the heat climbs (`TAIL.flee` 1.15 now: 1.1 at heat 1 to 1.3 at heat 5), takes
  exits and weaves traffic, and ends one of three ways: it escapes (out of sight of every unit and
  helicopter for 25 s, the pool released), it is busted (stopped, hemmed by a unit within 12 m for 3 s:
  it parks, hazards on, and the units stand down), or it is wrecked (a destroyed racer's heat is gone). The
  player sees a banner for each (`RACER BUSTED`, `RACER GOT AWAY`), and the racer's tail counts for the
  `rapSheet` of nothing: it is the world's business.
- The player joining in: a unit that sees the player ramming or blocking police during a racer chase (the
  player's `hitPolice`, speeding with a unit near) turns on the player: the racer's pursuit ends and the
  player's begins at the heat the racer's had reached (capped at 3).
- Claude's parts: a small HUD line in the drive screen while a racer chase is within 600 m (RACER CHASE
  and its heat marks, from `pursuitView().racer`: `{ heat, units, helis }` or null), its units' marks on
  the minimap, and the helicopters' banners. Add the field to the view and say so in the report.
- Tests: a racer chase climbs from heat 1 to 5 over infractions and time, five helicopters are never
  asked for (three at heat 5), the pools are the player's, a racer's escape, bust and wreck end it, the
  player's pursuit wins over a racer's, a chased player takes over.

## Order and versions

Parts 1 and 2 first (one commit each), then 3, then 4 (two commits: the racer pursuit, then its
roadblocks and helicopters). Versions from the backend range; stop for Claude's review after part 2 and
after part 4. The stakeout spots (`world/stakeouts.js`) are Claude's, in C6 step 1.

## Report

After each part: the commit hash, what changed, test counts, the numbers measured (a dispatch from a
station to the player: time and distance; a full resupply: cars and seconds), and what you need from
Claude's files (the spots list, the HUD fields, the stations' bay positions).
