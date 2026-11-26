const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1000,
    minHeight: 650,
    backgroundColor: '#090c10',
    title: 'Omnia Graphics',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  // L'app non deve mai aprire altre pagine né navigare fuori da index.html
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (ev) => ev.preventDefault());
  win.loadFile(path.join(__dirname, 'index.html'));
  return win;
}

// Cartelle di export autorizzate: solo quelle scelte dall'utente con il selettore di sistema (ricordate tra i riavvii)
const dirsFile = () => path.join(app.getPath('userData'), 'export-dirs.json');
function loadAllowedDirs() {
  try { const l = JSON.parse(fs.readFileSync(dirsFile(), 'utf8')); return new Set(Array.isArray(l) ? l.filter(x => typeof x === 'string') : []); } catch (e) { return new Set(); }
}
function allowDir(dir) {
  const set = loadAllowedDirs();
  set.add(path.resolve(dir));
  try { fs.writeFileSync(dirsFile(), JSON.stringify([...set].slice(-10))); } catch (e) {}
}
const isAllowedDir = (dir) => typeof dir === 'string' && loadAllowedDirs().has(path.resolve(dir));

ipcMain.handle('pick-folder', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, {
    title: 'Scegli la cartella di esportazione',
    properties: ['openDirectory', 'createDirectory']
  });
  if (r.canceled) return null;
  allowDir(r.filePaths[0]);
  return r.filePaths[0];
});

const MAX_FILES = 30;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;

// Salva PNG/JPG (data URL) nella cartella scelta. Accetta solo nomi semplici .png/.jpg con data URL coerente.
ipcMain.handle('save-files', async (_e, dir, files) => {
  if (!isAllowedDir(dir)) throw new Error('DIR_NON_AUTORIZZATA');
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error('Cartella non valida');
  if (!Array.isArray(files) || files.length === 0 || files.length > MAX_FILES) throw new Error('Elenco file non valido');
  if (files.reduce((n, f) => n + (f && typeof f.dataUrl === 'string' ? f.dataUrl.length : 0), 0) > MAX_TOTAL_BYTES * 1.4) throw new Error('File troppo grandi');
  const saved = [];
  for (const f of files) {
    if (!f || typeof f !== 'object') throw new Error('File non valido');
    const name = path.basename(String(f.name));
    const isJpg = /\.jpe?g$/i.test(name);
    const prefix = isJpg ? 'data:image/jpeg;base64,' : 'data:image/png;base64,';
    if (!/^[\w.\-]+\.(png|jpe?g)$/i.test(name) || typeof f.dataUrl !== 'string' || !f.dataUrl.startsWith(prefix)) {
      throw new Error('File non valido: ' + name);
    }
    const target = path.join(dir, name);
    fs.writeFileSync(target, Buffer.from(f.dataUrl.slice(prefix.length), 'base64'));
    saved.push(target);
  }
  return saved;
});

ipcMain.handle('reveal-file', (_e, p) => {
  if (typeof p === 'string' && isAllowedDir(path.dirname(p)) && fs.existsSync(p)) shell.showItemInFolder(p);
});

// ---- Export video MP4: i fotogrammi (JPEG) arrivano uno alla volta e vengono passati a FFmpeg ----
const { spawn } = require('child_process');
function ffmpegBin() {
  let p = require('ffmpeg-static');
  return typeof p === 'string' ? p.replace('app.asar', 'app.asar.unpacked') : null;
}
const videoJobs = new Map();
let videoSeq = 0;
const MAX_VIDEO_FRAMES = 60 * 90; // 90 secondi a 60 fps

// Musica: il file arriva dal renderer, viene scritto in una cartella temporanea e referenziato solo tramite id
const audioFiles = new Map();
let audioSeq = 0;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|flac)$/i;
const MAX_AUDIO_BYTES = 80 * 1024 * 1024;
function dropAudio(id) {
  const p = audioFiles.get(id);
  audioFiles.delete(id);
  if (p) { try { fs.unlinkSync(p); } catch (e) {} }
}

ipcMain.handle('audio-save', async (_e, name, data) => {
  const base = path.basename(String(name));
  if (!AUDIO_EXT.test(base)) throw new Error('Formato audio non supportato');
  const buf = Buffer.from(data);
  if (buf.length < 100 || buf.length > MAX_AUDIO_BYTES) throw new Error('File audio non valido o troppo grande');
  audioFiles.forEach((_p, id) => dropAudio(id)); // una sola musica alla volta
  const id = String(++audioSeq);
  const target = path.join(require('os').tmpdir(), `omnia-audio-${process.pid}-${id}${path.extname(base).toLowerCase()}`);
  fs.writeFileSync(target, buf);
  audioFiles.set(id, target);
  return id;
});

ipcMain.handle('audio-clear', async (_e, id) => { dropAudio(String(id)); });
app.on('before-quit', () => { audioFiles.forEach((_p, id) => dropAudio(id)); });

