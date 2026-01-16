from flask import Flask, request, send_file, send_from_directory, render_template
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

# ===== CSS / JS ファイル =====
@app.route("/<filename>")
def static_files(filename):
    if filename.endswith((".css", ".js", ".json")):
        return send_from_directory(".", filename)
    return "Not Found", 404

# ===== JSON 保存 =====
@app.route("/save_layout", methods=["POST"])
def save_layout():
    data = request.get_json()
    with open("parking_layout.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    socketio.emit("update_layout", data, broadcast=True)
    return {"status": "ok"}

# JSON取得
@app.route("/parking_layout.json")
def get_layout():
    return send_file("parking_layout.json")

# ===== Render 用ポート =====
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting server on 0.0.0.0:{port}")
    socketio.run(app, host="0.0.0.0", port=port)