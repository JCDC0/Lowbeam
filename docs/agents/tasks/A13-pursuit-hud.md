# A13: Pursuit HUD and police markers (Antigravity)

The police come in three steps: Claude builds the helicopter (model, takeoff from the HQ roof,
flight, searchlight), then Hermes builds the police core (patrol cars from the HQ motor pool, the
pursuit as a `RaceEvent`, heat, evading). This task builds everything the player sees of a pursuit
on screen, ahead of both, against the contract below, so the three pieces meet without anyone
editing someone else's files. Read `docs/agents/ARCHITECTURE.md` and the shared-tree rules in
`README.md` first.

Version numbers for this task: 0.7.10 to 0.7.14. Claude has 0.7.3 to 0.7.9, Hermes 0.7.15 to 0.7.19.

## The contract (Claude and Hermes will produce exactly this)

`Drive` will expose two read-only getters. Until the police exist both return `null` (or `[]`),
so the HUD shows nothing in normal play.

```js
/** @typedef {{
 *   state: 'pursuit' | 'evading' | 'cooldown' | 'busted' | 'escaped',
 *   heat: 1 | 2 | 3 | 4 | 5,       // how hard the police try; shown as five marks
 *   evade: number,                  // 0..1: evading fills it toward escape, pursuit drains it
 *   cooldown: number,               // 0..1: once evaded, fills to 1 and the pursuit is over
 *   bust: number,                   // 0..1: rises while the player is boxed in and slow
 *   units: number,                  // police cars in the pursuit
 *   heli: boolean,                  // the helicopter is overhead
 *   bounty: number,                 // yen, grows with time and damage
 *   time: number,                   // seconds since the pursuit started
 * }} PursuitView */
drive.pursuitView();   // PursuitView | null

/** @typedef {{ kind: 'police' | 'heli', x: number, z: number, yaw: number,
 *   search?: { x: number, z: number, r: number } }} PoliceMarker */
drive.policeMarkers(); // PoliceMarker[]: every police car and the helicopter, with the
                       // helicopter's searchlight spot on the ground when it has one
```

## Part 1 (0.7.10): `src/ui/pursuit.js`, the pursuit HUD

New file, DOM like `hud.js`, inline styles or new rules at the end of `style.css`. Export
`pursuitHud(parent)` returning `{ update(view, dt), el }`. Style it after Need for Speed: Most
Wanted (2005) in the game's own look (Michroma, the amber and red of the cluster):

- Top center, only while `view` is not null. Five heat marks (filled up to `heat`), the state as a
  word (PURSUIT, EVADING, COOLDOWN, BUSTED, ESCAPED), units and a helicopter glyph when `heli`.
- One bar under it: during `pursuit` and `evading` it is the evade bar (blue fill), during
  `cooldown` the cooldown bar (green fill). The bust bar is a second, red bar that only appears
  while `bust > 0`.
- BUSTED and ESCAPED show large for 3 s, then the HUD fades out.
- Bounty and time in small type under the bars.
- Nothing may cover the minimap, the cluster or the area name.

Wire it in `src/main.js` with a one-line mount and one line in the frame loop that calls
`update(drive?.pursuitView?.() ?? null, dt)`. Do not edit `src/drive.js` or `src/ui/hud.js`.

For checking it without the police: add `__lowbeam.pursuitDemo(state)` in `main.js` that feeds a
scripted `PursuitView` sequence (pursuit at heat 2 with evade draining, evading filling, cooldown
filling, escaped), and shoot each stage at 480 lines. Test the pure parts (bar widths, which bar
shows, state words) in `tests/pursuit-hud.test.mjs` by exporting a pure `layoutPursuit(view)`.

## Part 2 (0.7.11): police on the minimap and the Tab map

`src/ui/minimap.js` and `src/ui/map.js` take a markers getter (the same `drive.policeMarkers`).
Police cars are small blue and red arrows pointing along `yaw` that blink with a siren rhythm
(0.4 s); the helicopter is a rotor glyph, and its `search` spot a translucent circle of radius `r`.
Markers outside the minimap's circle are clipped to its rim as edge arrows so the player can see
where a pursuer is. Extend `tests/map.test.mjs`. The demo in part 1 should also feed markers
moving around the player so both maps can be shot.

## Rules

- Do not edit: `src/drive.js`, `src/traffic/*`, `src/race/*`, `src/world/*`, `src/audio/*`,
  `src/render/*`, `src/vehicles/*`, `assets/`, `tools/blender/`. Ask in your report if you need
  something there.
- `src/main.js` and `style.css` are shared: small exact-string edits, re-read right before editing.
- `npm test` and `npm run check` green before each commit; verify by looking, shots in your report.
