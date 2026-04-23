const { contextBridge } = require('electron');
const dgram = require('dgram');
const net = require('net');
const os = require('os');

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