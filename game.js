/* game.js — Versão final corrigida (mouthPositions fixas fora do feltro,
   orientação para dentro, desenho e física alinhados)
*/

console.log("game.js — pockets corrigidas (fixas, fora do feltro)");

/* ---------- canvas ---------- */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

/* ---------- mesa params ---------- */
const railOuter = 28;
const railInner = 12;
const pocketRadius = 26;

let cueRecoil = 0;        // animação do recuo atual
let cueRecoilTarget = 0;  // alvo de recuo quando o jogador tacar
let simulationRunning = false;
// pull-back (recuo real do taco)
let pullBack = 0;      // recuo atual (px)
let maxPullBack = 80;  // limite máximo de recuo (ajuste se quiser)
// força via barra (seletor independente)
let shotPower = 0;            // 0..36
let isAdjustingPower = false; // true enquanto arrasta a barra
// configurações da barra (tamanho/posição em px — ajuste se quiser)
const powerBar = {
  x: 40,
  y: null,   // vamos calcular dinamicamente como H/2 - barH/2 (no draw)
  w: 200,
  h: 20
};

const table = {
  x: railOuter,
  y: railOuter,
  width: W - railOuter * 2,
  height: H - railOuter * 2,
  pocketRadius
};

const cx = table.x + table.width / 2;
const cy = table.y + table.height / 2;

/* ---------- input / aiming state ---------- */
let aiming = false;
let mouse = { x: 0, y: 0 };
let isDragging = false;

/* ---------- util: converte evento para coordenadas do canvas (corrige escala) ---------- */
function toCanvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height)
  };
}

/* ---------- pointer handlers (pointer API cobre mouse + touch) ---------- */
function onPointerDown(e) {
    if (!areBallsStopped()) return;

    const pos = (e.touches && e.touches[0])
        ? toCanvasCoords(e.touches[0].clientX, e.touches[0].clientY)
        : toCanvasCoords(e.clientX, e.clientY);

    const white = balls[0];
    const dist = Math.hypot(pos.x - white.x, pos.y - white.y);

    // Jogador tocou na área útil da mira
    if (dist <= white.r + 140) {
        aiming = true;
        isDragging = true;
        mouse = pos;
        pullBack = 0;
        return;
    }

    // Tocou fora → NÃO desligar mira se o jogo está parado
    // (mantém mira livre automaticamente)
    if (!areBallsStopped()) {
        aiming = false;
        isDragging = false;
    }
}

function onPointerMove(e) {
    if (!aiming) return; // permite ajustar recuo mesmo sem "arrastar"

    const pos = (e.touches && e.touches[0])
        ? toCanvasCoords(e.touches[0].clientX, e.touches[0].clientY)
        : toCanvasCoords(e.clientX, e.clientY);

    mouse = pos;

    const white = balls[0];

    // ângulo da mira
    const ang = Math.atan2(mouse.y - white.y, mouse.x - white.x);

    // ✔ PONTO CORRETO da ponta do taco (MESMO que drawCueStick usa!)
    const tipX = white.x - Math.cos(ang) * (white.r + 4);
    const tipY = white.y - Math.sin(ang) * (white.r + 4);

    // vetor ponta → dedo
    const vx = mouse.x - tipX;
    const vy = mouse.y - tipY;

    // componente na direção oposta ao taco (recuo)
    const distBack = vx * -Math.cos(ang) + vy * -Math.sin(ang);

    const maxPullBack = 120;

    pullBack = Math.max(0, Math.min(maxPullBack, distBack));
}

function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;

    if (!aiming) return;

    const white = balls[0];

    // direção da mira
    const dx = mouse.x - white.x;
    const dy = mouse.y - white.y;
    const angle = Math.atan2(dy, dx);

    // força baseada no recuo real
    const power = Math.min(36, pullBack / 3);
    const impulse = power * 0.32;

    white.vx += Math.cos(angle) * impulse;
    white.vy += Math.sin(angle) * impulse;

    simulationRunning = true;

    // desativa mira até as bolas pararem
    aiming = false;

    // reseta recuo
    cueRecoilTarget = Math.min(40, power * 2);
    pullBack = 0;
}

