const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const userMarker = document.getElementById("user-marker");
const headingArrow = document.getElementById("heading-arrow");

// ===== 設定 =====
const rowCount = 9;
const colWidth = 70;   // ロッド幅
const rowHeight = 50;  // ロッド高さ
const colGap = 40;     // 通路幅

// 列のX座標を順番に計算（1列 / 通路 / 2列 / 通路 / 1列）
const x1 = 0;
const x2 = x1 + colWidth + colGap;      // 2列目左
const x3 = x2 + colWidth;              // 2列目右
const x4 = x3 + colGap;                // 4列目
const colX = [x1, x2, x3, x4];

// ===== 仮ロッド配置 =====
const rods = [];
for (let r = 0; r < rowCount; r++) {
  rods.push({id:`A${r+1}`, x: colX[0], y: r*rowHeight, status:0});
  rods.push({id:`B${r+1}`, x: colX[1], y: r*rowHeight, status:0});
  rods.push({id:`C${r+1}`, x: colX[2], y: r*rowHeight, status:0});
  rods.push({id:`D${r+1}`, x: colX[3], y: r*rowHeight, status:0});
}

// ===== ユーザー初期位置（画面下中央） =====
let user = {x: container.clientWidth/2, y: container.clientHeight - 30};

// ===== ロッド描画（初回のみ） =====
function initRods() {
  rods.forEach(r => {
    const d = document.createElement("div");
    d.className = "rod " + (r.status === 0 ? "empty" : "full");
    d.style.left = r.x + "px";
    d.style.top = r.y + "px";
    d.innerHTML = r.id;
    lot.appendChild(d);
    r.element = d;

    // クリックで空/満切替
    d.onclick = () => {
      r.status = r.status === 0 ? 1 : 0;
      d.className = "rod " + (r.status === 0 ? "empty" : "full");
    };
  });
}

// ===== 最寄り空きロッド取得 =====
function nearestRod() {
  const emptyRods = rods.filter(r => r.status === 0);
  if (emptyRods.length === 0) return null;

  let nearest = emptyRods[0];
  let minDist = Math.hypot(user.x - nearest.x, user.y - nearest.y);

  emptyRods.forEach(r => {
    const dist = Math.hypot(user.x - r.x, user.y - r.y);
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

  const dx = target.x - user.x;
  const dy = target.y - user.y;
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

// ボタンイベント
document.getElementById("up").onclick = moveUp;
document.getElementById("down").onclick = moveDown;
document.getElementById("left").onclick = moveLeft;
document.getElementById("right").onclick = moveRight;

// キーボード矢印キーも有効
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
(function loop() {
  updateArrow();
  requestAnimationFrame(loop);
})();