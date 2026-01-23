import eventlet
eventlet.monkey_patch()

from flask import Flask, request, send_from_directory, send_file
from flask_socketio import SocketIO
from flask_cors import CORS
import os, json

app = Flask(__name__)
CORS(app)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

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
@app.route("/save_layout", methods=["POST"])
def save_layout():
    data = request.get_json()
    with open("parking_layout.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    socketio.emit("layout_updated")
    return {"status": "ok"}

# ===== JSON 取得 =====
@app.route("/parking_layout.json")
def get_layout():
    return send_file("parking_layout.json")

# ===== 起動 =====
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port)