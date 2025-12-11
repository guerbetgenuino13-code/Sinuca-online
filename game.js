/* game.js — CORREÇÃO FINAL das caçapas:
   - mouthPositions definidas manualmente (fixas) para evitar inversões;
   - mouths posicionadas na madeira (fora do feltro);
   - desenho da boca em meia-lua embutida;
   - física alinhada com mouthPositions.
*/

console.log("game.js (corrigido: pockets embutidas com orientação fixa) carregado");

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

/* cores */
const railGold = "#E0B000";
const railBlue = "#0f4f7a";
const feltCenter = "#2f77b3";
const feltEdge = "#13354b";
const pocketColor = "#0b0f12";
const woodColor = "#caa87a";

/* pockets originais (centros perto da borda do felt) */
const pockets = [
  {x: table.x, y: table.y},                                   // top-left
  {x: table.x + table.width/2, y: table.y - 6},               // top-middle (um pouco acima)
  {x: table.x + table.width, y: table.y},                     // top-right
  {x: table.x, y: table.y + table.height},                    // bottom-left
  {x: table.x + table.width/2, y: table.y + table.height + 6},// bottom-middle
  {x: table.x + table.width, y: table.y + table.height}       // bottom-right
];

/* ---------- mouthPositions FIXAS (ordem: TL, TM, TR, BL, BM, BR) ----------
   Usei offsets manuais para garantir que a "boca" fique **na madeira** (fora do felt),
   e orientada para dentro da mesa (dirX/dirY apontando para o centro).
   Se quiser ajustar largura/offset, mude os valores de mouthX/mouthY abaixo.
*/
const mouthPositions = [
  // Top-left (colocada para a direita e levemente para cima da borda -> na madeira)
  {
    px: pockets[0].x, py: pockets[0].y,
    mouthX: pockets[0].x + 12, mouthY: pockets[0].y - 12,
    dirX:  1, dirY:  1
  },
  // Top-middle (boca deslocada PARA CIMA, na madeira; dir aponta para baixo)
  {
    px: pockets[1].x, py: pockets[1].y,
    mouthX: pockets[1].x, mouthY: pockets[1].y - 14,
    dirX:  0, dirY:  1
  },
  // Top-right
  {
    px: pockets[2].x, py: pockets[2].y,
    mouthX: pockets[2].x - 12, mouthY: pockets[2].y - 12,
    dirX: -1, dirY:  1
  },
  // Bottom-left
  {
    px: pockets[3].x, py: pockets[3].y,
    mouthX: pockets[3].x + 12, mouthY: pockets[3].y + 12,
    dirX:  1, dirY: -1
  },
  // Bottom-middle (boca deslocada PARA BAIXO, na madeira; dir aponta para cima)
  {
    px: pockets[4].x, py: pockets[4].y,
    mouthX: pockets[4].x, mouthY: pockets[4].y + 14,
    dirX:  0, dirY: -1
  },
  // Bottom-right
  {
    px: pockets[5].x, py: pockets[5].y,
    mouthX: pockets[5].x - 12, mouthY: pockets[5].y + 12,
    dirX: -1, dirY: -1
  }
];


/* ---------- bolas ---------- */
function createBall(x,y,radius=11,color="#fff",id=0,number=null){
  return {x,y,vx:0,vy:0,r:radius,color,id,mass:radius,number,pocketed:false};
}
const balls = [];
balls.push(createBall(table.x + table.width*0.22, table.y + table.height/2, 11, "#ffffff", 0, 0));
const ballDefs = [
  {num:1, color:"#FFD200"}, {num:2, color:"#0E6FFF"}, {num:3, color:"#E53935"},
  {num:4, color:"#8E3AC1"}, {num:5, color:"#FF7F00"}, {num:6, color:"#8B4A2F"},
  {num:7, color:"#1E8A3A"}, {num:8, color:"#000000"}, {num:9, color:"#FFD200"},
  {num:10, color:"#0E6FFF"},{num:11, color:"#FF6B6B"},{num:12, color:"#B57EDC"},
  {num:13, color:"#FFC58A"},{num:14, color:"#8B4A2F"},{num:15, color:"#66C175"}
];
const r = 11;
const spacing = r*2;
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
    balls.push(createBall(x,y,r,def.color,++idCounter,def.num));
    idx++;
    if(idx>=15) break;
  }
  if(idx>=15) break;
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

        // troca de velocidade (elastic)
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

/* ---------- helpers de desenho ---------- */
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

