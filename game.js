const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const gameWrap = document.getElementById("game-wrap");

const W = 1200;
const H = 700;
const CELL = 20;

const FOOD_COUNT = 10;
const NORMAL_FOODS = ["lingkaran", "persegi", "diamond", "segitiga"];

const P_EMAS = 0.10;
const P_KEBAL = 0.07;
const P_LAMBAT = 0.07;
const P_MAGNET = 0.06;

const DURASI_KEBAL = 5000;
const DURASI_LAMBAT = 5000;
const DURASI_MAGNET = 6000;

const RADIUS_MAGNET = 180;
const KECEPATAN_MAGNET = 9;

const AMBANG_PERINGATAN_TEPI = CELL * 2;

const HITAM = [15, 15, 15];
const HITAM_PANEL = [0, 0, 0];
const PUTIH = [245, 245, 245];
const HITAM_PUPIL = [20, 20, 20];
const MERAH = [220, 60, 60];
const EMAS = [255, 200, 0];
const BIRU_TOMBOL = [50, 120, 200];
const BIRU_TOMBOL_HOVER = [70, 150, 230];
const WARNA_BORDER = [0, 200, 170];
const WARNA_BORDER_BAHAYA = [230, 40, 40];
const WARNA_GRID = [30, 30, 30];
const KUNING_TEKS = [255, 220, 80];
const BIRU_KEBAL = [70, 160, 255];
const UNGU_LAMBAT = [180, 90, 230];
const ORANYE_MAGNET = [255, 140, 40];

const PALET_WARNA_ULAR = [
  [[0, 200, 80], [0, 140, 60]],
  [[60, 140, 255], [30, 90, 200]],
  [[190, 80, 230], [140, 40, 180]],
  [[255, 140, 0], [200, 100, 0]],
  [[255, 90, 150], [200, 50, 110]],
  [[0, 220, 220], [0, 160, 160]]
];

const WARNA_KEBAL_ULAR = [[255, 255, 255], [200, 230, 255]];

const JOYSTICK_PUSAT = [110, H - 110];
const JOYSTICK_RADIUS_LUAR = 65;
const JOYSTICK_RADIUS_KNOB = 28;
const JOYSTICK_DEADZONE = 14;

const BOOST_PUSAT = [W - 100, H - 100];
const BOOST_RADIUS = 55;

const FPS_DASAR = 6;
const KENAIKAN_PER_SKOR = 0.5;
const FPS_MAKS = 20;
const TAMBAHAN_BOOST_SHIFT = 10;
const FPS_MAKS_DENGAN_BOOST = 30;
const KURANGI_FPS_SAAT_LAMBAT = 4;

const DURASI_TEKS_MELAYANG = 800;
const FAKTOR_TRANSISI_WARNA = 0.12;

let state = "menu";
let snake = [];
let direction = [CELL, 0];
let nextDirection = [CELL, 0];
let foods = [];
let score = 0;
let highScore = Number(localStorage.getItem("snake_highscore") || 0);

let headColorNow = [...PALET_WARNA_ULAR[0][0]];
let bodyColorNow = [...PALET_WARNA_ULAR[0][1]];

let floatingTexts = [];
let particles = [];

let invincibleUntil = 0;
let slowUntil = 0;
let magnetUntil = 0;

let joystickPos = [...JOYSTICK_PUSAT];
let joystickPointer = null;
let boostPointer = null;
let touchBoost = false;

let keys = new Set();
let lastTime = performance.now();
let moveAccumulator = 0;
let mouseCanvasPos = [0, 0];

const menuOverlay = document.getElementById("menu-overlay");
const pauseOverlay = document.getElementById("pause-overlay");
const gameoverOverlay = document.getElementById("gameover-overlay");
const menuHighScore = document.getElementById("menu-high-score");
const finalScore = document.getElementById("final-score");
const newHighScore = document.getElementById("new-high-score");

function rgb(c, a = 1) {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}

function lerpColor(a, b, t) {
  return a.map((v, i) => v + (b[i] - v) * t);
}

function randInt(max) {
  return Math.floor(Math.random() * max);
}

function randomGridPosition() {
  return [randInt(W / CELL) * CELL, randInt(H / CELL) * CELL];
}

