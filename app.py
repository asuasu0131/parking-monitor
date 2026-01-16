from flask import Flask, request, send_file, send_from_directory, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import os
import json

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

# ===== CSS / JS / JSON =====
@app.route("/<filename>")
def static_files(filename):
    if filename.endswith((".css", ".js", ".json")):
        return send_from_directory(".", filename)
    return "Not Found", 404

# ===== JSON 保存 =====
@app.route("/save_layout", methods=["POST"])
def save_layout():
    data = request.get_json()
    file_path = "/tmp/parking_layout.json"  # Renderでも書き込み可能
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"[INFO] Saved layout to {file_path}")

        # 全クライアントに即時通知
        socketio.emit("update_layout", data, broadcast=True)

        return jsonify({"status": "ok"})
    except Exception as e:
        print(f"[ERROR] Failed to save layout: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# ===== JSON取得 =====
@app.route("/parking_layout.json")
def get_layout():
    file_path = "/tmp/parking_layout.json"
    if not os.path.exists(file_path):
        # 初回用にデフォルトを作成
        default_layout = [
            {"id":"A1","x":None,"y":None,"status":0},
            {"id":"A2","x":None,"y":None,"status":1},
            {"id":"A3","x":None,"y":None,"status":0},
            {"id":"B1","x":None,"y":None,"status":0},
            {"id":"B2","x":None,"y":None,"status":1},
            {"id":"B3","x":None,"y":None,"status":0}
        ]
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(default_layout, f, ensure_ascii=False, indent=2)
    return send_file(file_path)

# ===== Render 用ポート =====
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting server on 0.0.0.0:{port}")
    socketio.run(app, host="0.0.0.0", port=port)