# G1: Pursuit props, the trial (Assets)

Five small models for the police chases, built as Blender scripts with the project's kit and checked
in the browser. It is a trial of the asset workflow: small, self-contained, nothing in the game breaks
if a model is wrong, and Claude fits them into the game afterwards. Read
`docs/agents/ARCHITECTURE.md` (Conventions, Verification, Blender) and `docs/agents/tasks/README.md`
first, then read `tools/blender/kit.py` and `tools/blender/hideout.py` as the example of a script.

Versions: 0.9.50 onward (one commit for the whole set is fine, 0.9.50; a fix round is 0.9.51).

## The look

PS1-era low poly at night, like the rest of the game: flat colors, hard edges, few faces, no
textures except the kit's named ones. Shapes must read at 480 lines from 20 m away: chunky over fine.
Up to 6 materials per model, each with a plain 0xRRGGBB color; `emissive=True` only for things that
glow (lamps, lenses, reflective strips can stay unlit). Japanese road equipment, not American.

## The models

Every model: the origin is on the ground at its center, the front (the side drivers see) faces +z,
nothing below y = 0, units are meters.

| Name (file) | What | Size (w x h x d) | Triangles | Colliders | Lights |
|---|---|---|---|---|---|
| `spike_strip` | A police spike strip laid across a lane: a folding accordion of dark steel links with rows of short spikes, yellow and black end caps with a pull cord | 4.0 x 0.06 x 0.30 | 300 at most | none (the game tests running over it) | none |
| `police_barrier` | A Japanese police road barrier: a folding A-frame, the rail in red and white diagonal stripes made of geometry (alternating boxes), two flashing lamps on top (amber) | 2.0 x 1.1 x 0.6 | 400 at most | one box over the whole barrier | one, amber `[1.6, 0.9, 0.2]`, range 6, on top |
| `light_bar` | The roof light bar of a Japanese patrol car: a low red bar with a chrome base, the lens split in two halves so the game can flash them, materials named `lens-l` (x > 0, the car's left) and `lens-r` | 1.2 x 0.18 x 0.30 | 300 at most | none | none (the game adds them) |
| `breaker_scaffold` | A pursuit breaker: a scaffold tower at a building site, steel tube frame 3 bays wide and 4 levels high, plank decks, green safety mesh on the street face, a banner across it reading 安全第一 (make it a `sign:breaker` material; Claude paints the text, the viewer shows the model's name on it until then) | 8.0 x 9.0 x 2.5 | 1,500 at most | one box per leg pair (the footprint), y0 0, y1 9 | two work lamps, white `[2.2, 2.1, 1.8]`, range 12, spot 1, at the top facing down |
| `breaker_scaffold_down` | The same scaffold after a car knocks it over: tubes, planks and mesh fallen forward across the road in a pile, the banner torn | 8.0 x 2.5 x 10.0 (it now lies across +z) | 1,500 at most | low boxes over the pile, y1 at most 1.2 | none |

## How to build one

1. Blender is running with the MCP add-on on port 9876. Only you drive it during this task. Never call
   `bpy.ops.wm.read_factory_settings` (it kills the MCP server); `clear()` empties the scene.
2. Write the script `tools/blender/<name>.py`, in the style of `hideout.py`: a docstring that says
   what it is and its size, materials from `mat()`, geometry from `box`, `prism`, `cylinder`, `poly`,
   `loft`, then `collider()` and `light()`, then `frame_view()` and `result = '<name> built'`.
3. Run it through the MCP: execute
   `exec(open(r'C:\GitHub\Lowbeam\tools\blender\kit.py').read())`, then
   `exec(open(r'C:\GitHub\Lowbeam\tools\blender\<name>.py').read())`, then
   `export('<name>', r'C:\GitHub\Lowbeam\assets\models\<name>.json')`.
   Take a viewport screenshot to see it in Blender.
4. Check it in the game's own renderer: with `npm start` running, open
   `http://localhost:8040/tools/props.html?models=spike_strip,police_barrier,light_bar,breaker_scaffold,breaker_scaffold_down`
   in a browser. It draws every model at night on a two-lane road beside a game car for scale, with
   the game's materials and light pools. Keys: drag to orbit, wheel to zoom, 1 to 9 to solo a model,
   C collider boxes, L light markers, R the car. `window.__props.check()` returns a report per model
   (size, triangles, materials, colliders, lights, problems); it must list no problems.
   `window.__props.show(i)`, `view(yaw, pitch, dist)` and `shot('g1-<name>')` save screenshots to
   `tools/shots/`. Reload the page after each re-export.
5. Fix what looks wrong (scale against the car, floating or sunken parts, faces missing because a
   box was built inside out, colors too dark to read at night) and export again.

## Done when

- Five scripts in `tools/blender/` and five models in `assets/models/`, each under its triangle
  budget, `__props.check()` clean for all five.
- Screenshots: each model solo from road height (pitch about 0.15) and from above (about 0.6), and
  all five together with the car, at 1280 by 720.
- One commit (stage only your files by name): `0.9.50: Pursuit props: spike strip, police barrier,
  light bar, scaffold breaker`, with the version bump and a changelog entry (sorted by version).
  Do not edit `src/`, `kit.py` or the viewer; if the kit lacks something, write it into your report.
- A report: what you built, the triangle counts, the screenshots, anything that did not work in
  Blender or the viewer.
