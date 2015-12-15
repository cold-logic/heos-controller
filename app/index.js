"use strict";

const electron = require("electron");
const app = electron.app;  // Module to control application life.
const BrowserWindow = electron.BrowserWindow;  // Module to create native browser window.

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

// Quit when all windows are closed.
app.on("window-all-closed", function() {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform != "darwin") {
    app.quit();
  }
});

// This method will be called when Electron has done everything
// initialization and ready for creating browser windows.
app.on("ready", function() {
  var appPath = require("./app-path.js")();

  // Create the browser window.
  mainWindow = new BrowserWindow({
    "center": true,
    "width": 350,
    "height": 413,
    "min-width": 350,
    "min-height": 413,
    "show": false
  });

  // Setup the main menu
  require("./menu.js")();

  // Load the homepage
  mainWindow.loadURL(`file://${appPath}/index.html`);
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