from flask import Flask, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # GitHub Pages からの接続を許可
socketio = SocketIO(app, cors_allowed_origins="*")

# ユーザ情報を保持
users = {}  # { userId: {lat, lng} }

@app.route("/")
def index():
    return "Flask + SocketIO Server is running."

@socketio.on("update")
def handle_update(data):
    """
    クライアントからの位置更新を受け取り、
    全員に配信
    """
    users[data["id"]] = {"lat": data["lat"], "lng": data["lng"]}
    emit("users", users, broadcast=True)

@socketio.on("disconnect")
def handle_disconnect():
    # 切断したユーザを削除
    sid = request.sid
    if sid in users:
        del users[sid]
        emit("users", users, broadcast=True)

if __name__ == "__main__":
    # Renderでは host="0.0.0.0", port=ポートを環境変数から取得
    import os
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port)