ipcMain.handle('video-start', async (_e, dir, name, fps, w, h, audio) => {
  if (!isAllowedDir(dir)) throw new Error('DIR_NON_AUTORIZZATA');
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error('Cartella non valida');
  if (typeof name !== 'string' || !/^[\w.\-]+\.mp4$/i.test(path.basename(name))) throw new Error('Nome file non valido');
  if (!Number.isInteger(fps) || fps < 12 || fps > 60) throw new Error('FPS non validi');
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 64 || h < 64 || w > 2160 || h > 3840 || w % 2 || h % 2) throw new Error('Dimensioni non valide');
  if (videoJobs.size >= 1) throw new Error('Un export video e\' gia\' in corso');
  const bin = ffmpegBin();
  if (!bin || !fs.existsSync(bin)) throw new Error('FFmpeg non trovato');
  const target = path.join(dir, path.basename(name));
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-'];
  if (audio) {
    const num = (v, lo, hi) => typeof v === 'number' && isFinite(v) && v >= lo && v <= hi;
    const apath = audioFiles.get(String(audio.id));
    if (!apath || !fs.existsSync(apath)) throw new Error('Musica non disponibile: ricaricala');
    if (!num(audio.start, 0, 36000) || !num(audio.volume, 0, 1) || !num(audio.fadeIn, 0, 10) || !num(audio.fadeOut, 0, 10) || !num(audio.dur, 0.5, 90)) throw new Error('Parametri audio non validi');
    const fo = audio.fadeOut > 0 ? `,afade=t=out:st=${Math.max(0, audio.dur - audio.fadeOut).toFixed(3)}:d=${audio.fadeOut.toFixed(3)}` : '';
    const fi = audio.fadeIn > 0 ? `,afade=t=in:st=0:d=${audio.fadeIn.toFixed(3)}` : '';
    args.push('-stream_loop', '-1', '-ss', String(audio.start), '-t', String(audio.dur), '-i', apath);
    args.push('-map', '0:v', '-map', '1:a', '-af', `volume=${audio.volume.toFixed(3)}${fi}${fo},apad`, '-c:a', 'aac', '-b:a', '192k', '-t', String(audio.dur));
  } else {
    args.push('-an');
  }
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', target);
  const proc = spawn(bin, args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  const job = { proc, target, frames: 0, err: '', failed: null, done: null };
  job.done = new Promise((resolve) => proc.on('close', (code) => resolve(code)));
  proc.stderr.on('data', (d) => { job.err = (job.err + d).slice(-600); });
  proc.on('error', (e) => { job.failed = e.message; });
  proc.stdin.on('error', (e) => { job.failed = job.failed || e.message; });
  const id = String(++videoSeq);
  videoJobs.set(id, job);
  return id;
});

ipcMain.handle('video-frame', async (_e, id, dataUrl) => {
  const job = videoJobs.get(id);
  if (!job) throw new Error('Export video non attivo');
  if (job.failed) throw new Error('FFmpeg: ' + job.failed);
  const prefix = 'data:image/jpeg;base64,';
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(prefix)) throw new Error('Fotogramma non valido');
  if (++job.frames > MAX_VIDEO_FRAMES) throw new Error('Video troppo lungo');
  const ok = job.proc.stdin.write(Buffer.from(dataUrl.slice(prefix.length), 'base64'));
  if (!ok) await new Promise((r) => job.proc.stdin.once('drain', r));
  return job.frames;
});

ipcMain.handle('video-finish', async (_e, id) => {
  const job = videoJobs.get(id);
  if (!job) throw new Error('Export video non attivo');
  job.proc.stdin.end();
  const code = await job.done;
  videoJobs.delete(id);
  if (code !== 0 || job.failed) {
    try { fs.unlinkSync(job.target); } catch (e) {}
    throw new Error('FFmpeg: ' + (job.err.trim() || job.failed || 'codice ' + code));
  }
  return job.target;
});

ipcMain.handle('video-cancel', async (_e, id) => {
  const job = videoJobs.get(id);
  if (!job) return;
  videoJobs.delete(id);
  try { job.proc.stdin.destroy(); job.proc.kill(); } catch (e) {}
  await Promise.race([job.done, new Promise((r) => setTimeout(r, 2000))]);
  try { fs.unlinkSync(job.target); } catch (e) {}
});
app.on('before-quit', () => { videoJobs.forEach((j) => { try { j.proc.kill(); } catch (e) {} }); });

// Auto-aggiornamento: attivo solo nell'app installata e solo se la build ha un feed (app-update.yml)
function setupAutoUpdate(win) {
  const feed = path.join(process.resourcesPath || '', 'app-update.yml');
  if (!app.isPackaged || !fs.existsSync(feed)) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', async (info) => {
    const r = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Riavvia e aggiorna', 'Più tardi'],
      defaultId: 0,
      cancelId: 1,
      title: 'Aggiornamento pronto',
      message: `Omnia Graphics ${info.version} è pronto.`,
      detail: 'Riavvia ora per installarlo. Il tuo lavoro è salvato automaticamente.'
    });
    if (r.response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on('error', (err) => console.error('auto-update:', err && err.message));
  autoUpdater.checkForUpdates().catch(() => {});
}

Menu.setApplicationMenu(null);
app.whenReady().then(() => {
  const win = createWindow();
  setupAutoUpdate(win);
});
app.on('window-all-closed', () => app.quit());
