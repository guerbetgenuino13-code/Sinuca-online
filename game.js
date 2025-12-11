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

const mouthPositions = [
  // Top-left  -> desloca para cima+esquerda (fora do felt)
  {
    px: pockets[0].x,
    py: pockets[0].y,
    mouthX: pockets[0].x - cornerOffset,
    mouthY: pockets[0].y - cornerOffset
  },

  // Top-middle -> centralizado acima
  {
    px: pockets[1].x,
    py: pockets[1].y,
    mouthX: pockets[1].x,
    mouthY: pockets[1].y - midOffset
  },

  // Top-right -> desloca para cima+direita
  {
    px: pockets[2].x,
    py: pockets[2].y,
    mouthX: pockets[2].x + cornerOffset,
    mouthY: pockets[2].y - cornerOffset
  },

  // Bottom-left -> desloca para baixo+esquerda
  {
    px: pockets[3].x,
    py: pockets[3].y,
    mouthX: pockets[3].x - cornerOffset,
    mouthY: pockets[3].y + cornerOffset
  },

  // Bottom-middle -> centralizado abaixo
  {
    px: pockets[4].x,
    py: pockets[4].y,
    mouthX: pockets[4].x,
    mouthY: pockets[4].y + midOffset
  },

  // Bottom-right -> desloca para baixo+direita
  {
    px: pockets[5].x,
    py: pockets[5].y,
    mouthX: pockets[5].x + cornerOffset,
    mouthY: pockets[5].y + cornerOffset
  }
];

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
  // px/py = posição "base" da pocket (na madeira, mais perto do felt). usamos pockets[] como base
  m.px = pockets[i].x;
  m.py = pockets[i].y;
  // direção para o centro (garante apontar pra dentro)
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
    for(const m of mouthPositions){
      const innerR = table.pocketRadius - 8;
      const d = Math.hypot(b.x - m.mouthX, b.y - m.mouthY);
      if(d < innerR){
        b.vx = 0; b.vy = 0; b.pocketed = true; b.x = -1000; b.y = -1000;
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

  // sombra na madeira (embaixo)
  ctx.beginPath();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.arc(mouthX, mouthY, innerR + 14, 0, Math.PI*2);
  ctx.fill();

  // cavidade meia-lua (embutida)
  ctx.beginPath();
  ctx.fillStyle = pocketColor;
  ctx.ellipse(mouthX, mouthY, innerR, innerR*0.62, 0, Math.PI, 2*Math.PI);
  ctx.fill();

  // recorte do felt (lábio superior apontando para baixo)
  ctx.beginPath();
  const lipW = innerR * 0.92;
  const lipH = innerR * 0.28;
  ctx.ellipse(mouthX, mouthY - innerR*0.28, lipW, lipH, 0, 0, Math.PI*2);
  ctx.fillStyle = shadeHex(feltCenter, -8);
  ctx.fill();

  // profundidade interna (degradê)
  const g = ctx.createRadialGradient(mouthX, mouthY + innerR*0.12, innerR*0.1, mouthX, mouthY + innerR*0.12, innerR*0.95);
  g.addColorStop(0, "rgba(40,16,16,0.95)");
  g.addColorStop(0.5, "rgba(24,6,6,0.9)");
  g.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.beginPath();
  ctx.ellipse(mouthX, mouthY + innerR*0.12, innerR*0.88, innerR*0.54, 0, 0, Math.PI*2);
  ctx.fillStyle = g;
  ctx.fill();

  // destaque leve
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  ctx.ellipse(mouthX, mouthY - innerR*0.18, innerR*0.8, innerR*0.26, 0, 0, Math.PI*2);
  ctx.stroke();
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

/* ---------- draw loop ---------- */
function draw(){
  ctx.clearRect(0,0,W,H);
  drawTable();
  // desenhar pockets usando mouthPositions (tudo baseado no mouth)
  for(const m of mouthPositions){
    drawPocketByMouth(m);
  }
  // bolas
  for(const b of balls) drawPolishedBall(b);
  // HUD
  const remaining = balls.filter(b => b.number > 0 && !b.pocketed).length;
  ctx.fillStyle = "#ffffff"; ctx.font = "14px sans-serif"; ctx.textAlign = "left"; ctx.fillText("Bolas restantes: " + remaining, 12, H - 12);
  // mira
  if(aiming){
    const white = balls[0];
    ctx.beginPath(); ctx.moveTo(white.x, white.y); ctx.lineTo(mouse.x, mouse.y);
    ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2; ctx.setLineDash([6,6]); ctx.stroke(); ctx.setLineDash([]);
    const dxm = white.x - mouse.x, dym = white.y - mouse.y;
    const power = clamp(Math.hypot(dxm,dym) / 6, 0, 36);
    ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.font = "12px sans-serif"; ctx.fillText("Força: " + Math.round(power), white.x + 12, white.y - 12);
  }
}

/* ---------- input ---------- */
function getCanvasPos(e){
  const rect = canvas.getBoundingClientRect();
  let clientX, clientY;
  if(e.touches && e.touches[0]) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
  else { clientX = e.clientX; clientY = e.clientY; }
  return {x: clientX - rect.left, y: clientY - rect.top};
}
canvas.addEventListener("mousedown", (e) => {
  const p = getCanvasPos(e);
  const white = balls[0]; const d = Math.hypot(p.x - white.x, p.y - white.y);
  if(d <= white.r + 36) aiming = true; mouse = p;
});
canvas.addEventListener("mousemove", (e) => { mouse = getCanvasPos(e); });
canvas.addEventListener("mouseup", (e) => {
  if(!aiming) return;
  const p = getCanvasPos(e); const white = balls[0];
  const dxm = white.x - p.x, dym = white.y - p.y;
  const distVec = Math.hypot(dxm,dym);
  const force = clamp(distVec / 6, 0, 36);
  const angle = Math.atan2(dym, dxm);
  const impulse = force * 0.95;
  white.vx += Math.cos(angle) * impulse; white.vy += Math.sin(angle) * impulse;
  aiming = false;
});
canvas.addEventListener("mouseleave", () => { aiming = false; });
canvas.addEventListener("touchstart", (e)=>{ e.preventDefault(); canvas.dispatchEvent(new MouseEvent('mousedown', {clientX: e.touches[0].clientX, clientY: e.touches[0].clientY})); }, {passive:false});
canvas.addEventListener("touchmove", (e)=>{ e.preventDefault(); mouse = getCanvasPos(e); }, {passive:false});
canvas.addEventListener("touchend", (e)=>{ e.preventDefault(); canvas.dispatchEvent(new MouseEvent('mouseup')); }, {passive:false});

/* ---------- loop ---------- */
function loop(){ updatePhysics(); draw(); requestAnimationFrame(loop); }
loop();