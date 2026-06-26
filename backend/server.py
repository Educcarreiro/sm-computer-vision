from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import subprocess
import threading
import time
import json
import imageio_ffmpeg
from detector import process_video, extract_calibration_frame, KNOWN_TEAMS

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs")
GALLERY_FILE = os.path.join(OUTPUTS_DIR, "gallery.json")
os.makedirs(OUTPUTS_DIR, exist_ok=True)

jobs = {}


def load_gallery():
    if os.path.exists(GALLERY_FILE):
        with open(GALLERY_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []


def save_to_gallery(entry):
    gallery = load_gallery()
    gallery.insert(0, entry)
    with open(GALLERY_FILE, 'w', encoding='utf-8') as f:
        json.dump(gallery, f, ensure_ascii=False, indent=2)


def run_job(job_id, url, team_a, team_b, calibration=None):
    try:
        jobs[job_id]["status"] = "downloading"
        video_path = os.path.join(OUTPUTS_DIR, f"source_{job_id}.mp4")
        result = subprocess.run(
            ["yt-dlp", "-f", "best[height<=720]", "-o", video_path, url],
            capture_output=True, text=True, timeout=600
        )
        if result.returncode != 0:
            jobs[job_id]["status"] = "error"
            jobs[job_id]["error"] = "Erro ao baixar video"
            return

        jobs[job_id]["status"] = "processing"

        def progress_cb(current, total):
            jobs[job_id]["progress"] = round(current / total * 100)

        video_out, report = process_video(
            video_path, OUTPUTS_DIR, team_a, team_b, progress_cb, calibration
        )

        if video_out and report:
            jobs[job_id]["status"] = "converting"
            web_path = video_out.replace(".mp4", "_web.mp4")
            subprocess.run([
                FFMPEG, "-i", video_out,
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                "-y", web_path
            ], capture_output=True, timeout=600)
            if os.path.exists(web_path):
                os.remove(video_out)
                video_out = web_path
            jobs[job_id]["status"] = "done"
            jobs[job_id]["video"] = os.path.basename(video_out)
            jobs[job_id]["report"] = report
            jobs[job_id]["progress"] = 100

            save_to_gallery({
                "id": job_id,
                "url": url,
                "video": os.path.basename(video_out),
                "report": report,
                "created_at": time.strftime("%Y-%m-%d %H:%M")
            })
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
    calibration = data.get("calibration", None)

    if not url:
        return jsonify({"error": "URL e obrigatoria"}), 400

    job_id = str(int(time.time() * 1000))
    jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "video": None,
        "report": None,
        "error": None
    }

    thread = threading.Thread(target=run_job, args=(job_id, url, team_a, team_b, calibration))
    thread.daemon = True
    thread.start()

    return jsonify({"job_id": job_id})


@app.route("/api/calibrate", methods=["POST"])
def calibrate():
    """Baixa vídeo, extrai primeiro frame com jogadores detectados para calibração"""
    data = request.json
    url = data.get("url", "").strip()
    if not url:
        return jsonify({"error": "URL e obrigatoria"}), 400

    video_path = os.path.join(OUTPUTS_DIR, f"calib_{int(time.time())}.mp4")
    try:
        result = subprocess.run(
            ["yt-dlp", "-f", "best[height<=720]", "-o", video_path, url],
            capture_output=True, text=True, timeout=600
        )
        if result.returncode != 0:
            return jsonify({"error": "Erro ao baixar video"}), 400

        calib_data = extract_calibration_frame(video_path)
        if not calib_data:
            return jsonify({"error": "Nao foi possivel detectar jogadores"}), 400

        return jsonify(calib_data)
    finally:
        if os.path.exists(video_path):
            os.remove(video_path)


@app.route("/api/compare", methods=["POST"])
def compare():
    """Compara estatísticas de times entre análises diferentes"""
    data = request.json
    analyses = data.get("analyses", [])

    if len(analyses) < 2:
        return jsonify({"error": "Precisa de pelo menos 2 analises"}), 400

    gallery = load_gallery()
    gallery_map = {item["id"]: item for item in gallery}

    # Adicionar jobs em memória
    for k, v in jobs.items():
        if v.get("status") == "done":
            gallery_map[k] = {"id": k, "report": v["report"]}

    results = []
    for analysis in analyses:
        analysis_id = analysis.get("id")
        team_key = analysis.get("team")  # "team_a" ou "team_b"

        item = gallery_map.get(analysis_id)
        if not item or not item.get("report"):
            continue

        report = item["report"]
        team_data = report.get(team_key)
        if team_data:
            results.append({
                "analysis_id": analysis_id,
                "team": team_data,
                "matchup": report.get("matchup", {})
            })

    if len(results) < 2:
        return jsonify({"error": "Analises nao encontradas"}), 404

    # Gerar comparação
    t1 = results[0]["team"]
    t2 = results[1]["team"]

    comparison = {
        "teams": [t1, t2],
        "comparison": {
            "compactness": {
                "winner": t1["name"] if t1["compactness"] < t2["compactness"] else t2["name"],
                "values": [t1["compactness"], t2["compactness"]]
            },
            "width": {
                "winner": t1["name"] if t1["width"] > t2["width"] else t2["name"],
                "values": [t1["width"], t2["width"]]
            },
            "depth": {
                "winner": t1["name"] if t1["depth"] > t2["depth"] else t2["name"],
                "values": [t1["depth"], t2["depth"]]
            },
            "pressing": {
                "winner": t1["name"] if t1["pressing"] < t2["pressing"] else t2["name"],
                "values": [t1["pressing"], t2["pressing"]]
            }
        }
    }

    return jsonify(comparison)


@app.route("/api/status/<job_id>")
def status(job_id):
    job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job nao encontrado"}), 404
    return jsonify(job)


@app.route("/api/video/<filename>")
def serve_video(filename):
    path = os.path.join(OUTPUTS_DIR, filename)
    if not os.path.exists(path):
        return jsonify({"error": "Video nao encontrado"}), 404
    return send_file(path, mimetype="video/mp4")


@app.route("/api/jobs")
def list_jobs():
    completed = {k: v for k, v in jobs.items() if v["status"] == "done"}
    return jsonify(completed)


@app.route("/api/gallery")
def get_gallery():
    return jsonify(load_gallery())


@app.route("/api/teams")
def list_teams():
    return jsonify({k: v["label"] for k, v in KNOWN_TEAMS.items()})


if __name__ == "__main__":
    print("Soccer Mind Backend running on http://localhost:5000")
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
