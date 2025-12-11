// game.js — Versão completa corrigida
// Regras:
// - coloque este arquivo no seu projeto substituindo o antigo
// - requer um <canvas id="gameCanvas" width=...? height=...?>

// mostra erro em tela (útil mobile dev)
window.onerror = (msg, src, line, col, err) => {
  const id = "__error_overlay__";
  let div = document.getElementById(id);
  if (!div) {
    div = document.createElement("div");
    div.id = id;
    div.style.position = "fixed";
    div.style.top = "0";
    div.style.left = "0";
    div.style.zIndex = "999999";
    div.style.background = "rgba(180,0,0,0.95)";
    div.style.color = "white";
    div.style.padding = "8px";
    div.style.fontSize = "13px";
    div.style.whiteSpace = "pre-wrap";
    document.body.appendChild(div);
  }
  div.innerText = `ERRO: ${msg}\n${src}:${line}:${col}`;
};

// ---------- canvas ----------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

// ---------- mesa params ----------
const railOuter = 28;
const railInner = 12;
const pocketRadius = 26;

// ---------- cue recoil / animação / estado ----------
let cueRecoil = 0;
let cueRecoilTarget = 0;
let simulationRunning = false;

// ---------- mira / força / taco lateral ----------
let aimPoint = { x: 0, y: 0 }; // ponto da mira (usado para direção)
let power = 20;                // força atual controlada pelo taco lateral (0..36 aprox)
let draggingCue = false;       // true quando arrastando a alça do taco lateral
let cueStartY = 0;

// área do taco lateral (à direita)
const cueArea = { x: W - 120, y: 0, width: 120, height: H };

// ---------- mesa (retângulo do felt) ----------
const table = {
  x: railOuter,
  y: railOuter,
  width: W - railOuter * 2,
  height: H - railOuter * 2,
  pocketRadius
};

const cx = table.x + table.width / 2;
const cy = table.y + table.height / 2;

// --- Ajuste de resolução (corrige barra preta do taco) ---
function resizeCanvasToDPR() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  const newW = Math.round(rect.width * dpr);
  const newH = Math.round(rect.height * dpr);

  if (canvas.width !== newW || canvas.height !== newH) {
    canvas.width = newW;
    canvas.height = newH;
  }

  // atualizar variáveis globais
  window.W = canvas.width;
  window.H = canvas.height;

  // recalcular área lateral
  const SIDE_WIDTH = 120;
  const safeSide = Math.min(SIDE_WIDTH, Math.round(W * 0.28));
  cueArea.x = W - safeSide;
  cueArea.width = safeSide;

  // recalcular mesa
  table.x = railOuter;
  table.y = railOuter;
  table.width = W - railOuter * 2;
  table.height = H - railOuter * 2;

  // recalc centro
  cx = table.x + table.width / 2;
  cy = table.y + table.height / 2;
}

// chama agora e no resize
resizeCanvasToDPR();
window.addEventListener("resize", resizeCanvasToDPR);

// ---------- cores ----------
const railGold = "#E0B000";
const railBlue = "#0f4f7a";
const feltCenter = "#2f77b3";
const feltEdge = "#13354b";
const pocketColor = "#0b0f12";
const woodColor = "#caa87a";

// ---------- pockets / mouthPositions ----------
const pockets = [
  {x: table.x, y: table.y},                                   // TL
  {x: table.x + table.width/2, y: table.y - 6},               // TM
  {x: table.x + table.width, y: table.y},                     // TR
  {x: table.x, y: table.y + table.height},                    // BL
  {x: table.x + table.width/2, y: table.y + table.height + 6},// BM
  {x: table.x + table.width, y: table.y + table.height}       // BR
];

const inwardOffset = -10; // move mouths para fora do felt (na madeira)
const mouthPositions = pockets.map(p => {
  let dx = cx - p.x, dy = cy - p.y;
  let L = Math.hypot(dx,dy) || 1;
  dx /= L; dy /= L;
  const mouthX = p.x + dx * inwardOffset;
  const mouthY = p.y + dy * inwardOffset;
  return { px: p.x, py: p.y, mouthX, mouthY, dirX: dx, dirY: dy };
});

// ---------- bolas ----------
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

// ---------- física ----------
const friction = 0.992;
const clamp = (v,min,max) => Math.max(min, Math.min(max, v));

function areBallsStopped(){
  for(const b of balls){
    if (b.pocketed) continue;
    if (Math.hypot(b.vx || 0, b.vy || 0) > 0.03) return false;
  }
  return true;
}

function checkAllBallsStoppedAndReactivate(){
  if (!simulationRunning) return;
  if (areBallsStopped()){
    simulationRunning = false;
    // opcional: reset power/cue state
    cueRecoilTarget = 0;
  }
}

