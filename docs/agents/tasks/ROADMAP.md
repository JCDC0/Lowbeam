# Roadmap: everything planned and not built yet

Written 2026-10-14 at 0.10.41 for a new session and for Jc. It gathers in one place what the briefs,
the bug board and Jc's notes plan and the game does not do yet, in the order Jc set: the game clean
first, then the features already planned, then the new main objectives (races, a career, car
upgrades), then shipping. Each line points to the brief that holds the detail; the brief wins where
they differ. `ARCHITECTURE.md` says what is true now, `BUGS.md` is the live bug list.

## Where things stand (2026-10-14)

- Last commits: 0.10.38 to 0.10.41 (Claude): outside CC0 models for fourteen traffic kinds (Kenney's
  Car Kit and rgsdev's pack, `tools/import-glb.mjs` and `tools/fbx.mjs`, no Blender), whole tail lamps
  on the traffic, four new kinds (ambulance, fire engine, garbage truck, limousine), the player's and
  the racers' tail lamps lit from dusk to dawn and in rain with light trails at speed, and two bench
  findings on the board (T-05, T-06). 510 tests, type check clean.
- The backend (agy, Gemini 3.8 Flash in Antigravity) is back with a prompt Claude wrote on 2026-10-13
  (review Claude's edits to its files, T-05, T-06, D-01); Jc sends it. Its versions go on from 0.9.41.
- Hermes is off. His B5 work and his C8 code sit on branch `hermes/b5` in `C:\GitHub\Lowbeam-hermes`
  (shelved after a broken merge, 0.10.32); B5 restarts from `main`, reading that branch for ideas.
- Port 8040 is the agents' shared tree, 8041 Jc's (only on Jc's word). Nothing is pushed: `origin/main`
  is at 0.4.4.

## 1. The bug-bash (now; `BUGS.md`)

Jc's rule (2026-10-10): every bug and rough edge cleared and the six gates holding before the main
objectives start. A feature already half built (B5) goes on alongside.

Open lines and their owners (detail in `BUGS.md`):

| ID | What | Owner |
|---|---|---|
| R-01 | Roads clip through each other at some merges and junctions (seams, overlaps, z-fighting) | Claude |
| R-02 | Floor symbols: lane arrows, stop words (止まれ), merge and exit marks, bus and speed marks | Claude |
| R-03 | Zebras at odd angles across turning lanes under the Kurogane Line | Claude |
| R-04 | Side streets jog where they meet the Sotokan ring | Claude |
| P-02 | 424 ways into a crossing without their own signal pole (a near-side pole or a longer arm) | Claude |
| T-01 | 97 civilian stalls, all geometry: toll dividers on `c1-r`, Ginza portal pier legs, a pole at node 82, the `c3-ramp` rails | Claude |
| T-04 | Junction turns: 8 that clip the Kurogane Line's legs (nodes 66, 67, 75), 18 that leave the patch (ten junctions) | Claude |
| T-05 | 2 world-caused wrecks in the clipping bench | Backend |
| T-06 | A 16 m semi off the carriageway on `c3-ramp-ex` | Backend first |
| D-01 | The barrier faults: a test per item, then the guide's line | Backend, then Claude |
| T-03 | Stakeout cars would glow (waits on B5 part 3) | Backend and Claude |
| H-01 | The pursuit HUD's timer, seen fade and fuel pump have no data until B5 part 2 | Hermes or Backend, then Claude |
| H-02 | HUD changes checked against Jc's drawing on a mock page before each commit | Claude (process) |
| M-01 | Cars' mirrors broken: needs Jc's screenshot of which car and view | Claude |
| M-02 | Two traffic kinds still on hand-made bodies (kei truck, tanker; no CC0 source found) | Claude |
| W-01 | The steepest streets climb 12.6 % (Minatomachi, Shinmachi) | Claude |
| X-02 | Frame rate on a real gaming desktop: needs Jc's F3 numbers on 8041 | Jc, then Claude |

The gates still to build as tools (`BUGS.md`, "The gates"): `tools/propaudit.mjs` (no prop on a
carriageway, deck or junction, gate 2), a road seam audit (gate 3), a screenshot tour of fixed camera
spots that Jc passes (gate 4), a HUD mock page beside Jc's drawing (gate 5), and the prop viewer's
check at 0 problems for every model in the game (gate 6: today the Kenney and rgsdev trucks are over
the 2,000 triangle budget).

## 2. Features already planned (briefs written, after the bug-bash unless marked)

**Police and pursuit**
- B5, the police dispatch (backend, with Claude's HUD): stations dispatch the units (part 1); running
  low, one minute with one car left before the nearest station sends more, the reinforcement clock
  (part 2, which also feeds H-01); undercover cars waiting at the eighteen stakeout spots (part 3); a
  heat for the street racers, each with a notoriety 1 to 5 and the player's swarm at its level, up to
  three helicopters, the player drawn in when they ram police (part 4). Half built, so it goes on
  during the bug-bash. Claude's parts: the RACER CHASE line, its marks on the minimap, its banners.
- G1, the pursuit breakers: a scaffold tower standing and fallen (`breaker_scaffold`,
  `breaker_scaffold_down`), and the game rule that drops one on the chasing units.

**Driving**
- B6, nitrous earned on the road (backend, Claude's HUD): it fills at high speed, in the oncoming lane
  and on near misses, by drafting, and by hitting and taking out police; the HUD bar flashes and says
  why (DRAFT, ONCOMING, SPEED, TAKEDOWN).
- B3 part 4, the hour of the day: racers only after dusk, traffic 30 % denser by day with rushes at
  8:00 and 18:00, police sight 180 m by day, the helicopter's light only at night, crickets by night and
  cicadas by day.

**The world**
- C4, the Kurogane Line's ramps down to downtown: two pairs of slip roads off the deck to
  Kurogane-dori, at about x -450 and +450.
- C6, fill the map: gas stations 4 to 10, repair garages 5 to 12, hideouts 5 to 12 (step 2), then
  buildings outside the Sotokan ring from about 10,700 to 16,000 (suburbs, a village, the port, new
  kinds; step 3), and model variants so copies of a lot differ (G8).
- G4 and C1 part 5, the city's greenery: street trees in grates, planters, hedges, shrubs, benches,
  placed by the hundred along the avenues, the medians and the pocket parks.
- Breakable props (`BUGS.md`, plan item 4): lamp posts, signal poles, signs, bollards and vending
  machines that tip or bend when hit and stay down, with sparks.
- C5's rest: long soft shadows from the buildings at dawn and dusk; the headlights' reflection on the
  road ahead; wet bridge decks, plazas and lots; a cooler tint on wet sidewalks.

**Traffic and models**
- G6's rest: the kei truck and the tanker (no CC0 source: Gemini's search, 2026-10-14), the crossover.
- City greenery from outside CC0 models, downloaded and looked at on 2026-10-14 (not in the repository
  yet, `tools/props.html?day=1`): Innerscene's street tree (108 triangles), round bush (140), bench (156)
  and steel planter (1,128); KayKit's bench and potted bush. Innerscene's scaffold tower is 13,572
  triangles, too heavy for a pursuit breaker.
- The player's five cars from outside models or from Gemini 4 Argon (Jc, 2026-10-14): Cosmo's free cars
  fit three (its rally car the Hayate, its "kamaro" the Rampart, its "lamb" or "ghini" the Vespera);
  nothing fits the Tsurugi or the Hikari, the trial for Argon. A player car needs more than a traffic
  body: its cockpit, the camera solved per car, the wheels that turn, the lamp and exhaust spots
  (`vehicles/models.js`, `car.js`, `cockpit.js`), so the first car is a trial.
- An idea from 2026-10-13, not a brief yet: the ambulance and the fire engine on calls, lights and
  siren on, the traffic pulling over for them.
- The five hero cars stay lofted until an outside model can match their shapes (M-02 plan item 5).

**Audio**
- C8: the escaped and busted stingers once Jc makes the two files (the code waits on Hermes's branch);
  the vocal flags of the built-in tracks; more tracks from `docs/music/flow-prompts.md`.
- C9's later steps: gamepad focus inside the music panel, a loudness measure when a song is added,
  dropping files onto the panel.

## 3. The main objectives (not designed yet)

Jc named them on 2026-10-14: races, a career, car upgrades. None has a brief; each needs a design pass
with Jc first, written into `docs/DESIGN.md` as a new section, then briefs. What the game already has
to build on, and the questions to settle:

**Races.** In: `RaceEvent` (`src/race/event.js`) with three kinds, the Tokyo Xtreme Racer style duel
against a street racer (H to challenge), the Kuro Pass rally time attack (gates, splits, medals, pace
notes, a ghost) and the police pursuit; Route 1's loop, the Bayshore and Kurogane Lines, the pass, the
city grid, five street racers with their own heat (B5 part 4). Candidate kinds: a sprint (A to B
through the city), a circuit on Route 1's loop, a touge battle down the pass, a drag on the Kurogane
Line, speed trap runs, police milestones (Most Wanted's: so many units taken out, a pursuit lasted so
long). To settle: which kinds, where they start on the map (markers, the map and the GPS take them),
entry fees and prizes, rivals and their AI on a set course.

**A career.** In: money (start 15,000 yen, fuel, tolls, repairs, fines), the bounty and the rap sheet,
the racers' notoriety. To settle: Most Wanted's Blacklist (a ladder of named rivals, each unlocked by
races won, bounty and milestones) or Tokyo Xtreme Racer's way (rival teams and wanderers met on the
expressway, their spirit bars), or a mix; what a step of the career unlocks (cars, parts, districts,
heat ceilings); a story, or none.

**Car upgrades.** In: physics that model the engine's torque curve, the gearbox, the tires' grip, the
mass, the turbo's boost, nitrous, heat and wear, and the honest bars (`tools/sim.mjs`) that would
show an upgrade's effect. To settle: the parts (engine stages, turbo, exhaust, gearbox ratios, tires,
suspension, brakes, weight, nitrous size), whether they tune by sliders, where they are bought (the
five garages, more with C6), visual parts (paint exists; wheels, kits, a wing), and whether new cars
are bought or won.

**With all three:** save slots (one `localStorage` key today), a garage screen that shows the car's
parts and records, and the main menu's paths into a career.

## 4. Shipping (the last milestone, by hand)

`DESIGN.md` section 12: the page from a subpath on GitHub Pages, the loading screen over about 41 MB,
audio after the first input, saves that survive a version bump, every outside asset's license in
`assets/models/SOURCES.md` and the music's, a playthrough in Chrome, Firefox and Safari, and the frame
rate on a mid-range machine (X-02). Nobody starts it before Jc says the game is done.

## Open decisions for Jc

- The team for the next phase: how the Gemini app joins (design, sourcing, review by images) beside
  agy (code and tests) and Claude (plan, review, integration), and how work passes between them without
  copy and paste. Claude's proposal is in the session of 2026-10-14; once Jc decides, it goes into
  `README.md`'s team table.
- The main objectives' design pass (section 3): when it starts, and the answers to its questions.
- M-01: which car's mirror is broken, from which view.
