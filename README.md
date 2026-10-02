# Lowbeam

A PS1-style night driving game in the browser. One valley at night, three cars, three
gas stations and a gravel rally stage up into the mountains. Inspired by Night-Runners
Prologue and Need for Speed: Most Wanted (2005).

Work in progress: the world and the car physics exist; the playable page does not yet.
See `docs/DESIGN.md` for the plan and `docs/agents/ARCHITECTURE.md` for the current state.

```bash
npm install
npm test
npm start
```

Everything (models, textures, sounds) is generated in code. Three.js is vendored under
its MIT license in `vendor/`.