function chooseFoodType() {
  let r = Math.random();
  if (r < P_EMAS) return "emas";
  r -= P_EMAS;
  if (r < P_KEBAL) return "kebal";
  r -= P_KEBAL;
  if (r < P_LAMBAT) return "lambat";
  r -= P_LAMBAT;
  if (r < P_MAGNET) return "magnet";
  return "biasa";
}

function keyOf(p) {
  return `${Math.round(p[0])},${Math.round(p[1])}`;
}

function makeFood(forbidden) {
  let pos;
  do {
    pos = randomGridPosition();
  } while (forbidden.has(keyOf(pos)));

  const type = chooseFoodType();
  return {
    pos: [pos[0], pos[1]],
    jenis: type,
    bentuk: type === "biasa"
      ? NORMAL_FOODS[randInt(NORMAL_FOODS.length)]
      : type
  };
}

function makeAllFoods() {
  const forbidden = new Set(snake.map(keyOf));
  const result = [];
  for (let i = 0; i < FOOD_COUNT; i++) {
    const food = makeFood(forbidden);
    result.push(food);
    forbidden.add(keyOf(food.pos));
  }
  return result;
}

function resetGame() {
  const x = Math.floor(W / CELL / 2) * CELL;
  const y = Math.floor(H / CELL / 2) * CELL;

  snake = [
    [x, y],
    [x - CELL, y],
    [x - CELL * 2, y]
  ];

  direction = [CELL, 0];
  nextDirection = [...direction];
  foods = makeAllFoods();
  score = 0;

  headColorNow = [...PALET_WARNA_ULAR[0][0]];
  bodyColorNow = [...PALET_WARNA_ULAR[0][1]];

  floatingTexts = [];
  particles = [];

  invincibleUntil = 0;
  slowUntil = 0;
  magnetUntil = 0;

  joystickPos = [...JOYSTICK_PUSAT];
  joystickPointer = null;
  boostPointer = null;
  touchBoost = false;

  moveAccumulator = 0;
}

function isInvincible(now) {
  return now < invincibleUntil;
}

function isSlow(now) {
  return now < slowUntil;
}

function isMagnet(now) {
  return now < magnetUntil;
}

function shiftPressed() {
  return keys.has("Shift") || touchBoost;
}

function currentFps(now) {
  let base = Math.min(FPS_MAKS, FPS_DASAR + score * KENAIKAN_PER_SKOR);
  if (isSlow(now)) base = Math.max(3, base - KURANGI_FPS_SAAT_LAMBAT);
  if (state === "main" && shiftPressed()) {
    return Math.min(FPS_MAKS_DENGAN_BOOST, base + TAMBAHAN_BOOST_SHIFT);
  }
  return state === "main" ? base : 30;
}

function setState(next) {
  state = next;
  menuOverlay.classList.toggle("hidden", state !== "menu");
  pauseOverlay.classList.toggle("hidden", state !== "pause");
  gameoverOverlay.classList.toggle("hidden", state !== "gameover");

  if (state === "menu") {
    menuHighScore.textContent = highScore;
  }

  if (state === "gameover") {
    finalScore.textContent = `Skor Akhir: ${score}`;
    if (score >= highScore && score > 0) {
      newHighScore.textContent = "HIGH SCORE BARU!";
      newHighScore.style.color = "rgb(255, 220, 80)";
    } else {
      newHighScore.textContent = `High Score: ${highScore}`;
      newHighScore.style.color = "rgb(255, 220, 80)";
    }
  }
}

function triggerCollisionFeedback() {
  if (typeof navigator.vibrate === "function") navigator.vibrate([80, 35, 120]);

  gameWrap.classList.remove("collision-shake");
  void gameWrap.offsetWidth;
  gameWrap.classList.add("collision-shake");
}

function startGame() {
  resetGame();
  setState("main");
}

function saveHighScore() {
  localStorage.setItem("snake_highscore", String(highScore));
}

function directionAllowed(candidate) {
  return !(candidate[0] === -direction[0] && candidate[1] === -direction[1]);
}

function setDirection(candidate) {
  if (directionAllowed(candidate)) nextDirection = candidate;
}

