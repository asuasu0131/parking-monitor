const canvas = document.getElementById("lotCanvas");
const ctx = canvas.getContext("2d");
const socket = io();

let rods = []; // {id,x,y,width,height,status}
const LOT_WIDTH = 200;  // m
const LOT_HEIGHT = 100; // m

// Canvasサイズに応じて変換
function resizeCanvas(){
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// カメラ
let camera = { x: LOT_WIDTH/2, y: LOT_HEIGHT/2, zoom: 4 };
let isPanning = false, panStart = {x:0,y:0};

// マウス操作
canvas.onmousedown = (e)=>{
  if(e.button===2 || e.shiftKey){ // 右クリック or shift+左クリックでパン
    isPanning = true;
    panStart.x = e.clientX;
    panStart.y = e.clientY;
  } else {
    // ロッド移動判定
    const mx = (e.offsetX - canvas.width/2)/camera.zoom + camera.x;
    const my = (e.offsetY - canvas.height/2)/camera.zoom + camera.y;
    for(let r of rods){
      if(mx>=r.x && mx<=r.x+r.width && my>=r.y && my<=r.y+r.height){
        selectedRod = r;
        dragOffset = {x: mx - r.x, y: my - r.y};
        break;
      }
    }
  }
};
let selectedRod=null, dragOffset={x:0,y:0};
canvas.onmousemove = (e)=>{
  if(isPanning){
    const dx = (panStart.x - e.clientX)/camera.zoom;
    const dy = (panStart.y - e.clientY)/camera.zoom;
    camera.x += dx; camera.y += dy;
    panStart.x = e.clientX; panStart.y = e.clientY;
  }
  if(selectedRod){
    const mx = (e.offsetX - canvas.width/2)/camera.zoom + camera.x;
    const my = (e.offsetY - canvas.height/2)/camera.zoom + camera.y;
    selectedRod.x = mx - dragOffset.x;
    selectedRod.y = my - dragOffset.y;
  }
};
canvas.onmouseup = ()=>{ isPanning=false; selectedRod=null; };
canvas.onmouseleave = ()=>{ isPanning=false; selectedRod=null; };

// ホイールでズーム
canvas.onwheel = (e)=>{
  e.preventDefault();
  const factor = 1.1;
  if(e.deltaY < 0) camera.zoom *= factor;
  else camera.zoom /= factor;
};

// 描画
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // 背景
  ctx.fillStyle="#bfbfbf";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // ロッド描画
  for(let r of rods){
    const sx = (r.x - camera.x)*camera.zoom + canvas.width/2;
    const sy = (r.y - camera.y)*camera.zoom + canvas.height/2;
    const sw = r.width*camera.zoom;
    const sh = r.height*camera.zoom;
    ctx.fillStyle = r.status===0?"#4caf50":"#f44336";
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle="#fff";
    ctx.font = `${Math.max(8, sw/3)}px sans-serif`;
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(r.id, sx+sw/2, sy+sh/2);
  }

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

// ロッド追加
document.getElementById("add-rod").onclick = ()=>{
  rods.push({id:"R"+(rods.length+1), x:50, y:50, width:4, height:2, status:0});
};

// 保存
document.getElementById("save-layout").onclick = async ()=>{
  const res = await fetch("/save_layout", {
    method:"POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(rods)
  });
  if(res.ok) alert("保存しました");
  else alert("保存失敗");
};