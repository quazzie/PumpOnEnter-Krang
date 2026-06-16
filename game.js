const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = 720, H = 576, DURATION = 30;
const vid = document.getElementById('v');

const I = {};
const SRCS = {
  intro: 'data/png/intro.png', bg: 'data/png/bg.png', ready: 'data/png/ready_to_hack.png',
  game: 'data/png/game_sprite.png',
  ninja: 'data/png/ninja_game.png', rope: 'data/png/rope.png',
  start: 'data/png/start.png', hs: 'data/png/highscore.png',
  sel: 'data/png/ninja.png', cd: 'data/png/countdown.png'
};
let loaded = 0;
Object.entries(SRCS).forEach(([key, src]) => {
  const img = new Image();
  img.src = src;
  img.onload = img.onerror = () => { if (++loaded === Object.keys(SRCS).length) requestAnimationFrame(loop); };
  I[key] = img;
});

const music = {
  menu: makeAudio('data/audio/granmas_holiday.mp3', true),
  game: makeAudio('data/audio/hetspumpning.mp3', true)
};
function makeAudio(src, loop) { const a = new Audio(src); a.loop = loop; a.volume = 0.7; return a; }
function playMenu(restart = false) {
  music.game.pause();
  if (restart || music.menu.paused) {
    if (restart) music.menu.currentTime = 0;
    music.menu.play().catch(() => {});
  }
}
function playGame() { music.menu.pause(); music.menu.currentTime = 0; music.game.play().catch(() => {}); }
function stopAll() { Object.values(music).forEach(t => t.pause()); }

let screen = 'intro', menuSel = 0, waveT = 0;
let score = 0, timeLeft = DURATION, pawnFrame = 1, pressQueue = 0, ninjaProgress = 0;
let blinks = {}, lastEntry = null, pendingScore = null, scoreSaved = false, lastSavedName = 'ANON';
let cdStep = 0, cdTimer = 0, videoContext = null;

let scores = [];
try {
  const stored = JSON.parse(localStorage.getItem('pumpit_hs') || '[]');
  if (Array.isArray(stored)) scores = stored.map(e => {
    if (e == null) return { score: 0, name: 'ANON' };
    if (typeof e === 'number') return { score: e, name: 'ANON' };
    return { score: typeof e.score === 'number' ? e.score : 0, name: typeof e.name === 'string' && e.name.trim() ? e.name.trim() : 'ANON' };
  });
} catch(e) {}
function saveScores() { try { localStorage.setItem('pumpit_hs', JSON.stringify(scores)); } catch(e) {} }

const menuItems = [
  { img: () => I.start, cx: 360, cy: 480, w: 131, h: 42 },
  { img: () => I.hs,    cx: 360, cy: 530, w: 242, h: 45 }
];

function hideVideo() { vid.style.display = 'none'; vid.src = ''; vid.onended = null; }
function showVideo(source, context, onEnd) {
  stopAll(); screen = 'video'; videoContext = context;
  vid.src = source; vid.style.display = 'block';
  vid.play().catch(() => onEnd());
  vid.onended = () => { videoContext = null; onEnd(); };
}

function showMenu()      { hideVideo(); screen = 'menu'; playMenu(); }
function showHighscore() { screen = 'highscore'; }
function showResult()    { hideVideo(); screen = 'result'; playMenu(true); }
function beginCountdown(){ hideVideo(); screen = 'countdown'; cdStep = 0; cdTimer = 0; playGame(); }
function beginGame()     { screen = 'game'; score = 0; timeLeft = DURATION; pawnFrame = 1; pressQueue = 0; ninjaProgress = 0; blinks = {}; }

function savePendingScore() {
  if (pendingScore === null || scoreSaved) return;
  const name = (prompt('Ange ditt namn för highscore', lastSavedName || 'ANON') || '').trim() || 'ANON';
  lastEntry = { score: pendingScore, name };
  lastSavedName = name;
  scores.push(lastEntry);
  scores.sort((a, b) => b.score - a.score);
  scores.length = Math.min(scores.length, 10);
  saveScores(); scoreSaved = true; pendingScore = null;
}

