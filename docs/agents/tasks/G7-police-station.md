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
