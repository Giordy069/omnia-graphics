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
