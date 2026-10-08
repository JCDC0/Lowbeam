# C4: The Kurogane Line's ramps down to downtown (Claude, planned)

The Kurogane Line (`kuroganeLine` in `layout.js`) runs 12 m over the middle of Kurogane-dori across
downtown, but the only ways on and off are its four junctions with Route 1's inner carriageway. A
Shuto-style line has ramps down into the city it crosses. This brief records what that takes; it is
larger than one patch because no road in the game leaves the side of a deck yet.

## The design

Two pairs, one each side of downtown's middle (about x -450 and x +450, clear of the Naikan ring's
crossings at x about +-800 and of the line's bends onto the avenue):

- An exit off the eastbound carriageway (`c3-f`, on the north side) as a slip road on its left edge,
  descending at 6 % beside the deck over the avenue's north sidewalk (12 m in about 200 m, plus the
  taper), then merging into Kurogane-dori's eastbound lanes as an entry slip with the avenue as its
  carriageway (`slipRamp` with `carriageHw` the avenue's 7 m).
- An entry the other way: off the avenue's eastbound outer lane, climbing beside the deck and merging
  into `c3-f`. The mirror pair on the south side serves the westbound carriageway (`c3-r`).

## What has to change

- `roads.js`: a slip road attached to a lifted carriageway takes the carriageway's height along its
  attached stretch (today only ground carriageways have slips), and a road can be a slip at both
  ends (off the deck, onto the avenue), or the descent is a third road between two slips.
- `scatter.js`: the deck's parapet walls (`WALL_LIFT` boxes on both outer sides) open along the
  attached stretch, the ramp's own deck gets parapets on its outer side only, and `portalOver` stands
  a portal's leg outside the ramp where one runs beside the deck (today a leg on another road drops
  the portal).
- `build-bridges.js`: the deck's side skirts and parapets open where the slip is attached, and the
  ramp's deck meets the main deck without a gap.
- `citygen.js` and `layout.js`: the ramps join the `avoid` list (streets keep clear by `hw + 26`), so
  the cross streets that reach the avenue's north and south sides near a ramp end short of it, or the
  ramp's low end is placed between two of them. Measure which streets change.
- `traffic/net.js` (the backend's): an exit from an expressway carriageway that is lifted works as
  today (`linkRamp`), but a ramp ending on a two-way avenue as a slip, not a T, needs the end link to
  go into the avenue's same-direction lane only. Brief the backend for that piece.
- Buildings: the ramps' footprints push the avenue's frontage back where they run (the building
  mask counts every road); check that no tower is left floating over a removed lot.
- The minimap, the Tab map and the GPS route pick the ramps up from the road list with no change.

## Tests

- Every ramp's height is continuous where it leaves the deck and where it meets the avenue (no step
  over 3 cm), and no grade over 6.5 %.
- No wall, pier or portal leg stands on a ramp's surface; no building box overlaps it.
- A car can route from Route 1 onto the line, off it into downtown and back (`TrafficNet.route`).
- The road fingerprint changes only by the new ramps and the streets they shorten (list them).

## Order

1. Pure geometry and heights (`layout.js`, `roads.js`), tested headless.
2. Walls, piers and portals (`scatter.js`), then the meshes (`build-bridges.js`).
3. The city's streets and buildings around the ramps.
4. The traffic links (backend), then a drive in the browser at every ramp.
