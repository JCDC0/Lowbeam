# A14: Blinkers on the traffic and the pass-by whoosh (Hermes)

Two things the street should feel like: civilian cars that signal before they move, and the
"shwoom" of a car going past you, as strong as the speed between you. Read
`docs/agents/ARCHITECTURE.md` (Traffic, Audio) and the shared-tree rules in `README.md` first.

Version numbers: 0.7.15 (part 1) and 0.7.16 (part 2). Claude has 0.7.4 to 0.7.9 (the helicopter,
the gas stations, the city buildings), Antigravity 0.7.10 to 0.7.14 (A13, the pursuit HUD).

## Part 1 (0.7.15): blinkers

Files: `src/traffic/sim.js`, `src/traffic/render.js` (Claude hands it to you for this task),
tests.

- Agent field `signal`: -1 left, 0 off, 1 right, in the driver's own frame (traffic keeps left,
  `d` positive to the left of travel, as everywhere else).
- A civilian that decides to change lanes signals first and only moves after 1.2 to 2.5 s (per
  driver, from the agent's own random stream), then checks the gap again; if it closed, the
  signal goes off and the change is dropped. The signal stays on through the move and goes off
  when it ends. Planned changes for an exit or a turn signal the same way.
- Turns at a junction: signal from about 60 m before the stop line (or the turn link) through
  the turn. Taking an exit ramp: signal from the start of the taper. An entry ramp merging into a
  carriageway: signal toward the carriageway over the last stretch.
- Street racers never signal (they weave). A wreck runs its hazards (both sides) until it fades.
- Render: amber flares at the outer head and tail lamp spots on the signalling side
  (`lampSpots` already finds the lamps; take the spot farthest to that side), blinking at about
  1.5 Hz (0.33 s on, 0.33 s off), phase per agent so a queue does not blink in unison. Same flare
  mesh, so no new draw call; check `MAX_FLARE_CARS * 4` still fits or raise it.
- Tests: a lane change is preceded by at least 1.2 s of signal on the right side; a dropped change
  turns the signal off; racers never signal; the lane flip-flop numbers in ARCHITECTURE (3.3 %)
  do not get worse.

## Part 2 (0.7.16): the pass-by whoosh

Files: new pure `src/audio/passby.js`, `src/audio/audio.js` (the voice; Claude hands it to you
for this task), one small hook in `src/drive.js` passing the nearby agents into `audio.update`,
tests.

- `passby.js` (pure, no Web Audio): `PassBy` tracks every traffic agent within about 80 m of the
  player. For each it watches the relative position and velocity; when the closest approach
  happens (the dot of relative position and relative velocity turns from negative to positive)
  within about 14 m and the relative speed is over about 8 m/s, it emits one event
  `{ speed, dist, side, heavy, kind }`: `speed` the relative speed (m/s), `dist` the miss distance,
  `side` -1 left or 1 right of the player, `heavy` for trucks, buses, tankers and semis. One event
  per pass, never two for the same car until it has gone away again.
- Voice (`audio.js`): filtered noise, a short swell and decay whose length shrinks with speed
  (about 0.25 + 6 / speed s), loudness rising with speed (strong at 30 m/s and up) and falling with
  miss distance, a band-pass that sweeps down through the pass (Doppler), panned to `side`, plus
  a low rumble layer for `heavy`. Through the effects channel and the same camera low-pass as the
  tires, so the cockpit muffles it. A car you pass at 200 km/h against traffic at 60 must sound
  violent; one creeping by at 15 km/h must be nearly nothing.
- Render a check with `tools/audio-lab.html` (or a Node render like `tools/render-engines.mjs`): a
  WAV of a few passes at 20, 60 and 120 km/h relative, for the user to listen to.
- Tests: one event per pass; none for a car matching your speed beside you; louder for faster and
  closer; side is right.

## Rules

- Do not edit: `src/world/*`, `src/render/*`, `src/vehicles/*`, `src/ui/*` (Antigravity's A13 is
  there), `assets/`, `tools/blender/`, `src/audio/music.js`, `src/audio/soundtrack.js`.
- `src/drive.js` and `style.css` are shared: small exact-string edits, re-read right before editing.
- `npm test` and `npm run check` green before each commit; verify by looking (a shot of a queue
  blinking at a junction at 480 lines) and by listening (the WAV).
- After A14 comes the police core (cars from the HQ motor pool, the pursuit as a `RaceEvent`, heat,
  evading), once Claude's helicopter lands. Its contract is already in `A13-pursuit-hud.md`.
