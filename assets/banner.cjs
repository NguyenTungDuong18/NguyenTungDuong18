// Builds the animated pixel banner (assets/pixel-banner.svg) from Pixel Vocab Flight sprites.
// usage: node assets/banner.cjs <PixelVocabFlight>/Game/Assets/_Project/Art/Resources/Pixel assets/pixel-banner.svg
const fs = require('fs'), path = require('path');
const [dir, out] = process.argv.slice(2);
if (!dir || !out) throw new Error('usage: node banner.cjs <PixelDir> <out.svg>');

const W = 960, H = 320, GROUND = H - 26;
const NAME = 'NGUYỄN TÙNG DƯƠNG', SUB = 'BACKEND DEVELOPER';

// ---------- sprite frames: each PNG embedded once in <defs>, reused with <use> ----------
const defs = [];
const ids = new Map();
function frame(file, scale) {
  const key = file + '@' + scale;
  if (!ids.has(key)) {
    const buf = fs.readFileSync(path.join(dir, file));
    const w = buf.readUInt32BE(16) * scale, h = buf.readUInt32BE(20) * scale;
    const id = 'f' + ids.size;
    defs.push(`<image id="${id}" href="data:image/png;base64,${buf.toString('base64')}" width="${w}" height="${h}" style="image-rendering:pixelated"/>`);
    ids.set(key, { id, w, h });
  }
  return ids.get(key);
}
const frames = (folder, prefix) => fs.readdirSync(path.join(dir, folder))
  .filter(f => new RegExp('^' + prefix + '_\\d+\\.png$').test(f))
  .sort((a, b) => parseInt(a.match(/_(\d+)\.png$/)[1]) - parseInt(b.match(/_(\d+)\.png$/)[1]))
  .map(f => folder + '/' + f);

// cycle frames with discrete opacity; begin offsets desync identical sprites
function anim(files, scale, dur, begin = 0) {
  return files.map((f, i) => {
    const { id } = frame(f, scale);
    const vals = files.map((_, j) => (j === i ? 1 : 0)).join(';');
    return `<use href="#${id}" opacity="${i ? 0 : 1}"><animate attributeName="opacity" values="${vals}" dur="${dur}s" begin="${-begin}s" calcMode="discrete" repeatCount="indefinite"/></use>`;
  }).join('');
}

// ---------- 5x7 pixel font with Vietnamese marks drawn above the cap height ----------
const G = {
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  ' ': ['000', '000', '000', '000', '000', '000', '000'],
};
// marks: [row (negative = above the letter), col] pixels
const MARK = {
  circ: [[-2, 2], [-1, 1], [-1, 3]],
  tilde: [[-5, 1], [-5, 2], [-5, 4], [-4, 0], [-4, 3]],
  grave: [[-2, 1], [-1, 2]],
  horn: [[0, 5], [-1, 6]],
};
const ACCENT = { 'Ễ': ['E', 'circ', 'tilde'], 'Ù': ['U', 'grave'], 'Ư': ['U', 'horn'], 'Ơ': ['O', 'horn'] };
function glyph(ch) {
  const [base, ...marks] = ACCENT[ch] || [ch];
  const rows = G[base];
  if (!rows) throw new Error('no glyph for ' + ch);
  const px = [];
  rows.forEach((r, y) => [...r].forEach((c, x) => c === '1' && px.push([x, y, false])));
  marks.forEach(m => MARK[m].forEach(([y, x]) => px.push([x, y, true])));
  const width = Math.max(rows[0].length, ...px.map(p => p[0] + 1));
  return { px, width };
}

// sanity check: every name/subtitle char renders and the horn letters are wider
for (const ch of NAME + SUB) glyph(ch);
console.assert(glyph('Ư').width === 7 && glyph('U').width === 5, 'glyph widths');

const GOLD = ['#FFF6C2', '#FFE36E', '#FFD23F', '#FFB627', '#FF9F1C', '#F77F00', '#E85D04'];
function text(str, P, x0, y0, opts) {
  const gl = [...str].map(glyph);
  const total = gl.reduce((s, g) => s + (g.width + 1) * P, -P);
  let x = x0 === 'center' ? Math.round((W - total) / 2 / P) * P : x0;
  return gl.map((g, i) => {
    const gx = x; x += (g.width + 1) * P;
    if (!g.px.length) return '';
    return opts.render(g, gx, y0, i);
  }).join('');
}
const rects = (g, P, fill, dx = 0, dy = 0) =>
  g.px.map(([x, y, m]) => `<rect x="${x * P + dx}" y="${y * P + dy}" width="${P}" height="${P}" fill="${typeof fill === 'function' ? fill(y, m) : fill}"/>`).join('');

