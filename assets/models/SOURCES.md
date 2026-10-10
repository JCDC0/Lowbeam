# Outside models

Every model in `assets/models/` that was not built from a script in `tools/blender/` comes from here:
where it came from, who made it, its license, and how it was converted. Checked again before the game
ships (the GitHub Pages milestone).

| Model | Source | Author | License | Converted |
|---|---|---|---|---|
| `kenney_sedan.json` | Car Kit 3.1, `Models/GLB format/sedan.glb`, kenney.nl (downloaded 2026-10-10) | Kenney | CC0 1.0 (no credit required; credit to Kenney is appreciated) | `node tools/import-glb.mjs sedan.glb kenney_sedan --size 4.55,1.78,1.42 --auto` |
