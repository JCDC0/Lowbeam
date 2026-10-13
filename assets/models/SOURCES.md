# Outside models

Every model in `assets/models/` that was not built from a script in `tools/blender/` comes from here:
where it came from, who made it, its license, and how it was converted. Checked again before the game
ships (the GitHub Pages milestone).

Each was converted with `node tools/import-glb.mjs <file> <name> --size L,W,H --auto` at its traffic
kind's size (0.10.39: whole tail lamps, and the FBX reader).

## Kenney's Car Kit 3.1

`Models/GLB format/`, kenney.nl, downloaded 2026-10-10, author Kenney, license CC0 1.0 (no credit
required; credit to Kenney is appreciated).

| Model | File | Traffic kind | Size (L, W, H) |
|---|---|---|---|
| `kenney_sedan.json` | `sedan.glb` | `sedan` | 4.55, 1.78, 1.42 |
| `kenney_hatch.json` | `hatchback-sports.glb` | `hatch` | 3.95, 1.7, 1.45 |
| `kenney_taxi.json` | `taxi.glb` | `taxi` | 4.6, 1.78, 1.5 |
| `kenney_suv.json` | `suv.glb` | `suv` | 4.7, 1.9, 1.75 |
| `kenney_minivan.json` | `van.glb` | `minivan` | 4.8, 1.8, 1.78 |
| `kenney_pickup.json` | `truck.glb` | `pickup` | 5.2, 1.9, 1.8 |
| `kenney_boxtruck.json` | `delivery.glb` | `truck` | 7.2, 2.3, 3.2 |
| `kenney_garbage.json` | `garbage-truck.glb` | `garbage` | 6.5, 2.2, 2.9 |

## rgsdev's Free Low Poly Vehicles Pack

`free_low_poly_vehicles_pack_by_rgsdev.zip` (1.4 MB) from opengameart.org/content/free-low-poly-vehicles-pack,
downloaded 2026-10-13, author Raphael Gonçalves (rgsdev), license CC0 (its `License.txt`: public domain,
free for any project, credit not required). Binary FBX, one flat color a material.

| Model | File | Traffic kind | Size (L, W, H) |
|---|---|---|---|
| `rgsdev_bus.json` | `Bus/Bus.fbx` | `bus` | 10.5, 2.5, 3.1 |
| `rgsdev_semi.json` | `Truck with trailer/Truck with trailer.fbx` | `semi` | 16, 2.5, 3.6 |
| `rgsdev_van.json` | `Van/Van.fbx` | `van` | 4.9, 1.85, 2.0 |
| `rgsdev_ambulance.json` | `Ambulance/Ambulance.fbx` | `ambulance` | 5.6, 1.9, 2.5 |
| `rgsdev_firetruck.json` | `Firetruck/Firetruck.fbx` | `firetruck` | 9, 2.5, 3.3 |
| `rgsdev_limo.json` | `Limousine/Limousine.fbx` | `limo` | 6.2, 1.9, 1.45 |
