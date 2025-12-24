/* game.js — Versão final: mira livre (taco acompanha), tacada apenas pela barra lateral,
   sem pullBack/arraste para bater (opção 1) */

console.log("game.js — versão final: mira livre + tacada só pela barra lateral");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

/* ---------- mesa params ---------- */
const railOuter = 28;
const railInner = 12;
const pocketRadius = 26;

let cueRecoil = 0;
let cueRecoilTarget = 0;
let simulationRunning = false;

let shotPower = 0;            // 0..36 scale
let isAdjustingPower = false;

const powerBar = {
  // barra vertical no lado direito
  x: W - 36,
  y: 60,
  w: 20,
  h: H - 120
};

const table = {
  x: railOuter,
  y: railOuter,
  // deixa espaço à direita para a sidebar
  width: W - railOuter * 2 - 60,
  height: H - railOuter * 2,
  pocketRadius
};

const cx = table.x + table.width / 2;
const cy = table.y + table.height / 2;

/* ---------- input / aiming state ---------- */
let aiming = true; // mira ativa quando bolas paradas (começa true)
let mouse = { x: cx + 100, y: cy }; // posição inicial da mira
let isDragging = false; // usado apenas para mover a mira (não puxa força)

/* ---------- util ---------- */
function toCanvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height)
  };
}

/* ---------- pockets ---------- */
const pockets = [
  { x: table.x, y: table.y },
  { x: table.x + table.width / 2, y: table.y },
  { x: table.x + table.width, y: table.y },
  { x: table.x, y: table.y + table.height },
  { x: table.x + table.width / 2, y: table.y + table.height },
  { x: table.x + table.width, y: table.y + table.height }
];

const inwardOffset = 6;
const mouthPositions = pockets.map(p => {
  let dx = cx - p.x;
  let dy = cy - p.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;

  const mouthX = p.x + dx * inwardOffset;
  const mouthY = p.y + dy * inwardOffset;

  let ddx = cx - mouthX, ddy = cy - mouthY;
  const L = Math.hypot(ddx, ddy) || 1;
  ddx /= L; ddy /= L;

  return { px: p.x, py: p.y, mouthX, mouthY, dirX: ddx, dirY: ddy };
});

/* ---------- bolas ---------- */
function createBall(x,y,r=11,color="#fff",id=0,num=null){
  return {x,y,vx:0,vy:0,r,color,id,mass:r,number:num,pocketed:false};
}

const balls = [];
balls.push(createBall(table.x + table.width * 0.22, table.y + table.height/2, 11, "#ffffff", 0, 0));

const ballDefs = [
  {num:1,color:"#FFD200"},{num:2,color:"#0E6FFF"},{num:3,color:"#E53935"},
  {num:4,color:"#8E3AC1"},{num:5,color:"#FF7F00"},{num:6,color:"#8B4A2F"},
  {num:7,color:"#1E8A3A"},{num:8,color:"#000000"},{num:9,color:"#FFD200"},
  {num:10,color:"#0E6FFF"},{num:11,color:"#FF6B6B"},{num:12,color:"#B57EDC"},
  {num:13,color:"#FFC58A"},{num:14,color:"#8B4A2F"},{num:15,color:"#66C175"}
];

let idx = 0;
let idCounter = 1;
const spacing = 22;
const startX = table.x + table.width*0.66;
const startY = table.y + table.height/2;

for(let row=0; row<5; row++){
  const rowSizes = [5,4,3,2,1];
  const rowSize = rowSizes[row];
  const x = startX + row * (spacing * 0.88);
  const totalH = (rowSize - 1) * spacing;
  for(let col=0; col<rowSize; col++){
    const y = startY - totalH/2 + col * spacing;
    const def = ballDefs[idx % ballDefs.length];
    balls.push(createBall(x, y, 11, def.color, ++idCounter, def.num));
    idx++;
  }
}

/* ---------- física ---------- */
const friction = 0.992;
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));

