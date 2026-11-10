// Aura LCD PebbleKit JS: Clay settings + Open-Meteo weather bridge.
// The watch has no internet; this runs on the phone, fetches weather, and pushes
// temperature + WMO weather code to the watch over AppMessage. Open-Meteo needs
// no API key, which keeps this free for anyone installing the face.

var Clay = require('pebble-clay');
var clayConfig = require('./config');

// Runs on the generated config page (injected via toString, so it must be fully
// self-contained). Gives the page an Aura identity instead of the plain default:
// a branded header, wide rounded section cards, aligned labels, and an accent
// Save button in Aura's sky colours.
function clayStyle() {
  var clayConfig = this;
  var css = [
    'body{background:#0e1116;color:#e6edf3;}',
    '#aura-hd{padding:26px 16px 20px;text-align:center;',
      'background:linear-gradient(160deg,#20344f,#0e1116);}',
    '#aura-hd .wm{font-size:30px;font-weight:700;letter-spacing:9px;color:#fff;}',
    '#aura-hd .sub{margin-top:6px;font-size:12px;letter-spacing:2px;',
      'color:#8aa0b6;text-transform:uppercase;}',
    '.section{margin:16px 12px;border-radius:16px;overflow:hidden;',
      'background:#171d27;box-shadow:0 1px 6px rgba(0,0,0,.45);}',
    '.item{padding:15px 18px;}',
    '.label{font-size:16px;letter-spacing:.2px;color:#e6edf3;}',
    '.description{color:#8aa0b6;}',
    '.input{border-radius:10px;padding:12px;}',
    '.component-submit .button,.button{margin:18px 12px;border:0;border-radius:14px;',
      'padding:15px;font-size:17px;letter-spacing:2px;text-transform:uppercase;color:#04222b;',
      'background:linear-gradient(90deg,#2ec4b6,#1f8fb0);}'
  ].join('');
  var st = document.createElement('style');
  st.innerHTML = css;
  document.head.appendChild(st);

  this.on(this.EVENTS.AFTER_BUILD, function () {
    if (document.getElementById('aura-hd')) { return; }
    var hd = document.createElement('div');
    hd.id = 'aura-hd';
    hd.innerHTML = '<div class="wm">AURA</div><div class="sub">LED CGW-50 watchface</div>';
    document.body.insertBefore(hd, document.body.firstChild);
  });

  // The accent colour picker only matters while "Automatic" is off.
  clayConfig.on(clayConfig.EVENTS.AFTER_BUILD, function () {
    var auto = clayConfig.getItemByMessageKey('ACCENT_AUTO');
    var pick = clayConfig.getItemByMessageKey('ACCENT');
    if (!auto || !pick) { return; }
    function sync() { if (auto.get()) { pick.hide(); } else { pick.show(); } }
    auto.on('change', sync);
    sync();
  });

  // Worldwide city typeahead under the "Search a city" box. A declarative Clay
  // config cannot do this, so it is wired here (this whole function is injected
  // into the config page as a string, so it must stay self-contained: no
  // require, no closures over module scope). Debounced query against the keyless
  // Open-Meteo geocoder; a tap fills CITY / LAT / LON and turns GPS off.
  clayConfig.on(clayConfig.EVENTS.AFTER_BUILD, function () {
    var searchItem = clayConfig.getItemByMessageKey('SEARCH');
    if (!searchItem || !searchItem.$element) { return; }

    var box = document.createElement('div');
    box.style.margin = '0 0 6px 0';
    box.style.background = '#171d27';
    searchItem.$element[0].appendChild(box);   // minified list: [0] is the raw node (not jQuery .get(0))

    var timer = null;

    function setVal(key, value) {
      var item = clayConfig.getItemByMessageKey(key);
      if (item) { try { item.set(value); } catch (e) {} }
    }

    function pick(r) {
      setVal('CITY', r.name);
      setVal('LAT', String(r.lat));
      setVal('LON', String(r.lon));
      setVal('USE_GPS', false);   // picking a city means "use this city"
      box.innerHTML = '';
    }

    function render(rows) {
      box.innerHTML = '';
      for (var i = 0; i < rows.length; i++) {
        (function (r) {
          var row = document.createElement('div');
          row.textContent = r.label;
          row.style.padding = '12px 18px';
          row.style.borderBottom = '1px solid #2a3340';
          row.style.color = '#e6edf3';
          row.style.cursor = 'pointer';
          row.onclick = function () { pick(r); };
          box.appendChild(row);
        })(rows[i]);
      }
    }

    var seq = 0;   // only the newest query may draw results (replies can arrive out of order)

    function search(q) {
      var url = 'https://geocoding-api.open-meteo.com/v1/search?name=' +
        encodeURIComponent(q) + '&count=8&language=en&format=json';
      var my = ++seq;
      var req = new XMLHttpRequest();
      req.open('GET', url, true);
      req.timeout = 8000;
      req.ontimeout = function () { if (my === seq) { render([]); } };
      req.onload = function () {
        if (my !== seq) { return; }
        if (req.status < 200 || req.status >= 300) { render([]); return; }
        var rows = [];
        try {
          var j = JSON.parse(req.responseText);
          var res = j.results || [];
          for (var i = 0; i < res.length; i++) {
            var x = res[i];
            var parts = [x.name];
            if (x.admin1) { parts.push(x.admin1); }
            if (x.country) { parts.push(x.country); }
            rows.push({ name: x.name, lat: x.latitude, lon: x.longitude, label: parts.join(', ') });
          }
        } catch (e) {}
        render(rows);
      };
      req.onerror = function () { if (my === seq) { render([]); } };
      req.send();
    }

    searchItem.$manipulatorTarget.on('keyup', function () {
      if (timer) { clearTimeout(timer); }
      var q = String(searchItem.get() || '').trim();
      if (q.length < 2) { box.innerHTML = ''; return; }
      timer = setTimeout(function () { search(q); }, 300);
    });
  });
}

