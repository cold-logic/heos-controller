# Base
gulp = require "gulp"
electron = require "electron-prebuilt"
# Required for building
rimraf = require "rimraf"
packager = require "electron-packager"
# Required for running
proc = require "child_process"

app = 
  name: "Heos Controller"
  version: "1.0"
  bundle: "com.ninjachris.heos-controller"

gulp.task "build", ->
  rimraf "build/*", ->
    packager 
      "name"             : app.name
      "app-version"      : app.version
      "app-bundle-id"    : app.bundle
      "helper-bundle-id" : "#{app.bundle}.helper"
      "platform"         : "darwin"
      "arch"             : "x64"
      "version"          : "0.36.0"
      "dir"              : "./app"
      "out"              : "./build"
      "asar"             : true
      "sign"             : false
      "icon"             : "icon.icns"
    , (err) ->
      if err then console.log err
      console.log "Done"

gulp.task "run", ->
  child = proc.spawn electron, ["."], cwd: "app"

gulp.task "default", ["run"]