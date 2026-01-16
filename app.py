from flask import Flask, request, send_file, send_from_directory
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import os
import json
import tempfile

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# ===== WebSocket 位置更新管理 =====
users = {}

@socketio.on("update_position")
def handle_update(data):
    users[request.sid] = {"lat": data["lat"], "lng": data["lng"]}
    emit("positions", users, broadcast=True)

@socketio.on("disconnect")
def handle_disconnect():
    if request.sid in users:
        del users[request.sid]
        emit("positions", users, broadcast=True)

# ===== HTML ページ =====
@app.route("/")
def virtual():
    return send_from_directory(".", "virtual.html")

@app.route("/admin")
def admin():
    return send_from_directory(".", "admin.html")

# ===== CSS / JS / JSON ファイル =====
@app.route("/<filename>")
def static_files(filename):
    if filename.endswith((".css", ".js", ".json")):
        return send_from_directory(".", filename)
    return "Not Found", 404

# ===== JSON 保存 =====
@app.route("/save_layout", methods=["POST"])
def save_layout():
    data = request.get_json()
    try:
        # Render 環境でも書き込める /tmp フォルダに保存
        tmp_path = os.path.join(tempfile.gettempdir(), "parking_layout.json")
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        # virtual.html に即時反映
        socketio.emit("update_layout", data, broadcast=True)
        return {"status": "ok"}
    except Exception as e:
        print("保存エラー:", e)
        return {"status":"error", "message": str(e)}, 500

# ===== JSON取得 =====
@app.route("/parking_layout.json")
def get_layout():
    try:
        tmp_path = os.path.join(tempfile.gettempdir(), "parking_layout.json")
        # ファイルがまだ存在しない場合は初期データを返す
        if not os.path.exists(tmp_path):
            initial_data = [
                {"id":"A1","x":None,"y":None,"status":0},
                {"id":"A2","x":None,"y":None,"status":1},
                {"id":"A3","x":None,"y":None,"status":0},
                {"id":"B1","x":None,"y":None,"status":0},
                {"id":"B2","x":None,"y":None,"status":1},
                {"id":"B3","x":None,"y":None,"status":0}
            ]
            return json.dumps(initial_data), 200, {"Content-Type":"application/json"}
        return send_file(tmp_path)
    except Exception as e:
        print("取得エラー:", e)
        return {"status":"error", "message": str(e)}, 500

# ===== Render 用ポート =====
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting server on 0.0.0.0:{port}")
    socketio.run(app, host="0.0.0.0", port=port)