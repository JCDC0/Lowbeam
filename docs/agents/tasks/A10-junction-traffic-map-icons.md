# A10: traffic at any junction, and the map for Kurogane Island

Owner: Antigravity. Claude is rebuilding the map at the same time (see `C1-kurogane-island.md`): the
street grid becomes an irregular network with crossings at any angle and T junctions, and Route 1
goes up on a viaduct through town. Hermes is working in `src/traffic/sim.js` and `src/race/`.

Stay out of: `src/world/` (all of it), `src/render/`, `src/audio/`, `src/traffic/sim.js`,
`src/traffic/render.js`, `src/traffic/bodies.js`, `src/race/`, `src/drive.js`, `assets/`.
Your files: `src/traffic/net.js`, `tests/net.test.mjs` (new), `src/ui/map.js`, `src/ui/minimap.js`,
`tests/map.test.mjs`, and a new `src/ui/stats.js` if you do part 3.

Rules: `git status` first; if a file you need has changes you did not make, leave that file and
say so. Take the next free version after `git log` (Claude is on 0.5.x). One commit per part, a test
for every rule written first, `npm test` and `npm run check` clean, stage files by name, update
`docs/agents/ARCHITECTURE.md` and `docs/agents/CHANGELOG.md` with small exact-string edits (other
agents edit them too: re-read right before editing), no em dashes, no single-line explanatory
comments, the Antigravity Co-Authored-By trailer.

## Part 1. Traffic at any junction (`net.js`)

Today `linkCrossings` only looks at roads of class `street`, gives each crossing a light whose
axis comes from the world direction of the road (`Math.abs(q.tx) > Math.abs(q.tz)`), and a road
that ends on the side of another only gets an end link.

- Crossings between any two two-way surface roads of class `street` or `arterial`. Skip a
  crossing where either road is lifted more than 2 m at that point (`road.lift`, one value per
  path sample): that is a bridge over the other road, not a junction.
- The light axis is per road at the node (road A is axis 0, road B axis 1), not from the world
  direction, so a crossing at 50 degrees or on a curve still alternates correctly.
- T junctions: a road whose start or end lies within `JOIN` of another road's side (not near
  that road's ends). The side road gets a stop line where it meets the through road and gives way:
  a car there waits until no car on the through road's lanes is within 45 m approaching the
  junction (expose this as data on the stop, for example `{ s, yield: { lanes, at } }`, so the sim
  can read it; Hermes or Claude wire the sim side). Links: from the side road's lanes onto both
  directions of the through road (left and right turns), and from both through road directions
  into the side road.
- A crossing with five or more arms, or two junctions closer than 25 m, keeps working: merge the
  nodes into one light node.
- Tests in a new `tests/net.test.mjs`. Build a small `RoadNetwork` from hand-written road defs in
  the test, do not import `layout.js`: a straight street crossed by a curved one at about 55
  degrees (one light node, the two axes alternate), a street ending on another's side (a T: a
  yield stop on the side road, turn links both ways), and an arterial that crosses a street on a
  lift of 7 m (no node at all).

## Part 2. The map and minimap for the island

`world.mapData` (`src/world/mapdata.js`, Claude's) is gaining:

- `water.coast`: the island's coast as a closed polygon `[[x, z], ...]`. Everything outside it is
  sea. Draw the sea outside it (the map today draws a rectangle from `water.sea`; keep that as the
  fallback when `coast` is missing).
- POIs of new kinds next to `station`, `toll` and `start`: `police` (the headquarters on the
  north-east cape), `garage` (player garages and tuning shops) and `hideout` (warehouses and lots
  where a car can hide later). Give each its own small icon in the style of the existing ones (a
  shield, a wrench, a dashed square) and a legend entry on the Tab map.
- Roads already carry `lifted` runs. With the viaduct those get long: draw lifted runs above the
  ground roads, a little wider, with a dark outline, so the elevated expressway reads as being on
  top.

Write it against fake data in `tests/map.test.mjs` (a square coast, one POI of each kind), so it
does not wait for Claude's layout; it will light up when the new mapData lands.

## Part 3 (optional, if you have usage left). A stats overlay

`src/ui/stats.js`: F3 toggles a small corner readout of frames per second, draw calls and
triangles (`renderer.info.render`) and the traffic agent count. Inline styles, no `style.css` edit.
Hook it in `src/main.js` with a two-line exact-string edit. Claude uses it to keep the denser city
inside the budget.

Stop after part 2 (or 3) and report: commit hashes, the tests you added, and a screenshot of the
Tab map with the fake island data.