/* listeners */
canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", onPointerUp);
canvas.addEventListener("mouseleave", onPointerUp);

/* ---------- cores ---------- */
const railGold = "#E0B000";
const railBlue = "#0f4f7a";
const feltCenter = "#2f77b3";
const feltEdge = "#13354b";
const pocketColor = "#0b0f12";
const woodColor = "#caa87a";

/* ---------- pockets originais (para referência) ---------- */
const pockets = [
  {x: table.x, y: table.y},                                   // TL
  {x: table.x + table.width/2, y: table.y - 6},               // TM (ligeiro)
  {x: table.x + table.width, y: table.y},                     // TR
  {x: table.x, y: table.y + table.height},                    // BL
  {x: table.x + table.width/2, y: table.y + table.height + 6},// BM
  {x: table.x + table.width, y: table.y + table.height}       // BR
];

/* ---------- mouthPositions FIXAS (fora do feltro) ---------- */
const PR = pocketRadius;
const inwardOffset = -4; // negative: mouth moves OUTWARD (into wood)

const mouthPositions = pockets.map(p => {
  // unit vector center <- pocket
  let dx = cx - p.x;
  let dy = cy - p.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  const mouthX = p.x + dx * inwardOffset;
  const mouthY = p.y + dy * inwardOffset;
  // dir -> center
  let ddx = cx - mouthX, ddy = cy - mouthY;
  const L = Math.hypot(ddx, ddy) || 1;
  ddx /= L; ddy /= L;
  return { px: p.x, py: p.y, mouthX, mouthY, dirX: ddx, dirY: ddy };
});

/* ---------- bolas ---------- */
function createBall(x,y,radius=11,color="#fff",id=0,number=null){
  return {x,y,vx:0,vy:0,r:radius,color,id,mass:radius,number,pocketed:false};
}
const balls = [];
balls.push(createBall(table.x + table.width * 0.22, table.y + table.height/2, 11, "#ffffff", 0, 0));

const ballDefs = [
  {num:1, color:"#FFD200"}, {num:2, color:"#0E6FFF"}, {num:3, color:"#E53935"},
  {num:4, color:"#8E3AC1"}, {num:5, color:"#FF7F00"}, {num:6, color:"#8B4A2F"},
  {num:7, color:"#1E8A3A"}, {num:8, color:"#000000"}, {num:9, color:"#FFD200"},
  {num:10, color:"#0E6FFF"},{num:11, color:"#FF6B6B"},{num:12, color:"#B57EDC"},
  {num:13, color:"#FFC58A"},{num:14, color:"#8B4A2F"},{num:15, color:"#66C175"}
];

const r = 11;
const spacing = r * 2;
const startX = table.x + table.width*0.66;
const startY = table.y + table.height/2;
let idCounter = 1;
let idx = 0;
for(let row=0; row<5; row++){
  const rowSizes = [5,4,3,2,1];
  const rowSize = rowSizes[row];
  const x = startX + row * (spacing * 0.88);
  const totalH = (rowSize - 1) * spacing;
  for(let col=0; col<rowSize; col++){
    const y = startY - totalH/2 + col * spacing;
    const def = ballDefs[idx % ballDefs.length];
    balls.push(createBall(x, y, r, def.color, ++idCounter, def.num));
    idx++;
    if(idx >= 15) break;
  }
  if(idx >= 15) break;
}

/* ---------- física ---------- */
const friction = 0.992;
const clamp = (v,min,max) => Math.max(min, Math.min(max, v));

