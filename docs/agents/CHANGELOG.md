# Changelog

## 0.1.0 (2026-10-02)

First commit. Plan, scaffold and the pure core.

- `docs/DESIGN.md`: the plan for the night rally milestone, including the arcade gauge
  cluster, the cockpit camera and the long-term open-world direction.
- Scaffold: vendored Three.js r185, import-map setup, `tools/devserver.mjs` with canvas
  capture, `tsc` type-checking, `node --test`.
- World: seeded valley terrain, spline roads with smoothed and grade-clamped profiles,
  junction blending, carved heightfield, three gas station pads, `Ground.at`.
- Vehicles: three car specs and a 120 Hz bicycle-model physics with load transfer,
  traction control, automatic gearbox, reverse, jumps and fuel. Tuned so the garage
  bars match the sim.
- Render plumbing (not yet run): low-res target with dither and 15-bit quantize,
  PSX materials with vertex snapping and baked light, `MeshBuilder`.
- `tools/sim.mjs` tuning bench. 11 tests.
