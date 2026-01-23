const canvas = document.getElementById("parking-canvas");
const ctx = canvas.getContext("2d");
const zoomSlider = document.getElementById("zoom-slider");

let canvasWidth, canvasHeight;
function resizeCanvas(){
  canvasWidth = canvas.clientWidth;
  canvasHeight = canvas.clientHeight;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const socket = io();

// 仮想駐車場サイズ（メートル）
const LOT_WIDTH = 300;
const LOT_HEIGHT = 200;

// カメラ（表示中心座標 + ズーム）
let camera = { x: LOT_WIDTH/2, y: LOT_HEIGHT/2, zoom: 1 };

// 仮想座標のロッド
let rods = [
  { id:"A1", x:45, y:30, status:0 },
  { id:"A2", x:45, y:90, status:1 },
  { id:"A3", x:45, y:150, status:0 },
  { id:"B1", x:165, y:30, status:0 },
  { id:"B2", x:165, y:90, status:1 },
  { id:"B3", x:165, y:150, status:0 }
];

// 選択中のロッド
let selectedRod = null;
let offset = {x:0, y:0};

// 仮想座標 → 画面px
function toScreen(vx, vy){
  return {
    x: (vx - camera.x) * camera.zoom + canvasWidth/2,
    y: (vy - camera.y) * camera.zoom + canvasHeight/2
  };
}

// 画面px → 仮想座標
function toVirtual(px, py){
  return {
    x: (px - canvasWidth/2)/camera.zoom + camera.x,
    y: (py - canvasHeight/2)/camera.zoom + camera.y
  };
}

// 描画
function draw(){
  ctx.clearRect(0,0,canvasWidth,canvasHeight);

  // 背景
  ctx.fillStyle = "#bfbfbf";
  ctx.fillRect(0,0,canvasWidth,canvasHeight);

  // ロッド描画
  rods.forEach(r=>{
    const {x,y} = toScreen(r.x,r.y);
    const size = 5 * camera.zoom; // 点として小さく表示
    ctx.fillStyle = r.status===0?"#4caf50":"#f44336";
    ctx.fillRect(x-size/2, y-size/2, size, size);
  });
}

// ドラッグ操作
canvas.onmousedown = (e)=>{
  const mouse = toVirtual(e.offsetX,e.offsetY);
  // 近いロッドを探す
  for(let r of rods){
    if(Math.abs(r.x - mouse.x)<2 && Math.abs(r.y - mouse.y)<2){
      selectedRod = r;
      offset.x = mouse.x - r.x;
      offset.y = mouse.y - r.y;
      break;
    }
  }
};

canvas.onmousemove = (e)=>{
  if(selectedRod){
    const mouse = toVirtual(e.offsetX,e.offsetY);
    selectedRod.x = mouse.x - offset.x;
    selectedRod.y = mouse.y - offset.y;
  }
};

canvas.onmouseup = ()=>{ selectedRod = null; };
canvas.onmouseleave = ()=>{ selectedRod = null; };

// ズーム
zoomSlider.addEventListener("input", ()=>{
  camera.zoom = parseFloat(zoomSlider.value);
});

// 保存
document.getElementById("save-layout").onclick = async ()=>{
  const res = await fetch("/save_layout",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify(rods)
  });
  if(res.ok) alert("保存しました");
  socket.emit("layout_updated");
};

// 追加
document.getElementById("add-rod").onclick = ()=>{
  rods.push({id:"R"+(rods.length+1), x:LOT_WIDTH/2, y:LOT_HEIGHT/2, status:0});
};

(function loop(){
  draw();
  requestAnimationFrame(loop);
})();