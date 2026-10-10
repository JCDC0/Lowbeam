# Outside models

Every model in `assets/models/` that was not built from a script in `tools/blender/` comes from here:
where it came from, who made it, its license, and how it was converted. Checked again before the game
ships (the GitHub Pages milestone).

All of these are from Kenney's Car Kit 3.1 (`Models/GLB format/`, kenney.nl, downloaded 2026-10-10),
author Kenney, license CC0 1.0 (no credit required; credit to Kenney is appreciated). Each was converted
with `node tools/import-glb.mjs <file> <name> --size L,W,H --auto` at its traffic kind's size.

| Model | File | Traffic kind | Size (L, W, H) |
|---|---|---|---|
| `kenney_sedan.json` | `sedan.glb` | `sedan` | 4.55, 1.78, 1.42 |
| `kenney_hatch.json` | `hatchback-sports.glb` | `hatch` | 3.95, 1.7, 1.45 |
| `kenney_taxi.json` | `taxi.glb` | `taxi` | 4.6, 1.78, 1.5 |
| `kenney_suv.json` | `suv.glb` | `suv` | 4.7, 1.9, 1.75 |
| `kenney_minivan.json` | `van.glb` | `minivan` | 4.8, 1.8, 1.78 |
| `kenney_pickup.json` | `truck.glb` | `pickup` | 5.2, 1.9, 1.8 |
| `kenney_boxtruck.json` | `delivery.glb` | `truck` | 7.2, 2.3, 3.2 |
