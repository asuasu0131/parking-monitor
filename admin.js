const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const addRodBtn = document.getElementById("add-rod");
const saveLayoutBtn = document.getElementById("save-layout");
const zoomSlider = document.getElementById("zoom-slider");

let rods = [];
let nodes = [];
let dragItem = null;
let offsetX=0, offsetY=0;

// ================= 初期ロッドサンプル =================
function initRods(){
  rods = [
    {id:"A1", x:100, y:80},
    {id:"A2", x:100, y:180},
    {id:"B1", x:300, y:80},
    {id:"B2", x:300, y:180}
  ];
  renderRods();
}

// ================= ロッドDOM作成 =================
function renderRods(){
  lot.innerHTML=""; // 一旦クリア
  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className="rod";
    d.style.left=r.x+"px";
    d.style.top=r.y+"px";
    d.textContent=r.id;
    lot.appendChild(d);
    r.el = d;

    // ドラッグ開始
    d.addEventListener("mousedown", e=>{
      dragItem = r;
      offsetX = e.offsetX;
      offsetY = e.offsetY;
    });
  });

  // ノードも同じように作れる（必要なら）
  nodes.forEach(n=>{
    const d = document.createElement("div");
    d.className="rod"; // 見た目は同じでOK
    d.style.background="#ff9800";
    d.style.left=n.x+"px";
    d.style.top=n.y+"px";
    d.style.width="20px";
    d.style.height="20px";
    d.style.fontSize="10px";
    d.textContent="N";
    lot.appendChild(d);
    n.el=d;

    d.addEventListener("mousedown", e=>{
      dragItem = n;
      offsetX = e.offsetX;
      offsetY = e.offsetY;
    });
  });
}

// ================= ドラッグ操作 =================
window.addEventListener("mousemove", e=>{
  if(dragItem){
    let rect = container.getBoundingClientRect();
    dragItem.x = e.clientX - rect.left - offsetX;
    dragItem.y = e.clientY - rect.top - offsetY;
    dragItem.el.style.left = dragItem.x + "px";
    dragItem.el.style.top = dragItem.y + "px";
  }
});

window.addEventListener("mouseup", e=>{
  dragItem=null;
});

// ================= ロッド追加 =================
addRodBtn.addEventListener("click", ()=>{
  const newId = "R"+(rods.length+1);
  const newRod = {id:newId, x:50, y:50};
  rods.push(newRod);
  renderRods();
});

// ================= 保存 =================
saveLayoutBtn.addEventListener("click", ()=>{
  const layout = rods.map(r=>({
    id:r.id,
    x:Math.round(r.x),
    y:Math.round(r.y),
    status:0
  }));
  const blob = new Blob([JSON.stringify(layout,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "parking_layout.json";
  a.click();
  URL.revokeObjectURL(url);
});

// ================= ズーム =================
zoomSlider.addEventListener("input", e=>{
  const scale = e.target.value;
  lot.style.transform = `scale(${scale})`;
});

// ================= 初期化 =================
initRods();