function applyJoystick(x, y) {
  const dx = x - JOYSTICK_PUSAT[0];
  const dy = y - JOYSTICK_PUSAT[1];
  const dist = Math.hypot(dx, dy);
  const clamped = Math.min(dist, JOYSTICK_RADIUS_LUAR);

  if (dist > 0) {
    joystickPos[0] = JOYSTICK_PUSAT[0] + dx / dist * clamped;
    joystickPos[1] = JOYSTICK_PUSAT[1] + dy / dist * clamped;
  }

  if (dist > JOYSTICK_DEADZONE) {
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) setDirection([CELL, 0]);
      else setDirection([-CELL, 0]);
    } else {
      if (dy > 0) setDirection([0, CELL]);
      else setDirection([0, -CELL]);
    }
  }
}

function canvasPoint(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return [
    (clientX - r.left) * W / r.width,
    (clientY - r.top) * H / r.height
  ];
}

function pointerDistance(x, y, center) {
  return Math.hypot(x - center[0], y - center[1]);
}

function beginPointer(id, x, y) {
  if (state !== "main") return;

  if (pointerDistance(x, y, JOYSTICK_PUSAT) <= JOYSTICK_RADIUS_LUAR + 25 && joystickPointer === null) {
    joystickPointer = id;
    applyJoystick(x, y);
    return;
  }

  if (pointerDistance(x, y, BOOST_PUSAT) <= BOOST_RADIUS + 10 && boostPointer === null) {
    boostPointer = id;
    touchBoost = true;
  }
}

function movePointer(id, x, y) {
  if (id === joystickPointer) applyJoystick(x, y);
}

function endPointer(id) {
  if (id === joystickPointer) {
    joystickPointer = null;
    joystickPos = [...JOYSTICK_PUSAT];
  }

  if (id === boostPointer) {
    boostPointer = null;
    touchBoost = false;
  }
}

canvas.addEventListener("pointerdown", e => {
  canvas.setPointerCapture?.(e.pointerId);
  const [x, y] = canvasPoint(e.clientX, e.clientY);
  beginPointer(e.pointerId, x, y);
});

canvas.addEventListener("pointermove", e => {
  const [x, y] = canvasPoint(e.clientX, e.clientY);
  mouseCanvasPos = [x, y];
  movePointer(e.pointerId, x, y);
});

canvas.addEventListener("pointerup", e => endPointer(e.pointerId));
canvas.addEventListener("pointercancel", e => endPointer(e.pointerId));

window.addEventListener("keydown", e => {
  keys.add(e.key);

  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
    e.preventDefault();
  }

  if (state === "menu") {
    if (e.key === "Enter" || e.key === " ") startGame();
  } else if (state === "main") {
    if (e.key === "Escape") {
      setState("pause");
      return;
    }

    if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") setDirection([0, -CELL]);
    else if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") setDirection([0, CELL]);
    else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") setDirection([-CELL, 0]);
    else if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") setDirection([CELL, 0]);
  } else if (state === "pause") {
    if (e.key === "Escape" || e.key.toLowerCase() === "p") setState("main");
    else if (e.key.toLowerCase() === "r") startGame();
  } else if (state === "gameover") {
    if (e.key === "Enter") startGame();
  }
});

window.addEventListener("keyup", e => keys.delete(e.key));

document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("resume-btn").addEventListener("click", () => setState("main"));
document.getElementById("pause-restart-btn").addEventListener("click", startGame);
document.getElementById("main-menu-btn").addEventListener("click", () => {
  resetGame();
  setState("menu");
});
document.getElementById("gameover-restart-btn").addEventListener("click", startGame);

function colorForType(type) {
  return {
    biasa: MERAH,
    emas: EMAS,
    kebal: BIRU_KEBAL,
    lambat: UNGU_LAMBAT,
    magnet: ORANYE_MAGNET
  }[type] || MERAH;
}

function starPoints(cx, cy, outer, inner, points, rotation) {
  const result = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = rotation + i * Math.PI / points;
    const r = i % 2 === 0 ? outer : inner;
    result.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return result;
}

