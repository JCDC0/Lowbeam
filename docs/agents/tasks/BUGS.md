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
| R-01 | Roads clip through each other at some merges and junctions instead of joining cleanly (seams, overlaps, z-fighting) | `world/roads.js`, `junctions.js`, `merge.js`, `build-roads` | Claude | needs spots from Jc, and the seam audit (gate 3) to find the rest |
| R-02 | Floor symbols missing: lane arrows, stop words, merge and exit markings, bus and speed marks | `world/markings.js`, road textures | Claude | to plan after R-01 (zebras and stop lines exist) |
| P-01 | Poles said to stand in the middle of a road (utility, signal or guide sign) | `world/poles.js`, `signals.js`, `build-signals.js`, `guide-signs.js` | Claude | the placement data puts 0 of 2,709 signal poles, 0 of 7,741 lamps and 0 buildings on tarmac (audit, 2026-10-10), so the picture and the data may differ, or the spot is on a deck or a junction: needs Jc's spot |
| M-01 | Cars' mirrors broken (which cars, which view, which part: needs a screenshot) | `vehicles/bodies/*`, `models.js`, `cockpit.js` | Claude | needs a spot; check each car in `tools/bodies.html` |
| M-02 | Hand-scripted models look poor: replace with outside low poly models that load clean (the plan below) | `tools/blender/`, `assets/models/`, `traffic/kinds.js` | Claude and Assets | plan below; a one-car trial first |
| H-01 | Pursuit HUD half built: the reinforcement timer, the "seen" fade-in rule and the helicopter fuel pump have no data until B5 part 2 | `ui/pursuit.js` (done), `drive.js` `pursuitView()` | Hermes (data), Claude (HUD) | waiting on B5 part 2 |
| H-02 | HUD changes take too long to land: the sketches were misread more than once | `ui/pursuit.js`, `ui/hud.js` | Claude | process: a mock page of the HUD is checked against Jc's drawing before every commit (gate 5) |
| T-01 | 123 civilian stalls: lanes that run into a shape (toll booth island widths, the portal pier legs in Ginza, tight avenue turns for the 10.5 m bus) | `traffic/net.js`, `world/scatter.js`, toll plaza data | Claude (geometry), Backend (lanes) | cataloged by B4 part 3, `node tools/clipbench.mjs` lists them |
| T-02 | The Hikari is not among the street racers (two traffic tests sit near their limits when a kind is added) | `traffic/kinds.js`, tests | Backend | open |
| T-03 | Stakeout cars would glow: `stepParked` lights the tail lamps and the headlamp flares show | `traffic/sim.js`, `traffic/render.js` | Backend (flag), Claude (lamps) | waits on B5 part 3 |
| W-01 | The steepest streets climb 12.6 % over 10 m (Minatomachi, Shinmachi, off the Sotokan ring) | `world/layout.js`, `roads.js` | Claude | open |
| X-01 | The GPS route test measures planning time and fails when the machine is busy; `tests/passby.test.mjs` "a loud swell that decays" failed once under load | `tests/` | Backend | make both deterministic |
| X-02 | Nothing has been checked at real frame rates on a gaming desktop | all | Jc, then Claude | needs Jc: F3 numbers on 8041 |
| D-01 | ARCHITECTURE.md still lists the roadblock barrier faults as open; G7 says they were fixed in 0.9.32 | `ARCHITECTURE.md` | Claude | verify in the game, then fix the line |

## Clear

| ID | Bug | Version |
|---|---|---|
| F-01 | The game froze, the picture stopped while the music and the engine went on: a helicopter with no target crashed the frame loop (`Heli.light`); the loop now survives a faulting frame | 0.10.31 |
| N-01 | Minimap: police arrows did not point where the cars drive and their sight turned with the player's car; the sight was a 70 m cone where the director uses 150 m all round | 0.10.34 |
| N-02 | Civilians drove through static shapes and off the carriageway (15 clips, 10 off the road); now 0 and 0 | 0.9.34 to 0.9.37 |
| N-03 | `tests/devserver.test.mjs` failed in any folder not named exactly Lowbeam (a worktree) | 0.10.32 |

## The gates: what "clean" means

1. `npm test` and `npm run check` green, and `node tools/clipbench.mjs` at 0 clips, 0 off the road and 0
   stalls (or a short list Jc agrees).
2. Placement audit at 0: no pole, lamp, sign, vending machine, tree or building on a carriageway, deck or
   junction (a tool, `tools/propaudit.mjs`, from the audit run on 2026-10-10; to be added and tested).
3. Road seam audit at 0: no two road surfaces overlap or leave a gap at a merge, junction or ramp mouth
   (a tool, to be written: samples the road meshes along every junction and merge).
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
2. One import script in Blender (`tools/blender/import_model.py`, run through the Blender MCP): load the
   glTF or FBX, set the scale and the facing the kit uses (front +z, x right), merge by material, give
   the paint panels the names the game tints, add the lamps, a collider and the size, and export to
   `assets/models/<name>.json`. The cars come out of one pipeline, so they match.
3. A source list, `assets/models/SOURCES.md`: every outside model with its origin, author and license, for
   the shipping milestone.
4. A one-car trial before anything else: one Kenney or Quaternius sedan through the script into the game
   as a civilian, looked at in `tools/props.html` and on the road. If Jc likes it, the rest follow.
5. The five hero cars (Hayate, Rampart, Vespera, Tsurugi, Hikari) stay as they are until the trial says
   an outside model can match their shapes; free packs give clean generic cars, not those particular ones.
   Other sources (Sketchfab, Poly Pizza, `generate_3d` in the Blender MCP) have mixed licenses and quality
   and are judged one model at a time.

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