function updatePhysics(){
  for(const b of balls){
    if(b.pocketed) continue;
    b.x += b.vx; b.y += b.vy;
    b.vx *= friction; b.vy *= friction;
    if(Math.abs(b.vx) < 0.01) b.vx = 0;
    if(Math.abs(b.vy) < 0.01) b.vy = 0;

    const left = table.x + b.r;
    const right = table.x + table.width - b.r;
    const top = table.y + b.r;
    const bottom = table.y + table.height - b.r;
    if(b.x < left){ b.x = left; b.vx *= -1; }
    if(b.x > right){ b.x = right; b.vx *= -1; }
    if(b.y < top){ b.y = top; b.vy *= -1; }
    if(b.y > bottom){ b.y = bottom; b.vy *= -1; }

    for (const m of mouthPositions){
      const innerR = table.pocketRadius + b.r * 0.4;
      const d = Math.hypot(b.x - m.mouthX, b.y - m.mouthY);
      if (d < innerR){
        b.pocketed = true;
        b.vx = 0; b.vy = 0;
        b.x = -100; b.y = -100;
        break;
      }
    }
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

// ---------- APLICAR TACADA (novo sistema) ----------
function applyShotUsingPower(forceValue){
  // bloqueia tacadas enquanto a simulação está ativa
  if (simulationRunning) return;

  const white = balls[0];
  if(!white) return;

  // proteção: aimPoint válido
  if (!aimPoint || typeof aimPoint.x !== "number") return;

  const dx = aimPoint.x - white.x;
  const dy = aimPoint.y - white.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return;

  const ang = Math.atan2(dy, dx);

  const impulse = (forceValue || power) * 0.32;

  white.vx += Math.cos(ang) * impulse;
  white.vy += Math.sin(ang) * impulse;

  simulationRunning = true;
  cueRecoilTarget = Math.min(40, Math.round((forceValue || power) * 2.2));

  // debug
  // console.log("SHOT:", {aimPoint, white:{x:white.x,y:white.y}, dx,dy, angDeg:(ang*180/Math.PI).toFixed(1), impulse});
}

// ---------- helpers desenho ----------
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shadeHex(hex, amt){
  const c = hex.replace("#","");
  const n = parseInt(c,16);
  let r = (n>>16) + amt;
  let g = ((n>>8)&0xff) + amt;
  let b = (n&0xff) + amt;
  r = Math.max(0,Math.min(255,r));
  g = Math.max(0,Math.min(255,g));
  b = Math.max(0,Math.min(255,b));
  return "#" + ((1<<24) + (r<<16) + (g<<8) + b).toString(16).slice(1);
}
function lighten(hex, frac){
  const c = hex.replace("#","");
  const n = parseInt(c,16);
  let r = (n>>16), g = ((n>>8)&0xff), b = (n&0xff);
  r = Math.min(255, Math.round(r + (255 - r) * frac));
  g = Math.min(255, Math.round(g + (255 - g) * frac));
  b = Math.min(255, Math.round(b + (255 - b) * frac));
  return "#" + ((1<<24) + (r<<16) + (g<<8) + b).toString(16).slice(1);
}

// ---------- desenho: table / pockets / balls / cue ----------
function drawTable(){
  ctx.fillStyle = "#0c0d10";
  ctx.fillRect(0,0,W,H);

  const outerX = table.x - railOuter;
  const outerY = table.y - railOuter;
  const outerW = table.width + railOuter * 2;
  const outerH = table.height + railOuter * 2;

  ctx.fillStyle = "#070707";
  roundRect(ctx, outerX, outerY, outerW, outerH, 18); ctx.fill();

  const woodInset = 6;
  ctx.fillStyle = woodColor;
  roundRect(ctx, outerX + woodInset, outerY + woodInset, outerW - woodInset*2, outerH - woodInset*2, 16); ctx.fill();

  ctx.fillStyle = railGold;
  roundRect(ctx, outerX + woodInset + 2, outerY + woodInset + 2, outerW - (woodInset+2)*2, outerH - (woodInset+2)*2, 14); ctx.fill();

  ctx.fillStyle = railBlue;
  roundRect(ctx, table.x - railInner/2, table.y - railInner/2, table.width + railInner, table.height + railInner, 12); ctx.fill();

  const g = ctx.createRadialGradient(cx, cy, Math.max(table.width,table.height)*0.08, cx, cy, Math.max(table.width,table.height)*0.7);
  g.addColorStop(0, lighten(feltCenter, 0.06));
  g.addColorStop(0.35, feltCenter);
  g.addColorStop(1, feltEdge);
  ctx.fillStyle = g;
  roundRect(ctx, table.x, table.y, table.width, table.height, 10); ctx.fill();

  ctx.beginPath();
  roundRect(ctx, table.x, table.y, table.width, table.height, 10);
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.fill();
}

function drawPocketByMouth(m){
  const mouthX = m.mouthX, mouthY = m.mouthY;
  const innerR = table.pocketRadius - 6;
  ctx.beginPath(); ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.arc(mouthX, mouthY, innerR + 14, 0, Math.PI*2); ctx.fill();

  const dx = m.dirX || 0, dy = m.dirY || 1;
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
  ctx.fillStyle = grad; ctx.fill();
  ctx.restore();

  const highlightShiftX = mouthX - dx * (innerR * 0.18);
  const highlightShiftY = mouthY - dy * (innerR * 0.18);
  ctx.save();
  ctx.translate(highlightShiftX, highlightShiftY);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
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

// draw cue behind the white ball using aimPoint (so direction is consistent)
function drawCueStick(){
  const white = balls && balls[0];
  if (!white) return;

  // if aimPoint is not set, draw default horizontal behind ball
  const dx = (aimPoint && typeof aimPoint.x === "number") ? aimPoint.x - white.x : 1;
  const dy = (aimPoint && typeof aimPoint.y === "number") ? aimPoint.y - white.y : 0;
  const ang = Math.atan2(dy, dx);

  const dist = Math.hypot(dx,dy);
  const rawPower = clamp(dist / 6, 0, 36);
  const pwr = Math.round(rawPower) || power;

  const stickLen = clamp(100 + pwr * 4, 80, 380);
  const tipX = white.x - Math.cos(ang) * (white.r + 6);
  const tipY = white.y - Math.sin(ang) * (white.r + 6);
  const buttX = tipX - Math.cos(ang) * (stickLen + cueRecoil);
  const buttY = tipY - Math.sin(ang) * (stickLen + cueRecoil);

  // shadow
  ctx.beginPath(); ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 11; ctx.lineCap = "round";
  ctx.moveTo(buttX + 2, buttY + 4); ctx.lineTo(tipX + 2, tipY + 4); ctx.stroke();

  // wood body
  const g = ctx.createLinearGradient(buttX, buttY, tipX, tipY);
  g.addColorStop(0, "#8B5A2B"); g.addColorStop(0.6, "#5a3518"); g.addColorStop(1, "#222");
  ctx.beginPath(); ctx.strokeStyle = g; ctx.lineWidth = 8; ctx.lineCap = "round";
  ctx.moveTo(buttX, buttY); ctx.lineTo(tipX, tipY); ctx.stroke();

  // small tip
  const cueTipX = tipX + Math.cos(ang) * 6;
  const cueTipY = tipY + Math.sin(ang) * 6;
  ctx.beginPath(); ctx.fillStyle = "#ccc"; ctx.arc(cueTipX, cueTipY, 3.2, 0, Math.PI*2); ctx.fill();

  // power HUD near white ball
  const barW = 90, barH = 8;
  let bx = white.x + 28, by = white.y - 36;
  if (bx + barW > W - 12) bx = W - barW - 16;
  if (by < 12) by = white.y + 24;
  ctx.beginPath();
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, bx - 6, by - 6, barW + 12, barH + 12, 6); ctx.fill();
  ctx.beginPath();
  roundRect(ctx, bx, by, barW, barH, 4);
  ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fill();
  const fillW = Math.round((pwr / 36) * barW);
  const barGrad = ctx.createLinearGradient(bx, by, bx + barW, by);
  barGrad.addColorStop(0, "#ffef6b"); barGrad.addColorStop(0.5, "#ffb84d"); barGrad.addColorStop(1, "#ff6b4b");
  ctx.beginPath(); roundRect(ctx, bx, by, fillW, barH, 4); ctx.fillStyle = barGrad; ctx.fill();
  ctx.fillStyle = "#000"; ctx.font = "11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(pwr.toString(), bx + barW / 2, by + barH / 2);
}

// draw right-side cue UI (slot + draggable handle controlling 'power')
function drawSideCue(){
  // background area
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(cueArea.x, cueArea.y, cueArea.width, cueArea.height);

  // draw a vertical slot (centered)
  const slotX = cueArea.x + cueArea.width/2;
  const slotTop = 24, slotBottom = cueArea.height - 24;
  const slotW = 8;
  ctx.beginPath();
  ctx.fillStyle = "#111";
  roundRect(ctx, slotX - slotW/2 - 12, slotTop - 6, 24, slotBottom - slotTop + 12, 12);
  ctx.fill();

  // map power (0..36) to Y position inside slot
  const minY = slotTop + 8;
  const maxY = slotBottom - 8;
  const norm = clamp((power) / 36, 0, 1);
  const handleY = maxY - (maxY - minY) * norm;

  // draw handle
  ctx.beginPath();
  ctx.fillStyle = "#bfa57a";
  roundRect(ctx, slotX - 28, handleY - 10, 56, 20, 8);
  ctx.fill();

  // draw text with numeric power
  ctx.fillStyle = "#000"; ctx.font = "11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(Math.round(power).toString(), slotX, handleY);

  // small label
  ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.font = "12px sans-serif";
  ctx.fillText("Força", slotX, 12);
}

// ---------- input helpers ----------
function getCanvasPos(e){
  const rect = canvas.getBoundingClientRect();
  const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : (e.clientX !== undefined ? e.clientX : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0));
  const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : (e.clientY !== undefined ? e.clientY : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : 0));
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height)
  };
}

