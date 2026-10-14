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

## KayKit's City Builder Bits 1.0 (free)

`KayKit_City_Builder_Bits_1.0_FREE.zip` (4.9 MB) from kaylousberg.itch.io/city-builder-bits, downloaded
2026-10-14 with Jc's go, author Kay Lousberg, license CC0 (its `License.txt`: free to use in personal,
educational and commercial projects; credit not mandatory; the page asks not to resell unmodified copies).
The `.gltf` copies, which carry the color atlas. Lamps laid by `--head` and `--tail` (their lamp blocks
are shades the hue rules miss).

| Model | File | Traffic kind | Size (L, W, H) | Lamps (head; tail: x, y, w, h) |
|---|---|---|---|---|
| `kaykit_wagon.json` | `gltf/car_stationwagon.gltf` | `wagon` | 4.7, 1.78, 1.5 | 0.55, 0.51, 0.28, 0.18; 0.6, 0.57, 0.3, 0.09 |
| `kaykit_sedan.json` | `gltf/car_sedan.gltf` | `exec` | 4.95, 1.83, 1.45 | 0.54, 0.49, 0.26, 0.18; 0.6, 0.53, 0.32, 0.09 |
| `kaykit_hatch.json` | `gltf/car_hatchback.gltf` | `kei` | 3.4, 1.48, 1.62 | 0.44, 0.55, 0.22, 0.2; 0.48, 0.59, 0.28, 0.09 |

## Cosmo's Low Poly Cars (free)

The free download (2.6 MB, `lowpoly_cars_free`) from cosmo-art.itch.io/low-poly-cars, downloaded 2026-10-14
with Jc's go, author Cosmo, license CC0 1.0 (its `License.txt`: use, modify and distribute, commercial or
not, without attribution). The `.glb` copies. The free cars paint their lamps like the trim, so the lamps
are laid by `--head` and `--tail`; the van's and the coupe's paint is named with `--map`.

| Model | File | Traffic kind | Size (L, W, H) | Extra |
|---|---|---|---|---|
| `cosmo_van.json` | `GLTF/van.glb` | `keivan` | 3.4, 1.48, 1.9 | `--map "#8aa16d=paint" --head 0.45,0.94,0.26,0.07 --tail 0.64,1.12,0.07,0.38` |
| `cosmo_jeep.json` | `GLTF/jeep.glb` | `offroad` | 4.4, 1.84, 1.8 | `--head 0.5,0.95,0.16,0.16 --tail 0.66,1.07,0.12,0.16` |
| `cosmo_coupe.json` | `GLTF/coupe.glb` | `coupe` | 4.5, 1.8, 1.32 | `--map "#424242=paint,#2e2e2e=paint" --head 0.55,0.68,0.3,0.06 --tail 0.5,0.85,0.42,0.06` |
