const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const zoomSlider = document.getElementById("zoom-slider");
const socket = io();

let zoom = 1;
let rods = [];
let selectedRod = null;

function createRod(id, x=100, y=100, w=80, h=50, angle=0, status=0){
  const rod = {id,x,y,w,h,angle,status};
  rods.push(rod);

  const d = document.createElement("div");
  d.className = "rod "+(status? "full":"empty");
  d.innerHTML = id;
  lot.appendChild(d);
  rod.el = d;

  const resize = document.createElement("div");
  resize.className="resize-handle";
  d.appendChild(resize);

  const rotate = document.createElement("div");
  rotate.className="rotate-handle";
  d.appendChild(rotate);

  function update(){
    d.style.width = rod.w+"px";
    d.style.height = rod.h+"px";
    d.style.left = rod.x+"px";
    d.style.top = rod.y+"px";
    d.style.transform = `rotate(${rod.angle}deg)`;
  }
  update();

  // 選択
  d.onclick = (e)=>{
    selectedRod = rod;
    rods.forEach(r=>r.el.classList.remove("selected"));
    d.classList.add("selected");
    e.stopPropagation();
  }

  // 移動
  d.onmousedown = (e)=>{
    if(e.target===resize||e.target===rotate) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = rod.x;
    const origY = rod.y;
    function move(ev){
      rod.x = origX + (ev.clientX-startX)/zoom;
      rod.y = origY + (ev.clientY-startY)/zoom;
      update();
    }
    function up(){ document.removeEventListener("mousemove",move); document.removeEventListener("mouseup",up); }
    document.addEventListener("mousemove",move);
    document.addEventListener("mouseup",up);
  };

  // サイズ変更
  resize.onmousedown = (e)=>{
    e.stopPropagation(); e.preventDefault();
    const startX=e.clientX, startY=e.clientY;
    const origW=rod.w, origH=rod.h;
    function move(ev){
      rod.w = Math.max(20, origW+(ev.clientX-startX)/zoom);
      rod.h = Math.max(10, origH+(ev.clientY-startY)/zoom);
      update();
    }
    function up(){ document.removeEventListener("mousemove",move); document.removeEventListener("mouseup",up);}
    document.addEventListener("mousemove",move);
    document.addEventListener("mouseup",up);
  };

  // 回転
  rotate.onmousedown = (e)=>{
    e.stopPropagation(); e.preventDefault();
    const centerX = rod.x+rod.w/2;
    const centerY = rod.y+rod.h/2;
    function move(ev){
      const dx = ev.clientX - centerX;
      const dy = ev.clientY - centerY;
      rod.angle = Math.atan2(dy,dx)*180/Math.PI;
      update();
    }
    function up(){ document.removeEventListener("mousemove",move); document.removeEventListener("mouseup",up);}
    document.addEventListener("mousemove",move);
    document.addEventListener("mouseup",up);
  };

  // ダブルクリックで状態変更
  d.ondblclick = ()=>{
    rod.status = rod.status?0:1;
    d.className="rod "+(rod.status? "full":"empty");
  }

  return rod;
}

// 初期ロッド
createRod("A1",100,100);
createRod("B1",300,100);

zoomSlider.addEventListener("input",()=>{
  zoom = parseFloat(zoomSlider.value);
  lot.style.transform = `scale(${zoom})`;
});

// パン
let isPanning=false, panStartX=0, panStartY=0, origScrollLeft=0, origScrollTop=0;
container.addEventListener("mousedown",(e)=>{
  if(!e.shiftKey) return;
  isPanning=true; panStartX=e.clientX; panStartY=e.clientY;
  origScrollLeft=container.scrollLeft; origScrollTop=container.scrollTop;
});
document.addEventListener("mousemove",(e)=>{
  if(!isPanning) return;
  container.scrollLeft = origScrollLeft-(e.clientX-panStartX);
  container.scrollTop  = origScrollTop-(e.clientY-panStartY);
});
document.addEventListener("mouseup",(e)=>{ isPanning=false; });

// 背景クリックで選択解除
lot.addEventListener("click",()=>{ selectedRod=null; rods.forEach(r=>r.el.classList.remove("selected")); });

// Deleteキーで削除
document.addEventListener("keydown",(e)=>{
  if(e.key==="Delete" && selectedRod){
    lot.removeChild(selectedRod.el);
    rods = rods.filter(r=>r!==selectedRod);
    selectedRod=null;
  }
});

// 保存
document.getElementById("save-layout").onclick = async ()=>{
  const saveData = rods.map(r=>({id:r.id,x:r.x,y:r.y,w:r.w,h:r.h,angle:r.angle,status:r.status}));
  const res = await fetch("/save_layout",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify(saveData)
  });
  if(res.ok) alert("保存しました");
  else alert("保存失敗");
};