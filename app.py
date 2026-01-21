from flask import Flask, send_from_directory
import os

app = Flask(__name__)

# ===== ルート =====
@app.route("/")
def index():
    # virtual.html を返す
    return send_from_directory(".", "virtual.html")

# ===== CSS / JS / その他静的ファイル =====
@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(".", filename)

# ===== Render用ポート =====
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting server on 0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port)