function shadeHex(hex,amt){
  const c = hex.replace("#",""); const n = parseInt(c,16);
  let r = (n>>16)+amt, g = ((n>>8)&0xff)+amt, b = (n&0xff)+amt;
  r=Math.max(0,Math.min(255,r)); g=Math.max(0,Math.min(255,g)); b=Math.max(0,Math.min(255,b));
  return "#" + ((1<<24) + (r<<16) + (g<<8) + b).toString(16).slice(1);
}
function lighten(hex,frac){
  const c = hex.replace("#",""); const n = parseInt(c,16);
  let r=(n>>16), g=((n>>8)&0xff), b=(n&0xff);
  r = Math.min(255, Math.round(r + (255 - r) * frac));
  g = Math.min(255, Math.round(g + (255 - g) * frac));
  b = Math.min(255, Math.round(b + (255 - b) * frac));
  return "#" + ((1<<24) + (r<<16) + (g<<8) + b).toString(16).slice(1);
}

/* ---------- desenhar mesa (felt + madeira + filete) ---------- */
function drawTable(){
  ctx.fillStyle = "#0c0d10";
  ctx.fillRect(0,0,W,H);

  const outerX = table.x - railOuter;
  const outerY = table.y - railOuter;
  const outerW = table.width + railOuter * 2;
  const outerH = table.height + railOuter * 2;

  // contorno escuro (madeira base)
  ctx.fillStyle = "#070707";
  roundRect(ctx, outerX, outerY, outerW, outerH, 18);
  ctx.fill();

  // madeira (simplificada)
  const woodInset = 6;
  ctx.fillStyle = woodColor;
  roundRect(ctx, outerX + woodInset, outerY + woodInset, outerW - woodInset*2, outerH - woodInset*2, 16);
  ctx.fill();

  // filete dourado
  ctx.fillStyle = railGold;
  roundRect(ctx, outerX + woodInset + 2, outerY + woodInset + 2, outerW - (woodInset+2)*2, outerH - (woodInset+2)*2, 14);
  ctx.fill();

  // faixa azul entre madeira e felt
  ctx.fillStyle = railBlue;
  roundRect(ctx, table.x - railInner/2, table.y - railInner/2, table.width + railInner, table.height + railInner, 12);
  ctx.fill();

  // felt com gradiente radial
  const cx = table.x + table.width/2;
  const cy = table.y + table.height/2;
  const maxR = Math.max(table.width, table.height) * 0.7;
  const g = ctx.createRadialGradient(cx, cy, maxR*0.08, cx, cy, maxR);
  g.addColorStop(0, lighten(feltCenter, 0.06));
  g.addColorStop(0.35, feltCenter);
  g.addColorStop(1, feltEdge);
  ctx.fillStyle = g;
  roundRect(ctx, table.x, table.y, table.width, table.height, 10);
  ctx.fill();

  // leve vinheta interna
  ctx.beginPath();
  roundRect(ctx, table.x, table.y, table.width, table.height, 10);
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.fill();
}

/* ---------- desenhar pockets EMBUTIDAS (meia-lua na madeira) ---------- */
function drawPocket(px, py){
  // procurar mouth position correspondente
  const mp = mouthPositions.find(m => Math.abs(m.px - px) < 1 && Math.abs(m.py - py) < 1);
  const mouthX = mp ? mp.mouthX : px;
  const mouthY = mp ? mp.mouthY : py;
  const dx = mp ? mp.dirX : 0;
  const dy = mp ? mp.dirY : 1;
  const innerR = table.pocketRadius - 6;

  // 1) sombra posterior na madeira (fundo)
  ctx.beginPath();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.arc(px, py, table.pocketRadius + 10, 0, Math.PI*2);
  ctx.fill();

  // 2) cavidade (meia-lua) — embutida na madeira (posição mouthX,mouthY já está NA madeira)
  ctx.beginPath();
  ctx.fillStyle = pocketColor;
  // desenha meia-lua (arco inferior) como elipse cortada (usando arc e rect trick)
  ctx.ellipse(mouthX, mouthY, innerR, innerR * 0.6, 0, Math.PI, 2*Math.PI);
  ctx.fill();

  // 3) recorte do felt (pequeno lábio azul por cima da madeira, apontando para baixo)
  ctx.beginPath();
  const lipW = innerR * 0.9;
  const lipH = innerR * 0.28;
  ctx.ellipse(mouthX, mouthY - innerR*0.26, lipW, lipH, 0, 0, Math.PI*2);
  ctx.fillStyle = shadeHex(feltCenter, -8);
  ctx.fill();

  // 4) profundidade interna (degradê)
  const grad = ctx.createRadialGradient(mouthX, mouthY + innerR*0.12, innerR*0.1, mouthX, mouthY + innerR*0.12, innerR*0.95);
  grad.addColorStop(0, "rgba(40,16,16,0.95)");
  grad.addColorStop(0.5, "rgba(24,6,6,0.9)");
  grad.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.beginPath();
  ctx.ellipse(mouthX, mouthY + innerR*0.12, innerR*0.88, innerR*0.54, 0, 0, Math.PI*2);
  ctx.fillStyle = grad;
  ctx.fill();

  // 5) leve destaque na borda superior (relevo)
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  ctx.ellipse(mouthX, mouthY - innerR*0.18, innerR*0.8, innerR*0.26, 0, 0, Math.PI*2);
  ctx.stroke();
}

