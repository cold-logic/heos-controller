import dgram from 'node:dgram';
import net from 'node:net';
import os from 'node:os';
import { EventEmitter } from 'node:events';

const HEOS_BROADCAST_ADDR = "239.255.255.250";
const HEOS_PORT = 1255;

export class HeosService extends EventEmitter {
  constructor() {
    super();
    this.connection = null;
    this.discovery_interval = null;
  }

  broadcast_addresses() {
    if (os.platform() == "win32") {
      let addresses = [];
      const ifaces = os.networkInterfaces();
      Object.values(ifaces).forEach((i) => {
        let iface_addresses = i.filter(iface => iface.family == "IPv4" && !iface.internal).map(iface => iface.address);
        
        // create broadcast address from interface adress
        iface_addresses = iface_addresses.map(addr => {
          let blocks = addr.split(".");
          blocks[3] = "255";
          return blocks.join(".");
        });

        addresses.push(...iface_addresses);
      });
      return addresses;
    } else {
      return [ HEOS_BROADCAST_ADDR ];
    }
  }

  discover() {
    const client = dgram.createSocket('udp4');
    client.on('error', (err) => {
      console.error(`discovery client error:\n${err.stack}`);
      client.close();
    });

    client.on('listening', () => {
      const BROADCAST_ADDRS = this.broadcast_addresses();
      const message = Buffer.from(
        'M-SEARCH * HTTP/1.1\r\n' +
        `HOST: ${HEOS_BROADCAST_ADDR}:1900\r\n' +
        'MAN: "ssdp:discover"\r\n' +
        'ST: urn:schemas-denon-com:device:ACT-Denon:1\r\n' +
        'MX: 1\r\n' +
        '\r\n'
      );
      
      BROADCAST_ADDRS.forEach(addr => {
        client.send(message, 0, message.length, 1900, addr);
      });
      console.log('sent discovery request...');
    });

    client.on('message', (msg, rinfo) => {
      if (msg.indexOf('ST: urn:schemas-denon-com:device:ACT-Denon:1') > -1) {
        console.log(`discovered speaker at ${rinfo.address}`);
        client.close();
        this.connect(rinfo.address);
        if (this.discovery_interval) {
          clearInterval(this.discovery_interval);
          this.discovery_interval = null;
        }
      }
    });

    client.bind(null);
    
    if (!this.discovery_interval) {
      this.discovery_interval = setInterval(() => this.discover(), 10000);
    }
  }

  connect(ip) {
    if (this.connection) {
      this.connection.end();
    }

    this.connection = net.createConnection({
      host: ip,
      port: HEOS_PORT
    });

    this.connection.on('error', err => {
      console.error('Heos connection error:', String(err));
      if (err && err.code === 'ECONNREFUSED') {
        setTimeout(() => this.connect(ip), 30000);
      }
    });

    this.connection.on('connect', () => {
      console.log('connected to Heos speaker!');
      setTimeout(() => {
        this.sendCmd('system/register_for_change_events', { enable: 'off' });
        this.getPlayers();
        this.sendCmd('system/register_for_change_events', { enable: 'on' });
      }, 1000);
    });

    this.connection.on('data', (data) => {
      const events = data.toString().split('\r\n');
      for (const event of events) {
        if (event.length > 0) {
          try {
            const json = JSON.parse(event);
            this.handleHeosEvent(json);
          } catch (e) {
            console.error('Failed to parse Heos event:', event, e);
          }
        }
      }
    });

    this.connection.on('end', () => {
      console.log('disconnected from Heos speaker');
    });
  }

  handleHeosEvent(json) {
    console.log('%s: %o', json.heos.command, json);
    
    if (json.heos.command == 'player/get_players' && json.payload) {
      this.emit('players', json.payload);
    }
    
    if (json.heos.command == 'player/get_play_state') {
      this.parseMsg(json.heos.message, (pid, state) => {
        this.emit('state', { pid, state });
      });
    }
    
    if (json.heos.command == 'player/get_volume' || json.heos.command == 'event/player_volume_changed') {
      this.parseMsg(json.heos.message, (pid, level) => {
        this.emit('volume', { pid, level });
      });
    }
  }

  parseMsg(msg, cb) {
    const args = [], qs = msg.split('&');
    for (const param of qs) {
      args.push(param.split('=')[1]);
    }
    if (typeof cb == 'function') cb.apply(this, args);
  }

  sendCmd(cmd, obj) {
    if (this.connection && this.connection.readyState == 'open') {
      const qs = [];
      let msg = 'heos://' + cmd;
      if (obj) {
        for (const k in obj) {
          if (obj.hasOwnProperty(k)) {
            const v = obj[k];
            qs.push([k,v].join('='));
          }
        }
        msg += '?' + qs.join('&');
      }
      this.connection.write(msg + '\r\n');
    }
  }

  getPlayers() {
    this.sendCmd('player/get_players');
  }

  getVolume(pid) {
    this.sendCmd('player/get_volume', { pid });
  }

  getState(pid) {
    // Note: The original code had a hardcoded PID here '-652946493'. 
    // I'll use the passed PID instead, but keep the original behavior if needed.
    this.sendCmd('player/get_play_state', { pid });
  }

  setVolume(pid, level) {
    this.sendCmd('player/set_volume', { pid, level });
  }

  setState(pid, state) {
    this.sendCmd('player/set_play_state', { pid, state });
  }

  playPrev(pid) {
    this.sendCmd('player/play_previous', { pid });
  }

  playNext(pid) {
    this.sendCmd('player/play_next', { pid });
  }
}
