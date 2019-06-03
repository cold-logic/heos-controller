require('dotenv').config()
const electronBuilder = require('electron-builder')

electronBuilder.build({
  mac: ['default'],
  publish: 'always'
})