function polygon(points, fill, stroke = null, lineWidth = 1) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function roundedRect(x, y, w, h, radius, fill, stroke = null, lineWidth = 1) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawText(text, x, y, size, color, align = "left", bold = false) {
  ctx.font = `${bold ? "bold " : ""}${size}px Arial`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function drawStar(cx, cy, outer, inner, rotation, fill, stroke = null) {
  polygon(starPoints(cx, cy, outer, inner, 5, rotation), fill, stroke, 2);
}

function drawFood(food, now) {
  const [x, y] = food.pos;
  const cx = x + CELL / 2;
  const cy = y + CELL / 2;
  const type = food.jenis;

  ctx.save();

  if (type === "emas") {
    const pulse = Math.sin(now / 150) * 3;
    const outer = CELL * 0.45 + pulse;
    const inner = outer * 0.45;

    const glow = 0.18 + 0.10 * Math.sin(now / 150);
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, outer * 2.5);
    g.addColorStop(0, `rgba(255,215,0,${Math.max(0, glow)})`);
    g.addColorStop(1, "rgba(255,215,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, outer * 2.5, 0, Math.PI * 2);
    ctx.fill();

    drawStar(cx, cy, outer, inner, (now / 400) % (Math.PI * 2), rgb(EMAS), rgb(PUTIH));
  } else if (type === "kebal") {
    const pulse = Math.sin(now / 180) * 2;
    const r = CELL * 0.42 + pulse;
    const shield = [
      [cx, cy - r],
      [cx + r * 0.85, cy - r * 0.2],
      [cx + r * 0.55, cy + r],
      [cx - r * 0.55, cy + r],
      [cx - r * 0.85, cy - r * 0.2]
    ];
    polygon(shield, rgb(BIRU_KEBAL), rgb(PUTIH), 2);
  } else if (type === "lambat") {
    const r = CELL * 0.42;
    ctx.fillStyle = rgb(UNGU_LAMBAT);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgb(PUTIH);
    ctx.lineWidth = 2;
    ctx.stroke();

    const a = now / 300;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6);
    ctx.stroke();
  } else if (type === "magnet") {
    const r = CELL * 0.4;
    ctx.strokeStyle = rgb(ORANYE_MAGNET);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.2, Math.PI * 1.8);
    ctx.stroke();

    ctx.fillStyle = "rgb(200,200,200)";
    ctx.beginPath();
    ctx.arc(cx - r * 0.85, cy + r * 0.1, 3, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.85, cy + r * 0.1, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const phase = x * 0.02 + y * 0.03;
    const scale = 1 + 0.08 * Math.sin(now / 280 + phase);
    const size = (CELL - 6) * scale;
    const dark = MERAH.map(c => Math.max(0, c - 45));
    const light = MERAH.map(c => Math.min(255, c + 55));

    ctx.fillStyle = "rgba(0,0,0,.31)";
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy + 3, CELL * 0.42, CELL * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    drawBasicShape(food.bentuk, cx, cy, size, rgb(dark));
    drawBasicShape(food.bentuk, cx - size * 0.10, cy - size * 0.10, size * 0.62, rgb(light));
    drawBasicShape(food.bentuk, cx, cy, size, "rgb(90,15,15)", null, 2);

    ctx.fillStyle = rgb(PUTIH, 0.9);
    ctx.beginPath();
    ctx.ellipse(cx - size * 0.12, cy - size * 0.21, size * 0.16, size * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawBasicShape(shape, cx, cy, size, fill, stroke = null, lineWidth = 1) {
  const r = size / 2;
  ctx.save();

  if (shape === "lingkaran") {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  } else if (shape === "persegi") {
    roundedRect(cx - r, cy - r, size, size, 5, fill, stroke, lineWidth);
  } else if (shape === "diamond") {
    polygon([[cx, cy-r], [cx+r, cy], [cx, cy+r], [cx-r, cy]], fill, stroke, lineWidth);
  } else {
    polygon([[cx, cy-r], [cx+r, cy+r*0.8], [cx-r, cy+r*0.8]], fill, stroke, lineWidth);
  }

  ctx.restore();
}

function createParticles(x, y, color, count = 14, now) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: [...color],
      start: now,
      duration: 350 + Math.random() * 200
    });
  }
}