// name: drops in letter by letter with a bounce, then a wave + flash ripples across it every 6s
const NP = 6, NAME_Y = 72;
const nameSvg = text(NAME, NP, 'center', NAME_Y, {
  render: (g, gx, gy, i) => {
    const t = 0.3 + i * 0.07, wave = 4 + i * 0.09;
    return `<g transform="translate(${gx} ${gy})" opacity="0"><set attributeName="opacity" to="1" begin="${t}s" fill="freeze"/>` +
      `<g><animateTransform attributeName="transform" type="translate" values="0 -260;0 10;0 -8;0 0" keyTimes="0;0.6;0.82;1" dur="0.9s" begin="${t}s" fill="freeze"/>` +
      `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -12;0 0;0 0" keyTimes="0;0.08;0.16;1" dur="6s" begin="${wave}s" repeatCount="indefinite"/>` +
      rects(g, NP, '#2a1748', NP, NP) +
      rects(g, NP, (y, m) => (m ? GOLD[0] : GOLD[y])) +
      `<g opacity="0">${rects(g, NP, '#ffffff')}<animate attributeName="opacity" values="0;0.85;0;0" keyTimes="0;0.04;0.1;1" dur="6s" begin="${wave + 1.6}s" repeatCount="indefinite"/></g>` +
      `</g></g></g>`;
  },
});

// subtitle: typed in after the name lands, with a blinking block cursor
const SP = 3, SUB_Y = 150, SUB_T = 2.5;
let subEnd = 0;
const subSvg = text(SUB, SP, 'center', SUB_Y, {
  render: (g, gx, gy, i) => {
    subEnd = gx + (g.width + 1) * SP;
    return `<g transform="translate(${gx} ${gy})" opacity="0"><set attributeName="opacity" to="1" begin="${SUB_T + i * 0.06}s" fill="freeze"/>${rects(g, SP, '#5DADE2')}</g>`;
  },
});
const cursor = `<rect x="${subEnd + SP}" y="${SUB_Y}" width="${SP * 3}" height="${SP * 7}" fill="#5DADE2" opacity="0">` +
  `<animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.5;0.5;1" dur="1s" begin="${SUB_T}s" repeatCount="indefinite"/></rect>`;

// ---------- scenery ----------
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const snap = (v, s = 3) => Math.floor(v / s) * s;
// night gradient in flat bands, each boundary softened with a checkerboard dither row
const SKY = ['#0f1020', '#121428', '#15172d', '#181a2f', '#1a1b27'], BAND = 60;
const sky = SKY.map((c, i) => `<rect y="${i * BAND}" width="${W}" height="${i === SKY.length - 1 ? H : BAND}" fill="${c}"/>` +
  (i ? [...Array(W / 6)].map((_, k) => `<rect x="${k * 6 + (k % 2) * 3}" y="${i * BAND - 3}" width="3" height="3" fill="${c}"/>`).join('') : '')).join('');
const stars = [...Array(70)].map(() => {
  const x = snap(rnd() * W), y = snap(rnd() * (GROUND - 40)), d = (1.2 + rnd() * 2.5).toFixed(1), c = rnd() > 0.8 ? '#FFE36E' : '#AED6F1';
  return `<rect x="${x}" y="${y}" width="3" height="3" fill="${c}"><animate attributeName="opacity" values="1;0.15;1" dur="${d}s" begin="-${d}s" repeatCount="indefinite"/></rect>`;
}).join('');
const moon = ['00111100', '01111110', '11111111', '11111111', '11111111', '11111111', '01111110', '00111100']
  .flatMap((r, y) => [...r].map((c, x) => c === '1' ? `<rect x="${860 + x * 4}" y="${22 + y * 4}" width="4" height="4" fill="${(x + y) % 5 ? '#F4F1DE' : '#D8D3B8'}"/>` : '')).join('');
const cloud = (x, y, s, dur, op) =>
  `<g opacity="${op}"><animateTransform attributeName="transform" type="translate" from="${x} ${y}" to="${x - W - 200} ${y}" dur="${dur}s" begin="-${(dur * rnd()).toFixed(1)}s" repeatCount="indefinite"/>` +
  ['0011100000', '0111111100', '1111111111'].flatMap((r, ry) => [...r].map((c, rx) => c === '1' ? `<rect x="${rx * s}" y="${ry * s}" width="${s}" height="${s}" fill="#2c3352"/>` : '')).join('') + `</g>`;