function updatePhysics(){
  for(const b of balls){
    if(b.pocketed) continue;

    b.x += b.vx;
    b.y += b.vy;

    b.vx *= friction;
    b.vy *= friction;

    if(Math.abs(b.vx) < 0.01) b.vx = 0;
    if(Math.abs(b.vy) < 0.01) b.vy = 0;

    const left   = table.x + b.r;
    const right  = table.x + table.width - b.r;
    const top    = table.y + b.r;
    const bottom = table.y + table.height - b.r;

    if(b.x < left){ b.x = left; b.vx *= -1; }
    if(b.x > right){ b.x = right; b.vx *= -1; }
    if(b.y < top){ b.y = top; b.vy *= -1; }
    if(b.y > bottom){ b.y = bottom; b.vy *= -1; }

    for(const m of mouthPositions){
      const innerR = table.pocketRadius - 8;
      const d = Math.hypot(b.x - m.mouthX, b.y - m.mouthY);
      if(d < innerR){
        b.vx = 0;
        b.vy = 0;
        b.pocketed = true;
        b.x = -1000;
        b.y = -1000;
        break;
      }
    }
  }

  /* colisão bola-bola */
  for(let i=0;i<balls.length;i++){
    for(let j=i+1;j<balls.length;j++){
      const A = balls[i], B = balls[j];
      if(A.pocketed || B.pocketed) continue;

      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const d  = Math.hypot(dx,dy);
      const minD = A.r + B.r;

      if(d>0 && d<minD){
        const overlap = (minD - d) / 2;
        const nx = dx / d, ny = dy / d;

        A.x -= nx * overlap;
        A.y -= ny * overlap;
        B.x += nx * overlap;
        B.y += ny * overlap;

        const tx = -ny, ty = nx;

        const vAn = A.vx*nx + A.vy*ny;
        const vAt = A.vx*tx + A.vy*ty;
        const vBn = B.vx*nx + B.vy*ny;
        const vBt = B.vx*tx + B.vy*ty;

        const m1 = A.mass, m2 = B.mass;
        const vAnAfter = (vAn*(m1-m2)+2*m2*vBn)/(m1+m2);
        const vBnAfter = (vBn*(m2-m1)+2*m1*vAn)/(m1+m2);

        A.vx = vAnAfter*nx + vAt*tx;
        A.vy = vAnAfter*ny + vAt*ty;
        B.vx = vBnAfter*nx + vBt*tx;
        B.vy = vBnAfter*ny + vBt*ty;
      }
    }
  }
}

/* ---------- aplicar forças ---------- */

function applyShotWithPower() {
  const white = balls[0];
  if (!white) return;

  // direção da mira (mouse) determina o angulo da tacada
  const dx = mouse.x - white.x;
  const dy = mouse.y - white.y;
  const ang = Math.atan2(dy, dx);

  const impulse = shotPower * 0.32;

  white.vx += Math.cos(ang) * impulse;
  white.vy += Math.sin(ang) * impulse;

  simulationRunning = true;
  aiming = false;

  cueRecoilTarget = Math.min(40, Math.round(shotPower * 2));
  shotPower = 0;
}

/* ---------- estado das bolas ---------- */

function areBallsStopped() {
  for (const b of balls) {
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0.03) return false;
  }
  return true;
}

function checkAllBallsStoppedAndReactivate() {
  if (!simulationRunning) return;

  if (areBallsStopped()) {
    simulationRunning = false;
    aiming = true;
    isDragging = false;
    cueRecoil = 0;
  }
}

/* ---------- helpers ---------- */

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
  const c=hex.replace("#",""), n=parseInt(c,16);
  let r=(n>>16)+amt, g=((n>>8)&255)+amt, b=(n&255)+amt;
  r=Math.max(0,Math.min(255,r));
  g=Math.max(0,Math.min(255,g));
  b=Math.max(0,Math.min(255,b));
  return "#" + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}

function lighten(hex,frac){
  const c=hex.replace("#",""), n=parseInt(c,16);
  let r=(n>>16), g=((n>>8)&255), b=(n&255);
  r=Math.min(255,Math.round(r+(255-r)*frac));
  g=Math.min(255,Math.round(g+(255-g)*frac));
  b=Math.min(255,Math.round(b+(255-b)*frac));
  return "#" + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}