function updatePhysics(){
  for(const b of balls){
    if(b.pocketed) continue;
    b.x += b.vx; b.y += b.vy;
    b.vx *= friction; b.vy *= friction;
    if(Math.abs(b.vx) < 0.01) b.vx = 0;
    if(Math.abs(b.vy) < 0.01) b.vy = 0;
    
    // limites do felt
    const left = table.x + b.r;
    const right = table.x + table.width - b.r;
    const top = table.y + b.r;
    const bottom = table.y + table.height - b.r;
    if(b.x < left){ b.x = left; b.vx *= -1; }
    if(b.x > right){ b.x = right; b.vx *= -1; }
    if(b.y < top){ b.y = top; b.vy *= -1; }
    if(b.y > bottom){ b.y = bottom; b.vy *= -1; }

    // pockets: usar mouthPositions
    for(const m of mouthPositions){
      const innerR = table.pocketRadius - 8;
      const d = Math.hypot(b.x - m.mouthX, b.y - m.mouthY);
      if(d < innerR){
        b.vx = 0; b.vy = 0; b.pocketed = true; b.x = -1000; b.y = -1000;
        break;
      }
    }
  }
  
function applyShotWithPower() {
  const white = balls[0];
  if (!white) return;

  // direção baseada na mira atual (mouse)
  const dx = mouse.x - white.x;
  const dy = mouse.y - white.y;
  const ang = Math.atan2(dy, dx);

  const impulse = shotPower * 0.32; // ajuste escala se quiser

  white.vx += Math.cos(ang) * impulse;
  white.vy += Math.sin(ang) * impulse;

  simulationRunning = true;
  aiming = false;

  // anima recoil do taco (visual)
  cueRecoilTarget = Math.min(40, Math.round(shotPower * 2));
  shotPower = 0;
}

function applyShotUsingRecoil(power, ang) {
  const white = balls[0];
  const impulse = power * 0.35; // ajuste de escala da força

  white.vx += Math.cos(ang) * impulse;
  white.vy += Math.sin(ang) * impulse;

  simulationRunning = true;
}

  // colisões bola-bola
  for(let i=0;i<balls.length;i++){
    for(let j=i+1;j<balls.length;j++){
      const A = balls[i], B = balls[j];
      if(A.pocketed || B.pocketed) continue;
      const dx = B.x - A.x, dy = B.y - A.y;
      const d = Math.hypot(dx,dy);
      const minD = A.r + B.r;
      if(d > 0 && d < minD){
        const overlap = (minD - d) / 2;
        const nx = dx / d, ny = dy / d;
        A.x -= nx * overlap; A.y -= ny * overlap;
        B.x += nx * overlap; B.y += ny * overlap;
        // troca de velocidade (1D along normal + conserve tangential)
        const tx = -ny, ty = nx;
        const vAn = A.vx * nx + A.vy * ny;
        const vAt = A.vx * tx + A.vy * ty;
        const vBn = B.vx * nx + B.vy * ny;
        const vBt = B.vx * tx + B.vy * ty;
        const m1 = A.mass, m2 = B.mass;
        const vAnAfter = (vAn*(m1 - m2) + 2*m2*vBn) / (m1 + m2);
        const vBnAfter = (vBn*(m2 - m1) + 2*m1*vAn) / (m1 + m2);
        A.vx = vAnAfter * nx + vAt * tx;
        A.vy = vAnAfter * ny + vAt * ty;
        B.vx = vBnAfter * nx + vBt * tx;
        B.vy = vBnAfter * ny + vBt * ty;
      }
    }
  }
}

/* ---------- check stopped ---------- */
function areBallsStopped() {
  if (!balls || balls.length === 0) return true;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    const speed = Math.hypot(b.vx || 0, b.vy || 0);
    if (speed > 0.03) return false;
  }
  return true;
}
function checkAllBallsStoppedAndReactivate() {
  if (!simulationRunning) return;

  if (areBallsStopped()) {
    simulationRunning = false;

    // ativa mira automaticamente
    aiming = true;
    isDragging = false;
    pullBack = 0;
    cueRecoil = 0;
  }
}

