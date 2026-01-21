const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");

// Canvasをlotの上に追加
const canvas = document.createElement("canvas");
canvas.id = "path-canvas";
canvas.style.position = "absolute";
canvas.style.top = "0";
canvas.style.left = "0";
canvas.style.width = "100%";
canvas.style.height = "100%";
canvas.style.pointerEvents = "none"; // Canvas上でクリックできないように
lot.appendChild(canvas);
const ctx = canvas.getContext("2d");

// ユーザーマーカーと矢印
const userMarker = document.createElement("div");
userMarker.id = "user-marker";
lot.appendChild(userMarker);
const headingArrow = document.createElement("div");
headingArrow.id = "heading-arrow";
lot.appendChild(headingArrow);

// ===== 設定 =====
const rowCount = 9;
const colCount = 6;
const colWidth = 70;
const rowHeight = 50;
let offsetX, offsetY;
const moveStep = 5;

// ===== Canvasサイズ同期 =====
function resizeCanvas() {
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  offsetX = (rect.width - colWidth * colCount) / 2;
  offsetY = (rect.height - rowHeight * rowCount) / 2;
  if (!user.x && !user.y) {
    user.x = rect.width / 2;
    user.y = rect.height - 30; // 下中央入口
  }
  // ロッド座標も更新
  rods.forEach(r => {
    r.canvasX = offsetX + r.col * colWidth + colWidth / 2;
    r.canvasY = offsetY + r.row * rowHeight + rowHeight / 2;
    r.element.style.left = (r.canvasX - colWidth / 2) + "px";
    r.element.style.top = (r.canvasY - rowHeight / 2) + "px";
  });
}
window.addEventListener("resize", resizeCanvas);

// ===== ユーザー =====
let user = { x: 0, y: 0 };

// ===== ロッド =====
const rods = [];
function initRods() {
  // 1列目(A)、2列目(B)、3列目(C)、4列目(D)
  for (let r = 0; r < rowCount; r++) {
    rods.push({ id: `A${r + 1}`, col: 0, row: r, status: 0 });
    rods.push({ id: `B${r + 1}`, col: 2, row: r, status: 0 });
    rods.push({ id: `C${r + 1}`, col: 3, row: r, status: 0 });
    rods.push({ id: `D${r + 1}`, col: 5, row: r, status: 0 });
  }
  rods.forEach(r => {
    const d = document.createElement("div");
    d.className = "rod " + (r.status === 0 ? "empty" : "full");
    d.style.width = colWidth + "px";
    d.style.height = rowHeight + "px";
    lot.appendChild(d);
    r.element = d;
    d.onclick = () => {
      r.status = r.status === 0 ? 1 : 0;
      d.className = "rod " + (r.status === 0 ? "empty" : "full");
      currentPath = []; // ロッド変更時に再計算
    };
  });
}

// ===== 通路ノード =====
const nodes = [];
for (let r = 0; r < rowCount; r++) {
  for (let c = 0; c < colCount; c++) {
    if ([0, 2, 3, 5].includes(c)) continue; // ロッド列は避ける
    nodes.push({
      row: r,
      col: c,
      x: offsetX + c * colWidth + colWidth / 2,
      y: offsetY + r * rowHeight + rowHeight / 2,
      neighbors: []
    });
  }
}
// 隣接ノード
nodes.forEach(n => {
  n.neighbors = nodes.filter(o => Math.abs(o.row - n.row) + Math.abs(o.col - n.col) === 1);
});

// ===== A* =====
function heuristic(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}
function astar(start, goal) {
  const openSet = [start], came = new Map(), g = new Map(), f = new Map();
  g.set(start, 0); f.set(start, heuristic(start, goal));
  while (openSet.length) {
    openSet.sort((a, b) => (f.get(a) || 1e6) - (f.get(b) || 1e6));
    const current = openSet.shift();
    if (current === goal) {
      const path = [];
      let c = current;
      while (c) { path.unshift(c); c = came.get(c); }
      return path;
    }
    current.neighbors.forEach(n => {
      const tentative = (g.get(current) || 1e6) + 1;
      if (tentative < (g.get(n) || 1e6)) {
        came.set(n, current);
        g.set(n, tentative);
        f.set(n, tentative + heuristic(n, goal));
        if (!openSet.includes(n)) openSet.push(n);
      }
    });
  }
  return [];
}

// ===== 最寄り空きロッドノード =====
function nearestRodNode() {
  const emptyRods = rods.filter(r => r.status === 0);
  if (!emptyRods.length) return null;
  let nearest = emptyRods[0];
  let minDist = Math.hypot(user.x - nearest.canvasX, user.y - nearest.canvasY);
  emptyRods.forEach(r => {
    const d = Math.hypot(user.x - r.canvasX, user.y - r.canvasY);
    if (d < minDist) { nearest = r; minDist = d; }
  });
  // 最も近いノードに接続
  const goalNode = nodes.reduce((prev, curr) =>
    Math.hypot(curr.x - nearest.canvasX, curr.y - nearest.canvasY) <
    Math.hypot(prev.x - nearest.canvasX, prev.y - nearest.canvasY) ? curr : prev
  , nodes[0]);
  return goalNode;
}

// ===== 経路描画 =====
let currentPath = [];
function drawPath(path) {
  if (!path.length) return;
  ctx.strokeStyle = "blue";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(user.x, user.y);
  path.forEach(n => ctx.lineTo(n.x, n.y));
  ctx.stroke();
}

// ===== 赤矢印更新 =====
function updateArrow() {
  if (currentPath.length > 0) {
    const next = currentPath[0];
    const dx = next.x - user.x;
    const dy = next.y - user.y;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    headingArrow.style.left = user.x + "px";
    headingArrow.style.top = user.y + "px";
    headingArrow.style.transform = `translate(-50%,-100%) rotate(${angle}deg)`;
  }
  userMarker.style.left = user.x + "px";
  userMarker.style.top = user.y + "px";
}

// ===== 移動 =====
function moveUp() { user.y -= moveStep; currentPath = []; }
function moveDown() { user.y += moveStep; currentPath = []; }
function moveLeft() { user.x -= moveStep; currentPath = []; }
function moveRight() { user.x += moveStep; currentPath = []; }

document.getElementById("up").onclick = moveUp;
document.getElementById("down").onclick = moveDown;
document.getElementById("left").onclick = moveLeft;
document.getElementById("right").onclick = moveRight;
window.addEventListener("keydown", e => {
  switch (e.key) {
    case "ArrowUp": moveUp(); break;
    case "ArrowDown": moveDown(); break;
    case "ArrowLeft": moveLeft(); break;
    case "ArrowRight": moveRight(); break;
  }
});

// ===== メインループ =====
function mainLoop() {
  resizeCanvas(); // ウィンドウサイズ対応
  const startNode = nodes.reduce((prev, curr) =>
    Math.hypot(curr.x - user.x, curr.y - user.y) < Math.hypot(prev.x - user.x, prev.y - user.y) ? curr : prev
  , nodes[0]);
  const goalNode = nearestRodNode();
  if (goalNode) currentPath = astar(startNode, goalNode);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPath(currentPath);
  updateArrow();
  requestAnimationFrame(mainLoop);
}

initRods();
resizeCanvas();
mainLoop();