/* ---------- barra de força (vertical) ---------- */

function isInsidePowerBar(pos){
  return pos.x >= powerBar.x &&
         pos.x <= powerBar.x + powerBar.w &&
         pos.y >= powerBar.y &&
         pos.y <= powerBar.y + powerBar.h;
}

function updatePowerFromPos(pos){
  // vertical: 0 (bottom) .. h (top)
  let v = powerBar.y + powerBar.h - pos.y; // distância do fundo
  v = Math.max(0, Math.min(powerBar.h, v));
  shotPower = Math.round((v / powerBar.h) * 36);
}

function onPowerStart(pos){
  if (!isInsidePowerBar(pos)) return false;
  isAdjustingPower = true;
  updatePowerFromPos(pos);
  return true;
}

function onPowerMove(pos){
  if(isAdjustingPower) updatePowerFromPos(pos);
}

function onPowerEnd(){
  if(!isAdjustingPower) return;
  isAdjustingPower = false;
  applyShotWithPower();
}

/* ---------- limites de mira ---------- */

function limitAimToBorders(white,targetX,targetY){
  return {
    x: Math.max(table.x, Math.min(table.x + table.width, targetX)),
    y: Math.max(table.y, Math.min(table.y + table.height, targetY))
  };
}

function limitAimToBalls(white,targetX,targetY){
  let bestX = targetX, bestY = targetY;
  let minT = Infinity;

  for(const b of balls){
    if(b===white || b.pocketed) continue;

    const A={x:white.x,y:white.y};
    const B={x:targetX,y:targetY};
    const C={x:b.x,y:b.y};

    const dx=B.x-A.x, dy=B.y-A.y;
    const denom = dx*dx + dy*dy;
    if(denom === 0) continue;

    const t=((C.x-A.x)*dx + (C.y-A.y)*dy) / denom;
    if(t<0 || t>1) continue;

    const Px=A.x+t*dx;
    const Py=A.y+t*dy;
    const dist=Math.hypot(Px-C.x, Py-C.y);

    if(dist <= b.r+4 && t < minT){
      minT=t;
      bestX=Px;
      bestY=Py;
    }
  }
  return {x:bestX,y:bestY};
}

/* ---------- DRAW ---------- */

function draw(){
  ctx.clearRect(0,0,W,H);

  drawTable();

  for(const m of mouthPositions) drawPocketByMouth(m);

  for(const b of balls) drawPolishedBall(b);

  drawCueStick();

  drawPowerBar();

  /* --- texto --- */
  const remaining = balls.filter(b => b.number>0 && !b.pocketed).length;
  ctx.fillStyle="#fff";
  ctx.font="14px sans-serif";
  ctx.textAlign="left";
  ctx.fillText("Bolas restantes: " + remaining, 12, H-12);

  if(aiming){
    const white = balls[0];
    if(white){
      let aimX = mouse.x;
      let aimY = mouse.y;

      const border = limitAimToBorders(white,aimX,aimY);
      aimX = border.x;
      aimY = border.y;

      const col = limitAimToBalls(white,aimX,aimY);
      aimX = col.x;
      aimY = col.y;

      ctx.beginPath();
      ctx.moveTo(white.x,white.y);
      ctx.lineTo(aimX,aimY);
      ctx.strokeStyle="rgba(255,255,255,0.9)";
      ctx.lineWidth=2;
      ctx.setLineDash([6,6]);
      ctx.stroke();
      ctx.setLineDash([]);

      const dxm = white.x - mouse.x;
      const dym = white.y - mouse.y;
      let power = clamp(Math.hypot(dxm,dym)/6,0,36);
      // mostra o valor atual selecionado na barra quando ajustando
      if(isAdjustingPower) power = shotPower;

      ctx.fillStyle="rgba(255,255,255,0.95)";
      ctx.font="12px sans-serif";
      ctx.fillText("Força: "+Math.round(power), white.x+12, white.y-12);
    }
  }
}

