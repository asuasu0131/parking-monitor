const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const zoomSlider = document.getElementById("zoom-slider");

let zoomScale = parseFloat(zoomSlider.value);

let rods = [
  {id:"A1",x:null,y:null,status:0},
  {id:"A2",x:null,y:null,status:1},
  {id:"A3",x:null,y:null,status:0},
  {id:"B1",x:null,y:null,status:0},
  {id:"B2",x:null,y:null,status:1},
  {id:"B3",x:null,y:null,status:0}
];

// ===== ロッド描画 =====
function renderRods(){
  document.querySelectorAll(".rod").forEach(e=>e.remove());

  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className = "rod " + (r.status===0?"empty":"full");
    d.innerHTML = `${r.id}<br>${r.status===0?"空き":"使用中"}`;
    lot.appendChild(d);
    r.element = d;

    if(r.x === null) r.x = container.clientWidth/2 - d.offsetWidth/2;
    if(r.y === null) r.y = container.clientHeight/2 - d.offsetHeight/2;

    d.style.left = r.x + "px";
    d.style.top  = r.y + "px";

    // ドラッグ
    d.onmousedown = e=>{
      e.preventDefault();
      const ox = e.clientX - r.x;
      const oy = e.clientY - r.y;

      function move(ev){
        r.x = ev.clientX - ox;
        r.y = ev.clientY - oy;
        d.style.left = r.x + "px";
        d.style.top  = r.y + "px";
      }
      function up(){
        document.removeEventListener("mousemove",move);
        document.removeEventListener("mouseup",up);
      }
      document.addEventListener("mousemove",move);
      document.addEventListener("mouseup",up);
    };

    // 状態切替
    d.ondblclick = ()=>{
      r.status = r.status===0 ? 1 : 0;
      d.className = "rod " + (r.status===0?"empty":"full");
      d.innerHTML = `${r.id}<br>${r.status===0?"空き":"使用中"}`;
    };
  });
}
renderRods();

// ===== ズーム（containerのみ）=====
zoomSlider.addEventListener("input", ()=>{
  zoomScale = parseFloat(zoomSlider.value);
  container.style.transform = `scale(${zoomScale})`;
  container.style.transformOrigin = "center center";
});

// ===== ロッド追加 =====
document.getElementById("add-rod").onclick = ()=>{
  const id = "R" + (rods.length + 1);
  rods.push({
    id,
    x: container.clientWidth/2 - 50,
    y: container.clientHeight/2 - 50,
    status:0
  });
  renderRods();
};

// ===== JSON保存 =====
document.getElementById("save-layout").onclick = async()=>{
  const saveData = rods.map(r=>({
    id:r.id,
    x:r.x,
    y:r.y,
    status:r.status
  }));

  const res = await fetch("/save_layout",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(saveData)
  });

  if(res.ok){
    alert("parking_layout.json に保存しました");
  }else{
    alert("保存に失敗しました");
  }
};