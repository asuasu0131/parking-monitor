const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const zoomSlider = document.getElementById("zoom-slider");
let zoomScale = parseFloat(zoomSlider.value);

const socket = io();

let rods = [];
let roads = [];

// ===== 描画 =====
function renderRods(){
  document.querySelectorAll(".rod").forEach(e=>e.remove());
  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className = "rod " + (r.status===0?"empty":"full");
    d.innerHTML = `${r.id}<br>${r.status===0?"空き":"使用中"}`;
    d.style.left = r.x + "px";
    d.style.top  = r.y + "px";
    lot.appendChild(d);
    r.element = d;

    // ドラッグ
    d.onmousedown = e=>{
      e.preventDefault();
      const offsetX = e.clientX - r.x;
      const offsetY = e.clientY - r.y;
      function move(e2){
        r.x = e2.clientX - offsetX;
        r.y = e2.clientY - offsetY;
        d.style.left = r.x + "px";
        d.style.top  = r.y + "px";
      }
      function up(){
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      }
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    };

    // 状態変更
    d.ondblclick = ()=>{
      r.status = r.status===0?1:0;
      d.className = "rod "+(r.status===0?"empty":"full");
      d.innerHTML = `${r.id}<br>${r.status===0?"空き":"使用中"}`;
    };
  });
}

function renderRoads(){
  document.querySelectorAll(".road").forEach(e=>e.remove());
  roads.forEach(r=>{
    lot.appendChild(r.element);
  });
}

// ===== ドラッグ可能通路作成 =====
function addRoad(x=50,y=50,w=100,h=50){
  const d = document.createElement("div");
  d.className = "road";
  d.style.left = x+"px";
  d.style.top  = y+"px";
  d.style.width = w+"px";
  d.style.height= h+"px";
  lot.appendChild(d);
  const road = {element:d, x, y, w, h};
  roads.push(road);

  d.onmousedown = e=>{
    e.preventDefault();
    const offsetX = e.clientX - d.offsetLeft;
    const offsetY = e.clientY - d.offsetTop;

    function move(e2){
      d.style.left = (e2.clientX - offsetX)+"px";
      d.style.top  = (e2.clientY - offsetY)+"px";
    }
    function up(){
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    }
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };
}

// ===== ボタン =====
document.getElementById("add-rod").onclick = ()=>{
  const id = "R"+(rods.length+1);
  const newRod = {id:id,x:100,y:100,status:0};
  rods.push(newRod);
  renderRods();
};

document.getElementById("add-road").onclick = ()=>{
  addRoad(50,50,150,60); // 適当な初期位置・サイズ
  renderRoads();          // 追加後すぐ表示
};

document.getElementById("save-layout").onclick = async ()=>{
  const layout = rods.map(r=>({id:r.id,x:r.x,y:r.y,status:r.status}));
  const roadData = roads.map(r=>({
    x: parseInt(r.element.style.left),
    y: parseInt(r.element.style.top),
    w: parseInt(r.element.style.width),
    h: parseInt(r.element.style.height)
  }));
  const data = {rods:layout, roads:roadData};

  await fetch("/save_layout", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify(data)
  });
  alert("保存しました");
  socket.emit("layout_updated");
};

// ===== 初期化 =====
renderRods();
renderRoads();

zoomSlider.addEventListener("input", ()=>{
  zoomScale = parseFloat(zoomSlider.value);
});

(function loop(){
  lot.style.transform = `scale(${zoomScale})`;
  requestAnimationFrame(loop);
})();