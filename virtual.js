const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const userMarker = document.getElementById("user-marker");
const headingArrow = document.getElementById("heading-arrow");

// ===== 仮ロッド配置（4列×9行） =====
const rods = [];
const rowCount = 9;
const colWidth = 70;
const rowHeight = 50;
const colGap = 40; // 通路幅

// 列配置: 1列 / 通路 / 2列 / 通路 / 1列
const colX = [
  0,                   // 1列目
  0,                   // 通路 placeholder
  colWidth + colGap,    // 2列目左
  colWidth*2 + colGap,  // 2列目右
  colWidth*2 + colGap + colGap, // 通路 placeholder
  colWidth*3 + colGap*2 + colWidth // 4列目
];

for (let r = 0; r < rowCount; r++) {
  rods.push({id:`A${r+1}`, x: colX[0], y: r*rowHeight, status:0});
  rods.push({id:`B${r+1}`, x: colX[2], y: r*rowHeight, status:0});
  rods.push({id:`C${r+1}`, x: colX[3], y: r*rowHeight, status:0});
  rods.push({id:`D${r+1}`, x: colX[5], y: r*rowHeight, status:0});
}

// ===== ユーザー初期位置（画面下中央） =====
let user = {x: container.clientWidth/2, y: container.clientHeight-30};

// ===== ロッド描画（初回のみ） =====
function initRods(){
  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className="rod "+(r.status===0?"empty":"full");
    d.style.left = r.x + "px";
    d.style.top = r.y + "px";
    d.innerHTML = r.id;
    lot.appendChild(d);
    r.element=d;
    d.onclick=()=>{
      r.status = r.status===0?1:0;
      d.className="rod "+(r.status===0?"empty":"full");
    };
  });
}

// ===== 最寄り空きロッド取得 =====
function nearestRod(){
  const emptyRods = rods.filter(r=>r.status===0);
  if(emptyRods.length===0) return null;
  let nearest = emptyRods[0];
  let minDist = Math.hypot(user.x - nearest.x, user.y - nearest.y);
  for(let r of emptyRods){
    const dist = Math.hypot(user.x - r.x, user.y - r.y);
    if(dist<minDist){
      nearest=r;
      minDist=dist;
    }
  }
  return nearest;
}

// ===== 赤矢印更新 =====
function updateArrow(){
  const target = nearestRod();
  if(!target) return;
  const dx = target.x - user.x;
  const dy = target.y - user.y;
  const angle = Math.atan2(dy, dx)*180/Math.PI;
  headingArrow.style.left = user.x+"px";
  headingArrow.style.top = user.y+"px";
  headingArrow.style.transform = `translate(-50%,-100%) rotate(${angle}deg)`;

  userMarker.style.left = user.x+"px";
  userMarker.style.top = user.y+"px";
}

// ===== 移動 =====
const moveStep = 5;
function moveUp(){ user.y -= moveStep; }
function moveDown(){ user.y += moveStep; }
function moveLeft(){ user.x -= moveStep; }
function moveRight(){ user.x += moveStep; }

document.getElementById("up").onclick = moveUp;
document.getElementById("down").onclick = moveDown;
document.getElementById("left").onclick = moveLeft;
document.getElementById("right").onclick = moveRight;

// キーボードも有効
window.addEventListener("keydown", e=>{
  switch(e.key){
    case "ArrowUp": moveUp(); break;
    case "ArrowDown": moveDown(); break;
    case "ArrowLeft": moveLeft(); break;
    case "ArrowRight": moveRight(); break;
  }
});

// ===== ループ =====
initRods();
(function loop(){
  updateArrow();
  requestAnimationFrame(loop);
})();