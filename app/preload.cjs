const { contextBridge } = require('electron');
const dgram = require('node:dgram');
const net = require('node:net');
const os = require('node:os');

contextBridge.exposeInMainWorld('nodeAPI', {
  dgram: {
    createSocket: dgram.createSocket
  },
  net: {
    createConnection: net.createConnection
  },
  os: {
    platform: os.platform,
    networkInterfaces: os.networkInterfaces
  }
});