/* ---------- desenho da mesa ---------- */

function drawTable() {
  ctx.fillStyle = "#0c0d10";
  ctx.fillRect(0, 0, W, H);

  const outerX = table.x - railOuter;
  const outerY = table.y - railOuter;
  const outerW = table.width + railOuter*2;
  const outerH = table.height + railOuter*2;

  ctx.fillStyle = "#070707";
  roundRect(ctx, outerX, outerY, outerW, outerH, 18);
  ctx.fill();

  const woodInset = 6;
  ctx.fillStyle = woodColor;
  roundRect(ctx, outerX+woodInset, outerY+woodInset, outerW-woodInset*2, outerH-woodInset*2, 16);
  ctx.fill();

  ctx.fillStyle = railGold;
  roundRect(ctx, outerX+woodInset+2, outerY+woodInset+2, outerW-(woodInset+2)*2, outerH-(woodInset+2)*2, 14);
  ctx.fill();

  ctx.fillStyle = railBlue;
  roundRect(ctx, table.x-railInner/2, table.y-railInner/2, table.width+railInner, table.height+railInner, 12);
  ctx.fill();

  const g = ctx.createRadialGradient(cx, cy, table.width*0.08, cx, cy, table.width*0.7);
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

/* ---------- desenho dos buracos ---------- */

function drawPocketByMouth(m){
  const innerR = table.pocketRadius - 6;

  ctx.beginPath();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.arc(m.mouthX, m.mouthY, innerR+14, 0, Math.PI*2);
  ctx.fill();

  const angle = Math.atan2(m.dirY, m.dirX) + Math.PI/2;

  ctx.save();
  ctx.translate(m.mouthX, m.mouthY);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.fillStyle = pocketColor;
  ctx.ellipse(0,0, innerR, innerR*0.62, 0, Math.PI, 2*Math.PI);
  ctx.fill();
  ctx.restore();
}

/* ---------- desenho das bolas ---------- */
function drawPolishedBall(b){
  if(b.pocketed) return;

  ctx.beginPath();
  ctx.fillStyle="rgba(0,0,0,0.28)";
  ctx.ellipse(b.x+4,b.y+6,b.r*0.95,b.r*0.5,0,0,Math.PI*2);
  ctx.fill();

  const isStripe = b.number >= 9;

  if(isStripe){
    ctx.beginPath();
    ctx.fillStyle="#fff";
    ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(b.x,b.y,b.r-1,0,Math.PI*2);
    ctx.clip();

    ctx.beginPath();
    ctx.ellipse(b.x,b.y,b.r*1.02,b.r*0.55,0,0,Math.PI*2);
    ctx.fillStyle=b.color;
    ctx.fill();
    ctx.restore();
  }

  else {
    ctx.beginPath();
    ctx.fillStyle=b.number===0 ? "#fff" : b.color;
    ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
    ctx.fill();
  }

  ctx.fillStyle="#fff";
  ctx.beginPath();
  ctx.arc(b.x,b.y,b.r*0.45,0,Math.PI*2);
  ctx.fill();

  ctx.fillStyle=b.number===8 ? "#fff" : "#000";
  ctx.font=`${Math.round(b.r*0.9)}px sans-serif`;
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.fillText(b.number, b.x, b.y);
}

/* ---------- taco ---------- */

function drawCueStick(){
  if(!aiming) return;

  const white = balls[0];
  if(!white) return;

  const dx = mouse.x - white.x;
  const dy = mouse.y - white.y;
  const ang = Math.atan2(dy, dx);

  // sem pullBack; stickLen fixo ligeiramente proporcional à distância da mira
  const stickLen = 140;

  const tipX = white.x - Math.cos(ang)*(white.r+4);
  const tipY = white.y - Math.sin(ang)*(white.r+4);

  const buttX = tipX - Math.cos(ang)*(stickLen + cueRecoil);
  const buttY = tipY - Math.sin(ang)*(stickLen + cueRecoil);

  ctx.beginPath();
  ctx.strokeStyle="rgba(0,0,0,0.45)";
  ctx.lineWidth=11;
  ctx.lineCap="round";
  ctx.moveTo(buttX+2,buttY+4);
  ctx.lineTo(tipX+2,tipY+4);
  ctx.stroke();

  const grad = ctx.createLinearGradient(buttX,buttY, tipX,tipY);
  grad.addColorStop(0,"#8B5A2B");
  grad.addColorStop(0.6,"#5a3518");
  grad.addColorStop(1,"#322214");

  ctx.beginPath();
  ctx.strokeStyle=grad;
  ctx.lineWidth=8;
  ctx.lineCap="round";
  ctx.moveTo(buttX,buttY);
  ctx.lineTo(tipX,tipY);
  ctx.stroke();
}

/* ---------- power bar draw ---------- */

function drawPowerBar(){
  // fundo
  ctx.beginPath();
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  roundRect(ctx, powerBar.x-6, powerBar.y-6, powerBar.w+12, powerBar.h+12, 8);
  ctx.fill();

  // track
  ctx.beginPath();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundRect(ctx, powerBar.x, powerBar.y, powerBar.w, powerBar.h, 6);
  ctx.fill();

  // nivel (de baixo para cima)
  const hLevel = (shotPower / 36) * powerBar.h;
  ctx.beginPath();
  ctx.fillStyle = "rgba(220,80,30,0.95)";
  roundRect(ctx, powerBar.x, powerBar.y + powerBar.h - hLevel, powerBar.w, hLevel, 6);
  ctx.fill();

  // indicador com valor
  ctx.fillStyle = "#fff";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(Math.round(shotPower), powerBar.x + powerBar.w/2, powerBar.y + powerBar.h + 18);

  // destaque quando ajustando
  if(isAdjustingPower){
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(powerBar.x-2, powerBar.y-2, powerBar.w+4, powerBar.h+4);
  }
}

/* ---------- pointer handlers ---------- */

function onPointerDown(e){
  if(!areBallsStopped()) return;

  const pos = e.touches
    ? toCanvasCoords(e.touches[0].clientX,e.touches[0].clientY)
    : toCanvasCoords(e.clientX,e.clientY);

  // 1) Se tocou na barra → ajusta força (SEM mexer mira)
  if (isInsidePowerBar(pos)) {
    onPowerStart(pos);
    return; // impede ativar mira
  }

  // 2) Só ativa mira se estiver dentro do pano da mesa
  const insideTable =
    pos.x >= table.x &&
    pos.x <= table.x + table.width &&
    pos.y >= table.y &&
    pos.y <= table.y + table.height;

  if (insideTable) {
    aiming = true;
    isDragging = true;
    mouse = pos; // agora sim, mira muda
  }
}

function onPointerMove(e){
  const pos = e.touches
    ? toCanvasCoords(e.touches[0].clientX,e.touches[0].clientY)
    : toCanvasCoords(e.clientX,e.clientY);

  if(isAdjustingPower){
    onPowerMove(pos);
    return; // não mexe na mira enquanto ajusta força
}

  if(!aiming) return;

  // mover a mira livremente (sem influenciar força)
  mouse = pos;
}

function onPointerUp(e){
  // se estava ajustando a barra, finalizar ajuste e atirar
  if(isAdjustingPower){
    onPowerEnd();
    return;
  }

  // se não era ajuste da barra, apenas soltar a mira (sem tacada)
  isDragging = false;
}

/* ---------- listeners ---------- */
canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", onPointerUp);
canvas.addEventListener("mouseleave", onPointerUp);

/* ---------- cores ---------- */
const railGold="#E0B000";
const railBlue="#0f4f7a";
const feltCenter="#2f77b3";
const feltEdge="#13354b";
const pocketColor="#0b0f12";
const woodColor="#caa87a";

/* ---------- game loop ---------- */

function gameLoop(){
  updatePhysics();
  checkAllBallsStoppedAndReactivate();

  cueRecoil += (cueRecoilTarget - cueRecoil) * 0.25;
  cueRecoilTarget *= 0.94;

  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
