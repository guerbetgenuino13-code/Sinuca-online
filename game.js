/* game.js — Mesa e visual estilo 8 Ball Pool (pano radial, rails dourados finos, pockets profundos)
   Mantém: todas as mecânicas (mira, tacada, física, colisões, 15 bolas).
*/

console.log("game.js (8-ball visual) carregado");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

/* ---------- Mesa params ---------- */
const railOuter = 28;    // espaço total usado por rail (outer shadow + gold)
const railInner = 12;    // largura do "felt inset" (visual)
const pocketRadius = 26;

const table = {
  x: railOuter,
  y: railOuter,
  width: W - railOuter * 2,
  height: H - railOuter * 2,
  pocketRadius
};

/* Paleta semelhante ao 8 Ball Pool */
const railGold = "#E0B000";      // dourado principal (filete)
const railGoldDark = "#B07E00";  // sombra do dourado
const railBlue = "#0f4f7a";      // azul decor no rail
const feltCenter = "#2f77b3";    // azul do centro do pano
const feltEdge = "#13354b";      // borda do pano mais escura
const pocketColor = "#0b0f12";

/* pockets positions */
const pockets = [
  {x: table.x, y: table.y},
  {x: table.x + table.width/2, y: table.y - 6},
  {x: table.x + table.width, y: table.y},
  {x: table.x, y: table.y + table.height},
  {x: table.x + table.width/2, y: table.y + table.height + 6},
  {x: table.x + table.width, y: table.y + table.height}
];

/* ---------- Balls ---------- */
function createBall(x, y, radius=11, color="#fff", id=0, number=null){
  return {x, y, vx:0, vy:0, r: radius, color, id, mass: radius, number, pocketed:false};
}

const balls = [];
// white ball
balls.push(createBall(table.x + table.width * 0.22, table.y + table.height/2, 11, "#ffffff", 0, 0));

// palette and triangle (colors tuned)
const ballDefs = [
  {num:1, color:"#FFD200"},
  {num:2, color:"#0E6FFF"},
  {num:3, color:"#E53935"},
  {num:4, color:"#8E3AC1"},
  {num:5, color:"#FF7F00"},
  {num:6, color:"#8B4A2F"},
  {num:7, color:"#1E8A3A"},
  {num:8, color:"#000000"},
  {num:9, color:"#FFD200"},
  {num:10, color:"#0E6FFF"},
  {num:11, color:"#FF6B6B"},
  {num:12, color:"#B57EDC"},
  {num:13, color:"#FFC58A"},
  {num:14, color:"#8B4A2F"},
  {num:15, color:"#66C175"}
];

const r = 11;
const spacing = r*2 + 0;
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

