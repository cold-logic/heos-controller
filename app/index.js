const path = require('path');

// Vendor deps
const {app, BrowserWindow, Menu} = require('electron');
const log = require('electron-log/main');
const {autoUpdater} = require('electron-updater');

// Local deps
const menu = require('./menu.js')

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
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  // if (process.platform != "darwin") {
    app.quit();
  // }
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
      contextIsolation: false,
      nodeIntegration: true,
    }
  });

  // Setup the main menu
  Menu.setApplicationMenu(menu);

  // Load the homepage
  mainWindow.loadFile('browser/index.html');
  mainWindow.show();

  // Open the dev tools
  // mainWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on("closed", function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
});