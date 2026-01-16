from flask import Flask, request, jsonify, send_file
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import os
import json

app = Flask(__name__)
CORS(app)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

users = {}  # socket_id: {lat,lng}

# WebSocket: 位置更新
@socketio.on("update_position")
def handle_update(data):
    users[request.sid] = {"lat": data["lat"], "lng": data["lng"]}
    emit("positions", users, broadcast=True)

@socketio.on("disconnect")
def handle_disconnect():
    if request.sid in users:
        del users[request.sid]
        emit("positions", users, broadcast=True)

# JSON保存
@app.route("/save_layout", methods=["POST"])
def save_layout():
    data = request.get_json()
    with open("parking_layout.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    # 保存後に WebSocket で全クライアントに通知
    socketio.emit("update_layout", data)
    return jsonify({"status":"ok"})

# JSON取得
@app.route("/parking_layout.json")
def get_layout():
    return send_file("parking_layout.json")

# Render 用ポート
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting server on 0.0.0.0:{port}")
    socketio.run(app, host="0.0.0.0", port=port)