// Settings saved before 1.3 hold palette indices as strings ("0".."12", ACCENT "-1" for automatic).
// The colour pickers want 0xRRGGBB numbers, so convert them once, in place.
(function migrateColours() {
  var OLD = [0xFFFFFF, 0x000000, 0xAAAAAA, 0x555555, 0xFF0000, 0xFF5500, 0xFFFF00, 0x00FF00,
             0x00FFFF, 0x0000FF, 0xAA00FF, 0xFFFFAA, 0xFFAA00];
  try {
    var s = JSON.parse(localStorage.getItem('clay-settings'));
    if (!s) { return; }
    var changed = false;
    ['DAY_BG', 'DAY_FG', 'NIGHT_BG', 'NIGHT_FG', 'ACCENT'].forEach(function (k) {
      if (typeof s[k] !== 'string') { return; }
      var i = parseInt(s[k], 10);
      if (k === 'ACCENT') { s.ACCENT_AUTO = i < 0; }
      if (!isNaN(i) && i >= 0 && i < OLD.length) { s[k] = OLD[i]; }
      else { delete s[k]; }
      changed = true;
    });
    if (changed) { localStorage.setItem('clay-settings', JSON.stringify(s)); }
  } catch (e) {}
})();

var clay = new Clay(clayConfig, clayStyle);

function settings() {
  try { return JSON.parse(localStorage.getItem('clay-settings')) || {}; }
  catch (e) { return {}; }
}

// A failed refresh keeps the last good reading on the watch instead of blanking it.
function sendError() { console.log('weather refresh failed'); }

// timezone=auto: Open-Meteo returns the location's own calendar day (so "today" high and low are
// right anywhere) with times in the location's local time plus utc_offset_seconds. Turning a
// location-local ISO string into a real instant, then reading it on the phone's clock, gives
// the watch sunrise and sunset in its own time of day.
function instant(iso, off) {
  return Date.parse(iso + 'Z') - off * 1000;
}

function localMinutes(iso, off) {
  var d = new Date(instant(iso, off));
  return d.getHours() * 60 + d.getMinutes();
}