function updateParticles(now, dt) {
  particles = particles.filter(p => {
    const elapsed = now - p.start;
    if (elapsed >= p.duration) return false;

    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.vy += 0.05 * dt * 60;

    const progress = elapsed / p.duration;
    const radius = Math.max(1, 4 * (1 - progress));

    ctx.fillStyle = rgb(p.color, 1 - progress);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();

    return true;
  });
}

function updateGame(now) {
  if (state !== "main") return;

  const fps = currentFps(now);
  const interval = 1000 / fps;

  moveAccumulator += now - lastTime;
  if (moveAccumulator < interval) return;

  moveAccumulator %= interval;
  direction = [...nextDirection];

  const oldHead = snake[0];
  const rawHead = [oldHead[0] + direction[0], oldHead[1] + direction[1]];

  let newHead;
  let outOfScreen = false;

  if (isInvincible(now)) {
    newHead = [((rawHead[0] % W) + W) % W, ((rawHead[1] % H) + H) % H];
  } else {
    newHead = rawHead;
    outOfScreen = newHead[0] < 0 || newHead[0] >= W || newHead[1] < 0 || newHead[1] >= H;
  }

  snake.unshift(newHead);

  if (isMagnet(now)) {
    const headCx = newHead[0] + CELL / 2;
    const headCy = newHead[1] + CELL / 2;

    for (const food of foods) {
      const mx = food.pos[0] + CELL / 2;
      const my = food.pos[1] + CELL / 2;
      const dx = headCx - mx;
      const dy = headCy - my;
      const dist = Math.hypot(dx, dy);

      if (dist > 0 && dist < RADIUS_MAGNET) {
        food.pos[0] += dx / dist * KECEPATAN_MAGNET;
        food.pos[1] += dy / dist * KECEPATAN_MAGNET;
      }
    }
  }

  let eaten = null;
  for (const food of foods) {
    if (
      newHead[0] < food.pos[0] + CELL &&
      newHead[0] + CELL > food.pos[0] &&
      newHead[1] < food.pos[1] + CELL &&
      newHead[1] + CELL > food.pos[1]
    ) {
      eaten = food;
      break;
    }
  }

  if (eaten) {
    const pos = [...eaten.pos];
    const type = eaten.jenis;
    const color = colorForType(type);

    if (type === "emas") {
      score += 5;
      snake.push([...snake[snake.length - 1]]);
      addFloatingText(pos[0] + CELL / 2, pos[1], "+5", KUNING_TEKS, now);
    } else if (type === "kebal") {
      score += 2;
      invincibleUntil = now + DURASI_KEBAL;
      addFloatingText(pos[0] + CELL / 2, pos[1], "KEBAL!", BIRU_KEBAL, now);
    } else if (type === "lambat") {
      score += 2;
      slowUntil = now + DURASI_LAMBAT;
      addFloatingText(pos[0] + CELL / 2, pos[1], "LAMBAT!", UNGU_LAMBAT, now);
    } else if (type === "magnet") {
      score += 2;
      magnetUntil = now + DURASI_MAGNET;
      addFloatingText(pos[0] + CELL / 2, pos[1], "MAGNET!", ORANYE_MAGNET, now);
    } else {
      score += 1;
      addFloatingText(pos[0] + CELL / 2, pos[1], "+1", PUTIH, now);
    }

    createParticles(pos[0] + CELL / 2, pos[1] + CELL / 2, color, 14, now);

    const index = foods.indexOf(eaten);
    if (index >= 0) foods.splice(index, 1);

    const forbidden = new Set(snake.map(keyOf));
    foods.forEach(f => forbidden.add(keyOf(f.pos)));
    foods.push(makeFood(forbidden));
  } else {
    snake.pop();
  }

  const selfCollision = !isInvincible(now) &&
    snake.slice(1).some(seg => seg[0] === newHead[0] && seg[1] === newHead[1]);

  if (outOfScreen || selfCollision) {
    triggerCollisionFeedback();
    if (score > highScore) {
      highScore = score;
      saveHighScore();
    }
    setState("gameover");
  }
}

function addFloatingText(x, y, text, color, now) {
  floatingTexts.push({ x, y, text, color: [...color], start: now });
}

