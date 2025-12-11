/* ---------- canvas ---------- */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

/* ---------- mesa params ---------- */
const railOuter = 28;
const railInner = 12;
const pocketRadius = 26;

/* ---------- cue recoil / animação ---------- */
let cueRecoil = 0;
let cueRecoilTarget = 0;
let simulationRunning = false;

/* ---------- aiming / força / futuros controles ---------- */
let aimPoint = { x: 0, y: 0 };
let power = 0;

/* área futura do taco lateral */
let draggingCue = false;
let startY = 0;
const cueArea = { x: W - 120, y: 0, width: 120, height: H };

/* ---------- mesa ---------- */
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

/* ---------- pockets ---------- */
const pockets = [
  {x: table.x, y: table.y},
  {x: table.x + table.width/2, y: table.y - 6},
  {x: table.x + table.width, y: table.y},
  {x: table.x, y: table.y + table.height},
  {x: table.x + table.width/2, y: table.y + table.height + 6},
  {x: table.x + table.width, y: table.y + table.height}
];

const PR = pocketRadius;
const inwardOffset = -10;

const mouthPositions = pockets.map(p => {
  let dx = cx - p.x;
  let dy = cy - p.y;
  let L = Math.hypot(dx,dy) || 1;
  dx /= L; dy /= L;

  const mouthX = p.x + dx * inwardOffset;
  const mouthY = p.y + dy * inwardOffset;

  return { px: p.x, py: p.y, mouthX, mouthY, dirX: dx, dirY: dy };
});

/* ---------- bolas ---------- */
function createBall(x,y,r=11,color="#fff",id=0,number=null){
  return {x,y,vx:0,vy:0,r,color,id,mass:r,number,pocketed:false};
}

const balls = [];
balls.push(createBall(table.x + table.width * 0.22, table.y + table.height/2, 11, "#fff", 0, 0));

/* rack inicial */
const ballDefs = [
  {num:1,color:"#FFD200"},{num:2,color:"#0E6FFF"},{num:3,color:"#E53935"},
  {num:4,color:"#8E3AC1"},{num:5,color:"#FF7F00"},{num:6,color:"#8B4A2F"},
  {num:7,color:"#1E8A3A"},{num:8,color:"#000"},{num:9,color:"#FFD200"},
  {num:10,color:"#0E6FFF"},{num:11,color:"#FF6B6B"},{num:12,color:"#B57EDC"},
  {num:13,color:"#FFC58A"},{num:14,color:"#8B4A2F"},{num:15,color:"#66C175"}
];

let idCounter = 1;
let idx = 0;
const startX = table.x + table.width*0.66;
const startY = table.y + table.height/2;
const spacing = 22;

for(let row=0; row<5; row++){
  let rowSizes=[5,4,3,2,1];
  let rowSize=rowSizes[row];
  let x=startX + row*(spacing*0.88);
  let totalH=(rowSize-1)*spacing;
  for(let col=0; col<rowSize; col++){
    let y=startY - totalH/2 + col*spacing;
    let def=ballDefs[idx%ballDefs.length];
    balls.push(createBall(x,y,11,def.color,++idCounter,def.num));
    idx++;
  }
}

/* ---------- física ---------- */
const friction = 0.992;
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));

function areBallsStopped(){
  for(const b of balls){
    if(Math.hypot(b.vx,b.vy) > 0.03) return false;
  }
  return true;
}

function checkAllBallsStoppedAndReactivate(){
  if(!simulationRunning) return;
  if(areBallsStopped()){
    simulationRunning = false;
  }
}

