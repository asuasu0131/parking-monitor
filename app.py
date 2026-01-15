from flask import Flask, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins="*")  # GitHub Pages からの接続を許可
socketio = SocketIO(app, cors_allowed_origins="*")

# 接続中ユーザーの位置情報を保持（sidをキー）
positions = {}  # { sid: {"lat":..., "lng":...} }

@app.route("/")
def index():
    return "Socket.IO server is running."

@socketio.on("update_position")
def handle_update_position(data):
    # クライアントから位置情報を受信
    positions[request.sid] = {"lat": data["lat"], "lng": data["lng"]}
    # 全員に配信
    emit("positions", positions, broadcast=True)

@socketio.on("disconnect")
def handle_disconnect():
    # 切断ユーザーを削除
    positions.pop(request.sid, None)
    emit("positions", positions, broadcast=True)

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port)