/**
 * The sky's clock as numbers. Pure: `render/sky.js` draws the dome, the sun, the moon and the stars
 * and `world.js` applies the light and the fog from what `skyLook` says. A time is an hour from 0 to
 * 24 (6 sunrise, 12 noon, 18 sunset, 0 midnight); the cloud cover, 0 clear to 1 overcast, comes from
 * the weather (`render/weather.js`) and greys the sky, hides the stars and the moon and dims the light.
 *
 * Every color here is sRGB, 0 to 1; the views convert them.
 */

/** @typedef {[number, number, number]} Rgb */

/** The times Settings offers, as hours. `cycle` runs the clock from `CYCLE_START`. */
export const TIMES = /** @type {const} */ (['night', 'dusk', 'dawn', 'day', 'cycle']);
/** @typedef {typeof TIMES[number]} TimeSetting */

/** The hour each fixed time stands at. @type {Record<string, number>} */
export const HOURS = { night: 23.2, dusk: 18.2, dawn: 5.8, day: 12.5 };

/** Where a cycle begins, and how many real seconds a day of it takes. */
export const CYCLE_START = 17.6;
export const CYCLE_SECONDS = 24 * 60;

/** Hours the clock advances per real second in a cycle. */
export const CYCLE_RATE = 24 / CYCLE_SECONDS;

