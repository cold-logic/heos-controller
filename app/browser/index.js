/* global $ */

window.$ = window.jQuery = require('jquery');
require('jquery-knob/dist/jquery.knob.min.js');

const dgram = require('node:dgram'); // dgram is UDP
const net = require('node:net');
const os = require('node:os'); 

const HEOS_BROADCAST_ADDR = "239.255.255.250";
let connection, ui, lastCommand, discovery_interval;

// Before the window closes, de-register and disconnect
window.onbeforeunload = function(e) {
  if (connection && connection.readyState == 'open') {
    sendCmd('system/register_for_change_events', {
      enable: 'off'
    });
    connection.end();
  }
};

// Setup UI event handlers
$(function() {
  const jQ = (function() {
    function jQ(s) {
      this.sel = s;
      this.$ = $(s);
    }
    return jQ;
  })();

  ui = {
    dial: new jQ('.dial'),
    speaker: new jQ('#speaker'),
    speaker_count: new jQ('#speaker_count'),
    refresh: new jQ('#refresh'),
    prev: new jQ('#prev'),
    state: new jQ('#state'),
    next: new jQ('#next')
  };

  const knobConfig = {
    fgColor: '#66CC66',
    angleOffset: -125,
    angleArc: 250,
    width: '100%',
    release: function(v) {
      if (lastCommand != 'populateVolume') {
        const option = ui.speaker.$.children().filter(':selected');
        const pid = option.data('pid');
        setVolume(pid, v);
      }
      lastCommand = '';
    }
  }

  ui.dial.$.knob(knobConfig);

  ui.speaker.$.on('change', function(e){
    const pid = $(this).find(':selected').data('pid');
    getVolume(pid);
    getState(pid);
  });

  // Controller button click highlights
  $('.control').on('mousedown mouseup', function(e){
    $(this).css('background-color', (e.type == 'mousedown' ? 'var(--bs-gray-300)' : ''));
  });

  // Click and keyboard events
  const clickSelectors = [
    ui.refresh.sel,
    ui.prev.sel,
    ui.state.sel,
    ui.next.sel
  ].join(',');
  
  // Handle both click and keyboard (Enter/Space) events
  $(document).on('click keydown', clickSelectors, function (e) {
    // For keyboard events, only respond to Enter or Space
    if (e.type === 'keydown' && !(e.key === 'Enter' || e.key === ' ')) {
      return;
    }
    
    // Prevent default for space key to avoid scrolling
    if (e.key === ' ') {
      e.preventDefault();
    }
    const $this = $(this);
    const pid = ui.speaker.$.find(':selected').data('pid');
    if ($this.is(ui.refresh.sel)) {
      sendCmd('player/get_players');
    }
    if ($this.is(ui.prev.sel)) {
      playPrev(pid);
    }
    if ($this.is(ui.state.sel)) {
      const iconClass = ui.state.$.find('i').attr('class');
      let state;
      if (iconClass.includes('bi-play-fill')) {
        state = 'play';
      } else if (iconClass.includes('bi-pause-fill')) {
        state = 'pause';
      } else {
        state = 'play'; // default fallback
      }
      setState(pid, state);
    }
    if ($this.is(ui.next.sel)) {
      playNext(pid);
    }
  });
});

// Start the SSDP discovery process
discover();

/******************************
 * Functions
 ******************************/

