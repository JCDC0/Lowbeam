# A2: Tab map, controls, the E key conflict

Files: new `src/ui/map.js`, `src/ui/menus.js`, `src/ui/hud.js`, `src/core/input.js`,
`style.css`, `src/main.js` (state machine edits only), `src/ui/minimap.js` (extract the
road drawing so both maps share it).

## Tab map

- Tab opens a full-screen map of the whole world and pauses the simulation. Tab or Esc
  closes it. (`input.js` already calls `preventDefault` for Tab.)
- New state `map` in `main.js` (like `pause`: `drive.render()` still draws behind it).
- Data: `world.mapData`, added by Claude in 0.2.0:

  ```js
  { bounds: { half },                      // world is [-half, half] on x and z
    roads: [{ id, name, cls, points: [[x, z], ...] }],
    pois: [{ kind, name, x, z }],          // 'station', 'toll', 'start', ...
    zones: [{ name, x, z, r }] }
  ```

  Until it exists, build the same shape from `world.ground.roads` and
  `world.scatter.stations` inside `map.js` behind one function `mapDataOf(world)`, so the
  switch to Claude's version is one line.
- Draw: cached offscreen canvas of the roads (width by class: expressway thickest, mountain
  and forest thin), station and toll icons, zone names, player arrow with heading, a
  scale bar, north arrow. Wheel or +/- zooms, drag or arrow keys pan, Home recenters on
  the player.
- Style it like the arcade menus from 0.1.9 (amber and dark, Michroma).

## Controls

- Interact (refuel, and later repair) moves from E to F. `KEYS.interact = ['KeyF']`, pad
  button unchanged. `shiftUp` loses `KeyE`: shift keys are Shift and Ctrl, plus E and Q
  only if E is no longer double bound. Final bindings: shift up `ShiftLeft`, `ShiftRight`,
  `KeyE`; shift down `ControlLeft`, `ControlRight`, `KeyQ`; interact `KeyF`.
- Update the prompt strings that say "HOLD E TO REFUEL" in `src/drive.js` to F (that one
  string edit in drive.js is allowed; Claude edits the rest of that file).
- The controls screen lists R, N and 1 to 7 as the manual gear order, Tab for the map,
  F for refuel and repair, C for camera (5 views), R reset.
- Settings: add an entry for render height (240, 360, 480 lines). Store it under
  `store.get('renderHeight', 240)`. Claude adds `stage.setHeight(h)` in `render/stage.js`;
  until then call it only if it exists.

## Done when

- Tab opens and closes the map in the browser, shot taken, pan and zoom work, the player
  arrow matches the car.
- `npm test` and `npm run check` pass; docs and changelog updated.
