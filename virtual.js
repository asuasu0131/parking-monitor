const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const userMarker = document.getElementById("user-marker");
const headingArrow = document.getElementById("heading-arrow");

// ===== 設定 =====
const rowCount = 9;
const colWidth = 70;    // ロッド幅（通路も同じ幅）
const rowHeight = 50;

// 列幅はすべて colWidth で統一
// 列順: 1列目 / 通路 / 2列目左 / 2列目右 / 通路 / 4列目
const colX = [
  0,                 // 1列目
  colWidth,           // 通路
  colWidth*2,         // 2列目左
  colWidth*3,         // 2列目右
  colWidth*4,         // 通路
  colWidth*5          // 4列目
];

// ===== ロッド配置 =====
const rods = [];
for (let r=0; r<rowCount; r++){
  rods.push({id:`A${r+1}`, x: colX[0], y: r*rowHeight, status:0});
  rods.push({id:`B${r+1}`, x: colX[2], y: r*rowHeight, status:0});
  rods.push({id:`C${r+1}`, x: colX[3], y: r*rowHeight, status:0});
  rods.push({id:`D${r+1}`, x: colX[5], y: r*rowHeight, status:0});
}

// ===== 駐車場全体サイズ & 中央オフセット =====
const totalCols = colX.length; // 6列
const totalRows = rowCount;
const parkingWidth = colWidth * totalCols;
const parkingHeight = rowHeight * totalRows;
const offsetX = (container.clientWidth - parkingWidth) / 2;
const offsetY = (container.clientHeight - parkingHeight) / 2;

// ===== ユーザー初期位置（画面下中央） =====
let user = {x: container.clientWidth/2, y: container.clientHeight - 30};

// ===== ロッド描画 =====
function initRods() {
  rods.forEach(r => {
    const d = document.createElement("div");
    d.className = "rod " + (r.status===0 ? "empty" : "full");
    d.style.width = colWidth + "px";
    d.style.height = rowHeight + "px";
    d.style.left = (r.x + offsetX) + "px";
    d.style.top  = (r.y + offsetY) + "px";
    d.innerHTML = r.id;
    lot.appendChild(d);
    r.element = d;

    // クリックで空/満切替
    d.onclick = () => {
      r.status = r.status===0 ? 1 : 0;
      d.className = "rod " + (r.status===0 ? "empty" : "full");
    };
  });
}

// ===== 最寄り空きロッド取得 =====
function nearestRod() {
  const emptyRods = rods.filter(r => r.status===0);
  if (emptyRods.length===0) return null;

  let nearest = emptyRods[0];
  let minDist = Math.hypot(user.x - (nearest.x+offsetX), user.y - (nearest.y+offsetY));

  emptyRods.forEach(r => {
    const dist = Math.hypot(user.x - (r.x+offsetX), user.y - (r.y+offsetY));
    if (dist < minDist) {
      nearest = r;
      minDist = dist;
    }
  });

  return nearest;
}

// ===== 赤矢印更新 =====
function updateArrow() {
  const target = nearestRod();
  if (!target) return;

  const targetX = target.x + offsetX + colWidth/2;
  const targetY = target.y + offsetY + rowHeight/2;
  const dx = targetX - user.x;
  const dy = targetY - user.y;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  headingArrow.style.left = user.x + "px";
  headingArrow.style.top = user.y + "px";
  headingArrow.style.transform = `translate(-50%,-100%) rotate(${angle}deg)`;

  userMarker.style.left = user.x + "px";
  userMarker.style.top = user.y + "px";
}

// ===== 移動 =====
const moveStep = 5;
function moveUp() { user.y -= moveStep; }
function moveDown() { user.y += moveStep; }
function moveLeft() { user.x -= moveStep; }
function moveRight() { user.x += moveStep; }

// ===== ボタンイベント =====
document.getElementById("up").onclick = moveUp;
document.getElementById("down").onclick = moveDown;
document.getElementById("left").onclick = moveLeft;
document.getElementById("right").onclick = moveRight;

// ===== キーボード矢印キーも有効 =====
window.addEventListener("keydown", e => {
  switch(e.key){
    case "ArrowUp": moveUp(); break;
    case "ArrowDown": moveDown(); break;
    case "ArrowLeft": moveLeft(); break;
    case "ArrowRight": moveRight(); break;
  }
});

// ===== メインループ =====
initRods();
(function loop(){
  updateArrow();
  requestAnimationFrame(loop);
})();