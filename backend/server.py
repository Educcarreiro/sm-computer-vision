from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import subprocess
import threading
import time
import json
import imageio_ffmpeg
from detector import process_video

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs")
os.makedirs(OUTPUTS_DIR, exist_ok=True)

jobs = {}


def run_job(job_id, url, team_a, team_b):
    try:
        jobs[job_id]["status"] = "downloading"
        video_path = os.path.join(OUTPUTS_DIR, f"source_{job_id}.mp4")
        result = subprocess.run(
            ["yt-dlp", "-f", "best[height<=720]", "-o", video_path, url],
            capture_output=True, text=True, timeout=600
        )
        if result.returncode != 0:
            jobs[job_id]["status"] = "error"
            jobs[job_id]["error"] = "Erro ao baixar vídeo"
            return

        jobs[job_id]["status"] = "processing"

        def progress_cb(current, total):
            jobs[job_id]["progress"] = round(current / total * 100)

        video_out, report = process_video(
            video_path, OUTPUTS_DIR, team_a, team_b, progress_cb
        )

        if video_out and report:
            jobs[job_id]["status"] = "converting"
            web_path = video_out.replace(".mp4", "_web.mp4")
            subprocess.run([
                FFMPEG, "-i", video_out,
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                "-y", web_path
            ], capture_output=True, timeout=300)
            if os.path.exists(web_path):
                os.remove(video_out)
                video_out = web_path
            jobs[job_id]["status"] = "done"
            jobs[job_id]["video"] = os.path.basename(video_out)
            jobs[job_id]["report"] = report
            jobs[job_id]["progress"] = 100
        else:
            jobs[job_id]["status"] = "error"
            jobs[job_id]["error"] = "Erro no processamento"

        if os.path.exists(video_path):
            os.remove(video_path)

    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)


@app.route("/api/analyze", methods=["POST"])
def analyze():
    data = request.json
    url = data.get("url", "").strip()
    team_a = data.get("team_a", "Team A").strip()
    team_b = data.get("team_b", "Team B").strip()

    if not url:
        return jsonify({"error": "URL é obrigatória"}), 400

    job_id = str(int(time.time() * 1000))
    jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "video": None,
        "report": None,
        "error": None
    }

    thread = threading.Thread(target=run_job, args=(job_id, url, team_a, team_b))
    thread.daemon = True
    thread.start()

    return jsonify({"job_id": job_id})


@app.route("/api/status/<job_id>")
def status(job_id):
    job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job não encontrado"}), 404
    return jsonify(job)


@app.route("/api/video/<filename>")
def serve_video(filename):
    path = os.path.join(OUTPUTS_DIR, filename)
    if not os.path.exists(path):
        return jsonify({"error": "Vídeo não encontrado"}), 404
    return send_file(path, mimetype="video/mp4")


@app.route("/api/jobs")
def list_jobs():
    completed = {k: v for k, v in jobs.items() if v["status"] == "done"}
    return jsonify(completed)


if __name__ == "__main__":
    print("Soccer Mind Backend running on http://localhost:5000")
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