const hex = (h) => /** @type {Rgb} */ ([(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255]);
const mix = (a, b, t) => /** @type {Rgb} */ ([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const NIGHT = {
  zenith: hex(0x020309), mid: hex(0x0a0f22), horizon: hex(0x1e2540), glow: hex(0x3a2a30), below: hex(0x07090f),
  fog: hex(0x070a14), hemiSky: hex(0x4a5a82), hemiGround: hex(0x101012), hemi: 1.0,
  cloudLit: hex(0x3a4562), cloudDark: hex(0x0a0e1a),
};
const DAY = {
  zenith: hex(0x3a72c4), mid: hex(0x74a4e0), horizon: hex(0xc4dcf0), glow: hex(0xc4dcf0), below: hex(0x6a766c),
  fog: hex(0xb4c9de), hemiSky: hex(0xa4c0e6), hemiGround: hex(0x6a665c), hemi: 2.1,
  cloudLit: hex(0xf6f8fb), cloudDark: hex(0x8894a6),
};
const TWILIGHT = {
  zenith: hex(0x1a2252), mid: hex(0x5c4a7c), horizon: hex(0xf08a52), glow: hex(0xff9a58), below: hex(0x2a2630),
  fog: hex(0x6a5068), hemiSky: hex(0x8a74a0), hemiGround: hex(0x2c2420), hemi: 1.3,
  cloudLit: hex(0xffb48a), cloudDark: hex(0x6a4a62),
};
const GREY_DAY = { sky: hex(0x8e98a4), fog: hex(0x9aa4ae), cloud: hex(0xb0b8c2) };

const SUN_COLOR = hex(0xfff0d2);
const SUN_LOW = hex(0xff9a5a);
const MOON_COLOR = hex(0xa4b6e0);

/**
 * The sun's height from -1 (midnight) through 0 (sunrise and sunset) to 1 (noon).
 * @param {number} hour
 */
export function sunAltitude(hour) {
  return Math.sin(((hour - 6) / 24) * Math.PI * 2);
}

/**
 * Unit vector toward the sun: up in the east at dawn, high in the south at noon, down in the west at
 * dusk (north is -z).
 * @param {number} hour @returns {Rgb}
 */
export function sunDirection(hour) {
  const phi = ((hour - 6) / 24) * Math.PI * 2;
  const x = Math.cos(phi);
  const y = 0.92 * Math.sin(phi);
  const z = 0.5 * Math.sin(phi);
  const n = Math.hypot(x, y, z);
  return [x / n, y / n, z / n];
}

/** The same hour on a clock that wraps. @param {number} hour */
export function wrapHour(hour) {
  return ((hour % 24) + 24) % 24;
}

/**
 * Pushes a color toward a grey of the same brightness, for an overcast sky: a night stays dark, a day
 * goes flat and pale.
 * @param {Rgb} c @param {Rgb} grey @param {number} k
 */
const overcast = (c, grey, k) => {
  const s = (c[0] + c[1] + c[2]) / (grey[0] + grey[1] + grey[2]);
  return mix(c, [grey[0] * s, grey[1] * s, grey[2] * s], k);
};

/**
 * What the sky and the light are at an hour under a cloud cover.
 * @param {number} hour 0 to 24
 * @param {number} [cloud] 0 clear to 1 overcast
 */
export function skyLook(hour, cloud = 0) {
  const h = wrapHour(hour);
  const alt = sunAltitude(h);
  const c = clamp01(cloud);
  const day = smooth(-0.14, 0.3, alt);
  const twilight = Math.exp(-((alt / 0.21) ** 2)) * (1 - 0.5 * c);

  /** @param {keyof typeof NIGHT} key */
  const pal = (key) => {
    const base = mix(/** @type {Rgb} */ (NIGHT[key]), /** @type {Rgb} */ (DAY[key]), day);
    return mix(base, /** @type {Rgb} */ (TWILIGHT[key]), twilight * 0.85);
  };
  const grey = (/** @type {Rgb} */ col, /** @type {Rgb} */ g, k) => overcast(col, g, k * 0.8);
  const zenith = grey(pal('zenith'), GREY_DAY.sky, c);
  const mid = grey(pal('mid'), GREY_DAY.sky, c);
  const horizon = grey(pal('horizon'), GREY_DAY.fog, c * 0.9);
  const glow = grey(pal('glow'), GREY_DAY.fog, c * 0.9);
  const below = pal('below');
  const fog = grey(pal('fog'), GREY_DAY.fog, c);
  const hemiSky = grey(pal('hemiSky'), GREY_DAY.sky, c * 0.7);
  const hemiGround = pal('hemiGround');
  const hemi = lerp(NIGHT.hemi, DAY.hemi, day) * lerp(1, 0.9, c) + twilight * 0.15;

  const sunDir = sunDirection(h);
  const moonDir = /** @type {Rgb} */ ([-sunDir[0], -sunDir[1], -sunDir[2]]);
  const dim = 1 - 0.6 * c;
  const sunI = 3.2 * smooth(0, 0.3, alt) * dim;
  const moonI = 0.9 * smooth(0, 0.3, -alt + 0.1) * (1 - 0.65 * c);
  const useSun = sunI >= moonI;
  const sunCol = mix(SUN_LOW, SUN_COLOR, smooth(0.05, 0.4, alt));
  const keyDir = useSun ? sunDir : moonDir;
  const keyColor = useSun ? sunCol : MOON_COLOR;
  const keyIntensity = Math.max(sunI, moonI);

  const clear = 1 - c;
  const lamp = clamp01(1 - smooth(-0.04, 0.3, alt) + 0.28 * c * day);
  return {
    hour: h,
    sunAlt: alt,
    day,
    twilight,
    zenith, mid, horizon, glow, below, fog,
    hemiSky, hemiGround, hemi,
    sunDir, moonDir,
    keyDir, keyColor, keyIntensity,
    stars: (1 - day) ** 2 * clear * clear,
    sunAlpha: smooth(-0.1, 0.05, alt) * (1 - c) ** 1.5,
    moonAlpha: smooth(-0.05, 0.1, -alt + 0.12) * (1 - c) ** 1.5,
    sunGlow: smooth(-0.12, 0.1, alt) * (1 - 0.7 * c),
    sunColor: sunCol,
    city: (1 - day) * (1 - 0.4 * c),
    lamp,
    windows: clamp01((lamp - 0.12) / 0.88),
    cloudLit: grey(pal('cloudLit'), GREY_DAY.cloud, c * 0.5),
    cloudDark: grey(pal('cloudDark'), GREY_DAY.cloud, c * 0.9),
    cloud: c,
  };
}

/**
 * Advances a cycle's clock. @param {number} hour @param {number} dt seconds
 */
export function advanceClock(hour, dt) {
  return wrapHour(hour + CYCLE_RATE * dt);
}

/** Whether a stored value names a time setting. @param {any} t @returns {t is TimeSetting} */
export function isTime(t) {
  return TIMES.includes(t);
}

/**
 * The next time in the cycle of settings. @param {TimeSetting} t @param {number} [step]
 * @returns {TimeSetting}
 */
export function nextTime(t, step = 1) {
  const i = TIMES.indexOf(t);
  return TIMES[(Math.max(0, i) + step + TIMES.length) % TIMES.length];
}