const clouds = [cloud(W + 50, 30, 6, 60, 0.7), cloud(W + 400, 120, 8, 80, 0.5), cloud(W + 700, 200, 5, 45, 0.6)].join('');
const shooting = `<g opacity="0"><animateTransform attributeName="transform" type="translate" values="120 10;420 110" keyTimes="0;1" dur="0.8s" begin="3s;shoot.end+7s" id="shoot" fill="freeze"/>` +
  `<animate attributeName="opacity" values="0;1;0" dur="0.8s" begin="3s;shoot.end+7s"/>` +
  [0, 1, 2, 3, 4, 5].map(i => `<rect x="${-i * 6}" y="${-i * 2}" width="4" height="4" fill="#ffffff" opacity="${1 - i * 0.15}"/>`).join('') + `</g>`;
const ground = `<rect y="${GROUND}" width="${W}" height="${H - GROUND}" fill="#2b2f3a"/>` +
  [...Array(W / 12)].map((_, i) => `<rect x="${i * 12}" y="${GROUND}" width="12" height="4" fill="${i % 2 ? '#3d6b35' : '#4f8a43'}"/>` +
    (i % 7 === 3 ? `<rect x="${i * 12 + 4}" y="${GROUND - 4}" width="4" height="4" fill="#4f8a43"/>` : '')).join('');

// sparkles around the name once it has landed
const spark = frames('Effects/Combat', 'fx_spark');
const sparkles = [[150, 40], [790, 60], [470, 25], [300, 120], [660, 128]].map(([x, y], i) =>
  `<g transform="translate(${x} ${y})" opacity="0"><set attributeName="opacity" to="1" begin="2.4s" fill="freeze"/>${anim(spark, 2, 0.6 + i * 0.13, i * 0.2)}</g>`).join('');

// birds flapping across the top
const bird = frames('Effects/Nature', 'fx_bird').slice(0, 8);
const birds = [[0, 6, 22], [1, 26, 24], [2, 14, 23]].map(([i, y, dur]) =>
  `<g><animateTransform attributeName="transform" type="translate" from="-60 ${y}" to="${W + 60} ${y}" dur="${dur}s" begin="-${i * 2.2}s" repeatCount="indefinite"/>${anim(bird, 1, 0.8, i * 0.27)}</g>`).join('');

// fighter on a wavy path with puffs of smoke behind it
const fighter = frames('Aircraft/Fighter', 'fighter_level');
const smoke = frames('Effects/Combat', 'fx_smoke');
const path_ = [...Array(25)].map((_, i) => `${-120 + i * ((W + 240) / 24)} ${178 + Math.round(Math.sin(i / 2.2) * 16)}`).join(';');
const puffs = [0, 0.3, 0.6].map(b =>
  `<g opacity="0"><animateTransform attributeName="transform" type="translate" values="2 28;-46 22" dur="0.9s" begin="${b}s" repeatCount="indefinite"/>` +
  `<animate attributeName="opacity" values="0.9;0" dur="0.9s" begin="${b}s" repeatCount="indefinite"/>${anim(smoke, 2, 0.9, b)}</g>`).join('');
const plane = `<g><animateTransform attributeName="transform" type="translate" values="${path_}" dur="10s" begin="0s" repeatCount="indefinite"/>` +
  `${puffs}<g transform="rotate(90 32 32)">${anim(fighter, 2, 0.3)}</g></g>`;

// parade: the pilot leads, the whole base crew chases, dust under every step
const crew = ['pilot', 'mechanic', 'medic', 'engineer', 'guard', 'officer', 'professor'];
const dust = frames('Effects/Base', 'fx_dust');
const runners = crew.map((c, i) => {
  const x = -i * 64, run = frames('Characters/' + c, `chr_${c}_run_e`);
  return `<g transform="translate(${x} ${GROUND - 64})">` +
    `<g transform="translate(-22 50)" opacity="0.7">${anim(dust, 2, 0.6, i * 0.1)}</g>` +
    anim(run, 2, 0.64, i * 0.08) + `</g>`;
}).join('');
const paradeLen = crew.length * 64;
const parade = `<g><animateTransform attributeName="transform" type="translate" from="-60 0" to="${W + paradeLen} 0" dur="16s" begin="-4s" repeatCount="indefinite"/>${runners}</g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs><clipPath id="frame"><rect width="${W}" height="${H}" rx="10"/></clipPath>${defs.join('')}</defs>
<g clip-path="url(#frame)">
${sky}${stars}${moon}${clouds}${shooting}${birds}
${sparkles}${nameSvg}${subSvg}${cursor}
${plane}${ground}${parade}
</g>
</svg>`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, svg);
console.log('ok', out, (svg.length / 1024).toFixed(1) + ' KB');