/* ---------- desenhar bolas (polido) ---------- */
function drawPolishedBall(b){
  if(b.pocketed) return;

  ctx.beginPath();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.ellipse(b.x + 4, b.y + 6, b.r * 0.95, b.r * 0.5, 0, 0, Math.PI*2);
  ctx.fill();

  const isStripe = b.number >= 9;
  if(isStripe){
    ctx.beginPath(); ctx.fillStyle = "#fff"; ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(b.x,b.y,b.r-0.4,0,Math.PI*2); ctx.clip();
    ctx.beginPath(); ctx.ellipse(b.x,b.y,b.r*1.02,b.r*0.52,0,0,Math.PI*2); ctx.fillStyle = b.color; ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(0,0,0,0.34)"; ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.fillStyle = "#fff"; ctx.arc(b.x,b.y,b.r*0.48,0,Math.PI*2); ctx.fill();
    const grad = ctx.createRadialGradient(b.x - b.r*0.35, b.y - b.r*0.45, 1, b.x, b.y, b.r*1.2);
    grad.addColorStop(0, "rgba(255,255,255,0.92)"); grad.addColorStop(0.25,"rgba(255,255,255,0.18)"); grad.addColorStop(1,"rgba(255,255,255,0)");
    ctx.beginPath(); ctx.fillStyle = grad; ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = "#000"; ctx.font = `${Math.round(b.r*0.85)}px sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(b.number.toString(), b.x, b.y);
  } else {
    if(b.number === 0){
      ctx.beginPath(); ctx.fillStyle="#fff"; ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.strokeStyle="rgba(0,0,0,0.18)"; ctx.lineWidth =1; ctx.arc(b.x,b.y,b.r-1.2,0,Math.PI*2); ctx.stroke();
      const hg = ctx.createRadialGradient(b.x - b.r*0.35, b.y - b.r*0.45, 1, b.x, b.y, b.r*1.2);
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

/* ---------- main draw ---------- */
function draw(){
  ctx.clearRect(0,0,W,H);
  drawTable();

  // desenha pockets (usa mouthPositions para consistência visual)
  for(const m of mouthPositions){
    drawPocket(m.px, m.py);
  }

  // bolas
  for(const b of balls) drawPolishedBall(b);

  // HUD
  const remaining = balls.filter(b => b.number > 0 && !b.pocketed).length;
  ctx.fillStyle = "#ffffff";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Bolas restantes: " + remaining, 12, H - 12);

  // mira
  if(aiming){
    const white = balls[0];
    ctx.beginPath(); ctx.moveTo(white.x, white.y); ctx.lineTo(mouse.x, mouse.y);
    ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2; ctx.setLineDash([6,6]); ctx.stroke(); ctx.setLineDash([]);
    const dx = white.x - mouse.x, dy = white.y - mouse.y;
    const power = clamp(Math.hypot(dx,dy) / 6, 0, 36);
    ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.font = "12px sans-serif"; ctx.fillText("Força: " + Math.round(power), white.x + 12, white.y - 12);
  }
}

/* ---------- input handlers ---------- */
function getCanvasPos(e){
  const rect = canvas.getBoundingClientRect();
  let clientX, clientY;
  if(e.touches && e.touches[0]) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
  else { clientX = e.clientX; clientY = e.clientY; }
  return {x: clientX - rect.left, y: clientY - rect.top};
}

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
  const p = getCanvasPos(e);
  const white = balls[0];
  const dx = white.x - p.x, dy = white.y - p.y;
  const distVec = Math.hypot(dx,dy);
  const force = clamp(distVec / 6, 0, 36);
  const angle = Math.atan2(dy, dx);
  const impulse = force * 0.95;
  white.vx += Math.cos(angle) * impulse;
  white.vy += Math.sin(angle) * impulse;
  aiming = false;
});
canvas.addEventListener("mouseleave", () => { aiming = false; });
canvas.addEventListener("touchstart", (e)=>{ e.preventDefault(); canvas.dispatchEvent(new MouseEvent('mousedown', {clientX: e.touches[0].clientX, clientY: e.touches[0].clientY})); }, {passive:false});
canvas.addEventListener("touchmove", (e)=>{ e.preventDefault(); mouse = getCanvasPos(e); }, {passive:false});
canvas.addEventListener("touchend", (e)=>{ e.preventDefault(); canvas.dispatchEvent(new MouseEvent('mouseup')); }, {passive:false});

/* ---------- loop ---------- */
function loop(){
  updatePhysics();
  draw();
  requestAnimationFrame(loop);
}
loop();