/* ---------- helpers ---------- */
function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function shadeHex(hex, amt){
  const c = hex.replace("#",""); const n = parseInt(c,16);
  let r = (n>>16) + amt; let g = ((n>>8)&0xff) + amt; let b = (n&0xff) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return "#" + ((1<<24) + (r<<16) + (g<<8) + b).toString(16).slice(1);
}
function lighten(hex, frac){
  const c = hex.replace("#",""); const n = parseInt(c,16);
  let r = (n>>16), g = ((n>>8)&0xff), b = (n&0xff);
  r = Math.min(255, Math.round(r + (255 - r) * frac));
  g = Math.min(255, Math.round(g + (255 - g) * frac));
  b = Math.min(255, Math.round(b + (255 - b) * frac));
  return "#" + ((1<<24) + (r<<16) + (g<<8) + b).toString(16).slice(1);
}
function isInsidePowerBar(pos) {
  const bx = powerBar.x;
  const by = powerBar.y;
  const bw = powerBar.w;
  const bh = powerBar.h;
  return pos.x >= bx && pos.x <= bx + bw && pos.y >= by && pos.y <= by + bh;
}

function updatePowerFromPos(pos) {
  const bx = powerBar.x;
  const bw = powerBar.w;
  let x = pos.x - bx;
  x = Math.max(0, Math.min(bw, x));
  shotPower = Math.round((x / bw) * 36);
}

function onPowerStart(pos) {
  if (!isInsidePowerBar(pos)) return false;
  isAdjustingPower = true;
  updatePowerFromPos(pos);
  return true;
}
function onPowerMove(pos) {
  if (!isAdjustingPower) return;
  updatePowerFromPos(pos);
}
function onPowerEnd() {
  if (!isAdjustingPower) return;
  isAdjustingPower = false;
  applyShotWithPower();
}
/* ---------- drawing: table / pockets / balls / cue ---------- */
function drawTable(){
  ctx.fillStyle = "#0c0d10";
  ctx.fillRect(0,0,W,H);

  const outerX = table.x - railOuter;
  const outerY = table.y - railOuter;
  const outerW = table.width + railOuter * 2;
  const outerH = table.height + railOuter * 2;

  ctx.fillStyle = "#070707";
  roundRect(ctx, outerX, outerY, outerW, outerH, 18);
  ctx.fill();

  const woodInset = 6;
  ctx.fillStyle = woodColor;
  roundRect(ctx, outerX + woodInset, outerY + woodInset, outerW - woodInset*2, outerH - woodInset*2, 16);
  ctx.fill();

  ctx.fillStyle = railGold;
  roundRect(ctx, outerX + woodInset + 2, outerY + woodInset + 2, outerW - (woodInset+2)*2, outerH - (woodInset+2)*2, 14);
  ctx.fill();

  ctx.fillStyle = railBlue;
  roundRect(ctx, table.x - railInner/2, table.y - railInner/2, table.width + railInner, table.height + railInner, 12);
  ctx.fill();

  const g = ctx.createRadialGradient(cx, cy, Math.max(table.width,table.height)*0.08, cx, cy, Math.max(table.width,table.height)*0.7);
  g.addColorStop(0, lighten(feltCenter, 0.06));
  g.addColorStop(0.35, feltCenter);
  g.addColorStop(1, feltEdge);
  ctx.fillStyle = g;
  roundRect(ctx, table.x, table.y, table.width, table.height, 10);
  ctx.fill();

  ctx.beginPath();
  roundRect(ctx, table.x, table.y, table.width, table.height, 10);
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.fill();
}

