# C5: Weather (Claude)

Rain for the night drive, which `docs/DESIGN.md` lists under "later". The look is Claude's (render,
world, UI); what rain does to the drive is the backend's (`B3-wet-weather.md`).

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

## To do

- The sky in the rain: the stars and the moon fade, the horizon band greys.
- A halo round each lamp head in the wet (the glow on a wet lens), and the headlights' reflection on
  the road in front of the player's car.
- Rain under cover: no streaks under a deck, a canopy or a gas station roof.
- The rest of the road surfaces (bridge decks, plazas, lots), and the sidewalks' brown pools read too
  warm when wet; try a cooler tint.
- Splashes where the streaks land near the camera.
- The screen: drops on the lens in the chase cameras, or wipers in the cockpit.
