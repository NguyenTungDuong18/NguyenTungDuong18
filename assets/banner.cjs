// Builds an animated pixel banner SVG from PixelVocabFlight sprites.
// usage: node banner.cjs <PixelDir> <out.svg>
const fs = require('fs'), path = require('path');
const [dir, out] = process.argv.slice(2);
const W = 900, H = 160, S = 3; // banner size, sprite scale
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64');

// one <image> per frame; discrete opacity animation cycles through them
function sprite(files, w, h, dur) {
  const n = files.length;
  return files.map((f, i) => {
    const vals = files.map((_, j) => (j === i ? 1 : 0)).join(';');
    return `<image href="${b64(f)}" width="${w * S}" height="${h * S}" style="image-rendering:pixelated" opacity="${i ? 0 : 1}">` +
      `<animate attributeName="opacity" values="${vals}" dur="${dur}s" calcMode="discrete" repeatCount="indefinite"/></image>`;
  }).join('');
}

const run = [...Array(8)].map((_, i) => `Characters/pilot/chr_pilot_run_e_${i}.png`);
const fly = [...Array(4)].map((_, i) => `Aircraft/Fighter/fighter_level_${i}.png`);

// deterministic pixel stars
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const stars = [...Array(40)].map(() => {
  const x = Math.floor(rnd() * W / S) * S, y = Math.floor(rnd() * 90 / S) * S, d = (1 + rnd() * 2).toFixed(1);
  return `<rect x="${x}" y="${y}" width="${S}" height="${S}" fill="#AED6F1"><animate attributeName="opacity" values="1;0.2;1" dur="${d}s" repeatCount="indefinite"/></rect>`;
}).join('');
const ground = [...Array(W / (S * 4))].map((_, i) =>
  `<rect x="${i * S * 4}" y="${H - 18}" width="${S * 4}" height="${S}" fill="${i % 2 ? '#3d6b35' : '#4f8a43'}"/>`).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<rect width="${W}" height="${H}" rx="8" fill="#1a1b27"/>${stars}
<rect y="${H - 15}" width="${W}" height="15" fill="#2b2f3a"/>${ground}
<g><animateTransform attributeName="transform" type="translate" from="-100 -12" to="${W + 100} -12" dur="7s" repeatCount="indefinite"/>
<g transform="rotate(90 48 48)">${sprite(fly, 32, 32, 0.4)}</g></g>
<g><animateTransform attributeName="transform" type="translate" from="-80 ${H - 15 - 32 * S}" to="${W + 80} ${H - 15 - 32 * S}" dur="9s" repeatCount="indefinite"/>
${sprite(run, 24, 32, 0.8)}</g>
</svg>`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, svg);
console.log('ok', out, (svg.length / 1024).toFixed(1) + ' KB');
