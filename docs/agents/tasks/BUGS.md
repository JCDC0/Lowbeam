# The bug board

Jc's call (2026-10-10): clean first, then the game's plans. Every bug, patch and rough edge that Jc, the
agents or a bench has found goes on this board with one owner, until all of them are clear and the
gates at the bottom hold. New game features wait; a feature already half built (B5) goes on.

Rules:
- One line per bug, one owner, the owner's file rules apply (`README.md`). Say what you fixed and what
  proves it in your commit and its changelog entry, and move the line to "Clear" with the version.
- A bug without a place cannot be fixed: Jc's reports should come with a screenshot and the coordinates
  from F3. Where we can, a bench finds them instead (the gates).
- Fix the cause in the generator or the rule, then add the audit or test that would have caught it.

## Open

| ID | Bug | Where | Owner | State |
|---|---|---|---|---|
| R-01 | Roads clip through each other at some merges and junctions instead of joining cleanly (seams, overlaps, z-fighting) | `world/roads.js`, `junctions.js`, `merge.js`, `build-roads` | Claude | needs spots from Jc, and the seam audit (gate 3) to find the rest; one found (0.10.45): at the kogyo crossing near (2423, -1293) a street crossing another at a slant has its sidewalks drawn across the other road |
| R-02 | Floor symbols missing: lane arrows, stop words, merge and exit markings, bus and speed marks | `world/markings.js`, road textures | Claude | to plan after R-01 (zebras and stop lines exist); a first 止まれ texture from the Gemini app is in `G:\My Drive\Lowbeam\from-gemini\tomare_256.png` (wants a transparent background) |
| P-02 | 424 ways into a crossing lost their own signal pole in 0.10.36 (no corner with room for it); the lights still work, but the driver coming up has no head over the lane | `world/signals.js` | Claude | a near-side pole, or an arm long enough from the far corner |
| R-03 | Zebra crossings drawn at odd angles across turning lanes under the Kurogane Line (Jc's screenshot, 2026-10-10) | `world/markings.js` | Claude | open |
| R-04 | Where the side streets meet the Sotokan ring the map shows small jogs: the streets bend to meet the ring instead of joining it cleanly (Jc's map screenshots) | `world/citygen.js`, `junctions.js` | Claude | with R-01 |
| M-01 | Cars' mirrors broken (which cars, which view, which part: needs a screenshot) | `vehicles/bodies/*`, `models.js`, `cockpit.js` | Claude | needs a spot; check each car in `tools/bodies.html` |
| M-02 | Hand-scripted models look poor: replace with outside low poly models that load clean (the plan below) | `tools/import-glb.mjs`, `assets/models/`, `traffic/kinds.js` | CCC | twenty civilian kinds are outside CC0 models now (0.10.38, 0.10.39, 0.10.43: Kenney's Car Kit, rgsdev's pack, KayKit's City Builder Bits and Cosmo's Low Poly Cars, eight of them new kinds); the kei truck and tanker have no CC0 source (Gemini's search, 2026-10-14) |
| H-01 | Pursuit HUD half built: the reinforcement timer, the "seen" fade-in rule and the helicopter fuel pump have no data until B5 part 2 | `ui/pursuit.js` (done), `drive.js` `pursuitView()` | CCC | waiting on B5 part 2 |
| H-02 | HUD changes take too long to land: the sketches were misread more than once | `ui/pursuit.js`, `ui/hud.js` | Claude | process: a mock page of the HUD is checked against Jc's drawing before every commit (gate 5) |
| T-01 | 123 civilian stalls, all geometry (B4 part 3 sorted them): the toll plaza divider islands on `c1-r` near s 5,730 (1.3 m boxes leave 2.43 m for a 2.5 m semi; 40), the Kurogane Line portal pier legs on the Ginza cross streets `ginza-b4`, `b5`, `b8` (50), a signal pole at (-995.7, 1171.0) swept by the bus turning at node 82, `dori` to `shin-b31` (15), the `c3-ramp-wx` and `c3-ramp-ex` rails within 0.38 m of the lane over their first 30 m (18) | `world/highway.js`, `toll.js`, `scatter.js`, `signals.js` | Claude | next; `node tools/clipbench.mjs` lists them |
| T-04 | Junction turns the strict turn test names as exceptions: 14 that clip a static shape at 7 junctions (Ginza and Dori, Kitae, Hama, Nishi) and 18 that leave the carriageway at 10 junctions (side streets meeting `r18`, `west` and `east`) | `traffic/net.js` (`buildTurn`), `world/junctions.js` (the patch) | Claude | 6 signal clipping turns cleared and removed (0.9.38); 8 pier clips (nodes 66, 67, 75) and 18 patch faults (nodes 1, 4, 6, 12, 13, 15, 16, 17, 20, 22; 0.13 to 0.53 m) listed for patch widening |
| T-03 | Stakeout cars would glow: `stepParked` lights the tail lamps and the headlamp flares show | `traffic/sim.js`, `traffic/render.js` | CCC | waits on B5 part 3 |
| W-01 | The steepest streets climb 12.6 % over 10 m (Minatomachi, Shinmachi, off the Sotokan ring) | `world/layout.js`, `roads.js` | Claude | open |
| X-02 | Nothing has been checked at real frame rates on a gaming desktop | all | Jc, then Claude | needs Jc: F3 numbers on 8041 |

## Clear

| ID | Bug | Version |
|---|---|---|
| D-01 | Roadblock barrier faults from G7 review tested and cleared: trafficVoices skips barrier engine audio; hard hits knock and flatten without yaw spin; civilian target excludes barriers and parked units in update and populate; traffic brakes to full stop before barrier and slow car below 6 m/s closing stops at upright barrier | 0.9.44 |
| T-06 | Vehicles over 12 m (semi) kept off Kurogane Line ramps (c3-ramp-*); tested that 7.4 m ramp width supports up to 10.5 m bus and 9 m tanker/trucks with zero carriageway departures, while 16 m rigid semi swept 0.237 m outside the lane | 0.9.43 |
| T-05 | node tools/clipbench.mjs world-caused wrecks at 0: clipbench prints kind, lane, s and cause on world wreck; changeSafe expands toll plaza buffer to 110 m and probes trajectory points against hitWorld to eliminate toll booth island collisions | 0.9.42 |
| M-03 | Traffic tail lamps half lit and their flares off the lamps (Jc, the SUV and the truck in the 0.10.38 shots): the converter took one triangle of each lamp's quad (its two shades, 3 and 8 degrees of hue, straddled the tail test), and the taxi's roof sign pulled the head lamp flares onto the windshield. Now a lamp's neighbors of the same hue join it, and the flares use only the lamps in the front and back quarters | 0.10.39 |
| X-01 | GPS route test uses bounded A* expansion count instead of wall-clock milliseconds; passby audio test uses windowed RMS over 10 ms instead of single-sample noise | 0.9.40 |
| T-02 | Hikari 300ZR added to RIVALS (rv-hikari); 6-seed racer average 205.9 km/h (> 180 km/h) and civilian lane reversal rate 2.3 % (< 10 %) | 0.9.39 |
| F-01 | The game froze, the picture stopped while the music and the engine went on: a helicopter with no target crashed the frame loop (`Heli.light`); the loop now survives a faulting frame | 0.10.31 |
| P-01 | Signal poles in the road (Jc's screenshots: in junctions, one dead ahead, one under the Kurogane Line deck): 92 of 2,709 stood where cars drive, because a pole kept 1.3 m from a lane's center line (inside a 3 m lane) and the road check asked only the nearest road at any height. Now 0.6 m from the edge of every lane and every curve through a crossing, at the pole's height, with an independent test | 0.10.36 |
| N-04 | The Tab map and the main menu still named the old valley (KIRIGAOKA TACTICAL MAP, KIRIGAOKA TOWN, LAKE KIRIGAOKA, KIRIGAOKA RIDGE, KIRIGAOKA TACTICAL RALLY); the map's labels are the island's own areas now | 0.10.36 |
| N-01 | Minimap: police arrows did not point where the cars drive and their sight turned with the player's car; the sight was a 70 m cone where the director uses 150 m all round | 0.10.34 |
| N-02 | Civilians drove through static shapes and off the carriageway (15 clips, 10 off the road); now 0 and 0, never wrecked by the world, the cost of the probes 3.6 % | 0.9.34 to 0.9.37 |
| N-03 | `tests/devserver.test.mjs` failed in any folder not named exactly Lowbeam (a worktree) | 0.10.32 |

## The gates: what "clean" means

1. `npm test` and `npm run check` green, and `node tools/clipbench.mjs` at 0 clips, 0 off the road and 0
   stalls (or a short list Jc agrees).
2. Placement audit at 0: no pole, lamp, sign, vending machine, tree or building on a carriageway, deck or
   junction (`node tools/propaudit.mjs`, 0.10.45; 47 left, all T-01: 18 portal legs, 29 toll plaza parts).
3. Road seam audit at 0: no two road surfaces overlap or leave a gap at a merge, junction or ramp mouth
   (`node tools/seamaudit.mjs`, 0.10.46; 658 left: 147 sidewalks across a carriageway, 61 carriageway
   overlaps, 57 holes, 393 steps at patch edges).
4. A screenshot tour: a fixed set of camera spots (every district, each junction type, each merge, the
   toll plazas, both viaducts, the Kurogane Line, the pass) that Jc has looked at and passed.
5. The HUD against Jc's drawing: a mock page with the drawing beside it, passed before the commit.
6. Models: every car and prop in the game loads clean in `tools/props.html` (`__props.check()` at 0
   problems: normals, size, symmetry, parts that float, a mirror on each side of a car).

## Plan: outside models (M-02)

Free low poly models that load clean, instead of hand scripted ones, in this order:
1. Civilians first (G6: the fourteen kinds remade and seven new). Candidates, all CC0 (no credit
   needed, any use): Kenney's Car Kit (over 40 vehicles, glTF, OBJ, FBX), Quaternius's low poly cars and
   public transport (FBX, OBJ, Blend), OpenGameArt's free low poly vehicles pack (police cars among them).
   Each needs its license read on its own page when we take it.
2. One import script, `tools/import-glb.mjs` (0.10.37, Node, no Blender): reads the .glb, gives each
   triangle a flat color from the palette texture and a flat normal, sorts the parts by hue and place
   (`paint` tinted per car, `glass`, `lamp` at the front, `tail` at the back, `tire`, `rim`, `plate`,
   `trim`, `under`) with one color each, and scales the model to its traffic kind's length, width and
   height. The cars come out of one pipeline, so they match.
3. A source list, `assets/models/SOURCES.md`: every outside model with its origin, author and license, for
   the shipping milestone.
4. A one-car trial before anything else: one Kenney or Quaternius sedan through the script into the game
   as a civilian, looked at in `tools/props.html` and on the road. If Jc likes it, the rest follow.
5. The five hero cars (Hayate, Rampart, Vespera, Tsurugi, Hikari) stay as they are until the trial says
   an outside model can match their shapes; free packs give clean generic cars, not those particular ones.
   Other sources (Sketchfab, Poly Pizza, `generate_3d` in the Blender MCP) have mixed licenses and quality
   and are judged one model at a time. The trial for them is `C10-hero-cars.md` (2026-10-14): Cosmo's free
   cars for the Hayate, the Rampart and the Vespera, Gemini 4 Argon for the Tsurugi and the Hikari.

## Plan: roads and props (R-01, R-02, P-01)

No outside road generator is a drop-in for this island (a loop expressway with viaducts, ramps,
overpasses and a lane net for the traffic). The ones worth reading: libOpenDRIVE (C++, builds road and lane
meshes from OpenDRIVE files, has a WebAssembly build and JavaScript bindings), OSM2World (builds 3D from
OpenStreetMap data, glTF out) and CARLA's OpenDRIVE mesher. Each wants the layout in its own format, and
none gives us our traffic lanes. So the fix stays in our own code, with audits that prove it:
1. The seam audit (gate 3) and the placement audit (gate 2) as tools, then fix what they find.
2. Junction patches by the standard method (sort the arms by angle, offset each pair of edges, join them
   with arcs), checked against what `junctions.js` does now; merge and ramp mouths blended by the same
   rule, with their markings.
3. Props by rules, not luck: every lamp, pole, sign, signal and vending machine gets a clear zone around
   the carriageway and the decks, and a test that fails when one is inside it.
4. After the bug-bash, breakable props (a feature, not a bug): lamp posts, signal poles, signs, bollards
   and vending machines that tip or bend when hit and stay down, with sparks.
