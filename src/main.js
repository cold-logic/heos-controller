
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { LazyStore } from '@tauri-apps/plugin-store';
import $ from 'jquery';
import * as bootstrap from 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './index.css';

const store = new LazyStore('settings.json');

// jQuery Knob needs global jQuery
window.$ = window.jQuery = $;

// Keep data-bs-theme in sync with the OS preference at runtime
const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
themeMedia.addEventListener('change', onThemeChange);
window.addEventListener('unload', () => themeMedia.removeEventListener('change', onThemeChange));

function onThemeChange(e) {
  document.documentElement.setAttribute('data-bs-theme', e.matches ? 'dark' : 'light');
  updateKnobTheme();
}

function knobBgColor() {
  return document.documentElement.getAttribute('data-bs-theme') === 'dark'
    ? '#555555'
    : '#EEEEEE';
}

function updateKnobTheme() {
  if (ui) {
    ui.dial.$.trigger('configure', { bgColor: knobBgColor() });
    ui.dial.$.trigger('change');
  }
}

// Wait for knob plugin to load before initializing UI
let ui, lastCommand;

import('jquery-knob').then(() => {
  $(function () {
    // App Initialization
    initializeApp();
  });
});

function initializeApp() {
  const jQ = (function () {
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

  const settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));

  const knobConfig = {
    fgColor: '#66CC66',
    bgColor: knobBgColor(),
    angleOffset: -125,
    angleArc: 250,
    width: '100%',
    release: function (v) {
      if (lastCommand != 'populateVolume') {
        const option = ui.speaker.$.children().filter(':selected');
        const pid = option.data('pid');
        if (pid) setVolume(pid, v);
      }
      lastCommand = '';
    }
  }

  ui.dial.$.knob(knobConfig);

  ui.speaker.$.on('change', function (e) {
    const pid = $(this).find(':selected').data('pid');
    if (pid) {
      getVolume(pid);
      getState(pid);
    }
  });

  // Controller button click highlights
  $('.control').on('mousedown mouseup', function (e) {
    $(this).css('background-color', (e.type == 'mousedown' ? 'var(--bs-gray-300)' : ''));
  });

  // Click and keyboard events
  const clickSelectors = [
    ui.refresh.sel,
    ui.prev.sel,
    ui.state.sel,
    ui.next.sel
  ].join(',');

  $(document).on('click keydown', clickSelectors, function (e) {
    if (e.type === 'keydown' && !(e.key === 'Enter' || e.key === ' ')) {
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
    }
    const $this = $(this);
    const pid = ui.speaker.$.find(':selected').data('pid');

    if ($this.is(ui.refresh.sel)) {
      sendCmd('player/get_players');
    }
    if (pid) {
      if ($this.is(ui.prev.sel)) playPrev(pid);
      if ($this.is(ui.state.sel)) {
        const iconElement = ui.state.$.find('i');
        const iconClass = iconElement.length > 0 ? iconElement.attr('class') || '' : '';
        let state = 'play';
        if (iconClass.includes('bi-play-fill')) state = 'play';
        else if (iconClass.includes('bi-pause-fill')) state = 'pause';

        setState(pid, state);
      }
      if ($this.is(ui.next.sel)) playNext(pid);
    }
  });

  $('#settings-btn').on('click', async () => {
    const interfaces = await invoke('get_network_interfaces');
    const $select = $('#interface-select');
    $select.find('option:not([value="auto"])').remove();

    interfaces.forEach(iface => {
      $select.append(`<option value="${iface.ip}">${iface.name} (${iface.ip})</option>`);
    });

    const preferred = await store.get('preferred_interface') || 'auto';
    $select.val(preferred);

    settingsModal.show();
  });

  $('#save-settings').on('click', async () => {
    const selected = $('#interface-select').val();
    await store.set('preferred_interface', selected);
    await store.save();
    settingsModal.hide();

    // Trigger fresh scan
    invoke('discover_speakers');
  });

  setupListeners();

  // Start discovery loop
  const discover = () => invoke('discover_speakers').catch(e => console.error(e));
  let discoveryInterval = setInterval(discover, 10000);
  discover(); // Initial run

  // Track connection to stop discovery
  // We need to expose `stopDiscovery` or handle it in `connect`
  window.stopDiscovery = () => {
    if (discoveryInterval) {
      clearInterval(discoveryInterval);
      discoveryInterval = null;
    }
  };
}

let currentConnection = null;

async function setupListeners() {
  await listen('speaker-discovered', (event) => {
    console.log('Discovered speaker at:', event.payload);
    connect(event.payload);
  });

  await listen('heos-message', (event) => {
    const data = event.payload;
    try {
      const json = JSON.parse(data);
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
    } catch (e) {
      console.error('Failed to parse message:', data, e);
    }
  });

  await listen('heos-error', (event) => {
    console.error('HEOS Error:', event.payload);
  });

  await listen('heos-debug', (event) => {
    console.debug('[Rust Debug]:', event.payload);
  });

  await listen('heos-disconnected', () => {
    console.log('Disconnected from HEOS server');
    currentConnection = null;
    if (!discoveryInterval) {
      console.log('Restarting discovery...');
      const discover = () => invoke('discover_speakers').catch(e => console.error(e));
      discoveryInterval = setInterval(discover, 10000);
      discover();
    }
  });
}