/* ---------- Physics (unchanged) ---------- */
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

    for(const p of pockets){
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if(d < table.pocketRadius - 6){
        b.vx = 0; b.vy = 0; b.pocketed = true; b.x = -1000; b.y = -1000;
      }
    }
  }

  // collisions pairwise
  for(let i=0;i<balls.length;i++){
    for(let j=i+1;j<balls.length;j++){
      const A = balls[i], B = balls[j];
      if(A.pocketed || B.pocketed) continue;
      const dx = B.x - A.x, dy = B.y - A.y;
      const distAB = Math.hypot(dx,dy);
      const minDist = A.r + B.r;
      if(distAB > 0 && distAB < minDist){
        const overlap = (minDist - distAB) / 2;
        const nx = dx / distAB, ny = dy / distAB;
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

/* ---------- Drawing helpers for 8-ball look ---------- */

function drawTable(){
  // fundo externo / shadow
  ctx.fillStyle = "#0c0d10";
  ctx.fillRect(0,0,W,H);

  // rail base (escuro)
  const outerX = table.x - railOuter;
  const outerY = table.y - railOuter;
  const outerW = table.width + railOuter*2;
  const outerH = table.height + railOuter*2;
  ctx.fillStyle = "#070707";
  roundRect(ctx, outerX, outerY, outerW, outerH, 18);
  ctx.fill();

  // golden filete e detalhe escuro por baixo para profundidade
  const goldInset = 6;
  ctx.fillStyle = railGoldDark;
  roundRect(ctx, outerX + goldInset, outerY + goldInset, outerW - goldInset*2, outerH - goldInset*2, 16);
  ctx.fill();

  ctx.fillStyle = railGold;
  roundRect(ctx, outerX + goldInset + 2, outerY + goldInset + 2, outerW - (goldInset+2)*2, outerH - (goldInset+2)*2, 14);
  ctx.fill();

  // inner decorative blue strip
  ctx.fillStyle = railBlue;
  roundRect(ctx, table.x - railInner/2, table.y - railInner/2, table.width + railInner, table.height + railInner, 12);
  ctx.fill();

  // felt radial gradient (mais claro no centro)
  const cx = table.x + table.width/2;
  const cy = table.y + table.height/2;
  const maxR = Math.max(table.width, table.height) * 0.7;
  const grad = ctx.createRadialGradient(cx, cy, maxR*0.08, cx, cy, maxR);
  grad.addColorStop(0, lighten(feltCenter, 0.06));
  grad.addColorStop(0.35, feltCenter);
  grad.addColorStop(1, feltEdge);

  // desenha o felt normalmente (lembrando que as caçapas terão boca desenhada separadamente)
  ctx.fillStyle = grad;
  roundRect(ctx, table.x, table.y, table.width, table.height, 10);
  ctx.fill();

  // leve vinheta interna
  ctx.beginPath();
  roundRect(ctx, table.x, table.y, table.width, table.height, 10);
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  ctx.fill();
}


function drawPocket(px, py){
  // POSIÇÃO DA "BOCA" deslocada para fora da borda (evita invadir o feltro)
  // Calculamos direção do centro da mesa para o pocket e deslocamos a boca nessa direção
  const centerX = table.x + table.width/2;
  const centerY = table.y + table.height/2;
  let dx = px - centerX;
  let dy = py - centerY;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;

  // distância de deslocamento da boca para fora (ajuste aqui se quiser mais/menos)
  const mouthOffset = 8;
  const mouthX = px + dx * mouthOffset;
  const mouthY = py + dy * mouthOffset;

  // raio interno real da boca (menor que pocketRadius para parecer uma abertura)
  const innerR = table.pocketRadius - 6;

  // 1) desenha anel exterior decorativo (sob a mesa)
  ctx.beginPath();
  ctx.fillStyle = "#1b1108";
  ctx.arc(px, py, table.pocketRadius + 8, 0, Math.PI*2);
  ctx.fill();

  // 2) desenha a "boca" real (escura) **mais para fora** (não invade o feltro)
  ctx.beginPath();
  ctx.fillStyle = pocketColor;
  ctx.arc(mouthX, mouthY, innerR, 0, Math.PI*2);
  ctx.fill();

  // 3) desenha o "lábio" (pequena peça do feltro recortada) para parecer que a borda tem uma abertura
  //    desenhamos um pequeno retângulo arredondado sobre o feltro, na posição da boca, com cor do feltro escurecida
  ctx.save();
  // cria um pequeno "slot" sobre o felt (um retângulo arredondado alinhado ao centro da boca)
  const lipW = innerR * 1.6;
  const lipH = innerR * 0.45;
  ctx.beginPath();
  ctx.fillStyle = shadeHex(feltCenter, -18); // leve escurecimento para o lábio
  // posiciona o lip centrado na mouthX/mouthY mas deslocado um pouco pra dentro (para dar efeito)
  ctx.ellipse(mouthX - dx* (innerR*0.15), mouthY - dy*(innerR*0.15), lipW/2, lipH/2, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // 4) sombra dentro da boca (profundidade)
  ctx.beginPath();
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.ellipse(mouthX, mouthY + innerR*0.2, innerR*0.9, innerR*0.5, 0, 0, Math.PI*2);
  ctx.fill();

  // 5) pequeno brilho na borda superior do lábio para dar relevo
  ctx.beginPath();
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.ellipse(mouthX - dx*1.6, mouthY - dy*1.6, innerR*0.7, innerR*0.25, 0, 0, Math.PI*2);
  ctx.fill();
}

/* polished ball drawing (stripe + solid) */
function drawPolishedBall(b){
  if(b.pocketed) return;

  // shadow
  ctx.beginPath();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.ellipse(b.x + 4, b.y + 6, b.r * 0.95, b.r * 0.5, 0, 0, Math.PI*2);
  ctx.fill();

  const isStripe = b.number >= 9;

  if(isStripe){
    // white base
    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.fill();

    // stripe ellipse (clipped to circle)
    ctx.save();
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r - 0.4, 0, Math.PI*2);
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.r*1.02, b.r*0.52, 0, 0, Math.PI*2);
    ctx.fillStyle = b.color;
    ctx.fill();
    ctx.restore();

    // outer rim
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.34)";
    ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.stroke();

    // center white circle for number
    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.arc(b.x, b.y, b.r*0.48, 0, Math.PI*2);
    ctx.fill();

    // highlight
    const grad = ctx.createRadialGradient(b.x - b.r*0.35, b.y - b.r*0.45, 1, b.x, b.y, b.r*1.2);
    grad.addColorStop(0, "rgba(255,255,255,0.92)");
    grad.addColorStop(0.25, "rgba(255,255,255,0.18)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.fillStyle = grad;
    ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.fill();

    // number
    ctx.fillStyle = "#000";
    ctx.font = `${Math.round(b.r * 0.85)}px sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(b.number.toString(), b.x, b.y);
  } else {
    // solid or white
    if(b.number === 0){
      ctx.beginPath();
      ctx.fillStyle = "#ffffff";
      ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1;
      ctx.arc(b.x, b.y, b.r - 1.2, 0, Math.PI*2);
      ctx.stroke();

      // highlight
      const hg = ctx.createRadialGradient(b.x - b.r*0.35, b.y - b.r*0.45, 1, b.x, b.y, b.r*1.2);
      hg.addColorStop(0, "rgba(255,255,255,0.95)"); hg.addColorStop(0.3, "rgba(255,255,255,0.25)"); hg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath(); ctx.fillStyle = hg; ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
    } else {
      // colored with radial gradient
      const dark = shadeHex(b.color, -36);
      const grad = ctx.createRadialGradient(b.x - b.r*0.35, b.y - b.r*0.45, 1, b.x, b.y, b.r*1.4);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.12, b.color);
      grad.addColorStop(1, dark);
      ctx.beginPath(); ctx.fillStyle = grad; ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();

      // rim
      ctx.beginPath(); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(0,0,0,0.34)"; ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.stroke();

      // small white circle for number
      ctx.beginPath(); ctx.fillStyle = "#ffffff"; ctx.arc(b.x, b.y, b.r*0.48, 0, Math.PI*2); ctx.fill();

      // number color contrast
      const darkColors = ["#0E6FFF","#8E3AC1","#8B4A2F","#1E8A3A","#000000"];
      const numberColor = darkColors.includes(b.color) ? "#fff" : "#000";
      ctx.fillStyle = numberColor;
      ctx.font = `${Math.round(b.r * 0.85)}px sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(b.number.toString(), b.x, b.y);
    }
  }
}

/* ---------- Utilities ---------- */
function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* shade hex helper */
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

/* ---------- Draw loop ---------- */
function draw(){
  ctx.clearRect(0,0,W,H);
  drawTable();
  for(const p of pockets) drawPocket(p.x, p.y);
  for(const b of balls) drawPolishedBall(b);

  // HUD
  const remaining = balls.filter(b => b.number > 0 && !b.pocketed).length;
  ctx.fillStyle = "#ffffff";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Bolas restantes: " + remaining, 12, H - 12);

  // aiming line
  if(aiming){
    const white = balls[0];
    ctx.beginPath(); ctx.moveTo(white.x, white.y); ctx.lineTo(mouse.x, mouse.y);
    ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2; ctx.setLineDash([6,6]); ctx.stroke(); ctx.setLineDash([]);
    const dx = white.x - mouse.x, dy = white.y - mouse.y;
    const power = clamp(Math.hypot(dx,dy) / 6, 0, 36);
    ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.font = "12px sans-serif"; ctx.fillText("Força: " + Math.round(power), white.x + 12, white.y - 12);
  }
}

/* ---------- Input handlers ---------- */
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

/* ---------- Loop ---------- */
function loop(){
  updatePhysics();
  draw();
  requestAnimationFrame(loop);
}
loop();