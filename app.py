import eventlet
eventlet.monkey_patch()

from flask import Flask, request, send_from_directory, send_file, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS
import os, json

app = Flask(__name__)
CORS(app)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

LAYOUT_FILE = "parking_layout.json"

# 初期JSONがなければ作る
if not os.path.exists(LAYOUT_FILE):
    with open(LAYOUT_FILE, "w", encoding="utf-8") as f:
        json.dump({}, f, ensure_ascii=False, indent=2)

# ===== HTML =====
@app.route("/")
def virtual():
    return send_from_directory(".", "virtual.html")

@app.route("/admin")
def admin():
    return send_from_directory(".", "admin.html")

# ===== static =====
@app.route("/<path:filename>")
def static_files(filename):
    if filename.endswith((".css", ".js", ".json")):
        return send_from_directory(".", filename)
    return "Not Found", 404

# ===== JSON 保存 =====
# ===== JSON 保存 =====
@app.route("/save_layout", methods=["POST"])
def save_layout():
    data = request.get_json()
    if not data:
        return jsonify({"status":"error","message":"No data received"}), 400

    try:
        with open(LAYOUT_FILE, "r", encoding="utf-8") as f:
            all_layouts = json.load(f)

        parking_id = data.get("parking", {}).get("id") or f"P{len(all_layouts)+1}"
        all_layouts[parking_id] = data

        with open(LAYOUT_FILE, "w", encoding="utf-8") as f:
            json.dump(all_layouts, f, ensure_ascii=False, indent=2)

        # ここで即時反映用にデータを送信
        socketio.emit("layout_updated", data)

        return jsonify({"status":"ok","parking_id":parking_id})
    except Exception as e:
        return jsonify({"status":"error","message":str(e)}), 500

# ===== 全駐車場取得 =====
@app.route("/get_layouts", methods=["GET"])
def get_layouts():
    with open(LAYOUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return jsonify(data)

# ===== 個別JSON取得（従来互換） =====
@app.route("/parking_layout.json")
def get_layout():
    return send_file(LAYOUT_FILE)

# ===== 駐車センサー更新 =====
@app.route("/update_sensor", methods=["POST"])
def update_sensor():
    data = request.get_json()  # 例: {"R1":0,"R2":1}
    socketio.emit("sensor_update", data)  # UIにリアルタイム送信
    return jsonify({"status":"ok"})

# ===== SocketIO イベント =====
@socketio.on("layout_updated")
def on_layout_updated():
    socketio.emit("layout_updated")

# ===== 起動 =====
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5002))
    socketio.run(app, host="0.0.0.0", port=port)