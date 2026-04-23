import path from 'path';
import { fileURLToPath } from 'url';

// Vendor deps
import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import log from 'electron-log/main.js';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

// Local deps
import menu from './menu.js';
import { HeosService } from './heos-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const heosService = new HeosService();

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Initialize the logger to be available in renderer process
log.initialize();
log.info('App starting...');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

// Quit when all windows are closed.
app.on("window-all-closed", function() {
    app.quit();
});

// Handle Updates
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...');
})
autoUpdater.on('update-available', (info) => {
  log.info('Update available.');
})
autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available.');
})
autoUpdater.on('error', (err) => {
  log.info('Error in auto-updater.');
})
autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  log.info(log_message);
})
autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded');
});

// This method will be called when Electron has done everything
// initialization and ready for creating browser windows.
app.on("ready", function() {
  // Check for updates
  autoUpdater.checkForUpdates();

  // Create the browser window.
  mainWindow = new BrowserWindow({
    'min-width': 350,
    'min-height': 413,
    center: true,
    width: 350,
    height: 413,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Setup the main menu
  Menu.setApplicationMenu(menu);

  // Load the homepage
  mainWindow.loadFile('browser/index.html');
  mainWindow.show();

  // Set up Heos Service event forwarding
  heosService.on('players', (payload) => {
    mainWindow.webContents.send('heos:players', payload);
  });
  heosService.on('state', (data) => {
    mainWindow.webContents.send('heos:state', data);
  });
  heosService.on('volume', (data) => {
    mainWindow.webContents.send('heos:volume', data);
  });

  // Set up IPC handlers
  ipcMain.handle('heos:discover', () => heosService.discover());
  ipcMain.handle('heos:getPlayers', () => heosService.getPlayers());
  ipcMain.handle('heos:getVolume', (event, pid) => heosService.getVolume(pid));
  ipcMain.handle('heos:getState', (event, pid) => heosService.getState(pid));
  ipcMain.handle('heos:setVolume', (event, pid, level) => heosService.setVolume(pid, level));
  ipcMain.handle('heos:setState', (event, pid, state) => heosService.setState(pid, state));
  ipcMain.handle('heos:playPrev', (event, pid) => heosService.playPrev(pid));
  ipcMain.handle('heos:playNext', (event, pid) => heosService.playNext(pid));

  // Emitted when the window is closed.
  mainWindow.on("closed", function() {
    mainWindow = null;
  });
});