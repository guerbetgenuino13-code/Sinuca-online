/* game.js — Visual inspirado no screenshot: pano azul com gradiente, rails dourados/ornamentados,
   bolas com cores ajustadas, faixas e brilho forte. Mantém física e controles.
*/

console.log("game.js (visual custom azul/dourado) carregado");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

/* Mesa parameters */
const table = {
  x: 36, y: 36,
  width: W - 72, height: H - 72,
  pocketRadius: 24
};

/* Rails decorative colors (dourado + azul interno) */
const railOuterColor = "#B8860B";    // dourado escuro
const railInnerColor = "#0f4f7a";    // azul escuro (decoração)
const feltCenter = "#2b72a6";        // base do pano (azul)
const feltEdge = "#123856";          // borda do pano (mais escura)
const pocketColor = "#0e1a1f";

/* pockets */
const pockets = [
  {x: table.x, y: table.y},
  {x: table.x + table.width/2, y: table.y - 6},
  {x: table.x + table.width, y: table.y},
  {x: table.x, y: table.y + table.height},
  {x: table.x + table.width/2, y: table.y + table.height + 6},
  {x: table.x + table.width, y: table.y + table.height}
];

/* Ball factory */
function createBall(x, y, radius=11, color="#fff", id=0, number=null){
  return {x, y, vx:0, vy:0, r: radius, color, id, mass: radius, number, pocketed:false};
}

/* Ball palette tuned to match reference (saturated, bright) */
const ballDefs = [
  {num:1,  color:"#FFD200"}, // 1 - amarelo forte
  {num:2,  color:"#0E6FFF"}, // 2 - azul vivo
  {num:3,  color:"#E53935"}, // 3 - vermelho vivo
  {num:4,  color:"#8E3AC1"}, // 4 - roxo
  {num:5,  color:"#FF7F00"}, // 5 - laranja
  {num:6,  color:"#8B4A2F"}, // 6 - marrom
  {num:7,  color:"#1E8A3A"}, // 7 - verde
  {num:8,  color:"#000000"}, // 8 - preto
  {num:9,  color:"#FFD200"}, // 9 - stripe amarelo
  {num:10, color:"#0E6FFF"}, // 10 - stripe azul
  {num:11, color:"#FF6B6B"}, // 11 - stripe vermelho/rosado
  {num:12, color:"#B57EDC"}, // 12 - stripe lilás
  {num:13, color:"#FFC58A"}, // 13 - stripe pêssego/amarelo
  {num:14, color:"#8B4A2F"}, // 14 - stripe marrom
  {num:15, color:"#66C175"}  // 15 - stripe verde claro
];

/* initialize balls: white + triangle 15 */
const balls = [];
// white
balls.push(createBall(table.x + table.width * 0.22, table.y + table.height/2, 11, "#ffffff", 0, 0));

// triangle layout (5,4,3,2,1) with tighter packing
const r = 11;
const spacing = r*2 + 0;
const startX = table.x + table.width*0.66;
const startY = table.y + table.height/2;
let idx = 0;
let idCounter = 1;
for(let row=0; row<5; row++){
  const rowsSizes = [5,4,3,2,1];
  const rowSize = rowsSizes[row];
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

/* physics */
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

    // pocket check
    for(const p of pockets){
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if(d < table.pocketRadius - 4){
        b.vx = 0; b.vy = 0; b.pocketed = true; b.x = -1000; b.y = -1000;
      }
    }
  }

  // pairwise collisions
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

/* DRAW HELPERS: table, rails and balls (with nicer highlights) */

function drawTable(){
  // rails outer (dourado)
  ctx.fillStyle = railOuterColor;
  ctx.fillRect(table.x - 28, table.y - 28, table.width + 56, table.height + 56);

  // inner rail decorative strip
  ctx.fillStyle = railInnerColor;
  ctx.fillRect(table.x - 20, table.y - 20, table.width + 40, table.height + 40);

  // felt gradient (center bright -> edge dark)
  const g = ctx.createLinearGradient(table.x, table.y, table.x + table.width, table.y + table.height);
  g.addColorStop(0, feltEdge);
  g.addColorStop(0.5, feltCenter);
  g.addColorStop(1, feltEdge);

  ctx.fillStyle = g;
  ctx.fillRect(table.x, table.y, table.width, table.height);

  // subtle vignette: darker inside edges
  ctx.beginPath();
  ctx.rect(table.x, table.y, table.width, table.height);
  ctx.fillStyle = "rgba(0,0,0,0.04)";
  ctx.fill();
}

