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
        import shutil
        ytdlp_path = shutil.which("yt-dlp") or "yt-dlp"
        result = subprocess.run(
            [ytdlp_path, "-f", "best[height<=720]", "-o", video_path, url],
            capture_output=True, text=True, timeout=3600
        )
        if result.returncode != 0:
            jobs[job_id]["status"] = "error"
            jobs[job_id]["error"] = f"Erro ao baixar video: {result.stderr[:200] if result.stderr else 'unknown'}"
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
            ], capture_output=True, timeout=3600)
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
    jersey_color = data.get("jersey_color", None)

    if not url:
        return jsonify({"error": "URL e obrigatoria"}), 400

    # Se o usuário passou cor da camisa, criar calibração automática
    if jersey_color and not calibration:
        calibration = {"jersey_color_hint": jersey_color, "team_name": team_a}

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


@app.route("/api/patterns", methods=["POST"])
def find_patterns():
    """Analisa padrões recorrentes de um time em múltiplas partidas"""
    data = request.json
    team_name = data.get("team", "").strip()
    if not team_name:
        return jsonify({"error": "Nome do time e obrigatorio"}), 400

    gallery = load_gallery()

    # Juntar com jobs em memória
    for k, v in jobs.items():
        if v.get("status") == "done" and v.get("report"):
            found = False
            for g in gallery:
                if g.get("id") == k:
                    found = True
                    break
            if not found:
                gallery.append({"id": k, "report": v["report"]})

    # Encontrar todas as análises que envolvem esse time
    matches = []
    for item in gallery:
        report = item.get("report")
        if not report:
            continue
        ta = report.get("team_a", {})
        tb = report.get("team_b", {})
        if ta.get("name", "").lower() == team_name.lower():
            matches.append({
                "match_id": item.get("id"),
                "opponent": tb.get("name", "?"),
                "date": item.get("created_at", ""),
                "data": ta,
                "matchup": report.get("matchup", {})
            })
        elif tb.get("name", "").lower() == team_name.lower():
            matches.append({
                "match_id": item.get("id"),
                "opponent": ta.get("name", "?"),
                "date": item.get("created_at", ""),
                "data": tb,
                "matchup": report.get("matchup", {})
            })

    if len(matches) < 2:
        return jsonify({"error": f"Precisa de pelo menos 2 analises do {team_name}. Encontradas: {len(matches)}"}), 400

    # ── Análise de padrões ──
    formations_all = []
    compactness_vals = []
    width_vals = []
    depth_vals = []
    pressing_vals = []
    players_vals = []

    per_match = []

    for m in matches:
        d = m["data"]
        compactness_vals.append(d.get("compactness", 0))
        width_vals.append(d.get("width", 0))
        depth_vals.append(d.get("depth", 0))
        pressing_vals.append(d.get("pressing", 0))
        players_vals.append(d.get("players_avg", 0))

        forms = d.get("formations", [])
        for f in forms:
            formations_all.append(f["formation"])

        top_form = forms[0]["formation"] if forms else "?"

        per_match.append({
            "opponent": m["opponent"],
            "date": m["date"],
            "formation": top_form,
            "compactness": d.get("compactness", 0),
            "width": d.get("width", 0),
            "depth": d.get("depth", 0),
            "pressing": d.get("pressing", 0),
            "style": m["matchup"].get("style", "?")
        })

    import statistics
    from collections import Counter

    n = len(matches)

    # Formação mais usada
    form_counter = Counter(formations_all)
    top_formations = form_counter.most_common(5)
    total_forms = sum(form_counter.values())

    # Médias e desvio padrão (consistência)
    def stats_for(vals):
        vals = [v for v in vals if v > 0]
        if not vals:
            return {"avg": 0, "std": 0, "min": 0, "max": 0, "consistent": True}
        avg = round(statistics.mean(vals), 1)
        std = round(statistics.stdev(vals), 1) if len(vals) > 1 else 0
        cv = (std / avg * 100) if avg > 0 else 0
        return {
            "avg": avg,
            "std": std,
            "min": round(min(vals), 1),
            "max": round(max(vals), 1),
            "consistent": cv < 15  # < 15% variação = consistente
        }

    compact_stats = stats_for(compactness_vals)
    width_stats = stats_for(width_vals)
    depth_stats = stats_for(depth_vals)
    pressing_stats = stats_for(pressing_vals)

    # Detectar padrões
    patterns = []

    # 1. Formação dominante
    if top_formations:
        top_f, top_c = top_formations[0]
        pct = round(top_c / total_forms * 100, 1)
        if pct > 25:
            patterns.append({
                "type": "formation",
                "title": f"Formacao predominante: {top_f}",
                "detail": f"Usada em {pct}% das analises. Indica que o time tem uma estrutura tatica preferida.",
                "confidence": "alta" if pct > 40 else "media"
            })

    # 2. Consistência de compactação
    if compact_stats["consistent"]:
        patterns.append({
            "type": "shape",
            "title": "Bloco compacto consistente",
            "detail": f"Compactacao media de {compact_stats['avg']}m2 com variacao de apenas {compact_stats['std']}m2. O time mantem a mesma forma independente do adversario.",
            "confidence": "alta"
        })
    else:
        patterns.append({
            "type": "shape",
            "title": "Forma tatica adaptativa",
            "detail": f"Compactacao varia de {compact_stats['min']}m2 a {compact_stats['max']}m2. O time adapta sua forma ao adversario.",
            "confidence": "media"
        })

    # 3. DNA de pressing
    if pressing_stats["consistent"]:
        avg_p = pressing_stats["avg"]
        if avg_p < 10:
            press_style = "alta pressao (gegenpressing)"
        elif avg_p < 14:
            press_style = "pressao media-alta"
        elif avg_p < 18:
            press_style = "bloco medio"
        else:
            press_style = "bloco baixo"
        patterns.append({
            "type": "pressing",
            "title": f"DNA de pressing: {press_style}",
            "detail": f"Distancia media de pressing de {avg_p}m consistente em todas as partidas. Isso sugere um estilo de jogo bem treinado e ensaiado.",
            "confidence": "alta"
        })
    else:
        patterns.append({
            "type": "pressing",
            "title": "Pressing variavel por contexto",
            "detail": f"Pressing varia de {pressing_stats['min']}m a {pressing_stats['max']}m. O time ajusta intensidade conforme o adversario.",
            "confidence": "media"
        })

    # 4. Largura consistente (jogo ensaiado pelas pontas)
    if width_stats["consistent"] and width_stats["avg"] > 45:
        patterns.append({
            "type": "width",
            "title": "Jogo largo ensaiado",
            "detail": f"Largura media de {width_stats['avg']}m mantida em todas as partidas. Indica jogadas ensaiadas com amplitude pelas pontas.",
            "confidence": "alta"
        })
    elif width_stats["consistent"] and width_stats["avg"] < 35:
        patterns.append({
            "type": "width",
            "title": "Jogo centralizado padrao",
            "detail": f"Largura media de {width_stats['avg']}m. O time concentra jogadas pelo meio de campo de forma consistente.",
            "confidence": "alta"
        })

    # 5. Profundidade (verticalidade)
    if depth_stats["consistent"]:
        if depth_stats["avg"] > 20:
            patterns.append({
                "type": "depth",
                "title": "Time vertical e profundo",
                "detail": f"Profundidade de {depth_stats['avg']}m constante. O time busca profundidade de forma padronizada — possivel padrao de bolas longas ou contra-ataques ensaiados.",
                "confidence": "alta"
            })
        elif depth_stats["avg"] < 14:
            patterns.append({
                "type": "depth",
                "title": "Linhas muito juntas",
                "detail": f"Profundidade de apenas {depth_stats['avg']}m. Time joga com linhas compactas — padrao de bloco bem organizado.",
                "confidence": "alta"
            })

    # 6. Estilo dominante
    styles = [m["style"] for m in per_match]
    style_counter = Counter(styles)
    if style_counter:
        top_style, top_sc = style_counter.most_common(1)[0]
        if top_sc >= n * 0.6:
            patterns.append({
                "type": "style",
                "title": f"Estilo dominante: {top_style}",
                "detail": f"Em {top_sc} de {n} partidas o time jogou no mesmo estilo. Forte indicador de identidade tatica.",
                "confidence": "alta"
            })

    return jsonify({
        "team": team_name,
        "matches_analyzed": n,
        "per_match": per_match,
        "stats": {
            "compactness": compact_stats,
            "width": width_stats,
            "depth": depth_stats,
            "pressing": pressing_stats,
        },
        "top_formations": [{"formation": f, "count": c, "percent": round(c/total_forms*100, 1)} for f, c in top_formations],
        "patterns": patterns
    })


if __name__ == "__main__":
    print("Soccer Mind Backend running on http://localhost:5000")
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
