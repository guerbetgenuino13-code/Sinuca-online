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

// ---------- cue recoil / animação globals ----------
let cueRecoil = 0;        // animação do recuo atual
let cueRecoilTarget = 0;  // alvo de recuo quando o jogador tacar
let simulationRunning = false; // controla se a simulação de física está ativa
const table = {
  x: railOuter,
  y: railOuter,
  width: W - railOuter * 2,
  height: H - railOuter * 2,
  pocketRadius
};

const cx = table.x + table.width / 2;
const cy = table.y + table.height / 2;

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

/* ---------- mouthPositions FIXAS (fora do feltro) ----------
   Posicionamos as bocas fora do felt (na madeira) com offsets relativos ao pocketRadius.
   Depois calculamos dirX/dirY = normalize(center - mouth) para garantir orientação para dentro.
*/
const PR = pocketRadius;
// --- Ajuste fino: mouthPositions com cantos deslocados nas diagonais corretas ---
const cornerOffset = 14; // ajusta quanto as bocas dos cantos saem para a diagonal (aumente se quiser mais "pra fora")
const midOffset = 14;    // offset para as bocas do meio (mantive parecido com versão anterior)

// === Ajuste rápido: mouths fora do pano (offset negativo para empurrar para a madeira) ===
const inwardOffset = -10; // negativo => empurra PARA FORA (na madeira). Ajuste: -4, -8, -12.

const mouthPositions = pockets.map(p => {
  // direção do pocket para o centro (unit vector)
  let dx = (cx) - p.x;
  let dy = (cy) - p.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;

  // mouth fica OUTWARD quando inwardOffset é negativo
  const mouthX = p.x + dx * inwardOffset;
  const mouthY = p.y + dy * inwardOffset;

  // dirX/dirY apontam para o centro (usadas para rotacionar a boca)
  let dirX = (cx) - mouthX;
  let dirY = (cy) - mouthY;
  const L = Math.hypot(dirX, dirY) || 1;
  dirX /= L; dirY /= L;

  return {
    px: p.x,
    py: p.y,
    mouthX,
    mouthY,
    dirX,
    dirY
  };
});

// recalcula dirX/dirY para garantir que todas apontem para o centro
for (let m of mouthPositions) {
  let dx = (table.x + table.width/2) - m.mouthX;
  let dy = (table.y + table.height/2) - m.mouthY;
  const L = Math.hypot(dx, dy) || 1;
  m.dirX = dx / L;
  m.dirY = dy / L;
}

