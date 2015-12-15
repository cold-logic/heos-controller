module.exports = exports = function() {
  var app = require("app");
  var BrowserWindow = require("browser-window"); // Module to create native browser window.
  var Menu = require("menu");

  var mainMenu = Menu.buildFromTemplate([{
    label: "Heos Controller",
    submenu: [{
      label: "About Heos Controller",
      selector: "orderFrontStandardAboutPanel:"
    }, {
      type: "separator"
    }, {
      label: "Services",
      submenu: []
    }, {
      type: "separator"
    }, {
      label: "Hide Heos Controller",
      accelerator: "Command+H",
      selector: "hide:"
    }, {
      label: "Hide Others",
      accelerator: "Command+Shift+H",
      selector: "hideOtherApplications:"
    }, {
      label: "Show All",
      selector: "unhideAllApplications:"
    }, {
      type: "separator"
    }, {
      label: "Quit",
      accelerator: "Command+Q",
      click: function() {
        app.quit();
      }
    }]
  }, {
    label: "Edit",
    submenu: [{
      label: "Undo",
      accelerator: "Command+Z",
      selector: "undo:"
    }, {
      label: "Redo",
      accelerator: "Shift+Command+Z",
      selector: "redo:"
    }, {
      type: "separator"
    }, {
      label: "Cut",
      accelerator: "Command+X",
      selector: "cut:"
    }, {
      label: "Copy",
      accelerator: "Command+C",
      selector: "copy:"
    }, {
      label: "Paste",
      accelerator: "Command+V",
      selector: "paste:"
    }, {
      label: "Select All",
      accelerator: "Command+A",
      selector: "selectAll:"
    }]
  }, {
    label: "View",
    submenu: [{
      label: "Reload",
      accelerator: "Command+R",
      click: function() {
        BrowserWindow.getFocusedWindow().reloadIgnoringCache();
      }
    }, {
      label: "Toggle Full Screen",
      accelerator: "Ctrl+Command+F",
      click: function() {
        var w = BrowserWindow.getFocusedWindow();
        w.setFullScreen(!w.isFullScreen());
      }
    }, {
      label: "Toggle DevTools",
      accelerator: "Alt+Command+I",
      click: function() {
        BrowserWindow.getFocusedWindow().toggleDevTools();
      }
    }]
  }, {
    label: "Window",
    submenu: [{
      label: "Minimize",
      accelerator: "Command+M",
      selector: "performMiniaturize:"
    }, {
      label: "Zoom",
      selector: "performZoom:"
    }, {
      type: "separator"
    }, {
      label: "Bring All to Front",
      selector: "arrangeInFront:"
    }]
  }, {
    label: "Help",
    submenu: [{
      label: "Documentation",
      click: function() {
        require("shell").openExternal("https://github.com/cold-logic/heos-controller/wiki");
      }
    }]
  }]);
  Menu.setApplicationMenu(mainMenu);
};