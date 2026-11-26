// Prova gli handler IPC del processo principale con un 'electron' simulato
const Module = require('module'); const fs = require('fs'); const os = require('os'); const path = require('path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'omnia-main-'));
const out = path.join(tmp, 'out'); fs.mkdirSync(out);
const handlers = {}; let picked = out, revealed = null;
const fake = {
  app: { getPath: () => tmp, whenReady: () => ({ then() {} }), on() {}, isPackaged: false },
  BrowserWindow: Object.assign(function () {}, { fromWebContents: () => ({}) }),
  Menu: { setApplicationMenu() {} },
  dialog: { showOpenDialog: async () => ({ canceled: !picked, filePaths: [picked] }), showMessageBox: async () => ({ response: 1 }) },
  ipcMain: { handle: (n, f) => { handlers[n] = f; } },
  shell: { showItemInFolder: (p) => { revealed = p; } }
};
const orig = Module._load;
Module._load = function (req, ...a) { if (req === 'electron') return fake; if (req === 'electron-updater') return { autoUpdater: { on() {} } }; return orig.call(this, req, ...a); };
require('../main.js');
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const rej = async (p) => { try { await p; return false; } catch (e) { return e.message; } };
const PNG = 'data:image/png;base64,iVBORw0KGgo=';
(async () => {
  ok(await rej(handlers['save-files'](null, out, [{ name: 'a.png', dataUrl: PNG }])) === 'DIR_NON_AUTORIZZATA', 'cartella non scelta: rifiutata');
  await handlers['pick-folder']({ sender: {} });
  const saved = await handlers['save-files'](null, out, [{ name: 'a.png', dataUrl: PNG }, { name: 'b.jpg', dataUrl: 'data:image/jpeg;base64,/9j/4AAQ' }]);
  ok(saved.length === 2 && fs.existsSync(path.join(out, 'a.png')) && fs.existsSync(path.join(out, 'b.jpg')), 'cartella scelta: salva png e jpg');
  ok(await rej(handlers['save-files'](null, tmp, [{ name: 'a.png', dataUrl: PNG }])) === 'DIR_NON_AUTORIZZATA', 'altra cartella: rifiutata');
  ok(!!(await rej(handlers['save-files'](null, out, [{ name: 'x.png', dataUrl: 'data:image/jpeg;base64,AAAA' }]))), 'png con data URL jpeg: rifiutato');
  ok(!!(await rej(handlers['save-files'](null, out, [{ name: '..\evil.exe', dataUrl: PNG }]))), 'nome non immagine: rifiutato');
  ok(!!(await rej(handlers['save-files'](null, out, 'x'))) && !!(await rej(handlers['save-files'](null, out, []))), 'elenco non valido: rifiutato');
  ok(!!(await rej(handlers['save-files'](null, out, Array.from({ length: 31 }, () => ({ name: 'a.png', dataUrl: PNG }))))), 'troppi file: rifiutato');
  handlers['reveal-file'](null, path.join(out, 'a.png')); ok(revealed === path.join(out, 'a.png'), 'reveal in cartella autorizzata');
  revealed = null; handlers['reveal-file'](null, path.join(tmp, 'export-dirs.json')); ok(revealed === null, 'reveal fuori cartelle autorizzate: ignorato');
  console.log(fails ? 'FAILS ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