function drawPocketByMouth(m){
  const mouthX = m.mouthX;
  const mouthY = m.mouthY;
  const innerR = table.pocketRadius - 6;

  ctx.beginPath();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.arc(mouthX, mouthY, innerR + 14, 0, Math.PI*2);
  ctx.fill();

  const dx = m.dirX || 0;
  const dy = m.dirY || 1;
  const angle = Math.atan2(dy, dx) + Math.PI/2;

  ctx.save();
  ctx.translate(mouthX, mouthY);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.fillStyle = pocketColor;
  ctx.ellipse(0, 0, innerR, innerR*0.62, 0, Math.PI, 2*Math.PI);
  ctx.fill();
  ctx.restore();

  const lipShift = innerR * 0.26;
  const lipX = mouthX - dx * lipShift;
  const lipY = mouthY - dy * lipShift;
  ctx.save();
  ctx.translate(lipX, lipY);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.ellipse(0, 0, innerR * 0.92, innerR * 0.28, 0, 0, Math.PI*2);
  ctx.fillStyle = shadeHex(feltCenter, -8);
  ctx.fill();
  ctx.restore();

  const grad = ctx.createRadialGradient(mouthX, mouthY + innerR*0.12, innerR*0.08, mouthX, mouthY + innerR*0.12, innerR*0.95);
  grad.addColorStop(0, "rgba(40,16,16,0.95)");
  grad.addColorStop(0.5, "rgba(24,6,6,0.9)");
  grad.addColorStop(1, "rgba(0,0,0,0.85)");

  ctx.save();
  ctx.translate(mouthX, mouthY + innerR * 0.12);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.ellipse(0, 0, innerR * 0.88, innerR * 0.54, 0, 0, Math.PI*2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  const highlightShiftX = mouthX - dx * (innerR * 0.18);
  const highlightShiftY = mouthY - dy * (innerR * 0.18);
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  ctx.save();
  ctx.translate(highlightShiftX, highlightShiftY);
  ctx.rotate(angle);
  ctx.ellipse(0, 0, innerR * 0.8, innerR * 0.26, 0, 0, Math.PI*2);
  ctx.stroke();
  ctx.restore();
}

function drawPolishedBall(b){
  if(b.pocketed) return;
  ctx.beginPath(); ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.ellipse(b.x+4,b.y+6,b.r*0.95,b.r*0.5,0,0,Math.PI*2); ctx.fill();
  const isStripe = b.number >= 9;
  if(isStripe){
    ctx.beginPath(); ctx.fillStyle = "#fff"; ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(b.x,b.y,b.r-0.4,0,Math.PI*2); ctx.clip();
    ctx.beginPath(); ctx.ellipse(b.x,b.y,b.r*1.02,b.r*0.52,0,0,Math.PI*2); ctx.fillStyle = b.color; ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(0,0,0,0.34)"; ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.fillStyle = "#fff"; ctx.arc(b.x,b.y,b.r*0.48,0,Math.PI*2); ctx.fill();
    const grad = ctx.createRadialGradient(b.x - b.r*0.35, b.y - b.r*0.45, 1, b.x, b.y, b.r*1.2);
    grad.addColorStop(0,"rgba(255,255,255,0.92)"); grad.addColorStop(0.25,"rgba(255,255,255,0.18)"); grad.addColorStop(1,"rgba(255,255,255,0)");
    ctx.beginPath(); ctx.fillStyle = grad; ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = "#000"; ctx.font = `${Math.round(b.r*0.85)}px sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(b.number.toString(), b.x, b.y);
  } else {
    if(b.number === 0){
      ctx.beginPath(); ctx.fillStyle="#fff"; ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.strokeStyle="rgba(0,0,0,0.18)"; ctx.lineWidth =1; ctx.arc(b.x,b.y,b.r-1.2,0,Math.PI*2); ctx.stroke();
      const hg = ctx.createRadialGradient(b.x - b.r*0.35, b.y - b.r*0.45,1,b.x,b.y,b.r*1.2);
      hg.addColorStop(0,"rgba(255,255,255,0.95)"); hg.addColorStop(0.3,"rgba(255,255,255,0.25)"); hg.addColorStop(1,"rgba(255,255,255,0)");
      ctx.beginPath(); ctx.fillStyle = hg; ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
    } else {
      const dark = shadeHex(b.color, -36);
      const grad = ctx.createRadialGradient(b.x - b.r*0.35, b.y - b.r*0.45, 1, b.x, b.y, b.r*1.4);
      grad.addColorStop(0,"#fff"); grad.addColorStop(0.12,b.color); grad.addColorStop(1,dark);
      ctx.beginPath(); ctx.fillStyle = grad; ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.lineWidth=1; ctx.strokeStyle="rgba(0,0,0,0.34)"; ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.fillStyle="#fff"; ctx.arc(b.x,b.y,b.r*0.48,0,Math.PI*2); ctx.fill();
      const darkColors = ["#0E6FFF","#8E3AC1","#8B4A2F","#1E8A3A","#000000"];
      const numberColor = darkColors.includes(b.color) ? "#fff" : "#000";
      ctx.fillStyle = numberColor; ctx.font = `${Math.round(b.r*0.85)}px sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(b.number.toString(), b.x, b.y);
    }
  }
}