function drawFloatingTexts(now) {
  floatingTexts = floatingTexts.filter(t => {
    const elapsed = now - t.start;
    if (elapsed >= DURASI_TEKS_MELAYANG) return false;

    const progress = elapsed / DURASI_TEKS_MELAYANG;
    drawText(t.text, t.x, t.y - 30 * progress, 28, rgb(t.color, 1 - progress), "center", false);
    return true;
  });
}

function drawSnake(now) {
  const inv = isInvincible(now);
  const boost = shiftPressed();

  let targetHead, targetBody;
  if (state === "main" && inv) {
    [targetHead, targetBody] = WARNA_KEBAL_ULAR;
  } else if (state === "main" && boost) {
    targetHead = PUTIH;
    targetBody = PUTIH;
  } else {
    const paletteIndex = Math.floor(score / 5) % PALET_WARNA_ULAR.length;
    [targetHead, targetBody] = PALET_WARNA_ULAR[paletteIndex];
  }

  headColorNow = lerpColor(headColorNow, targetHead, FAKTOR_TRANSISI_WARNA);
  bodyColorNow = lerpColor(bodyColorNow, targetBody, FAKTOR_TRANSISI_WARNA);

  const count = snake.length;

  ctx.save();
  if (state === "main" && boost) {
    ctx.shadowColor = "rgba(255, 218, 75, .9)";
    ctx.shadowBlur = 18;
  }

  for (let i = 0; i < count; i++) {
    const seg = snake[i];
    const t = i / Math.max(1, count - 1);
    const color = lerpColor(headColorNow, bodyColorNow, t);

    if (i === count - 1 && count > 1) {
      const size = CELL * 0.55;
      const offset = (CELL - size) / 2;
      roundedRect(seg[0] + offset, seg[1] + offset, size, size, 4, rgb(color));
    } else {
      roundedRect(seg[0], seg[1], CELL, CELL, 5, rgb(color));
    }
  }

  ctx.restore();

  if (snake.length) drawEyes(snake[0][0], snake[0][1], direction);
}

function drawEyes(x, y, dir) {
  const dx = dir[0] === 0 ? 0 : dir[0] / CELL;
  const dy = dir[1] === 0 ? 0 : dir[1] / CELL;
  const eyeRadius = Math.max(3, CELL / 6);
  const pupilRadius = Math.max(1, eyeRadius / 2);

  let points;
  if (dx === 1) points = [[0.68, 0.30], [0.68, 0.70]];
  else if (dx === -1) points = [[0.32, 0.30], [0.32, 0.70]];
  else if (dy === -1) points = [[0.30, 0.32], [0.70, 0.32]];
  else points = [[0.30, 0.68], [0.70, 0.68]];

  for (const [tx, ty] of points) {
    const ex = x + tx * CELL;
    const ey = y + ty * CELL;

    ctx.fillStyle = rgb(PUTIH);
    ctx.beginPath();
    ctx.arc(ex, ey, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = rgb(HITAM_PUPIL);
    ctx.beginPath();
    ctx.arc(ex + dx * 2, ey + dy * 2, pupilRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBackground() {
  ctx.fillStyle = rgb(HITAM);
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = rgb(WARNA_GRID);
  ctx.lineWidth = 1;

  for (let x = 0; x < W; x += CELL) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
    ctx.stroke();
  }

  for (let y = 0; y < H; y += CELL) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
  }
}

function drawBorder(now) {
  let color = WARNA_BORDER;

  if (state === "main" && !isInvincible(now) && snake.length) {
    const [x, y] = snake[0];
    const near =
      x < AMBANG_PERINGATAN_TEPI ||
      x > W - CELL - AMBANG_PERINGATAN_TEPI ||
      y < AMBANG_PERINGATAN_TEPI ||
      y > H - CELL - AMBANG_PERINGATAN_TEPI;

    if (near && Math.floor(now / 200) % 2 === 0) color = WARNA_BORDER_BAHAYA;
  }

  ctx.strokeStyle = rgb(color);
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, W - 6, H - 6);

  ctx.strokeStyle = rgb(PUTIH);
  ctx.lineWidth = 3;
  const a = 30;
  const corners = [
    [0, 0, 1, 1],
    [W, 0, -1, 1],
    [0, H, 1, -1],
    [W, H, -1, -1]
  ];

  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * 3);
    ctx.lineTo(cx + dx * a, cy + dy * 3);
    ctx.moveTo(cx + dx * 3, cy);
    ctx.lineTo(cx + dx * 3, cy + dy * a);
    ctx.stroke();
  }
}

