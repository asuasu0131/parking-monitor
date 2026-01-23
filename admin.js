const container = document.getElementById("parking-lot-container");
const lot = document.getElementById("parking-lot");
const zoomSlider = document.getElementById("zoom-slider");
const saveBtn = document.getElementById("save-layout");
const addRodBtn = document.getElementById("add-rod");

let rods = [];
let rodCount = 0;

// ===== JSONロード時の初期ロッド =====
async function loadLayout() {
    try {
        const resp = await fetch("parking_layout.json");
        const data = await resp.json();
        data.forEach(r => addRod(r.id, r.x, r.y, r.status));
    } catch (e) {
        console.log("レイアウト読み込みエラー:", e);
    }
}

// ===== ロッド追加 =====
function addRod(id=null, x=50, y=50, status=0){
    rodCount++;
    const rodId = id || "R"+rodCount;
    const d = document.createElement("div");
    d.className = "rod " + (status?"full":"empty");
    d.textContent = rodId;
    lot.appendChild(d);

    const rod = {id: rodId, x, y, status, el:d};
    rods.push(rod);

    // ドラッグ可能
    let offsetX=0, offsetY=0, dragging=false;
    d.addEventListener("mousedown", e=>{
        dragging=true;
        offsetX=e.offsetX;
        offsetY=e.offsetY;
        d.style.zIndex=1000;
    });
    window.addEventListener("mousemove", e=>{
        if(dragging){
            const rect = container.getBoundingClientRect();
            rod.x = e.clientX - rect.left - offsetX;
            rod.y = e.clientY - rect.top - offsetY;
            d.style.left = rod.x + "px";
            d.style.top  = rod.y + "px";
        }
    });
    window.addEventListener("mouseup", ()=>{
        dragging=false;
        d.style.zIndex="";
    });

    // クリックで空き/満車切替
    d.addEventListener("click", e=>{
        if(dragging) return; // ドラッグ中は無効
        rod.status ^=1;
        d.className = "rod " + (rod.status?"full":"empty");
    });

    return rod;
}

// ===== UIリサイズ =====
function resizeUI(){
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    rods.forEach(r=>{
        r.el.style.left = r.x + "px";
        r.el.style.top  = r.y + "px";
    });
}
window.addEventListener("resize", resizeUI);
resizeUI();

// ===== JSON保存 =====
saveBtn.addEventListener("click", ()=>{
    const json = rods.map(r=>({id:r.id,x:r.x,y:r.y,status:r.status}));
    const blob = new Blob([JSON.stringify(json, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "parking_layout.json";
    a.click();
    URL.revokeObjectURL(url);
});

// ===== 新規ロッド追加 =====
addRodBtn.addEventListener("click", ()=>addRod());

// ===== 初期ロード =====
loadLayout();