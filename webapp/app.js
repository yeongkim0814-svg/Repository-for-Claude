// 브라우저에서 브로커로 직접 붙는다(WSS). 별도 서버가 없으므로 GitHub Pages 만으로 돌아간다.
import { encodeRLE, PALETTE, PALETTE_NAMES, FACE_PIXELS } from './encode.js';
import { DotCanvas, rasterizeText } from './drawing.js';

const PRESETS = [
  ['neutral', '기본'], ['happy', '기쁨'], ['love', '하트'], ['wink', '윙크'],
  ['surprise', '놀람'], ['sad', '슬픔'], ['angry', '삐짐'], ['bored', '심심'],
  ['sleepy', '졸림'], ['cheeky', '장난'],
];

const $ = (s) => document.querySelector(s);
const dot = $('#dot'), statusText = $('#statusText'), rssiEl = $('#rssi');
const canvas = new DotCanvas($('#canvas'));
let client = null, cfg = loadConfig(), sleeping = false;

// --- 설정 -------------------------------------------------------------------
function loadConfig() {
  try { return JSON.parse(localStorage.getItem('bmo.cfg')) || {}; } catch { return {}; }
}
function saveConfig(c) { localStorage.setItem('bmo.cfg', JSON.stringify(c)); }

function openSettings() {
  const f = $('#settingsForm');
  for (const k of ['host', 'port', 'path', 'user', 'pass', 'deviceId'])
    if (cfg[k] !== undefined) f.elements[k].value = cfg[k];
  $('#settings').showModal();
}

$('#settingsBtn').onclick = openSettings;
$('#settingsForm').addEventListener('submit', (e) => {
  if (e.submitter && e.submitter.value !== 'save') return;
  const f = e.target;
  cfg = {
    host: f.host.value.trim(), port: +f.port.value, path: f.path.value || '/mqtt',
    user: f.user.value.trim(), pass: f.pass.value || cfg.pass || '',
    deviceId: f.deviceId.value.trim(),
  };
  saveConfig(cfg);
  connect();
});

// --- MQTT -------------------------------------------------------------------
function topic(sub) { return `bmo/${cfg.deviceId}/${sub}`; }

function connect() {
  if (client) { try { client.end(true); } catch {} }
  if (!cfg.host) { openSettings(); return; }

  setStatus(false, '연결 중…');
  client = mqtt.connect(`wss://${cfg.host}:${cfg.port}${cfg.path}`, {
    username: cfg.user, password: cfg.pass,
    clientId: 'bmo-web-' + Math.random().toString(16).slice(2, 8),
    clean: true, reconnectPeriod: 3000, connectTimeout: 8000,
  });

  client.on('connect', () => {
    setStatus(false, '브로커 연결됨');
    client.subscribe([topic('status'), topic('state')], { qos: 0 });
  });
  client.on('reconnect', () => setStatus(false, '재연결 중…'));
  client.on('error', (e) => setStatus(false, '오류: ' + e.message));
  client.on('close', () => setStatus(false, '연결 끊김'));

  client.on('message', (t, payload) => {
    const body = payload.toString();
    if (t === topic('status')) {
      // BMO 가 죽으면 브로커가 LWT 로 offline 을 대신 알려준다
      setStatus(body === 'online', body === 'online' ? '온라인' : '오프라인');
    } else if (t === topic('state')) {
      try { applyState(JSON.parse(body)); } catch {}
    }
  });
}

function setStatus(online, text) {
  dot.classList.toggle('on', !!online);
  statusText.textContent = text;
  if (!online) rssiEl.textContent = '';
}

function applyState(s) {
  if (typeof s.rssi === 'number') rssiEl.textContent = `${s.rssi} dBm`;
  if (typeof s.arm === 'number') { $('#armSlider').value = s.arm; $('#armVal').textContent = s.arm + '°'; }
  if (typeof s.brightness === 'number') { $('#bright').value = s.brightness; $('#brightVal').textContent = s.brightness + '%'; }
  if (typeof s.sleeping === 'boolean') {
    sleeping = s.sleeping;
    $('#sleepBtn').classList.toggle('sel', sleeping);
    $('#sleepBtn').textContent = sleeping ? '수면모드 (켜짐)' : '수면모드';
  }
  [...$('#presets').children].forEach(b => b.classList.toggle('sel', b.dataset.preset === s.expression));
}

function send(sub, obj) {
  if (!client || !client.connected) { setStatus(false, '연결되지 않음'); return; }
  client.publish(topic('cmd/' + sub), JSON.stringify(obj), { qos: 1 });
}

// --- UI ---------------------------------------------------------------------
for (const [id, label] of PRESETS) {
  const b = document.createElement('button');
  b.className = 'ghost';
  b.textContent = label;
  b.dataset.preset = id;
  b.onclick = () => send('face', { preset: id });
  $('#presets').appendChild(b);
}

PALETTE.forEach((color, i) => {
  const b = document.createElement('button');
  b.className = 'swatch' + (i === 1 ? ' sel' : '');
  b.style.background = color;
  b.title = PALETTE_NAMES[i];
  b.onclick = () => {
    canvas.color = i;
    [...$('#palette').children].forEach((el, j) => el.classList.toggle('sel', i === j));
  };
  $('#palette').appendChild(b);
});

$('#brush').oninput  = (e) => canvas.brush = +e.target.value;
$('#undoBtn').onclick  = () => canvas.undo();
$('#clearBtn').onclick = () => canvas.clear(0);

$('#textBtn').onclick = () => {
  const t = $('#textInput').value.trim();
  if (!t) return;
  // 한글은 브라우저가 그려서 도트로 구워 보낸다 — BMO 안에 한글 폰트가 필요 없다
  canvas.load(rasterizeText(t));
  updateSizeHint();
};

$('#sendBtn').onclick = () => {
  send('face', { bitmap: encodeRLE(canvas.px) });
};

$('#armSlider').oninput  = (e) => $('#armVal').textContent = e.target.value + '°';
$('#armSlider').onchange = (e) => send('arm', { angle: +e.target.value });   // 손을 뗄 때만 전송
document.querySelectorAll('[data-arm]').forEach(b => {
  b.onclick = () => send('arm', { preset: b.dataset.arm });
});

$('#sleepBtn').onclick = () => send('sys', { sleep: !sleeping });
$('#bright').oninput   = (e) => $('#brightVal').textContent = e.target.value + '%';
$('#bright').onchange  = (e) => send('sys', { brightness: +e.target.value });

function updateSizeHint() {
  const n = encodeRLE(canvas.px).length;
  $('#sizeHint').textContent = `(${FACE_PIXELS}px → ${n}B)`;
}
$('#canvas').addEventListener('pointerup', updateSizeHint);

window.addEventListener('resize', () => canvas.resize());

// 시작
if (cfg.host) connect(); else openSettings();
updateSizeHint();
