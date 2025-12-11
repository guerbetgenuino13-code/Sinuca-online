/* game.js — Atualizado: adiciona 15 bolas (triângulo completo) com números
   Mantém: mesa, pockets, mira, tacada, física básica, colisões elásticas.
*/

console.log("game.js (15 bolas) carregado");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

// Mesa interna (com margem para bandas)
const table = {
  x: 40,
  y: 40,
  width: W - 80,
  height: H - 80,
  pocketRadius: 22,
  color: "#0f8f32",
  railColor: "#2b5a2f"
};

// Pockets: 6 (4 cantos + 2 meio-banda)
const pockets = [
  {x: table.x, y: table.y},
  {x: table.x + table.width/2, y: table.y - 8},
  {x: table.x + table.width, y: table.y},
  {x: table.x, y: table.y + table.height},
  {x: table.x + table.width/2, y: table.y + table.height + 8},
  {x: table.x + table.width, y: table.y + table.height}
];

// Bola template
function createBall(x, y, radius=10, color="#fff", id=0, number=null){
  return {x, y, vx:0, vy:0, r: radius, color, id, mass: radius, number, pocketed:false};
}

// Array de bolas
const balls = [];

// branca (id 0)
balls.push(createBall(table.x + table.width*0.25, table.y + table.height/2, 10, "#ffffff", 0, 0));

// Cores e design aproximado das bolas 1..15
// Para simplicidade: usamos cor sólida para todas; desenhamos número central.
// Você pode ajustar cores abaixo se quiser bolas lisas/rajadas distintas.
const ballDefs = [
  {num:1,  color:"#FFD700"}, // amarelo (1)
  {num:2,  color:"#00008B"}, // azul escuro (2)
  {num:3,  color:"#FF4500"}, // vermelho (3)
  {num:4,  color:"#800080"}, // roxo (4)
  {num:5,  color:"#FF8C00"}, // laranja (5)
  {num:6,  color:"#8B4513"}, // marrom (6)
  {num:7,  color:"#006400"}, // verde escuro (7)
  {num:8,  color:"#000000"}, // preta (8)
  {num:9,  color:"#FFFF99"}, // 9 (amarelo claro / stripe)
  {num:10, color:"#ADD8E6"}, // 10 (azul claro / stripe)
  {num:11, color:"#FFA07A"}, // 11 (salmon / stripe)
  {num:12, color:"#DDA0DD"}, // 12 (plum / stripe)
  {num:13, color:"#FFDAB9"}, // 13 (peach / stripe)
  {num:14, color:"#A52A2A"}, // 14 (brown-ish / stripe)
  {num:15, color:"#90EE90"}  // 15 (light green / stripe)
];

// Geração do triângulo de 15 bolas (linhas 5,4,3,2,1)
const r = 10;                 // raio bola
const spacing = r*2 + 2;      // distância entre centros
const startX = table.x + table.width*0.65;  // posição do "ponta" do tri (aprox)
const startY = table.y + table.height/2;

let idCounter = 1; // já usamos id 0 pra branca
let idx = 0;

for(let row = 0; row < 5; row++){
  // cada row tem (5 - row) ou, mais fácil: construir com 5 rows: rowSize = row+1? (vamos fazer 5,4,3,2,1)
  // vamos construir invertido: rowsSizes = [5,4,3,2,1]
  const rowsSizes = [5,4,3,2,1];
  const rowSize = rowsSizes[row];
  // x offset depende da row (avança para direita conforme row aumenta)
  const x = startX + row * (spacing * 0.87); // 0.87 aproxima o acomodo triangular
  // centramos verticalmente: para cada coluna calcular y com deslocamento para centralizar o tri
  const totalHeight = (rowSize - 1) * spacing;
  for(let col = 0; col < rowSize; col++){
    const y = startY - totalHeight/2 + col * spacing;
    const def = ballDefs[idx % ballDefs.length];
    balls.push(createBall(x, y, r, def.color, ++idCounter, def.num));
    idx++;
    if(idx >= 15) break;
  }
  if(idx >= 15) break;
}

// Física
const friction = 0.992;     // taxa de redução por frame

// Controle de mira
let aiming = false;
let mouse = {x:0,y:0};

// Utilidades
function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

