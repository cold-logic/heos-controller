module.exports = exports = function() {
  const path = require("path");
  
  let appPath;
  
  // Determine if this is a packaged app or a gulp run
  if (process.resourcesPath.indexOf("/Heos Controller.app/") > -1) {
    // Packaged app should use app.asar
    appPath = [process.resourcesPath, "app.asar","browser"].join(path.sep);
  } else {
    // Gulp runs should use the app directory
    appPath = [__dirname, "..","app","browser"].join(path.sep);
  }

  return appPath;
};