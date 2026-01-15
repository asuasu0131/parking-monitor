from flask import Flask, render_template
from flask_socketio import SocketIO, emit

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

positions = {}  # { sid: {"lat":..., "lng":...} }

@app.route("/")
def index():
    return render_template("virtual.html")

@socketio.on("update_position")
def handle_update_position(data):
    positions[request.sid] = {"lat": data["lat"], "lng": data["lng"]}
    emit("positions", positions, broadcast=True)

@socketio.on("disconnect")
def handle_disconnect():
    positions.pop(request.sid, None)
    emit("positions", positions, broadcast=True)

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000)