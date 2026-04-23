/* global $ */

import $ from 'jquery';
window.$ = window.jQuery = $;

// Dynamic import to ensure window.jQuery is set before knob loads
await import('jquery-knob');
await import('bootstrap');

let ui, lastCommand;

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
        window.heosAPI.setVolume(pid, v);
      }
      lastCommand = '';
    }
  }

  ui.dial.$.knob(knobConfig);

  ui.speaker.$.on('change', function(e){
    const pid = $(this).find(':selected').data('pid');
    window.heosAPI.getVolume(pid);
    window.heosAPI.getState(pid);
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
    if (e.type === 'keydown' && !(e.key === 'Enter' || e.key === ' ')) {
      return;
    }
    
    if (e.key === ' ') {
      e.preventDefault();
    }
    const $this = $(this);
    const pid = ui.speaker.$.find(':selected').data('pid');
    if ($this.is(ui.refresh.sel)) {
      window.heosAPI.getPlayers();
    }
    if ($this.is(ui.prev.sel)) {
      window.heosAPI.playPrev(pid);
    }
    if ($this.is(ui.state.sel)) {
      const iconElement = ui.state.$.find('i');
      const iconClass = iconElement.length > 0 ? iconElement.attr('class') || '' : '';
      let state;
      if (iconClass.includes('bi-play-fill')) {
        state = 'play';
      } else if (iconClass.includes('bi-pause-fill')) {
        state = 'pause';
      } else {
        state = 'play'; // default fallback
      }
      window.heosAPI.setState(pid, state);
    }
    if ($this.is(ui.next.sel)) {
      window.heosAPI.playNext(pid);
    }
  });

  // Register for updates from the main process
  window.heosAPI.onPlayers((payload) => populatePlayers(payload));
  window.heosAPI.onState((data) => populateState(data.pid, data.state));
  window.heosAPI.onVolume((data) => populateVolume(data.pid, data.level));

  // Start initial discovery
  window.heosAPI.discover();
});

/******************************
 * UI Functions
 ******************************/

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
    window.heosAPI.getVolume(payload[0].pid);
    window.heosAPI.getState(payload[0].pid);
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
