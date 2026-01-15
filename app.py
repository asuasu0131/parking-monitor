from flask import Flask, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import os

# ===== Flask + CORS =====
app = Flask(__name__)
CORS(app)  # GitHub Pages からのアクセスを許可

# ===== SocketIO =====
# async_mode='eventlet' で WebSocket を有効化
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# 接続中ユーザーの位置管理
users = {}  # { socket_id: {"lat":..., "lng":...} }

# ===== WebSocket: 位置更新 =====
@socketio.on("update_position")
def handle_update(data):
    users[request.sid] = {"lat": data["lat"], "lng": data["lng"]}
    emit("positions", users, broadcast=True)

# ===== WebSocket: 切断時 =====
@socketio.on("disconnect")
def handle_disconnect():
    if request.sid in users:
        del users[request.sid]
        emit("positions", users, broadcast=True)

# ===== Render 用ポート設定 =====
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting server on 0.0.0.0:{port}")
    socketio.run(app, host="0.0.0.0", port=port)