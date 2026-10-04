/**
 * The game's typefaces as CSS font stacks, and `loadFonts`, which waits until they are ready so the
 * canvas textures drawn while the world builds (signs, plazas, stations, dashboards) use them and not
 * a fallback. The faces are vendored in assets/fonts/ (fonts.css, tools/vendor-fonts.mjs).
 *
 * - `display`: Michroma, the original face of the menus and the HUD.
 * - `seg7`, `seg14`: DSEG seven and fourteen segment digits for digital dashboards and pump displays.
 * - `mono`: Share Tech Mono, monospace readouts.
 * - `impact`: Dela Gothic One, heavy banners for the police and the races (it has kana and kanji).
 * - `jp`: M PLUS 1p, Japanese text on signs and in the UI.
 */

export const FONT = {
  display: '"Lowbeam Display", "Michroma", sans-serif',
  seg7: '"DSEG7 Classic", monospace',
  seg14: '"DSEG14 Classic", monospace',
  mono: '"Share Tech Mono", monospace',
  impact: '"Dela Gothic One", "M PLUS 1p", sans-serif',
  jp: '"M PLUS 1p", "Yu Gothic", "Meiryo", "MS Gothic", "Noto Sans CJK JP", sans-serif',
};

/**
 * Every Japanese string the canvas textures draw, so the font pieces holding their characters are
 * fetched before the textures are (the CJK faces are split by unicode-range).
 */
const JP_TEXT = 'ラーメン居酒屋薬局書店喫茶理容酒寿司カラオケスナックホテル' +
  'ETC専用一般北東港湾岸普通大型円カメラ稼働中黒鉄高速パーソナルカード受付中速度違反取締中' +
  'きつね石油ほしセルフレギュラーハイオク軽油入口出口タイヤオイルバッテリー洗車コーティング' +
  '警察本部黒鉄';

/** Resolves once every face is loaded (or after `timeout` ms, so a missing file never blocks the game). */
export async function loadFonts(timeout = 4000) {
  if (typeof document === 'undefined' || !document.fonts) return;
  const want = [
    ['400 32px "DSEG7 Classic"', '0123456789'],
    ['700 32px "DSEG7 Classic"', '0123456789'],
    ['400 32px "DSEG14 Classic"', 'ABC0123456789'],
    ['700 32px "DSEG14 Classic"', 'ABC0123456789'],
    ['400 32px "Share Tech Mono"', 'ABC012'],
    ['400 32px "Dela Gothic One"', `ABC${JP_TEXT}`],
    ['400 32px "M PLUS 1p"', `ABC${JP_TEXT}`],
    ['700 32px "M PLUS 1p"', `ABC${JP_TEXT}`],
  ];
  const all = Promise.all(want.map(([font, text]) => document.fonts.load(font, text).catch(() => [])));
  await Promise.race([all, new Promise((r) => setTimeout(r, timeout))]);
}