function updatePhysics(){
  for(const b of balls){
    if(b.pocketed) continue;

    b.x += b.vx;
    b.y += b.vy;

    b.vx *= friction;
    b.vy *= friction;

    if(Math.abs(b.vx)<0.01) b.vx=0;
    if(Math.abs(b.vy)<0.01) b.vy=0;

    const left = table.x + b.r;
    const right = table.x + table.width - b.r;
    const top = table.y + b.r;
    const bottom = table.y + table.height - b.r;

    if(b.x < left){ b.x=left; b.vx*=-1; }
    if(b.x > right){ b.x=right; b.vx*=-1; }
    if(b.y < top){ b.y=top; b.vy*=-1; }
    if(b.y > bottom){ b.y=bottom; b.vy*=-1; }

    for(const m of mouthPositions){
      const innerR = pocketRadius + b.r*0.4;
      const d = Math.hypot(b.x - m.mouthX, b.y - m.mouthY);
      if(d < innerR){
        b.pocketed = true;
        b.x = -999;
        b.y = -999;
      }
    }
  }

  /* colisões bola-bola */
  for(let i=0;i<balls.length;i++){
    for(let j=i+1;j<balls.length;j++){
      let A=balls[i], B=balls[j];
      if(A.pocketed||B.pocketed) continue;

      let dx=B.x-A.x, dy=B.y-A.y;
      let d=Math.hypot(dx,dy);
      let minD=A.r+B.r;

      if(d>0 && d<minD){
        let overlap=(minD-d)/2;
        let nx=dx/d, ny=dy/d;
        A.x-=nx*overlap; A.y-=ny*overlap;
        B.x+=nx*overlap; B.y+=ny*overlap;

        let tx=-ny, ty=nx;
        let vAn=A.vx*nx + A.vy*ny;
        let vAt=A.vx*tx + A.vy*ty;
        let vBn=B.vx*nx + B.vy*ny;
        let vBt=B.vx*tx + B.vy*ty;

        let m1=A.mass, m2=B.mass;
        let vAn2 = (vAn*(m1-m2)+2*m2*vBn)/(m1+m2);
        let vBn2 = (vBn*(m2-m1)+2*m1*vAn)/(m1+m2);

        A.vx = vAn2*nx + vAt*tx;
        A.vy = vAn2*ny + vAt*ty;
        B.vx = vBn2*nx + vBt*tx;
        B.vy = vBn2*ny + vBt*ty;
      }
    }
  }
}

/* ---------- APLICAR TACADA (novo sistema) ---------- */
function applyShotUsingPower(forceValue){
  const white = balls[0];
  if(!white) return;

  const dx = aimPoint.x - white.x;
  const dy = aimPoint.y - white.y;

  const ang = Math.atan2(dy, dx);

  const impulse = forceValue * 0.32;

  white.vx += Math.cos(ang) * impulse;
  white.vy += Math.sin(ang) * impulse;

  simulationRunning = true;

  cueRecoilTarget = Math.min(40, Math.round(forceValue * 3));
}

/* ---------- desenho ---------- */

function drawTable(){ /* ... igual ao anterior ... */ }
function drawPolishedBall(b){ /* ... igual ao anterior ... */ }
function drawPocketByMouth(m){ /* ... igual ao anterior ... */ }
function drawCueStick(){ /* taco atrás da bola, igual ao anterior */ }

/* ---------- input ---------- */
function getCanvasPos(e){
  const r = canvas.getBoundingClientRect();
  let cx = (e.touches? e.touches[0].clientX : e.clientX);
  let cy = (e.touches? e.touches[0].clientY : e.clientY);
  return {
    x: (cx - r.left) * (canvas.width / r.width),
    y: (cy - r.top) * (canvas.height / r.height)
  };
}

/* --------- NOVO sistema de clique para mira --------- */
canvas.addEventListener("mousedown", e=>{
  aimPoint = getCanvasPos(e);
});
canvas.addEventListener("mousemove", e=>{
  aimPoint = getCanvasPos(e);
});
canvas.addEventListener("mouseup", e=>{
  aimPoint = getCanvasPos(e);
  applyShotUsingPower(20); // força temporária
});
canvas.addEventListener("touchstart", e=>{
  e.preventDefault();
  aimPoint = getCanvasPos(e);
},{passive:false});
canvas.addEventListener("touchmove", e=>{
  e.preventDefault();
  aimPoint = getCanvasPos(e);
},{passive:false});
canvas.addEventListener("touchend", e=>{
  e.preventDefault();
  applyShotUsingPower(20);
},{passive:false});

/* ---------- loop ---------- */
function draw(){
  ctx.clearRect(0,0,W,H);

  drawTable();

  for(const m of mouthPositions) drawPocketByMouth(m);

  drawCueStick();

  for(const b of balls) drawPolishedBall(b);
}

function loop(){
  updatePhysics();
  checkAllBallsStoppedAndReactivate();
  cueRecoil += (cueRecoilTarget - cueRecoil)*0.25;
  draw();
  requestAnimationFrame(loop);
}
loop();