// ---- mouse / touch events ----

// mouse down: decide se está pegando o handle lateral ou movendo a mira
canvas.addEventListener("mousedown", (e) => {
  const p = getCanvasPos(e);
  // check if clicked inside cueArea handle
  if (p.x >= cueArea.x && p.x <= cueArea.x + cueArea.width){
    // clicked in side area: start dragging cue handle
    draggingCue = true;
    cueStartY = p.y;
    // update power from y
    updatePowerFromY(p.y);
    return;
  }
  // otherwise update aimPoint (for mira)
  aimPoint = p;
});

// mouse move
canvas.addEventListener("mousemove", (e) => {
  const p = getCanvasPos(e);
  if (draggingCue){
    updatePowerFromY(p.y);
  } else {
    // update aimPoint only if not dragging cue
    aimPoint = p;
  }
});

// mouse up
canvas.addEventListener("mouseup", (e) => {
  const p = getCanvasPos(e);
  if (draggingCue){
    draggingCue = false;
    updatePowerFromY(p.y);
    return;
  }
  // if not dragging, apply shot using current power
  aimPoint = p;
  applyShotUsingPower(power);
});

// mouse leave -> cancel dragging
canvas.addEventListener("mouseleave", () => {
  draggingCue = false;
});

// touch handlers (map toque para os mesmos comportamentos)
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const p = getCanvasPos(e);
  if (p.x >= cueArea.x && p.x <= cueArea.x + cueArea.width){
    draggingCue = true;
    cueStartY = p.y;
    updatePowerFromY(p.y);
    return;
  }
  aimPoint = p;
}, {passive:false});

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const p = getCanvasPos(e);
  if (draggingCue){
    updatePowerFromY(p.y);
  } else {
    aimPoint = p;
  }
}, {passive:false});

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  if (draggingCue){
    draggingCue = false;
    return;
  }
  // apply shot
  // try to get last touch position, or keep aimPoint
  const changed = e.changedTouches && e.changedTouches[0];
  if (changed){
    aimPoint = getCanvasPos(e);
  }
  applyShotUsingPower(power);
}, {passive:false});

