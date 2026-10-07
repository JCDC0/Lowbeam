# C1: Claude's queue, in order

Jc's requests of 2026-10-07 after the police rebuild (0.9.3), with what Claude owns in each. Gemini's
side is in G3 and G4; the backend seat is empty, so Claude also takes the logic parts. One version per
part, from 0.9.5.

## 1. Cars hit the world (logic, sim and Drive)

Every car but the player's can pass through buildings today: a wreck slides through walls, a unit
driving free at the player cuts through a block, a car shoved off its lane ends up inside a barrier.

- A hook on `TrafficSim` like `clear` and `groundAt`: `hitWorld(x, z, r, y)` returns the contact
  from `Colliders.probe`. Each agent off its lane (a wreck, a free unit, a shoved car) is three
  circles along its length like the player; contacts push it out and take its speed along the
  normal, with a little bounce and a spin from an off-center hit.
- A hard hit on a wall wrecks a civilian or a racer; a unit hit above 9 m/s is wrecked and lost to
  the pursuit, the same rule as a hit from the player.
- Lane followers stay as they are (the lanes are clear of walls), but a racer or a unit changing lanes
  at speed into a barrier is caught by the same test.
- Tests: a wreck sliding at a building stops at its face; a free unit aimed through a block stops at
  the wall and goes back to the lanes; nothing ends a step inside a solid box.

## 2. Lights and sirens

- Light bars: red on the left, blue on the right, flashing in Most Wanted's quad pattern (two fast
  pulses a side), bigger flares, and the bar lights its surroundings: the nearest four units each
  get a dynamic light pool that throws red and blue onto the road, the walls and the player's car.
- Blinkers: the flare grows and a small amber pool lights the road at the corner.
- Sirens (B1 part 3): wail, yelp and hi-lo, synthesized, on the nearest three units, with Doppler
  from the relative speed, through the effects channel and muffled in the cockpit like the tires; the
  helicopter's rotor by distance. A pursuit puts the music in the `intense` mood at once and keeps it
  through cooldown. A check WAV rendered like `tools/render-passby.mjs`.

## 3. Music

- The swell comes in earlier: silent below 30 km/h, full at 75 (60 on the pass); today it is 50 and
  140 (`SWELL` in `src/audio/soundtrack.js`).
- A manifest, `assets/music/tracks.json`, lists each file with its mood and whether it has vocals,
  so Jc's new songs drop in without a code change. Vocal tracks stay in until their instrumental
  mixes arrive, then the manifest swaps them.

## 4. Instruments (Jc's sketch)

- Outside view: the HUD gauges stack vertically; the small gauges curve along the side of the main
  dial the way the first `classic` speedometer does; the warning lamps sit inside the main dial.
- Cockpit: the instruments become small and sit recessed in a binnacle under the windshield, above
  the wheel. They are not meant to be read: the needles and the fuel line move, that is all. A
  digital car gets a wide, low screen with small panels; an analog car three small round dials.

## 5. The city expressway and greenery

- A Shuto-style elevated expressway, the second layer: it leaves Route 1 at two junctions and runs
  over the downtown avenues on pillars at about 12 m, with on and off ramps down to the streets. The
  ground stays the first layer; `Ground.at(x, z, y)` already tells the decks apart. Traffic, the
  police routes and the minimap follow it.
- Greenery in the city: street trees in grates along the avenues, hedges and shrubs in the medians and
  at building fronts, a few pocket parks, from Gemini's G4 models once they pass, placed by the scatter.

## 6. Nitrous

A bottle per car, refilled at a pump for a fee. Held (a new rebindable key), it adds torque for as
long as it lasts, about 8 s a bottle, and the cost is real:

- the engine heats fast while it flows, so a long shot on a hot engine reaches the red;
- each shot adds a little damage, more when it is fired at high load or near the limiter;
- it pushes the revs: fired near the redline or held through a gear, it drives the engine past the
  limiter into over-rev, and past 11,000 rpm it blows like a money shift. Shifting up in time is the
  skill.
- The HUD and the cockpit show the bottle (a small gauge or a bar per style), the exhaust spits blue
  flame, and the engine sound hardens while it flows.
- Pure in `physics.js` and `thermal.js` with tests: the torque gain, the heat rate, the damage per
  shot, the over-rev and the blow when it is held through the limiter, nothing when the bottle is
  empty; the bars in `tools/sim.mjs` stay as they are without it.

## 7. Gemini's models into the game

The Mazuma (G2) into the traffic renderer with the game's wheels; the G1 props; the four police cars
(G3) in place of the borrowed civilian bodies, with their light bars driven by part 2; then the racers
and the civilians move to Blender models one by one as Gemini makes them.
