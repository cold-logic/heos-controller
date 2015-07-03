var path = require("path");
var app = require("app");  // Module to control application life.
var BrowserWindow = require("browser-window");  // Module to create native browser window.

// Keep a global reference of the window object, if you don"t, the window will
// be closed automatically when the javascript object is GCed.
var mainWindow = null;

// Quit when all windows are closed.
app.on("window-all-closed", function() {
  app.quit();
});

// This method will be called when Electron has done everything
// initialization and ready for creating browser windows.
app.on("ready", function() {
  var appPath = require("./app-path.js")();

  // Create the browser window.
  mainWindow = new BrowserWindow({
    center: true,
    width: 350,
    height: 413,
    "min-width": 350,
    "min-height": 391,
    show: false
  });

  // Setup the main menu
  require("./menu.js")();

  // Load the homepage
  mainWindow.loadUrl(["file://", appPath, "index.html"].join(path.sep));
  mainWindow.show();
  
  // Open the dev tools
  // mainWindow.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on("closed", function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
});