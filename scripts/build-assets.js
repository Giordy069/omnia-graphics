// Genera assets/ (Tailwind compilato + font locali) cosi' l'app funziona offline.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const outFonts = path.join(root, 'assets', 'fonts');
fs.mkdirSync(outFonts, { recursive: true });

const fonts = [
  ['anton', 'Anton', [400]],
  ['barlow-condensed', 'Barlow Condensed', [600, 700, 800, 900]],
  ['jetbrains-mono', 'JetBrains Mono', [400, 600, 700]],
  ['cinzel', 'Cinzel', [400, 700, 900]]
];

let css = '';
for (const [pkg, family, weights] of fonts) {
  for (const w of weights) {
    const file = `${pkg}-latin-${w}-normal.woff2`;
    fs.copyFileSync(path.join(root, 'node_modules', '@fontsource', pkg, 'files', file), path.join(outFonts, file));
    css += `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:block;src:url("fonts/${file}") format("woff2");}\n`;
  }
}
fs.writeFileSync(path.join(root, 'assets', 'fonts.css'), css);

execSync('npx tailwindcss -c tailwind.config.js -i tailwind.input.css -o assets/tailwind.css --minify', { cwd: root, stdio: 'inherit' });
console.log('assets pronti');