// atualiza power (0..36) a partir da coordenada Y no slot
function updatePowerFromY(y){
  const slotTop = 24, slotBottom = cueArea.height - 24;
  const minY = slotTop + 8;
  const maxY = slotBottom - 8;
  const clamped = Math.max(minY, Math.min(maxY, y));
  const norm = (maxY - clamped) / (maxY - minY); // 0..1
  power = clamp(Math.round(norm * 36), 0, 36);
}

// ---------- render loop ----------
function draw(){
  ctx.clearRect(0,0,W,H);

  drawTable();

  for(const m of mouthPositions) drawPocketByMouth(m);

  // side cue UI (draw first so it doesn't overlap HUD)
  drawSideCue();

  // cue behind ball
  drawCueStick();

  // balls
  for(const b of balls) drawPolishedBall(b);

  // HUD: bolas restantes e instruções
  const remaining = balls.filter(b => b.number > 0 && !b.pocketed).length;
  ctx.fillStyle = "#ffffff"; ctx.font = "14px sans-serif"; ctx.textAlign = "left";
  ctx.fillText("Bolas restantes: " + remaining, 12, H - 12);

  // mira linha pontilhada quando não simulationRunning
  if (!simulationRunning && aimPoint){
    const white = balls[0];
    ctx.beginPath(); ctx.moveTo(white.x, white.y); ctx.lineTo(aimPoint.x, aimPoint.y);
    ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2; ctx.setLineDash([6,6]); ctx.stroke(); ctx.setLineDash([]);
    const dxm = aimPoint.x - white.x, dym = aimPoint.y - white.y;
    const pwr = clamp(Math.hypot(dxm,dym) / 6, 0, 36);
    ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.font = "12px sans-serif";
    ctx.fillText("Força: " + Math.round(power) + " (arraste à direita)", white.x + 12, white.y - 12);
  }
}

// loop principal
function loop(){
  updatePhysics();
  checkAllBallsStoppedAndReactivate();
  cueRecoil += (cueRecoilTarget - cueRecoil) * 0.25;
  draw();
  requestAnimationFrame(loop);
}
loop();