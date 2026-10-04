/**
 * Landmark lots and the models standing on them (the police headquarters, the garages, the
 * hideouts). Pure: where a model sits and faces, and its colliders and lights in world space, so
 * the scatter can add them before the light pools are built. The meshes are made in models.js.
 *
 * A model (assets/models/<name>.json, exported by tools/blender/kit.py) is authored with its front
 * toward +z; on its lot the front faces the road.
 */

/**
 * @typedef {{ name: string, size: number[], materials: { name: string, color: number, tex: string, emissive: boolean }[],
 *   groups: { material: number, start: number, count: number }[], position: number[], normal: number[], uv: number[],
 *   colliders: { x: number, z: number, hx: number, hz: number, y0: number, y1: number }[],
 *   lights: { x: number, y: number, z: number, c: number[], range: number, spot: number }[] }} ModelData
 * @typedef {import('./ground.js').Pad & { lot: import('./layout.js').Lot }} LotPad
 */

/** Where a lot's model stands: its origin and the yaw that turns its front to the road. @param {LotPad} pad */
export function lotFrame(pad) {
  return { x: pad.cx, y: pad.h, z: pad.cz, yaw: Math.atan2(-pad.vx, -pad.vz) };
}

/**
 * A point of the model in world space. @param {{ x: number, z: number, yaw: number }} f
 * @param {number} x @param {number} z
 */
export function toWorld(f, x, z) {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return [f.x + x * c + z * s, f.z - x * s + z * c];
}

/**
 * Colliders and lights of every lot whose model is loaded, in world space.
 * @param {LotPad[]} lots @param {Record<string, ModelData>} models
 */
export function lotContents(lots, models) {
  /** @type {import('./scatter.js').Box[]} */
  const boxes = [];
  /** @type {import('./scatter.js').BakeLight[]} */
  const lights = [];
  for (const pad of lots) {
    const m = models[pad.lot.model];
    if (!m) continue;
    const f = lotFrame(pad);
    for (const c of m.colliders) {
      const [x, z] = toWorld(f, c.x, c.z);
      boxes.push({ x, z, hx: c.hx, hz: c.hz, yaw: f.yaw, y0: f.y + c.y0, y1: f.y + c.y1 });
    }
    for (const l of m.lights) {
      const [x, z] = toWorld(f, l.x, l.z);
      lights.push({ x, y: f.y + l.y, z, c: l.c, range: l.range, spot: l.spot || 0 });
    }
  }
  return { boxes, lights };
}