function endGame(skipVideo = false) {
  stopAll(); pendingScore = score; scoreSaved = false;
  if (skipVideo) return showResult();
  showVideo('data/video/end.mp4', 'end', showResult);
}

function handleEscape() {
  if (screen === 'video') {
    vid.pause();
    if (videoContext === 'start') return beginCountdown();
    if (videoContext === 'end') return showResult();
    return showMenu();
  }
  if (screen === 'game') return endGame(true);
  if (screen === 'result' || screen === 'highscore') return showMenu();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') return handleEscape();
  if (e.key === 'F2') { if (screen === 'result' && !scoreSaved && pendingScore !== null) savePendingScore(); return; }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (screen === 'game') { if (!e.repeat) pressQueue++; return; }
    if (screen === 'result' || screen === 'highscore') return;
    activate();
  }
  if (screen === 'menu' && !e.repeat) {
    if (e.key === 'ArrowUp') menuSel = 0;
    if (e.key === 'ArrowDown') menuSel = 1;
  }
});

canvas.addEventListener('click', () => { if (screen === 'game') { pressQueue++; return; } activate(); });
canvas.addEventListener('mousemove', e => {
  if (screen !== 'menu') { canvas.style.cursor = 'default'; return; }
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * W / rect.width;
  const y = (e.clientY - rect.top) * H / rect.height;
  const i = menuItems.findIndex(({cx,cy,w,h}) => x >= cx-w/2 && x <= cx+w/2 && y >= cy-h/2 && y <= cy+h/2);
  canvas.style.cursor = i !== -1 ? 'pointer' : 'default';
  if (i !== -1) menuSel = i;
});

function activate() {
  if (screen === 'intro') return showMenu();
  if (screen === 'menu') return menuSel === 0 ? showVideo('data/video/intro.mp4', 'start', beginCountdown) : showHighscore();
  if (screen === 'result' || screen === 'highscore') return showMenu();
}

function drainQueue() {
  if (screen !== 'game' || pressQueue === 0) return;
  score += pressQueue;
  pawnFrame = ((pawnFrame - 1 + pressQueue) % 3) + 1;
  pressQueue = 0;
}

function blink(key, dt, interval) {
  const b = blinks[key] || (blinks[key] = { t:0, on:true });
  if ((b.t += dt) > interval) { b.on = !b.on; b.t = 0; }
  return b.on;
}

function wave(image, cx, cy, w, h, t) {
  for (let r = 0; r < h; r++) {
    const dx = Math.sin((r/h) * Math.PI * 4 + t) * 2.5;
    ctx.drawImage(image, 0, r, w, 1, cx-w/2+dx, cy-h/2+r, w, 1);
  }
}

function text(str, x, y, font, color, glow) {
  ctx.textAlign = 'center'; ctx.font = font; ctx.fillStyle = color;
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 15; }
  ctx.fillText(str, x, y);
  ctx.shadowBlur = 0;
}

function grade(n) {
  if (n >= 300) return '🏆 LEGENDAR! Oslagbar!';
  if (n >= 240) return '🔥 MASTER! Grymma fingrar!';
  if (n >= 180) return '⚡ PRO! Inte illa alls!';
  if (n >= 120) return '👍 Okej, kan bli bättre!';
  if (n >= 60)  return '😅 Lite mer engagemang…';
  return '🐢 Sköldpaddan ringer!';
}

function drawIntro(dt) {
  ctx.drawImage(I.intro, 0, 0, W, H);
  if (blink('intro', dt, 0.55)) text('KLICKA ELLER TRYCK ENTER FÖR ATT STARTA', W/2, H-18, 'bold 18px "Courier New"', '#fff');
}

function drawMenu(dt) {
  waveT += dt * 3;
  ctx.drawImage(I.bg, 0, 0, W, H);
  menuItems.forEach(({ img, cx, cy, w, h }, i) => {
    wave(img(), cx, cy, w, h, waveT);
    if (menuSel !== i) return;
    const [gap, nw, nh] = [18, 33, 45];
    ctx.save();
    ctx.translate(cx - w/2 - gap, cy);
    ctx.scale(-1, 1);
    ctx.drawImage(I.sel, -nw/2, -nh/2, nw, nh);
    ctx.restore();
    ctx.drawImage(I.sel, cx + w/2 + gap - nw/2, cy - nh/2, nw, nh);
  });
}

