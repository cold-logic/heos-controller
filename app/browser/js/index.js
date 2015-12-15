/* global $ */

var net = require("net");
var connection, ui, lastCommand;

window.onbeforeunload = function(e) {
  if (connection.readyState == "open") {
    sendCmd("system/register_for_change_events", {
      enable: "off"
    });
    connection.end();
  }
};

(function () {
  var dgram = require("dgram"); // dgram is UDP
  var client = dgram.createSocket("udp4");
  client.bind(null, function () {
    var message = new Buffer(
      "M-SEARCH * HTTP/1.1\r\n" +
      "HOST: 239.255.255.250:1900\r\n" +
      "MAN: \"ssdp:discover\"\r\n" +
      "ST: urn:schemas-denon-com:device:ACT-Denon:1\r\n" + // Essential, used by the client to specify what they want to discover, eg 'ST:ge:fridge'
      "MX: 1\r\n" + // 1 second to respond (but they all respond immediately?)
      "\r\n"
    );
    console.log("Sending on port " + client.address().port);
    
    client.on("message", function (msg, rinfo) {
      console.log("server got: " + msg + " from " + rinfo.address + ":" + rinfo.port);
      client.close();
      connect(rinfo.address);
    });
    client.send(message, 0, message.length, 1900, "239.255.255.250");
  });
})();

$(function() {
  var jQ = (function() {
    function jQ(s) {
      this.sel = s;
      this.$ = $(s);
    }
    return jQ;
  })();
  ui = {
    dial: new jQ(".dial"),
    speaker: new jQ("#speaker"),
    speaker_count: new jQ("#speaker_count"),
    refresh: new jQ("#refresh"),
    prev: new jQ("#prev"),
    state: new jQ("#state"),
    next: new jQ("#next")
  };

  ui.dial.$.knob({
    "fgColor": "#66CC66",
    "angleOffset": -125,
    "angleArc": 250,
    "release": function(v) {
      if (lastCommand != "populateVolume") {
        var option = ui.speaker.$.children().filter(":selected");
        var pid = option.data("pid");
        setVolume(pid, v);
      }
      lastCommand = "";
    }
  });

  ui.speaker.$.on("change", function(e){
    var pid = $(this).find(":selected").data("pid");
    getVolume(pid);
    getState(pid);
  });

  // Controller button click highlights
  $(".control").on("mousedown mouseup", function(e){
    $(this).css("background-color", (e.type == "mousedown" ? "#C2C2C2" : ""));
  });

  // Click events
  var clickSelectors = [
    ui.refresh.sel,
    ui.prev.sel,
    ui.state.sel,
    ui.next.sel
  ].join(",");
  $(document).on("click", clickSelectors, function (e) {
    var $this = $(this);
    var pid = ui.speaker.$.find(":selected").data("pid");
    if ($this.is(ui.refresh.sel)) {
      sendCmd("player/get_players");
    }
    if ($this.is(ui.prev.sel)) {
      playPrev(pid);
    }
    if ($this.is(ui.state.sel)) {
      var state = ui.state.$.find(".glyphicon").attr("class").split("-")[1];
      setState(pid, state);
    }
    if ($this.is(ui.next.sel)) {
      playNext(pid);
    }
  });
});

function connect(ip) {
  connection = net.connect({
    host: ip,
    port: 1255
  }, function() { //'connect' listener
    console.log("connected to server!");
    setTimeout(function () {
      sendCmd("system/register_for_change_events", {
        enable: "off"
      });
      sendCmd("player/get_players");
      sendCmd("system/register_for_change_events", {
        enable: "on"
      });
    }, 1000);
  });
  connection.on("data", function(data) {
    var event, json, events = data.toString().split("\r\n");
    for (var i = 0; i < events.length; i++) {
      event = events[i];
      if (event.length > 0) {
        json = JSON.parse(event);
        console.log("%s: %o", json.heos.command, json);
        if (json.heos.command == "player/get_players" && json.payload) {
          populatePlayers(json.payload);
        }
        if (json.heos.command == "player/get_play_state") {
          parseMsg(json.heos.message, populateState);
        }
        if (json.heos.command == "player/get_volume" || json.heos.command == "event/player_volume_changed") {
          parseMsg(json.heos.message, populateVolume);
        }
      }
    }
  });
  connection.on("end", function() {
    console.log("disconnected from server");
  });
}

function parseMsg (msg, cb) {
  var args = [], qs = msg.split("&");
  for (var i = 0; i < qs.length; i++) {
    args.push(qs[i].split("=")[1]);
  }
  if (typeof cb == "function") cb.apply(this, args);
}

function sendCmd (cmd, obj) {
  if (connection.readyState == "open") {
    var msg = "heos://" + cmd;
    var qs = [];
    if (obj) {
      for (var k in obj) {
        if (obj.hasOwnProperty(k)) {
          var v = obj[k];
          qs.push([k,v].join("="));
        }
      }
      msg += "?" + qs.join("&");
    }
    connection.write(msg + "\r\n");
  }
}

function toggleState (state) {
  var toggle = {
    "play": "pause",
    "pause": "play",
    "stop": "play"
  };
  return toggle[state];
}

function populatePlayers(payload) {
  ui.speaker_count.$.text("(" + payload.length + " detected)");
  ui.speaker.$.children().remove();
  for (var i in payload) {
    var obj = payload[i];
    var option = document.createElement("option");
    // option.value = ip;
    option.textContent = obj.name;
    for (var k in obj) {
      option.dataset[k] = obj[k];
    }
    ui.speaker.$.append(option);
  }
  getVolume(payload[0].pid);
  getState(payload[0].pid);
}

function populateVolume(pid, level) {
  lastCommand = "populateVolume";
  if (ui.speaker.$.children().filter(":selected").data("pid") == pid) {
    ui.dial.$.val(level).trigger("change");
  }
}

function populateState (pid, state) {
  lastCommand = "populateState";
  if (ui.speaker.$.children().filter(":selected").data("pid") == pid) {
    ui.state.$.find(".glyphicon")
      .removeClass("glyphicon-play glyphicon-pause glyphicon-stop")
      .addClass("glyphicon-" + toggleState(state));
  }
}

function getVolume(pid) {
  sendCmd("player/get_volume", {
    pid: pid
  });
}

function getState (pid) {
  sendCmd("player/get_play_state", {
    pid: "-652946493"
  });
}

function getPlayQueue (pid, range) {
  sendCmd("player/get_queue", {
    pid: "-652946493"
  });
}

function setVolume(pid, level) {
  sendCmd("player/set_volume", {
    pid: pid,
    level: level
  });
}

function setState(pid, state) {
  sendCmd("player/set_play_state", {
    pid: pid,
    state: state
  });
  populateState(pid, state);
}

function playPrev (pid) {
  sendCmd("player/play_previous", {
    pid: pid
  });
}

function playNext (pid) {
  sendCmd("player/play_next", {
    pid: pid
  });
}