function drawCueStick() {
    if (!aiming) return;

    const white = balls && balls[0];
    if (!white || !mouse) return;

    // direção da mira
    const dx = mouse.x - white.x;
    const dy = mouse.y - white.y;
    const ang = Math.atan2(dy, dx);

    // força baseada no pullBack REAL (0–36)
    const power = Math.round(Math.min(36, pullBack / 3));

    // comprimento do taco
    const stickLen = 100 + power * 4;

    // ponta do taco encostando na bola
    const tipX = white.x - Math.cos(ang) * (white.r + 4);
    const tipY = white.y - Math.sin(ang) * (white.r + 4);

    // recuo visual (puxado + animação de recoil)
    const stickRecoil = pullBack + cueRecoil;

    // posição do cabo do taco
    const buttX = tipX - Math.cos(ang) * (stickLen + stickRecoil);
    const buttY = tipY - Math.sin(ang) * (stickLen + stickRecoil);

    // --- sombra do taco ---
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    ctx.moveTo(buttX + 2, buttY + 4);
    ctx.lineTo(tipX + 2, tipY + 4);
    ctx.stroke();

    // --- taco principal ---
    const grad = ctx.createLinearGradient(buttX, buttY, tipX, tipY);
    grad.addColorStop(0, "#8B5A2B");
    grad.addColorStop(0.6, "#5a3518");
    grad.addColorStop(1, "#322214");

    ctx.beginPath();
    ctx.strokeStyle = grad;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.moveTo(buttX, buttY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // ponta clara do taco
    const cueTipX = tipX + Math.cos(ang) * 6;
    const cueTipY = tipY + Math.sin(ang) * 6;
    ctx.beginPath();
    ctx.fillStyle = "#ccc";
    ctx.arc(cueTipX, cueTipY, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // ===========================================
// NOVA BARRA LATERAL DE FORÇA (independente)
// ===========================================

// referência da barra
const barX = powerBar.x;
const barY = powerBar.y = H / 2 - powerBar.h / 2;
const barW = powerBar.w;
const barH = powerBar.h;

// fundo externo
ctx.beginPath();
ctx.fillStyle = "rgba(0,0,0,0.35)";
roundRect(ctx, barX - 6, barY - 6, barW + 12, barH + 12, 6);
ctx.fill();

// corpo da barra
ctx.beginPath();
ctx.fillStyle = "#2b2b2b";
roundRect(ctx, barX, barY, barW, barH, 6);
ctx.fill();

// preenchimento baseado em shotPower
const fillW = Math.round((shotPower / 36) * barW);
ctx.beginPath();
ctx.fillStyle = "#ffb84d";
roundRect(ctx, barX, barY, fillW, barH, 6);
ctx.fill();

// texto da barra
ctx.fillStyle = "#fff";
ctx.font = "13px sans-serif";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillText("Força: " + shotPower, barX + barW / 2, barY + barH / 2);
}

function limitAimToBalls(white, targetX, targetY) {
  let closestX = targetX;
  let closestY = targetY;
  let minDist = Infinity;

  for (const b of balls) {
    if (b === white || b.pocketed) continue;

    // distância da bola ao segmento da linha da mira
    const A = {x: white.x, y: white.y};
    const B = {x: targetX, y: targetY};
    const C = {x: b.x, y: b.y};

    const t = ((C.x - A.x)*(B.x - A.x) + (C.y - A.y)*(B.y - A.y)) /
              ((B.x - A.x)**2 + (B.y - A.y)**2);

    if (t < 0 || t > 1) continue; // bola não está na frente da linha

    const Px = A.x + t * (B.x - A.x);
    const Py = A.y + t * (B.y - A.y);
    const dist = Math.hypot(Px - b.x, Py - b.y);

    if (dist <= b.r + 4) {
      if (t < minDist) {
        minDist = t;
        closestX = Px;
        closestY = Py;
      }
    }
  }

  return {x: closestX, y: closestY};
}
function limitAimToBorders(white, targetX, targetY) {
  const left = table.x;
  const right = table.x + table.width;
  const top = table.y;
  const bottom = table.y + table.height;

  // clampa o alvo dentro da mesa
  const clampedX = Math.max(left, Math.min(right, targetX));
  const clampedY = Math.max(top, Math.min(bottom, targetY));

  return {x: clampedX, y: clampedY};
}

function limitAimToBorders(white, targetX, targetY) {
  const left = table.x;
  const right = table.x + table.width;
  const top = table.y;
  const bottom = table.y + table.height;

  return {
    x: Math.max(left, Math.min(right, targetX)),
    y: Math.max(top, Math.min(bottom, targetY))
  };
}

function limitAimToBalls(white, targetX, targetY) {
  let closestX = targetX;
  let closestY = targetY;
  let minT = Infinity;

  for (const b of balls) {
    if (b === white || b.pocketed) continue;

    const A = { x: white.x, y: white.y };
    const B = { x: targetX, y: targetY };
    const C = { x: b.x, y: b.y };

    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const denom = dx*dx + dy*dy;
    if (denom === 0) continue;

    const t = ((C.x - A.x)*dx + (C.y - A.y)*dy) / denom;
    if (t < 0 || t > 1) continue;

    const Px = A.x + t * dx;
    const Py = A.y + t * dy;
    const dist = Math.hypot(Px - C.x, Py - C.y);

    // margem pequena (4px) para contar como bloqueio
    if (dist <= b.r + 4 && t < minT) {
      minT = t;
      closestX = Px;
      closestY = Py;
    }
  }

  return { x: closestX, y: closestY };
}

/* ---------- draw loop ---------- */
function draw(){
  ctx.clearRect(0,0,W,H);
  drawTable();
  for(const m of mouthPositions) drawPocketByMouth(m);
  drawCueStick();
  for(const b of balls) drawPolishedBall(b);

  const remaining = balls.filter(b => b.number > 0 && !b.pocketed).length;
  ctx.fillStyle = "#ffffff"; ctx.font = "14px sans-serif"; ctx.textAlign = "left"; ctx.fillText("Bolas restantes: " + remaining, 12, H - 12);

  if(aiming){
    const white = balls[0];

// Calcula mira livre → limitada por bordas e por colisões com bolas
let aimX = mouse.x;
let aimY = mouse.y;

// 1) limitar pelas bordas da mesa
const border = limitAimToBorders(white, aimX, aimY);
aimX = border.x; aimY = border.y;

// 2) limitar por colisão com outras bolas
const collision = limitAimToBalls(white, aimX, aimY);
aimX = collision.x; aimY = collision.y;

// desenhar linha de mira final
ctx.beginPath();
ctx.moveTo(white.x, white.y);
ctx.lineTo(aimX, aimY);
ctx.strokeStyle = "rgba(255,255,255,0.9)";
ctx.lineWidth = 2;
ctx.setLineDash([6,6]);
ctx.stroke();
ctx.setLineDash([]);
    const dxm = white.x - mouse.x, dym = white.y - mouse.y;
    const power = clamp(Math.hypot(dxm,dym) / 6, 0, 36);
    ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.font = "12px sans-serif"; ctx.fillText("Força: " + Math.round(power), white.x + 12, white.y - 12);
  }
}
aiming = true;
isDragging = false;
pullBack = 0;
/* ---------- main game loop ---------- */
function gameLoop() {
  updatePhysics();
  checkAllBallsStoppedAndReactivate();
  cueRecoil += (cueRecoilTarget - cueRecoil) * 0.25;
  // pequena desaceleração do target
  cueRecoilTarget *= 0.94;
  draw();
  requestAnimationFrame(gameLoop);
}
gameLoop();