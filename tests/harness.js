// Harness: carica index.html in jsdom con un canvas REALE (@napi-rs/canvas) per salvare PNG e guardarli.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');

const ROOT = path.join(__dirname, '..');
const SP = path.join(__dirname, 'out');
const FONTS = {
  'Anton': ['anton-latin-400-normal.woff2'],
  'Barlow Condensed': ['barlow-condensed-latin-600-normal.woff2', 'barlow-condensed-latin-700-normal.woff2', 'barlow-condensed-latin-800-normal.woff2', 'barlow-condensed-latin-900-normal.woff2'],
  'JetBrains Mono': ['jetbrains-mono-latin-400-normal.woff2', 'jetbrains-mono-latin-600-normal.woff2', 'jetbrains-mono-latin-700-normal.woff2'],
  'Cinzel': ['cinzel-latin-400-normal.woff2', 'cinzel-latin-700-normal.woff2', 'cinzel-latin-900-normal.woff2']
};
for (const [fam, files] of Object.entries(FONTS)) {
  for (const f of files) GlobalFonts.registerFromPath(path.join(ROOT, 'assets/fonts', f), fam);
}

async function open() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<link[^>]*assets\/[^>]*>/g, '');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true,
    beforeParse(w) {
      const proto = w.HTMLCanvasElement.prototype;
      const nc = (el) => (el.__nc || (el.__nc = createCanvas(300, 150)));
      Object.defineProperty(proto, 'width', { get() { return nc(this).width; }, set(v) { nc(this).width = v; }, configurable: true });
      Object.defineProperty(proto, 'height', { get() { return nc(this).height; }, set(v) { nc(this).height = v; }, configurable: true });
      proto.getContext = function () {
        const c = nc(this);
        if (!c.__ctx) {
          const ctx = c.getContext('2d');
          const cp = ctx.createPattern.bind(ctx);
          ctx.createPattern = (img, r) => cp(img && img.__nc ? img.__nc : img, r);
          const di = ctx.drawImage.bind(ctx);
          ctx.drawImage = (img, ...a) => di(img && img._img ? img._img : (img && img.__nc ? img.__nc : img), ...a);
          c.__ctx = ctx;
        }
        return c.__ctx;
      };
      proto.toDataURL = function (type, q) { return type === 'image/jpeg' ? nc(this).toDataURL('image/jpeg', Math.round((q || 0.92) * 100)) : nc(this).toDataURL('image/png'); };
      w.Image = class {
        set src(v) {
          this._s = v;
          loadImage(v).then(img => { this._img = img; this.width = img.width; this.height = img.height; this.onload && this.onload(); }).catch(() => this.onerror && this.onerror());
        }
        get src() { return this._s; }
      };
      w.document.fonts = { load: () => Promise.resolve(), ready: Promise.resolve() };
      w.matchMedia = () => ({ matches: false, addEventListener() {} });
      w.confirm = () => true; w.__dialogAuto = true; w.alert = (m) => console.log('ALERT', m);
      w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
    }
  });
  const w = dom.window;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  await sleep(600);
  const ev = (s) => w.eval(s);
  const shot = (name, setup) => {
    if (setup) ev(setup);
    ev('renderGraphic(true)');
    const c = w.document.getElementById('graphicCanvas');
    const buf = c.__nc.toBuffer('image/png');
    fs.mkdirSync(path.join(SP, 'shots'), { recursive: true });
    fs.writeFileSync(path.join(SP, 'shots', name + '.png'), buf);
    return path.join(SP, 'shots', name + '.png');
  };
  return { w, ev, sleep, shot, d: w.document };
}
module.exports = { open };