// adiciona px/py (referência de madeira) e dirX/dirY calculado
for (let i = 0; i < mouthPositions.length; i++) {
  const m = mouthPositions[i];
  m.px = pockets[i].x;
  m.py = pockets[i].y;
  let dx = cx - m.mouthX;
  let dy = cy - m.mouthY;
  const len = Math.hypot(dx, dy) || 1;
  m.dirX = dx / len;
  m.dirY = dy / len;
}

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
let aiming = false;
let mouse = {x:0,y:0};

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

    // pockets: usar mouthPositions (alinha visual + físico)
    for (const m of mouthPositions) {
      const innerR = table.pocketRadius + b.r * 0.4;
      const d = Math.hypot(b.x - m.mouthX, b.y - m.mouthY);
      if (d < innerR) {
        b.pocketed = true;
        b.vx = 0;
        b.vy = 0;
        b.x = -100;
        b.y = -100;
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
        // troca de velocidade
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
// =======================================================
// BLOCO 3 — VERIFICA SE BOLAS PARARAM + REATIVA A MIRA
// =======================================================
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
    aiming = true;
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

/* ---------- drawing: table ---------- */
function drawTable(){
  ctx.fillStyle = "#0c0d10";
  ctx.fillRect(0,0,W,H);

  const outerX = table.x - railOuter;
  const outerY = table.y - railOuter;
  const outerW = table.width + railOuter * 2;
  const outerH = table.height + railOuter * 2;

  // contorno madeira escura
  ctx.fillStyle = "#070707";
  roundRect(ctx, outerX, outerY, outerW, outerH, 18);
  ctx.fill();

  // madeira simplificada
  const woodInset = 6;
  ctx.fillStyle = woodColor;
  roundRect(ctx, outerX + woodInset, outerY + woodInset, outerW - woodInset*2, outerH - woodInset*2, 16);
  ctx.fill();

  // filete dourado
  ctx.fillStyle = railGold;
  roundRect(ctx, outerX + woodInset + 2, outerY + woodInset + 2, outerW - (woodInset+2)*2, outerH - (woodInset+2)*2, 14);
  ctx.fill();

  // faixa azul interna
  ctx.fillStyle = railBlue;
  roundRect(ctx, table.x - railInner/2, table.y - railInner/2, table.width + railInner, table.height + railInner, 12);
  ctx.fill();

  // felt radial
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

/* ---------- draw pocket (usa mouthPositions somente) ---------- */
function drawPocketByMouth(m){
  const mouthX = m.mouthX;
  const mouthY = m.mouthY;
  const innerR = table.pocketRadius - 6;

  // sombra no fundo (na madeira)
  ctx.beginPath();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.arc(mouthX, mouthY, innerR + 14, 0, Math.PI*2);
  ctx.fill();

  // calcular ângulo a partir da direção (aponta para o centro)
  const dxm = p.x - white.x;
const dym = p.y - white.y;
const angle = Math.atan2(dym, dxm);

  // 1) cavidade meia-lua (rotacionada)
  ctx.save();
  ctx.translate(mouthX, mouthY);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.fillStyle = pocketColor;
  ctx.ellipse(0, 0, innerR, innerR*0.62, 0, Math.PI, 2*Math.PI);
  ctx.fill();
  ctx.restore();

  // 2) recorte/lábio do felt (posicionado relativo à direção: fica "sobre" a madeira, apontando para dentro)
  const lipShift = innerR * 0.26;
  const lipX = mouthX - dx * lipShift;
  const lipY = mouthY - dy * lipShift;
  ctx.beginPath();
  ctx.save();
  ctx.translate(lipX, lipY);
  ctx.rotate(angle);
  ctx.ellipse(0, 0, innerR * 0.92, innerR * 0.28, 0, 0, Math.PI*2);
  ctx.fillStyle = shadeHex(feltCenter, -8);
  ctx.fill();
  ctx.restore();

  // 3) profundidade interna (degradê rotacionado também)
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

  // 4) pequeno destaque na borda superior do lábio
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

/* ---------- draw polished ball ---------- */
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
/* ---------- draw cue stick + power indicator ---------- */
function drawCueStick(){
  if(!aiming) return;
  const white = balls && balls[0];
  if(!white) return;

  // direção e distância entre bola e mouse/touch
  const dx = (mouse && typeof mouse.x === "number") ? mouse.x - white.x : 1;
  const dy = (mouse && typeof mouse.y === "number") ? mouse.y - white.y : 0;
  const ang = Math.atan2(dy, dx);

  // força atual (mesma lógica do cálculo de impulso)
  const dist = Math.hypot(dx, dy);
  const rawPower = clamp(dist / 6, 0, 36);
  const power = Math.round(rawPower);

  // stick length and position (ajustáveis)
  const stickLen = 100 + power * 4;
  const stickBack = Math.max(8, 16 + Math.min(power, 40) * 0.4 - cueRecoil);

  const tipX = white.x - Math.cos(ang) * (white.r + 6);
  const tipY = white.y - Math.sin(ang) * (white.r + 6);

  const buttX = tipX - Math.cos(ang) * (stickLen + cueRecoil);
  const buttY = tipY - Math.sin(ang) * (stickLen + cueRecoil);

  // sombra do stick
  ctx.beginPath();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 11;
  ctx.lineCap = "round";
  ctx.moveTo(buttX + 2, buttY + 4);
  ctx.lineTo(tipX + 2, tipY + 4);
  ctx.stroke();

  // corpo do stick - gradiente madeira -> ponta escura
  const g = ctx.createLinearGradient(buttX, buttY, tipX, tipY);
  g.addColorStop(0, "#8B5A2B");
  g.addColorStop(0.6, "#5a3518");
  g.addColorStop(1, "#222");
  ctx.beginPath();
  ctx.strokeStyle = g;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.moveTo(buttX, buttY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  // brilho
  const wrapX = buttX + (tipX - buttX) * 0.12;
  const wrapY = buttY + (tipY - buttY) * 0.12;
  ctx.beginPath();
  ctx.strokeStyle = "rgba(200,200,200,0.18)";
  ctx.lineWidth = 6;
  ctx.moveTo(wrapX, wrapY);
  ctx.lineTo(wrapX + Math.cos(ang + Math.PI/2) * 3, wrapY + Math.sin(ang + Math.PI/2) * 3);
  ctx.stroke();

  // ponta do stick (detalhe)
  const cueTipX = tipX + Math.cos(ang) * 6;
  const cueTipY = tipY + Math.sin(ang) * 6;
  ctx.beginPath();
  ctx.fillStyle = "#ccc";
  ctx.arc(cueTipX, cueTipY, 3.2, 0, Math.PI*2);
  ctx.fill();

  // indicador de força
  const barW = 90, barH = 8;
  let bx = white.x + 28;
  let by = white.y - 36;
  if(bx + barW > W - 12) bx = W - barW - 16;
  if(by < 12) by = white.y + 24;

  ctx.beginPath();
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, bx - 6, by - 6, barW + 12, barH + 12, 6);
  ctx.fill();

  ctx.beginPath();
  roundRect(ctx, bx, by, barW, barH, 4);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();

  const fillW = Math.round((power / 36) * barW);
  const barGrad = ctx.createLinearGradient(bx, by, bx + barW, by);
  barGrad.addColorStop(0, "#ffef6b");
  barGrad.addColorStop(0.5, "#ffb84d");
  barGrad.addColorStop(1, "#ff6b4b");
  ctx.beginPath();
  roundRect(ctx, bx, by, fillW, barH, 4);
  ctx.fillStyle = barGrad;
  ctx.fill();

  ctx.fillStyle = "#000";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(power.toString(), bx + barW / 2, by + barH / 2);
}

// ============================================
// BLOCO 2 — FUNÇÃO DE APLICAR A TACADA
// ============================================
function applyShot() {
  const white = balls && balls[0];
  if (!white || !mouse) return 0;

  const dx = mouse.x - white.x;
  const dy = mouse.y - white.y;
  const ang = Math.atan2(dy, dx);

  const dist = Math.hypot(dx, dy);
  const rawPower = clamp(dist / 6, 0, 36);
  const power = Math.round(rawPower);

  // fator de conversão power -> impulso (ajuste conforme sua física)
  const impulse = power * 0.32;

  white.vx += Math.cos(ang) * impulse;
  white.vy += Math.sin(ang) * impulse;

  // dispara recoil visual proporcional à força
  cueRecoilTarget = Math.min(40, Math.round(power * 3));

  simulationRunning = true;

  return power;
}
// ---------- taco (cue stick) ----------

/* ---------- draw loop ---------- */
function draw(){
  ctx.clearRect(0,0,W,H);
  drawTable();
  // desenhar pockets usando mouthPositions (tudo baseado no mouth)
  for(const m of mouthPositions){
    drawPocketByMouth(m);
  }
  drawCueStick();
  // bolas
  for(const b of balls) drawPolishedBall(b);
  // HUD
  const remaining = balls.filter(b => b.number > 0 && !b.pocketed).length;
  ctx.fillStyle = "#ffffff"; ctx.font = "14px sans-serif"; ctx.textAlign = "left"; ctx.fillText("Bolas restantes: " + remaining, 12, H - 12);

  // mira (linha pontilhada e texto)
  if(aiming){
    const white = balls[0];
    ctx.beginPath(); ctx.moveTo(white.x, white.y); ctx.lineTo(mouse.x, mouse.y);
    ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2; ctx.setLineDash([6,6]); ctx.stroke(); ctx.setLineDash([]);
 const dxm = mouse.x - white.x;
const dym = mouse.y - white.y;
const power = clamp(Math.hypot(dxm, dym) / 6, 0, 36);
    ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.font = "12px sans-serif"; ctx.fillText("Força: " + Math.round(power), white.x + 12, white.y - 12);
  }
}

/* ---------- input ---------- */
function getCanvasPos(e){
  const rect = canvas.getBoundingClientRect();
  let clientX, clientY;
  if(e.touches && e.touches[0]) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
  else { clientX = e.clientX; clientY = e.clientY; }
  // ajusta escala caso canvas CSS size difira do width/height
  return {x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height)};
}

// mouse/touch handlers (unificados, simples)
canvas.addEventListener("mousedown", (e) => {
  const p = getCanvasPos(e);
  const white = balls[0];
  const d = Math.hypot(p.x - white.x, p.y - white.y);
  if(d <= white.r + 36) aiming = true;
  mouse = p;
});
canvas.addEventListener("mousemove", (e) => { mouse = getCanvasPos(e); });
canvas.addEventListener("mouseup", (e) => {
  if(!aiming) return;
  const p = getCanvasPos(e); mouse = p;
  // aplica tacada usando applyShot (que calcula power + recoil)
  applyShot();
  aiming = false;
});
canvas.addEventListener("mouseleave", () => { aiming = false; });
canvas.addEventListener("touchstart", (e)=>{ e.preventDefault(); const m = {clientX:e.touches[0].clientX, clientY:e.touches[0].clientY}; canvas.dispatchEvent(new MouseEvent('mousedown', m)); }, {passive:false});
canvas.addEventListener("touchmove", (e)=>{ e.preventDefault(); mouse = getCanvasPos(e); }, {passive:false});
canvas.addEventListener("touchend", (e)=>{ e.preventDefault(); canvas.dispatchEvent(new MouseEvent('mouseup')); }, {passive:false});

/* ---------- loop ---------- */
function loop(){
  updatePhysics();
  checkAllBallsStoppedAndReactivate(); // verifica se as bolas pararam e reabilita mira
  cueRecoil += (cueRecoilTarget - cueRecoil) * 0.25;
  draw();
  requestAnimationFrame(loop);
}
loop();