// Polar day and night: the API reports sunrise equal to sunset. daylight_duration tells them
// apart. Sent as 0..1440 (sun up all day) or 0..0 (never up), which the watch labels.
function sunTimes(d, off) {
  var rise = d.daily.sunrise[0], set = d.daily.sunset[0];
  if (!rise || !set || rise === set) {
    var up = (d.daily.daylight_duration && d.daily.daylight_duration[0] > 0);
    return { rise: 0, set: up ? 1440 : 0 };
  }
  return { rise: localMinutes(rise, off), set: localMinutes(set, off) };
}

var fetchSeq = 0;   // only the newest request may update the watch

function fetchWeather(lat, lon) {
  var s = settings();
  var unit = s.UNITS ? '&temperature_unit=fahrenheit' : '';
  // Two decimals (about 1 km) is plenty for weather and shares less than the exact GPS fix.
  var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + Number(lat).toFixed(2) +
            '&longitude=' + Number(lon).toFixed(2) + '&current=temperature_2m,weather_code' +
            '&hourly=temperature_2m,precipitation_probability' +
            '&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,daylight_duration' +
            '&timezone=auto&forecast_days=2' + unit;
  var my = ++fetchSeq;
  var xhr = new XMLHttpRequest();
  xhr.timeout = 15000;
  xhr.onload = function () {
    if (my !== fetchSeq) { return; }
    if (xhr.status !== 200) { console.log('weather http ' + xhr.status); sendError(); return; }
    try {
      var d = JSON.parse(xhr.responseText);
      var off = d.utc_offset_seconds | 0;
      var now = Date.now(), start = 0, ft = [], fp = [];
      for (var k = 0; k < d.hourly.time.length; k++) {
        if (instant(d.hourly.time[k], off) > now - 3600000) { start = k; break; }
      }
      for (var h = 0; h < 18; h++) {
        ft.push(Math.max(0, Math.min(255, Math.round(d.hourly.temperature_2m[start + h]) + 50)));
        fp.push(Math.max(0, Math.min(100, d.hourly.precipitation_probability[start + h] | 0)));
      }
      var sun = sunTimes(d, off);
      Pebble.sendAppMessage({
        'FC_H': new Date(instant(d.hourly.time[start], off)).getHours(),
        'FC_T': ft,
        'FC_P': fp,
        'WX_TEMP': Math.round(d.current.temperature_2m),
        'WX_CODE': d.current.weather_code | 0,
        'WX_HI': Math.round(d.daily.temperature_2m_max[0]),
        'WX_LO': Math.round(d.daily.temperature_2m_min[0]),
        'SUNRISE': sun.rise,
        'SUNSET': sun.set,
        'WX_OK': 1
      });
    } catch (e) { console.log('weather parse: ' + e); sendError(); }
  };
  xhr.onerror = function () { sendError(); };
  xhr.ontimeout = function () { sendError(); };
  xhr.open('GET', url);
  xhr.send();
}

function locateAndFetch() {
  var s = settings();
  var lat = parseFloat(s.LAT), lon = parseFloat(s.LON);
  // USE_GPS defaults on when unset. Off means use the searched city / manual
  // coordinates, which the typeahead fills into LAT/LON (CITY is display only).
  var useGps = (s.USE_GPS === undefined) ? true : s.USE_GPS;
  if (!useGps && !isNaN(lat) && !isNaN(lon)) {
    fetchWeather(lat, lon);
    return;
  }
  navigator.geolocation.getCurrentPosition(        // else the phone's GPS
    function (pos) { fetchWeather(pos.coords.latitude, pos.coords.longitude); },
    function () { sendError(); },
    { timeout: 15000, maximumAge: 600000 }
  );
}

Pebble.addEventListener('ready', function () {
  console.log('ready');
  locateAndFetch();
  setInterval(locateAndFetch, 30 * 60 * 1000); // refresh every 30 minutes
});

// A settings save (units, city, GPS) must show up now, not at the next 30 minute tick. Clay has
// already written the new values to localStorage by the time this fires (its own listener is
// registered first), so a short delay is enough.
Pebble.addEventListener('webviewclosed', function (e) {
  if (e && e.response) { setTimeout(locateAndFetch, 500); }
});

// The watch never messages the phone; this is only a manual hook for testing
// (e.g. `pebble send-app-message` from the emulator) to force an immediate refresh.
Pebble.addEventListener('appmessage', function () {
  locateAndFetch();
});
