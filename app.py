from flask import Flask, send_from_directory, request, jsonify
import os

app = Flask(__name__)

# ===== センサ状態保持 =====
sensor_data = {"CH0": 0, "CH1": 0}

# ===== ルート =====
@app.route("/")
def index():
    return send_from_directory(".", "virtual.html")

# ===== CSS / JS / その他静的ファイル =====
@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(".", filename)

# ===== センサ状態更新（ラズパイからPOST） =====
@app.route("/update_sensor", methods=["POST"])
def update_sensor():
    global sensor_data
    data = request.get_json()
    if "CH0" in data and "CH1" in data:
        sensor_data["CH0"] = int(data["CH0"])
        sensor_data["CH1"] = int(data["CH1"])
        return jsonify({"status": "ok"})
    return jsonify({"status": "error"}), 400

# ===== センサ状態取得（UI側でGET） =====
@app.route("/get_sensor")
def get_sensor():
    return jsonify(sensor_data)

# ===== メイン =====
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting server on 0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port)