function drawControls() {
  ctx.fillStyle = "rgba(255,255,255,.16)";
  ctx.beginPath();
  ctx.arc(JOYSTICK_PUSAT[0], JOYSTICK_PUSAT[1], JOYSTICK_RADIUS_LUAR, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,.39)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,.51)";
  ctx.beginPath();
  ctx.arc(joystickPos[0], joystickPos[1], JOYSTICK_RADIUS_KNOB, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = touchBoost ? "rgba(255,200,0,.63)" : "rgba(255,255,255,.18)";
  ctx.beginPath();
  ctx.arc(BOOST_PUSAT[0], BOOST_PUSAT[1], BOOST_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,.39)";
  ctx.lineWidth = 3;
  ctx.stroke();

  drawText("BOOST", BOOST_PUSAT[0], BOOST_PUSAT[1], 20, rgb(PUTIH), "center", true);
}

function drawHUD(now) {
  roundedRect(10, 10, 260, 55, 14, "rgba(0,0,0,.59)");
  drawText(`Skor: ${score}`, 24, 26, 20, rgb(PUTIH), "left", true);
  drawText(`High Score: ${highScore}`, 24, 49, 20, rgb(KUNING_TEKS));

  const speed = state === "main" ? currentFps(now) : 0;
  const speedActive = state === "main" && shiftPressed();
  roundedRect(W / 2 - 92, 10, 184, 55, 14,
    speedActive ? "rgba(255, 190, 20, .18)" : "rgba(0, 0, 0, .59)",
    speedActive ? "rgba(255, 220, 75, .6)" : null);
  drawText("KECEPATAN", W / 2, 27, 12, speedActive ? rgb(EMAS) : rgb([170, 190, 185]), "center", true);
  drawText(state === "main" ? `${speed.toFixed(1)} sel/dtk` : "--", W / 2, 49, 19, rgb(PUTIH), "center", true);

  if (state === "main" && shiftPressed()) {
    drawText("BOOST!", 170, 26, 20, rgb(EMAS), "left", true);
  }

  const effects = [];
  if (isInvincible(now)) effects.push(["KEBAL", BIRU_KEBAL, (invincibleUntil - now) / 1000]);
  if (isSlow(now)) effects.push(["LAMBAT", UNGU_LAMBAT, (slowUntil - now) / 1000]);
  if (isMagnet(now)) effects.push(["MAGNET", ORANYE_MAGNET, (magnetUntil - now) / 1000]);

  if (effects.length) {
    roundedRect(10, 75, 200, 30 * effects.length + 10, 12, "rgba(0,0,0,.55)");
    effects.forEach((e, i) => {
      drawText(`${e[0]}  ${e[2].toFixed(1)}s`, 22, 88 + i * 26, 16, rgb(e[1]), "left", true);
    });
  }

  if (state === "main") {
    const hovered = mouseCanvasPos[0] >= W - 125 && mouseCanvasPos[0] <= W - 25 &&
      mouseCanvasPos[1] >= 15 && mouseCanvasPos[1] <= 60;

    roundedRect(W - 125, 15, 100, 45, 10, rgb(hovered ? BIRU_TOMBOL_HOVER : BIRU_TOMBOL));
    drawText("MENU", W - 75, 37, 20, rgb(PUTIH), "center", true);
  }
}

function isTouchDevice() {
  return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
}

canvas.addEventListener("click", e => {
  if (state !== "main") return;
  const [x, y] = canvasPoint(e.clientX, e.clientY);
  if (x >= W - 125 && x <= W - 25 && y >= 15 && y <= 60) {
    setState("pause");
  }
});

function render(now, dt) {
  drawBackground();

  for (const food of foods) drawFood(food, now);

  drawSnake(now);
  updateParticles(now, dt);
  drawBorder(now);
  drawFloatingTexts(now);
  drawHUD(now);
  if (isTouchDevice() && state === "main") drawControls();

  requestAnimationFrame(loop);
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);

  updateGame(now);
  render(now, dt);

  lastTime = now;
}

resetGame();
setState("menu");
requestAnimationFrame(loop);
