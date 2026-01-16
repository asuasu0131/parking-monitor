from flask import Flask, request, render_template, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import os
import json

app = Flask(__name__, template_folder=".")
CORS(app)  # CORS有効化

socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# 接続中ユーザー位置
users = {}

# ==== WebSocket: 位置更新 ====
@socketio.on("update_position")
def handle_update(data):
    users[request.sid] = {"lat": data["lat"], "lng": data["lng"]}
    emit("positions", users, broadcast=True)

# ==== WebSocket: 切断 ====
@socketio.on("disconnect")
def handle_disconnect():
    if request.sid in users:
        del users[request.sid]
        emit("positions", users, broadcast=True)

# ==== UIルート ====
@app.route("/")
def virtual():
    return render_template("virtual.html")

@app.route("/admin")
def admin():
    return render_template("admin.html")

# ==== JSON保存 ====
@app.route("/save_layout", methods=["POST"])
def save_layout():
    data = request.get_json()
    try:
        with open("parking_layout.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return jsonify({"status":"ok"}), 200
    except Exception as e:
        return jsonify({"status":"error","message":str(e)}), 500

# ==== Render用ポート ====
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting server on 0.0.0.0:{port}")
    socketio.run(app, host="0.0.0.0", port=port)