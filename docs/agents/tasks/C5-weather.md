# C5: Weather and the sky (Claude)

Rain and a day and night cycle for the night drive, which `docs/DESIGN.md` lists under "later". The
look is Claude's (render, world, UI); what weather and the hour do to the drive is the backend's
(`B3-wet-weather.md`).

## Done (0.10.3)

- `render/weather.js` (pure): `WEATHERS` (clear, drizzle, rain, storm), `LEVELS` (0, 0.35, 0.7, 1),
  `weatherLook(level)`: `wet` (soaks at 60 % of the level), the fog's distances, the streak count,
  fall speed, wind and brightness.
- `psx.js`: a `wet` option on `baked` materials: the surface darkens by 40 % of `uWet`, and each
  street lamp whose pool reaches the pixel adds a stretched reflection (`wetStreak`: a Gaussian across
  the line from the camera to the lamp, fading toward the camera, banded in four steps, stronger in
  puddles, a noise mask in world space). A true mirror reflection was tried first and showed nothing:
  its highlight falls between the camera and the lamp, outside the lamp's pool, which is all the
  shader knows about.
- `build-roads.js`: asphalt, lane asphalt, shoulders, sidewalks, zebras, stop lines, gore and dashes
  are `wet`. Not yet: bridge decks, the plazas' paving, the lots' asphalt.
- `render/rain.js`: `RainView`, 3,200 one-pixel streaks in a 44 by 26 by 44 m box that follows the
  camera, moved in the vertex shader from a seed and the time, leaning with the car's velocity.
- `world.js`: `setWeather(level)` (wetness, fog) and `stepWeather(dt, velocity)`; `main.js` applies the
  saved weather when the drive starts and steps the rain each frame.
- Settings: a WEATHER row (`ui/weather-setting.js`, saved as `weather`).

## Done (0.10.5): the sky and the time of day

- `render/daylight.js` (pure): `skyLook(hour, cloud)` gives the sky's colors, the fog, the hemisphere
  and key light, the stars, the sun and moon, and how bright the lamps and windows are; `TIMES`
  (night, dusk, dawn, day, cycle), `HOURS`, `advanceClock` (a day is 24 minutes).
- `render/sky.js`: `SkyView`, the dome as a shader with banded clouds, a glow round the sun and the
  town's glow on the horizon at night, the stars, the moon and the sun crossing the sky.
- `psx.js`: `uLamp` scales every street lamp, shop and neon pool (and the wet reflections) and
  `uWindows` the lit windows (materials with an `emissiveMap`); headlight pools and lamp flares keep
  30 % by day.
- `lit` materials (0.10.8): the street lamps' lenses, the shop windows and the gantry, plaza and gas
  station lamps dim to 12 % by day (`psxBasic({ lit: true })`), and the lit windows go out clean (a
  few amber squares were left at noon).
- `world.js`: `setTime`, `startCycle`, `applySky`, `stepSky`; the weather sets the cloud cover
  (`weatherLook(...).cloud`), so rain greys the sky and puts the stars and the moon out.
- Settings: a TIME OF DAY row; `__lowbeam.time('day')`.

## Done (0.10.6): no rain under a roof

- `world/rain-cover.js`: `placeRoofs` (the gas stations' and the toll plazas' canopies), `coverAt` (the
  height of the roof over a point: a lifted road found with the asker held high, or a canopy) and
  `CoverGrid` (64 by 64 cells of 1 m round the camera, refilled when it moves 9 m, slits of up to 3
  cells between roofs closed, the Kurogane Line's two carriageways stand a median apart).
  `RainView` reads it as a float texture in the vertex shader and hides a streak under the roof.
- Not covered yet: shop awnings, building overhangs, the Route 1 gantries (open frames), trees.

## To do

- The vending machines' fronts and the sign atlases stay as bright by day as by night (signs are,
  in life); the traffic lights' lamps could take a brighter day value.
- Shadows are not drawn: a sun with no shadows reads flat at noon. A blob shadow under each car and a
  few long ones for the buildings at dawn and dusk would help.
- Dawn and dusk look alike (the glow follows the sun's direction, not the side of the sky).
- Stars twinkle, and the moon's phase follows a calendar; fireflies or birds by day, in the audio
  (`B3-wet-weather.md` part 4).
- A halo round each lamp head in the wet (the glow on a wet lens), and the headlights' reflection on
  the road in front of the player's car.
- Rain under cover: no streaks under a deck, a canopy or a gas station roof.
- The rest of the road surfaces (bridge decks, plazas, lots), and the sidewalks' brown pools read too
  warm when wet; try a cooler tint.
- Splashes where the streaks land near the camera.
- The screen: drops on the lens in the chase cameras, or wipers in the cockpit.
