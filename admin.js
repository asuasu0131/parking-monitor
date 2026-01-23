const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const zoomSlider = document.getElementById("zoom-slider");

let zoomScale = 1;

// 初期駐車場サイズ
let lotWidth = parseInt(document.getElementById("lot-width").value);
let lotHeight = parseInt(document.getElementById("lot-height").value);
lot.style.width = lotWidth + "px";
lot.style.height = lotHeight + "px";

// ロッド配列（x,y,w,hはpx単位、rotationは角度）
let rods = [
  {id:"A1", x:300, y:150, w:60, h:120, rotation:0, status:0},
  {id:"A2", x:300, y:350, w:60, h:120, rotation:0, status:1},
  {id:"A3", x:300, y:550, w:60, h:120, rotation:0, status:0},
  {id:"B1", x:900, y:150, w:60, h:120, rotation:0, status:0},
  {id:"B2", x:900, y:350, w:60, h:120, rotation:0, status:1},
  {id:"B3", x:900, y:550, w:60, h:120, rotation:0, status:0}
];

function renderRods(){
  document.querySelectorAll(".rod").forEach(e=>e.remove());

  rods.forEach(r=>{
    const d = document.createElement("div");
    d.className = "rod "+(r.status===0?"empty":"full");
    d.innerHTML = `${r.id}<br>${r.status===0?"空き":"使用中"}`;
    d.style.width = r.w + "px";
    d.style.height = r.h + "px";
    d.style.left = r.x + "px";
    d.style.top  = r.y + "px";
    d.style.transform = `rotate(${r.rotation}deg)`;
    d.style.transformOrigin = "center center";
    lot.appendChild(d);
    r.el = d;

    // ドラッグ
    d.onmousedown = (e)=>{
      if(e.button!==0) return; // 左クリックのみ
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      const offsetX = startX - r.x, offsetY = startY - r.y;

      function move(ev){
        r.x = ev.clientX - offsetX;
        r.y = ev.clientY - offsetY;
        r.el.style.left = r.x + "px";
        r.el.style.top  = r.y + "px";
      }

      function up(){
        document.removeEventListener("mousemove",move);
        document.removeEventListener("mouseup",up);
      }
      document.addEventListener("mousemove",move);
      document.addEventListener("mouseup",up);
    };

    // ダブルクリックで状態変更
    d.ondblclick = ()=>{
      r.status = r.status===0?1:0;
      r.el.className = "rod "+(r.status===0?"empty":"full");
      r.el.innerHTML = `${r.id}<br>${r.status===0?"空き":"使用中"}`;
    };

    // 右クリックで回転
    d.oncontextmenu = (e)=>{
      e.preventDefault();
      r.rotation = (r.rotation + 90)%360;
      r.el.style.transform = `rotate(${r.rotation}deg)`;
    };
  });
}

renderRods();

// ズーム
zoomSlider.addEventListener("input", ()=>{
  zoomScale = parseFloat(zoomSlider.value);
});

// ロッド追加
document.getElementById("add-rod").onclick = ()=>{
  rods.push({id:"R"+(rods.length+1), x:lotWidth/2-30, y:lotHeight/2-60, w:60, h:120, rotation:0, status:0});
  renderRods();
};

// JSON保存
document.getElementById("save-layout").onclick = async ()=>{
  const res = await fetch("/save_layout", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({lotWidth, lotHeight, rods})
  });
  if(res.ok) alert("保存しました");
  else alert("保存失敗");
};

// 敷地サイズ変更
document.getElementById("apply-lot-size").onclick = ()=>{
  const w = parseInt(document.getElementById("lot-width").value);
  const h = parseInt(document.getElementById("lot-height").value);

  const scaleX = w / lotWidth;
  const scaleY = h / lotHeight;

  // ロッドをスケーリング
  rods.forEach(r=>{
    r.x *= scaleX;
    r.y *= scaleY;
    r.w *= scaleX;
    r.h *= scaleY;
  });

  lotWidth = w;
  lotHeight = h;
  lot.style.width = lotWidth + "px";
  lot.style.height = lotHeight + "px";

  renderRods();
};

// 描画ループ（ズーム反映）
(function loop(){
  lot.style.transform = `scale(${zoomScale})`;
  requestAnimationFrame(loop);
})();