function drawPocket(x,y){
  ctx.beginPath();
  // outer ring
  ctx.fillStyle = "#2b1f16";
  ctx.arc(x, y, table.pocketRadius + 6, 0, Math.PI*2);
  ctx.fill();

  // inner mouth
  ctx.beginPath();
  ctx.fillStyle = pocketColor;
  ctx.arc(x, y, table.pocketRadius - 2, 0, Math.PI*2);
  ctx.fill();
}

/* Draw a polished ball: stripe or solid with radial highlight */
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

    // clip to circle then draw stripe ellipse
    ctx.save();
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 0.4, 0, Math.PI*2); ctx.clip();
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.r*1.0, b.r*0.52, 0, 0, Math.PI*2);
    ctx.fillStyle = b.color;
    ctx.fill();
    ctx.restore();

    // outer rim
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.stroke();

    // center white circle for number
    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.arc(b.x, b.y, b.r*0.48, 0, Math.PI*2);
    ctx.fill();

    // highlight
    const grad = ctx.createRadialGradient(b.x - b.r*0.35, b.y - b.r*0.45, 1, b.x, b.y, b.r*1.2);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.25, "rgba(255,255,255,0.18)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath(); ctx.fillStyle = grad; ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();

    // number (black)
    ctx.fillStyle = "#000";
    ctx.font = `${Math.round(b.r * 0.85)}px sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(b.number.toString(), b.x, b.y);
  } else {
    // solid ball or white
    if(b.number === 0){
      // white ball
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
      // colored solid with radial gradient
      function shadeHex(hex, amt){
        const c = hex.replace("#",""); const n = parseInt(c,16);
        let r = (n>>16) + amt; let g = ((n>>8)&0xff) + amt; let bl = (n&0xff) + amt;
        r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); bl = Math.max(0, Math.min(255, bl));
        return "#" + ( (1<<24) + (r<<16) + (g<<8) + bl ).toString(16).slice(1);
      }
      const dark = shadeHex(b.color, -36);
      const grad = ctx.createRadialGradient(b.x - b.r*0.35, b.y - b.r*0.45, 1, b.x, b.y, b.r*1.4);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.12, b.color);
      grad.addColorStop(1, dark);
      ctx.beginPath(); ctx.fillStyle = grad; ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.stroke();

      // small central white circle for number contrast
      ctx.beginPath(); ctx.fillStyle = "#ffffff"; ctx.arc(b.x, b.y, b.r*0.48, 0, Math.PI*2); ctx.fill();

      // choose number color for contrast
      const darkColors = ["#0E6FFF","#8E3AC1","#8B4A2F","#1E8A3A","#000000"];
      const numberColor = darkColors.includes(b.color) ? "#fff" : "#000";
      ctx.fillStyle = numberColor;
      ctx.font = `${Math.round(b.r * 0.85)}px sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(b.number.toString(), b.x, b.y);
    }
  }
}

/* main draw */
function draw(){
  ctx.clearRect(0,0,W,H);
  drawTable();
  for(const p of pockets) drawPocket(p.x, p.y);

  // balls
  for(const b of balls) drawPolishedBall(b);

  // HUD
  const remaining = balls.filter(b => b.number > 0 && !b.pocketed).length;
  ctx.fillStyle = "#ffffff";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Bolas restantes: " + remaining, 12, H - 12);

  // aim line
  if(aiming){
    const white = balls[0];
    ctx.beginPath();
    ctx.moveTo(white.x, white.y);
    ctx.lineTo(mouse.x, mouse.y);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2; ctx.setLineDash([6,6]); ctx.stroke(); ctx.setLineDash([]);
    const dx = white.x - mouse.x, dy = white.y - mouse.y;
    const power = clamp(Math.hypot(dx,dy) / 6, 0, 30);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "12px sans-serif";
    ctx.fillText("Força: " + Math.round(power), white.x + 12, white.y - 12);
  }
}

/* input handlers */
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

/* loop */
function loop(){
  updatePhysics();
  draw();
  requestAnimationFrame(loop);
}
loop();