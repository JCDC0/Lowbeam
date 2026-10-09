# G7: A district police station and the roadblock barrier (Assets)

After the G5 batch in hand (the Hardtop fix, the Hoshi Beat, the Kagero RS-Wide). Jc wants more
police stations around the island; the HQ (`police_hq`) is one big building, and two more copies of
it would look wrong. This brief is a smaller station for the districts, and the last pursuit prop
from G1.

Versions: your 0.9.50 to 0.9.69 range ends with G5. Use 0.10.50 to 0.10.69 for this and what follows
(one commit per model). `package.json` holds the highest version committed: if yours is the highest,
bump it with `package-lock.json`; if not, add your changelog entry in version order only.

## 1. District police station (`police_station`)

A two-storey Japanese district police station (a large koban), on a lot about 36 by 28 m, the
front facing +z toward the street like the other lots (read `tools/blender/police_hq.py`, `garage.py`
and `hideout.py` first, and how `buildLots` places them).
- A two-storey block with a flat roof, a lit entrance canopy with a red lamp over the door (the
  koban's red globe), the station name sign (`sign:` material, reuse the HQ's sign key), barred
  ground-floor windows, a small roof helipad (a painted H, edge lights as `lights`), a radio mast.
- A forecourt with three parking bays for police cars (markings only) and a gate.
- Colliders on the building, the mast and the gate posts; lights at the canopy, the bays and the pad.
- At most 4,000 triangles. Check it in `tools/landmarks.html` and `tools/props.html` with the HQ for
  scale, with shots at night from the street and from above.

## 2. Roadblock barrier (`police_barrier`), from G1

The sawhorse barrier the roadblocks stand behind, between the cars:
- A 2.4 m wide, 1.1 m tall folding barrier: two A-frame legs, two boards striped red and white
  (diagonal stripes as faces or a `sign:` texture), a flashing lamp on top (an emissive `lamp`
  material; the game flashes it).
- At most 300 triangles; one collider box.
- Check in `tools/props.html` beside a police car.

Stop after each model for Claude's review.

## Review: the district station (Claude, 0.10.12)

Passes and is in the game: Kitamachi and Toge stand on `police_station` (36 by 28 m lots in
`layout.js`). Checked in the prop viewer (798 triangles, 16 materials, 12 colliders, 10 lights, no
problems) and from the road at night: the lit canopy with the red globe, the sign (KITAMACHI POLICE,
TOGE POLICE), the barred windows, the mast with its beacon and the boundary wall read well; the roof's
helipad (an H in a yellow ring, green edge lights) sits at y 7.5, x 0, z -6 where `helipadOf` puts the
helicopter's pad. Note for the next model: the facade is dark and low in contrast at night (blue trim
on grey); a lit window row or two on the ground floor would read from further down the road.

## Review: the roadblock barrier (Claude, 0.10.14)

Passes. Checked in the prop viewer beside the cruiser and a racer: 174 triangles, 2.4 by 1.1 by 0.5 m,
five materials, one collider, one light; red and white striped boards on A-frame legs with an amber
lamp on top, and it reads at the size of a police car from the front, the side and the back. The
backend places it at the roadblocks and flashes the lamp (B2-style wiring in `0.9.29`); that is the
last of G7.

## Review: the backend's wiring of the barrier (Claude, 0.10.17)

Placement and drawing pass; three fixes are owed and one test is missing. Checked in the game: a
roadblock planned and spawned the way `stepPolice` does, on the Harbor avenue. Two striped sawhorses
stand 2.2 m in front of two of the three cruisers, the amber lamp flashes, the gap at the right-hand
end stays open, and the light bars throw red and blue across them. `tests/island/roadblock.test.mjs`
passes (9 tests).

Fixes, for the backend (0.9.32):
1. A parked barrier is heard as an engine. `trafficVoices` (`src/audio/traffic-voices.js`) skips only
   wrecks, and `police-barrier` is not in `VOICE_OF`, so it falls to the sedan class and idles at 750
   rpm; measured: one voice, a 26 Hz sawtooth, from a barrier 36 m away, and it takes one of the four
   voice slots. Skip `a.barrier` (this one-line change goes in 0.9.31, in the same file as the rain
   work), with a test.
2. A hard hit leaves the barrier standing. Driving into it at 25 m/s made it a `wreck` that slid 15 m
   and spun to yaw 2.08 with `flattened` false and the mesh's `rotation.x` 0: upright, turning on the
   road, for the whole wreck time. The brief says it flattens when knocked aside; only the `knocked`
   path (under 18 m/s closing) sets `flattened`. A barrier should never be a `wreck`: take the knocked
   branch for any hit, set `flattened`, damp its slide like `stepKnocked`'s barrier case, let it lie
   and fade after the usual time. A test for both a soft and a hard hit.
3. The civilians' target counts the barriers: `this.agents.length - rivals < this.target` in
   `TrafficSim.update` includes every barrier (and every parked unit), so a roadblock of two barriers
   and three cars leaves five fewer civilians around the player while it stands. Count only the
   civilians.
4. Missing test: a car below 6 m/s closing stops at a barrier, and traffic brakes for one (the claims
   in the 0.9.29 changelog entry have only a placement test behind them).

Not checked: the barriers' colliders against the player at low speed (the claim above), left to the
test in 4.