function broadcast_address() {
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

function discover() {
  const client = dgram.createSocket('udp4');
  client.on('error', (err) => {
    console.error(`client error:\n${err.stack}`);
    client.close();
  });
  client.on('listening', () => {
    const address = client.address();
    console.log(`listening ${address.address}:${address.port}`);
    const BROADCAST_ADDR = broadcast_address()[0];
    const message = Buffer.from(
      'M-SEARCH * HTTP/1.1\r\n' +
      `HOST: ${HEOS_BROADCAST_ADDR}:1900\r\n` +
      'MAN: "ssdp:discover"\r\n' +
      'ST: urn:schemas-denon-com:device:ACT-Denon:1\r\n' + // Essential, used by the client to specify what they want to discover, eg 'ST:ge:fridge'
      'MX: 1\r\n' + // 1 second to respond (but they all respond immediately?)
      '\r\n'
    );
    client.send(message, 0, message.length, 1900, BROADCAST_ADDR);
    console.log('sent discovery request...');
  });
  client.on('message', function (msg, rinfo) {
    console.log(`client got: ${msg} from ${rinfo.address}:${rinfo.port}`);
    if ( msg.indexOf('ST: urn:schemas-denon-com:device:ACT-Denon:1') > -1) {
      client.close();
      connect(rinfo.address);
      clearInterval(discovery_interval);
    }
  });
  client.bind(null);
  if (!discovery_interval) // Setup an interval to keep trying to discover speakers
    discovery_interval = setInterval(discover, 10000)
}

// Connect to the speaker
function connect(ip) {
  connection = net.createConnection({
    host: ip,
    port: 1255
  });
  connection.on('error', err => {
    console.error(new Date(), String(err))
    if (err && err.code && err.code === 'ECONNREFUSED') {
      setTimeout(function () {
        console.log('Retrying connect...');
        connection.connect(1255, ip, connectListener)
      }, 3e4); // retry every 30 seconds
    }
  })
  connection.on('connect', () => { // gets triggered on successful connection
    console.log('connected to server!');
    setTimeout(function () {
      sendCmd('system/register_for_change_events', {
        enable: 'off'
      });
      sendCmd('player/get_players');
      sendCmd('system/register_for_change_events', {
        enable: 'on'
      });
    }, 1000);
  });
  connection.on('data', function(data) {
    const events = data.toString().split('\r\n');
    for (const event of events) {
      if (event.length > 0) {
        const json = JSON.parse(event);
        console.log('%s: %o', json.heos.command, json);
        if (json.heos.command == 'player/get_players' && json.payload) {
          populatePlayers(json.payload);
        }
        if (json.heos.command == 'player/get_play_state') {
          parseMsg(json.heos.message, populateState);
        }
        if (json.heos.command == 'player/get_volume' || json.heos.command == 'event/player_volume_changed') {
          parseMsg(json.heos.message, populateVolume);
        }
      }
    }
  });
  connection.on('end', function() {
    console.log('disconnected from server');
  });
}

// Cleanup the msg and execute a callback
function parseMsg (msg, cb) {
  const args = [], qs = msg.split('&');
  for (const param of qs) {
    args.push(param.split('=')[1]);
  }
  if (typeof cb == 'function') cb.apply(this, args);
}

// Send a command to the HEOS API
function sendCmd (cmd, obj) {
  if (connection && connection.readyState == 'open') {
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
    connection.write(msg + '\r\n');
  }
}

// Toggle UI play/pause/stop button
function toggleState (state) {
  const toggle = {
    'play': 'pause',
    'pause': 'play',
    'stop': 'play'
  };
  return toggle[state];
}

// Fill the speaker dropdown with what we've discovered
function populatePlayers(payload) {
  ui.speaker_count.$.text(`(${payload.length} detected)`);
  ui.speaker.$.children().remove();
  for (const i in payload) {
    const obj = payload[i];
    const option = document.createElement('option');
    option.textContent = obj.name;
    for (const k in obj) {
      option.dataset[k] = obj[k];
    }
    ui.speaker.$.append(option);
  }
  if (payload[0] && payload[0].pid) {
    getVolume(payload[0].pid);
    getState(payload[0].pid);
  }
}

// Set the UI volume dial level
function populateVolume(pid, level) {
  lastCommand = 'populateVolume';
  if (ui.speaker.$.children().filter(':selected').data('pid') == pid) {
    ui.dial.$.val(level).trigger('change');
  }
}

// Set the UI play/pause/stop button's state
function populateState (pid, state) {
  lastCommand = 'populateState';
  if (ui.speaker.$.children().filter(':selected').data('pid') == pid) {
    const icon = ui.state.$.find('i');
    const newState = toggleState(state);
    
    // Remove all possible Bootstrap Icon classes
    icon.removeClass('bi-play-fill bi-pause-fill bi-stop-fill');
    
    // Add the appropriate Bootstrap Icon class
    if (newState === 'play') {
      icon.addClass('bi-play-fill');
    } else if (newState === 'pause') {
      icon.addClass('bi-pause-fill');
    } else if (newState === 'stop') {
      icon.addClass('bi-stop-fill');
    }
  }
}

// Query HEOS API for volume
function getVolume(pid) {
  sendCmd('player/get_volume', {
    pid: pid
  });
}

// Query HEOS API for state
function getState (pid) {
  sendCmd('player/get_play_state', {
    pid: '-652946493'
  });
}

// Query HEOS API for play queue
function getPlayQueue (pid, range) {
  sendCmd('player/get_queue', {
    pid: '-652946493'
  });
}

// Crank the volume to 11 ;)
function setVolume(pid, level) {
  sendCmd('player/set_volume', {
    pid: pid,
    level: level
  });
}

// Play that funky music
function setState(pid, state) {
  sendCmd('player/set_play_state', {
    pid: pid,
    state: state
  });
  populateState(pid, state);
}

// Play my jam again!
function playPrev (pid) {
  sendCmd('player/play_previous', {
    pid: pid
  });
}

// NOPE! Next song plz...
function playNext (pid) {
  sendCmd('player/play_next', {
    pid: pid
  });
}