function drawCountdown(dt) {
  ctx.drawImage(I.ready, 0, 0, W, H);
  if ((cdTimer += dt) >= 1) { cdTimer -= 1; if (++cdStep >= 3) return beginGame(); }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(I.cd, (2-cdStep)*65, 0, 65, 83, W/2 - 65*0.9/2, 390, 65*0.9, 83*0.9);
}

function drawGame(dt) {
  if ((timeLeft -= dt) <= 0) { timeLeft = 0; return endGame(); }
  ninjaProgress = 1 - timeLeft / DURATION;
  ctx.drawImage(I.game, (pawnFrame-1) * W, 0, W, H, 0, 0, W, H);
  const rh = H - 60, rw = 21 * H / 554, rx = W - 140 - rw;
  ctx.drawImage(I.rope, rx, 0, rw, rh);
  const [nw, nh] = [176, 224];
  ctx.drawImage(I.ninja, rx + rw/2 - nw/2 + 40, Math.round(ninjaProgress * (rh-nh)), nw, nh);
}

function drawResult() {
  ctx.drawImage(I.bg, 0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.88)'; ctx.fillRect(0, 0, W, H);
  text('RESULTAT', W/2, 130, 'bold 48px "Courier New"', '#e94560', '#e94560');
  text(score, W/2, 280, 'bold 120px "Courier New"', '#ffe600', '#ffe600');
  text(`pumpar på ${DURATION} sekunder`, W/2, 320, '16px "Courier New"', '#aaa');
  text(grade(score), W/2, 380, 'bold 22px "Courier New"', '#16c79a', '#16c79a');
  const rank = lastEntry ? scores.indexOf(lastEntry) + 1 : 0;
  if (rank === 1) text('🏆 NYTT HIGHSCORE!', W/2, 420, '16px "Courier New"', '#fff');
  else if (rank > 0) text(`Placering: #${rank} på listan`, W/2, 420, '16px "Courier New"', '#fff');
  if (pendingScore !== null && !scoreSaved) text('Tryck F2 för att spara poäng', W/2, 450, '16px "Courier New"', '#fff');
  text('[ ESC ] för att gå tillbaka', W/2, 480, '14px "Courier New"', 'rgba(255,255,255,0.5)');
}

function drawVideo() {
  text('[ ESC ] för att hoppa över', W/2, H-24, '14px "Courier New"', '#fff', '#000');
}

function drawHighscore() {
  ctx.drawImage(I.bg, 0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.82)'; ctx.fillRect(0, 0, W, H);
  text('HIGHSCORES', W/2, 100, 'bold 36px "Courier New"', '#e94560', '#e94560');
  if (!scores.length) text('Inga scores ännu', W/2, 280, '20px "Courier New"', '#888');
  else scores.slice(0, 10).forEach((entry, i) => {
    ctx.fillStyle = i === 0 ? '#ffd700' : '#fff';
    ctx.font = (i === 0 ? 'bold ' : '') + '22px "Courier New"';
    ctx.textAlign = 'left';  ctx.fillText(`#${i+1} ${entry.name}`, 140, 155 + i*34);
    ctx.textAlign = 'right'; ctx.fillText(entry.score, 560, 155 + i*34);
  });
  text('[ ESC ] för att gå tillbaka', W/2, 530, '14px "Courier New"', 'rgba(255,255,255,0.5)');
}

let lastTime = 0;
function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.1);
  lastTime = ts;
  drainQueue();
  ctx.clearRect(0, 0, W, H);
  try {
    if (screen === 'intro')       drawIntro(dt);
    else if (screen === 'menu')   drawMenu(dt);
    else if (screen === 'countdown') drawCountdown(dt);
    else if (screen === 'game')   drawGame(dt);
    else if (screen === 'result') drawResult();
    else if (screen === 'highscore') drawHighscore();
    else if (screen === 'video')  drawVideo();
  } catch(e) { console.warn('draw error:', e); }
  requestAnimationFrame(loop);
}