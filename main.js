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
  win.loadFile(path.join(__dirname, 'index.html'));
  return win;
}

ipcMain.handle('pick-folder', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, {
    title: 'Scegli la cartella di esportazione',
    properties: ['openDirectory', 'createDirectory']
  });
  return r.canceled ? null : r.filePaths[0];
});

// Salva PNG (data URL) nella cartella scelta. Accetta solo nomi semplici .png.
ipcMain.handle('save-files', async (_e, dir, files) => {
  if (typeof dir !== 'string' || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error('Cartella non valida');
  }
  const saved = [];
  for (const f of files) {
    const name = path.basename(String(f.name));
    const prefix = 'data:image/png;base64,';
    if (!/^[\w.\-]+\.png$/i.test(name) || typeof f.dataUrl !== 'string' || !f.dataUrl.startsWith(prefix)) {
      throw new Error('File non valido: ' + name);
    }
    const target = path.join(dir, name);
    fs.writeFileSync(target, Buffer.from(f.dataUrl.slice(prefix.length), 'base64'));
    saved.push(target);
  }
  return saved;
});

ipcMain.handle('reveal-file', (_e, p) => {
  if (typeof p === 'string' && fs.existsSync(p)) shell.showItemInFolder(p);
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
