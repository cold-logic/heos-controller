import { contextBridge } from 'electron';
import dgram from 'node:dgram';
import net from 'node:net';
import os from 'node:os';

contextBridge.exposeInMainWorld('nodeAPI', {
  dgram,
  net,
  os
});