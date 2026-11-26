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
  // video: encoding reale con FFmpeg a partire da fotogrammi JPEG
  const { createCanvas } = require('@napi-rs/canvas');
  const frame = (i) => { const c = createCanvas(108, 134); const x = c.getContext('2d'); x.fillStyle = '#ff4655'; x.fillRect(0, 0, 108, 134); x.fillStyle = '#fff'; x.fillRect(i * 4, 20, 30, 30); return 'data:image/jpeg;base64,' + c.toBuffer('image/jpeg').toString('base64'); };
  ok(await rej(handlers['video-start'](null, tmp, 'a.mp4', 30, 108, 134)) === 'DIR_NON_AUTORIZZATA', 'video: cartella non autorizzata');
  ok(!!(await rej(handlers['video-start'](null, out, 'a.exe', 30, 108, 134))) && !!(await rej(handlers['video-start'](null, out, 'a.mp4', 5, 108, 134))) && !!(await rej(handlers['video-start'](null, out, 'a.mp4', 30, 107, 135))), 'video: nome, fps e dimensioni validati');
  const id = await handlers['video-start'](null, out, 'prova.mp4', 30, 108, 134);
  ok(!!(await rej(handlers['video-start'](null, out, 'due.mp4', 30, 108, 134))), 'video: un solo export alla volta');
  ok(!!(await rej(handlers['video-frame'](null, id, 'data:image/png;base64,AAAA'))), 'video: fotogramma non JPEG rifiutato');
  for (let i = 0; i < 20; i++) await handlers['video-frame'](null, id, frame(i));
  const mp4 = await handlers['video-finish'](null, id);
  const buf = fs.readFileSync(mp4);
  ok(buf.length > 500 && buf.slice(4, 8).toString() === 'ftyp', 'video: MP4 valido (' + buf.length + ' byte)');
  const id2 = await handlers['video-start'](null, out, 'annullato.mp4', 30, 108, 134);
  await handlers['video-frame'](null, id2, frame(1)); await handlers['video-cancel'](null, id2);
  ok(!fs.existsSync(path.join(out, 'annullato.mp4')), 'video: annullando il file parziale sparisce');
  // musica: WAV sinusoidale di 2 s mixato nell'MP4
  const wav = (() => { const sr = 8000, n = sr * 2, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 8) * 12000), 44 + i * 2); return b; })();
  ok(!!(await rej(handlers['audio-save'](null, 'virus.exe', wav))) && !!(await rej(handlers['audio-save'](null, 'x.wav', Buffer.alloc(10)))), 'audio: estensione e dimensione validate');
  const aid = await handlers['audio-save'](null, 'prova.wav', wav);
  ok(!!(await rej(handlers['video-start'](null, out, 'a.mp4', 30, 108, 134, { id: 'nope', start: 0, volume: 1, fadeIn: 0, fadeOut: 0, dur: 1 }))), 'audio: id sconosciuto rifiutato');
  ok(!!(await rej(handlers['video-start'](null, out, 'a.mp4', 30, 108, 134, { id: aid, start: 0, volume: 9, fadeIn: 0, fadeOut: 0, dur: 1 }))), 'audio: parametri fuori range rifiutati');
  const vid = await handlers['video-start'](null, out, 'musica.mp4', 30, 108, 134, { id: aid, start: 0.2, volume: 0.8, fadeIn: 0.1, fadeOut: 0.2, dur: 1 });
  for (let i = 0; i < 30; i++) await handlers['video-frame'](null, vid, frame(i));
  const withAudio = fs.readFileSync(await handlers['video-finish'](null, vid));
  ok(withAudio.includes('mp4a') && withAudio.includes('avc1'), 'audio: MP4 con traccia audio AAC e video H.264 (' + withAudio.length + ' byte)');
  ok(!buf.includes('mp4a'), 'senza musica: nessuna traccia audio');
  await handlers['audio-clear'](null, aid);
  ok(!!(await rej(handlers['video-start'](null, out, 'a.mp4', 30, 108, 134, { id: aid, start: 0, volume: 1, fadeIn: 0, fadeOut: 0, dur: 1 }))), 'audio: dopo clear non e\' piu\' utilizzabile');
  console.log(fails ? 'FAILS ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