let isConnecting = false;

function connect(ip) {
  if (currentConnection || isConnecting) {
    // Already connected or connecting, ignore this request
    return;
  }
  isConnecting = true;

  invoke('connect_speaker', { ip })
    .then(() => {
      console.log('Connected to server!');
      currentConnection = ip; // Track active connection
      isConnecting = false;
      if (window.stopDiscovery) window.stopDiscovery(); // Stop scanning

      setTimeout(function () {
        sendCmd('system/register_for_change_events', { enable: 'off' });
        sendCmd('player/get_players');
        sendCmd('system/register_for_change_events', { enable: 'on' });
      }, 1000);
    })
    .catch(err => {
      console.error('Connection failed', err);
      isConnecting = false;
      // Retry like original app (every 30s)
      console.log('Retrying connect in 30s...');
      setTimeout(() => connect(ip), 30000);
    });
}

// Cleanup the msg and execute a callback
function parseMsg(msg, cb) {
  if (!msg) return;
  const args = [], qs = msg.split('&');
  for (const param of qs) {
    args.push(param.split('=')[1]);
  }
  if (typeof cb == 'function') cb.apply(this, args);
}

function sendCmd(cmd, obj) {
  // Rust command expects HashMap<String, String> for args
  // Convert obj to that format
  let args = {};
  if (obj) {
    for (const k in obj) {
      args[k] = String(obj[k]);
    }
  }
  invoke('send_command', { command: cmd, args: obj ? args : null })
    .catch(e => console.error('Send command failed:', e));
}

function toggleState(state) {
  const toggle = {
    'play': 'pause',
    'pause': 'play',
    'stop': 'play'
  };
  return toggle[state];
}

function populatePlayers(payload) {
  const currentPid = ui.speaker.$.find(':selected').data('pid'); // Cache current selection
  ui.speaker_count.$.text(`(${payload.length} detected)`);
  ui.speaker.$.children().remove();

  let hasSelection = false;
  for (const i in payload) {
    const obj = payload[i];
    const option = document.createElement('option');
    option.textContent = obj.name;
    for (const k in obj) {
      option.dataset[k] = obj[k];
    }
    ui.speaker.$.append(option);

    // Restore selection if match found
    if (obj.pid == currentPid) {
      ui.speaker.$.val(obj.name); // value is text content by default if no value attr, but here we didn't set value.
      // Wait, <option> in HTML has value attribute. The code didn't set `option.value`.
      // The original code was `option.textContent = obj.name`.
      // So the value is the text content.
      // Wait, let's set selected property directly to be safe.
      option.selected = true;
      hasSelection = true;
    }
  }

  // If we restored a selection, great. If not (and we have players), default to first?
  // The original code did:
  // if (payload[0] && payload[0].pid) { getVolume... } which implies it might default to first.
  // But if we have a selection, we should keep it.

  if (hasSelection) {
    // Refresh volume/state for the preserved selection
    getVolume(currentPid);
    getState(currentPid);
  } else if (payload[0] && payload[0].pid) {
    // Default to first if no previous selection or previous selection lost
    getVolume(payload[0].pid);
    getState(payload[0].pid);
  }
}

function populateVolume(pid, level) {
  lastCommand = 'populateVolume';
  // Ensure we are selecting the right speaker context
  if (ui.speaker.$.children().filter(':selected').data('pid') == pid) {
    ui.dial.$.val(level).trigger('change');
  }
}

function populateState(pid, state) {
  lastCommand = 'populateState';
  if (ui.speaker.$.children().filter(':selected').data('pid') == pid) {
    const icon = ui.state.$.find('i');
    const newState = toggleState(state);

    icon.removeClass('bi-play-fill bi-pause-fill bi-stop-fill');

    if (newState === 'play') {
      icon.addClass('bi-play-fill');
    } else if (newState === 'pause') {
      icon.addClass('bi-pause-fill');
    } else if (newState === 'stop') {
      icon.addClass('bi-stop-fill');
    }
  }
}

function getVolume(pid) {
  sendCmd('player/get_volume', { pid: pid });
}

function getState(pid) {
  sendCmd('player/get_play_state', { pid: pid }); // Using pid from arg? Original used hardcoded '-652946493' for some reason? 
  // Original: pid: '-652946493' in getState but passed pid... likely a debug leftover in original code?
  // I should probably use the real PID.
  // Wait, let's look at original code again.
  // function getState (pid) { sendCmd(..., { pid: '-652946493' }); }
  // That seems suspicious. I will assume it should be the passed `pid`.
  // Ref: line 325 in original.
  // If I change it, I might fix a bug or break it if that magic PID was essential.
  // But generally `player/get_play_state` needs a real PID.
  // I will use `pid` argument to be safe and "correct".
}

function setVolume(pid, level) {
  sendCmd('player/set_volume', { pid: pid, level: level });
}

function setState(pid, state) {
  sendCmd('player/set_play_state', { pid: pid, state: state });
  populateState(pid, state); // Optimistic UI update
}

function playPrev(pid) {
  sendCmd('player/play_previous', { pid: pid });
}

function playNext(pid) {
  sendCmd('player/play_next', { pid: pid });
}