// Atualiza físicas simples
function updatePhysics(){
  // mover bolas
  for(let b of balls){
    if(b.pocketed) continue;
    b.x += b.vx;
    b.y += b.vy;

    // aplicar atrito
    b.vx *= friction;
    b.vy *= friction;

    // parar se muito lento
    if(Math.abs(b.vx) < 0.01) b.vx = 0;
    if(Math.abs(b.vy) < 0.01) b.vy = 0;

    // colisão com rails (paredes internas)
    const left = table.x + b.r;
    const right = table.x + table.width - b.r;
    const top = table.y + b.r;
    const bottom = table.y + table.height - b.r;

    if(b.x < left){ b.x = left; b.vx *= -1; }
    if(b.x > right){ b.x = right; b.vx *= -1; }
    if(b.y < top){ b.y = top; b.vy *= -1; }
    if(b.y > bottom){ b.y = bottom; b.vy *= -1; }

    // pockets check
    for(const p of pockets){
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if(d < table.pocketRadius){
        b.vx = 0;
        b.vy = 0;
        b.pocketed = true;
        b.x = -1000;
        b.y = -1000;
      }
    }
  }

  // colisões bola-bola (pairwise)
  for(let i=0;i<balls.length;i++){
    for(let j=i+1;j<balls.length;j++){
      const A = balls[i];
      const B = balls[j];
      if(A.pocketed || B.pocketed) continue;

      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const distAB = Math.hypot(dx,dy);
      const minDist = A.r + B.r;
      if(distAB > 0 && distAB < minDist){
        // push them apart (positional correction)
        const overlap = (minDist - distAB) / 2;
        const nx = dx / distAB;
        const ny = dy / distAB;
        A.x -= nx * overlap;
        A.y -= ny * overlap;
        B.x += nx * overlap;
        B.y += ny * overlap;

        // resolve velocities (elastic collision 2D)
        const tx = -ny; // tangent
        const ty = nx;

        // components along normal and tangent
        const vAn = A.vx * nx + A.vy * ny;
        const vAt = A.vx * tx + A.vy * ty;
        const vBn = B.vx * nx + B.vy * ny;
        const vBt = B.vx * tx + B.vy * ty;

        // conservation of momentum for normal component (elastic)
        const m1 = A.mass;
        const m2 = B.mass;
        const vAnAfter = (vAn*(m1 - m2) + 2*m2*vBn) / (m1 + m2);
        const vBnAfter = (vBn*(m2 - m1) + 2*m1*vAn) / (m1 + m2);

        // convert scalars back to vectors
        A.vx = vAnAfter * nx + vAt * tx;
        A.vy = vAnAfter * ny + vAt * ty;
        B.vx = vBnAfter * nx + vBt * tx;
        B.vy = vBnAfter * ny + vBt * ty;
      }
    }
  }
}

// Desenho mesa, pockets e bolas (com número)
function draw(){
  // fundo
  ctx.clearRect(0,0,W,H);

  // rail (borda escura)
  ctx.fillStyle = table.railColor;
  ctx.fillRect(table.x - 24, table.y - 24, table.width + 48, table.height + 48);

  // mesa verde
  ctx.fillStyle = table.color;
  ctx.fillRect(table.x, table.y, table.width, table.height);

  // pockets
  for(const p of pockets){
    ctx.beginPath();
    ctx.fillStyle = "#0b0b0b";
    ctx.arc(p.x, p.y, table.pocketRadius, 0, Math.PI*2);
    ctx.fill();
  }

  // bolas
  for(const b of balls){
    if(b.pocketed) continue;

    // sombra
    ctx.beginPath();
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.ellipse(b.x + 3, b.y + 5, b.r * 0.9, b.r * 0.5, 0, 0, Math.PI*2);
    ctx.fill();

    // bola (cor)
    ctx.beginPath();
    ctx.fillStyle = b.color;
    ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.fill();

    // borda
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // número da bola (se >0)
    if(b.number && b.number > 0){
      ctx.fillStyle = (b.color === "#000000") ? "#fff" : "#fff";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.number.toString(), b.x, b.y);
    } else if(b.number === 0){
      // branca: desenha pequeno contorno
      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = 1;
      ctx.arc(b.x, b.y, b.r-1.4, 0, Math.PI*2);
      ctx.stroke();
    }
  }

  // HUD simples: bolas restantes
  const remaining = balls.filter(b => b.number > 0 && !b.pocketed).length;
  ctx.fillStyle = "#fff";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Bolas restantes: " + remaining, 16, H - 14);

  // se aiming, desenhar linha de mira
  if(aiming){
    const white = balls[0];
    ctx.beginPath();
    ctx.moveTo(white.x, white.y);
    ctx.lineTo(mouse.x, mouse.y);
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6,6]);
    ctx.stroke();
    ctx.setLineDash([]);

    const dx = white.x - mouse.x;
    const dy = white.y - mouse.y;
    const power = clamp(Math.hypot(dx,dy) / 6, 0, 30);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "12px sans-serif";
    ctx.fillText("Força: " + Math.round(power), white.x + 12, white.y - 12);
  }
}

// Input (mouse/touch)
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
  // só começar mira se clicar perto da branca
  if(d <= white.r + 40){
    aiming = true;
  }
  mouse = p;
});

canvas.addEventListener("mousemove", (e) => {
  mouse = getCanvasPos(e);
});

canvas.addEventListener("mouseup", (e) => {
  if(!aiming) return;
  const p = getCanvasPos(e);
  const white = balls[0];
  // vetor de tacada: da mira para a bola
  const dx = white.x - p.x;
  const dy = white.y - p.y;
  const distVec = Math.hypot(dx,dy);
  const force = clamp(distVec / 6, 0, 30); // escala
  // aplica velocidade instantânea
  const angle = Math.atan2(dy, dx);
  const impulse = force * 0.9; // ajuste fino
  white.vx += Math.cos(angle) * impulse;
  white.vy += Math.sin(angle) * impulse;
  aiming = false;
});

canvas.addEventListener("mouseleave", () => { aiming = false; });
canvas.addEventListener("touchstart", (e)=>{ e.preventDefault(); canvas.dispatchEvent(new MouseEvent('mousedown', {clientX: e.touches[0].clientX, clientY: e.touches[0].clientY})); }, {passive:false});
canvas.addEventListener("touchmove", (e)=>{ e.preventDefault(); mouse = getCanvasPos(e); }, {passive:false});
canvas.addEventListener("touchend", (e)=>{ e.preventDefault(); canvas.dispatchEvent(new MouseEvent('mouseup')); }, {passive:false});

// Loop
function loop(){
  updatePhysics();
  draw();
  requestAnimationFrame(loop);
}

loop();