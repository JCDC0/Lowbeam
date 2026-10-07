# C2: The pursuit overhaul (Claude)

Jc's requests of 0.9.15, gathered into one plan. The model is Need for Speed: Most Wanted (2005):
its pursuit HUD, its heat on the radar, its "cop taken out" moments. The world and the feel of the
driving stay Night-Runners Prologue. Parts are in order; each is one or more commits in Claude's
range, with tests for the rules and screenshots for the looks. C1 part 7 (Gemini's police and racer
bodies into the game) goes first, so the cars being rammed and destroyed are the real models.

## 1. One set of car physics for everybody (done in 0.9.18)

Today traffic is kinematic: a car the player hits becomes a sliding wreck, and a police unit
wrecks above 9 m/s. Instead, every car the player touches (civilians, racers, police) collides with
the same rules as the player's own car.

- Each traffic kind gets a mass, a size and a grip (`traffic/kinds.js`; kei cars light, trucks and
  buses heavy). Car-to-car contact (`vehicles/contact.js`) exchanges momentum by mass both ways: a
  kei car is knocked aside, a bus stops the player.
- A car that is hit leaves its lane as a free body for as long as it is moving off line: it slides,
  spins, scrapes the walls (`sim.collideWorld`), then rejoins traffic if it can, or stays a wreck.
- Civilians and racers do not break. Only the police do (part 2).
- Tests: a light car loses more speed than a heavy one in the same hit; momentum is conserved; a
  glancing hit spins, a square one stops.

## 2. Police cars that can be destroyed (done in 0.9.19)

- Every unit kind gets hit points (`police/units.js`): cruiser 100, unmarked 80, interceptor 120,
  Rhino 260. Damage comes from the impulse of each hit, the walls included, so a hard ram or a
  unit sent into a pillar costs it most.
- Damage shows: a smoking unit below half, sparks and a limp below a quarter, and at zero it is
  destroyed: it spins out, the light bar dies, it burns with smoke and stays on the road as a wreck.
- A destroyed unit counts in `rapSheet` (units destroyed), adds to the bounty (by kind: ¥5,000 a
  cruiser up to ¥20,000 a Rhino) and raises heat a little, as Most Wanted does.
- If Gemini's models need it later: a burnt shell variant and a loose light bar (a G task).

## 3. Being noticed: the detection bar (done in 0.9.71)

- A unit that can see the player (the line-of-sight rules in `sight.js`) shows a marker above it in
  the world and on the minimap, and the detection bar fills while it watches.
- What fills it: speeding past a unit within its range, racing in front of it, a speed trap. What
  provokes a pursuit at once: crashing into a unit, or a near miss at speed within a few meters.
  A full bar starts the pursuit. Out of sight the bar drains.
- The police also chase street racers now and then: a patrol that sees a racer above the limit
  pursues it with lights and sirens and gives up after a while. A racer chase that comes near the
  player can draw the player in.

## 4. More helicopters (done in 0.9.72)

Heat 3: one helicopter, heat 4: two, heat 5: three, each with its own searchlight and rotor sound,
spread round the player so their searchlights cover different streets. The count is a setting in
`units.js` and drops if the frame rate suffers.

## 5. The pursuit HUD, Most Wanted style (done in 0.9.73)

- One panel at the bottom center of the screen, never pulsing:
  - the evade / busted meter across it;
  - the heat level (1 to 5) as the difficulty meter;
  - the bounty, counting up as it grows;
  - units on the scene (in pursuit now), units nearby (within sight), units destroyed (the kill
    meter);
  - a helicopter symbol per helicopter up.
- The typeface is Michroma (`FONT.display`, `--font-display`), the wide squared face already
  bundled, for every number and word in the pursuit HUD and its banners (Jc's choice).
- The HUD leaves at once when the pursuit ends or the screen changes (a garage, a menu, the map):
  no fade that lingers or pulses over the next screen. The bug today: the panel keeps pulsing when
  the player enters a garage.

## 6. (done in 0.9.74) Banners with flair

- The toasts and pursuit banners become a small set of styles: a slam-in banner (fast scale and
  slide, a hold, a quick exit) for events, and a quiet line for information. No pulse in and out.
- "Cop taken out": a white flash, a short camera shake, a hit sound, and a banner that slams in with
  the unit and the bounty it added (`COP TAKEN OUT  +¥5,000`). The same family for BUSTED, ESCAPED,
  ROADBLOCK, SPIKE STRIP and the heat going up.

## 7. A bigger minimap with the heat on it

- The minimap grows from 168 to about 220 px (it scales with the window as now).
- The heat level sits on its rim, as on Most Wanted's radar: five marks lit by heat, the rim red
  and blue in a pursuit.
- Units show their sight: a cone ahead of each searching unit, a lit marker on each one that sees
  the player; helicopters show their searchlight.

## 8. The audio expansion

- Pass-bys: today one swish whatever the speed. Each nearby car gets its own voice from a small pool
  (engine and tire noise, panned and Doppler shifted, louder and longer the faster it closes), so a
  bus at 40 and a racer at 250 sound nothing alike.
- Each civilian kind has its own engine voice (kei car buzz, sedan, van, diesel truck, bus).
- Horns: civilians honk when the player overtakes on the wrong side, cuts in close, runs a red, or
  scrapes them; each kind has its own horn.
- Panic in a pursuit: civilians near the chase brake hard, swerve to the side, honk and screech.
- Police: the siren voices already exist; a destroyed unit's siren dies with a wind-down.

## Inspirations, recorded

`docs/DESIGN.md` names what each game governs: Need for Speed: Most Wanted (2005) for the police,
the pursuit loop, its HUD and banners and the heat; Night-Runners Prologue for the world, the night,
the rendering and the driving. (Jc's "Midnight Runners Prologue" is Night-Runners Prologue.)
