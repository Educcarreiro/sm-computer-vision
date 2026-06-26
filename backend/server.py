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
CORS(app, resources={r"/api/*": {"origins": "*"}})

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
            [ytdlp_path, "--js-runtimes", "nodejs,deno", "-f", "best[height<=720]", "-o", video_path, url],
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
            # Aguardar o arquivo ser liberado pelo OpenCV no Windows
            for _ in range(10):
                try:
                    with open(video_out, 'rb') as f:
                        f.read(1)
                    break
                except PermissionError:
                    time.sleep(1)
            subprocess.run([
                FFMPEG, "-i", video_out,
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                "-y", web_path
            ], capture_output=True, timeout=3600)
            if os.path.exists(web_path):
                for _ in range(5):
                    try:
                        os.remove(video_out)
                        break
                    except PermissionError:
                        time.sleep(1)
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
    """Analisa padrões táticos profundos de um time em múltiplas partidas"""
    data = request.json
    team_name = data.get("team", "").strip()
    if not team_name:
        return jsonify({"error": "Nome do time e obrigatorio"}), 400

    gallery = load_gallery()
    for k, v in jobs.items():
        if v.get("status") == "done" and v.get("report"):
            if not any(g.get("id") == k for g in gallery):
                gallery.append({"id": k, "report": v["report"]})

    import unicodedata
    def normalize(s):
        return unicodedata.normalize('NFKD', s.lower().strip()).encode('ascii', 'ignore').decode('ascii')

    search = normalize(team_name)

    matches = []
    for item in gallery:
        report = item.get("report")
        if not report:
            continue
        ta = report.get("team_a", {})
        tb = report.get("team_b", {})
        opponent_data = None
        team_data = None
        if normalize(ta.get("name", "")) == search:
            team_data = ta
            opponent_data = tb
        elif normalize(tb.get("name", "")) == search:
            team_data = tb
            opponent_data = ta
        if team_data:
            matches.append({
                "match_id": item.get("id"),
                "opponent": opponent_data.get("name", "?") if opponent_data else "?",
                "date": item.get("created_at", ""),
                "data": team_data,
                "opponent_data": opponent_data or {},
                "matchup": report.get("matchup", {})
            })

    if len(matches) < 2:
        return jsonify({"error": f"Precisa de pelo menos 2 analises do {team_name}. Encontradas: {len(matches)}"}), 400

    import statistics
    from collections import Counter

    n = len(matches)
    formations_all = []
    per_match = []

    vals = {"compact": [], "width": [], "depth": [], "pressing": [], "players": []}
    opp_vals = {"compact": [], "pressing": []}
    was_more_compact = 0
    was_more_aggressive = 0
    was_wider = 0

    for m in matches:
        d = m["data"]
        od = m["opponent_data"]
        mu = m["matchup"]

        vals["compact"].append(d.get("compactness", 0))
        vals["width"].append(d.get("width", 0))
        vals["depth"].append(d.get("depth", 0))
        vals["pressing"].append(d.get("pressing", 0))
        vals["players"].append(d.get("players_avg", 0))
        opp_vals["compact"].append(od.get("compactness", 0))
        opp_vals["pressing"].append(od.get("pressing", 0))

        if mu.get("more_compact", "").lower() == team_name.lower():
            was_more_compact += 1
        if mu.get("more_aggressive", "").lower() == team_name.lower():
            was_more_aggressive += 1
        if mu.get("wider_play", "").lower() == team_name.lower():
            was_wider += 1

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
            "style": mu.get("style", "?")
        })

    def calc_stats(v):
        v = [x for x in v if x > 0]
        if not v:
            return {"avg": 0, "std": 0, "min": 0, "max": 0, "consistent": True}
        avg = round(statistics.mean(v), 1)
        std = round(statistics.stdev(v), 1) if len(v) > 1 else 0
        cv = (std / avg * 100) if avg > 0 else 0
        return {"avg": avg, "std": std, "min": round(min(v), 1), "max": round(max(v), 1), "consistent": cv < 15}

    stats = {k: calc_stats(v) for k, v in vals.items()}
    form_counter = Counter(formations_all)
    top_formations = form_counter.most_common(5)
    total_forms = sum(form_counter.values())

    # ═══ ANÁLISE PROFUNDA ═══
    insights = []

    # ── 1. PERFIL TÁTICO GERAL ──
    avg_p = stats["pressing"]["avg"]
    avg_w = stats["width"]["avg"]
    avg_d = stats["depth"]["avg"]
    avg_c = stats["compact"]["avg"]

    if avg_p < 10:
        perfil_pressing = "time de pressao altissima que sufoca o adversario na saida de bola"
    elif avg_p < 13:
        perfil_pressing = "time que pressa de forma agressiva no campo adversario"
    elif avg_p < 16:
        perfil_pressing = "time que espera o adversario no bloco medio antes de pressionar"
    else:
        perfil_pressing = "time que recua e espera o adversario vir, priorizando organizacao defensiva"

    ratio_wd = avg_w / avg_d if avg_d > 0 else 1
    if ratio_wd > 3.2:
        perfil_forma = "jogo extremamente horizontal — o time abre muito o campo, buscando superioridade numerica pelas pontas"
    elif ratio_wd > 2.5:
        perfil_forma = "jogo largo com boa amplitude — busca triangulacoes pelas laterais e cruzamentos"
    elif ratio_wd > 1.8:
        perfil_forma = "equilíbrio entre largura e profundidade — alterna entre jogo pelo meio e pelas pontas"
    else:
        perfil_forma = "jogo muito vertical e direto — privilegia passes em profundidade e contra-ataques rapidos"

    insights.append({
        "category": "PERFIL TATICO",
        "icon": "brain",
        "items": [
            {
                "title": "Identidade de jogo",
                "detail": f"{team_name} e um {perfil_pressing}. Sua forma tatica indica {perfil_forma}.",
                "confidence": "alta"
            }
        ]
    })

    # ── 2. AGRESSIVIDADE ──
    agg_items = []
    pct_aggressive = round(was_more_aggressive / n * 100)
    pct_compact = round(was_more_compact / n * 100)

    if pct_aggressive > 70:
        agg_items.append({
            "title": f"Agressividade dominante ({pct_aggressive}% das partidas)",
            "detail": f"{team_name} foi o time mais agressivo em {was_more_aggressive} de {n} partidas. Isso indica um padrao sistematico de buscar o gol ativamente, nao apenas reagir ao adversario.",
            "confidence": "alta"
        })
    elif pct_aggressive > 40:
        agg_items.append({
            "title": f"Agressividade equilibrada ({pct_aggressive}%)",
            "detail": f"O time alterna entre ser agressivo e reativo dependendo do adversario. Sugere um treinador que adapta o plano de jogo.",
            "confidence": "media"
        })
    else:
        agg_items.append({
            "title": f"Perfil reativo ({100 - pct_aggressive}% defensivo)",
            "detail": f"{team_name} raramente e o time mais agressivo. Prefere absorver a pressao e contra-atacar.",
            "confidence": "alta"
        })

    if avg_p < 14:
        agg_items.append({
            "title": f"Pressing alto ativo ({avg_p}m media)",
            "detail": f"A distancia media de pressing de {avg_p}m indica que {team_name} pressiona o adversario ainda no campo de ataque. Padrao tipico de times que treinam triggers de pressao — quando a bola vai pro zagueiro ou lateral, todo o time sobe junto. Isso sugere jogadas ensaiadas de recuperacao de bola.",
            "confidence": "alta"
        })
    elif avg_p < 17:
        agg_items.append({
            "title": f"Pressing seletivo ({avg_p}m media)",
            "detail": f"{team_name} nao pressa o tempo todo — escolhe os momentos. A distancia de {avg_p}m sugere que o time espera o adversario chegar ao meio campo antes de fechar os espacos. Isso pode indicar uma armadilha tatica: deixar o adversario avançar e entao pressionar com intensidade.",
            "confidence": "media"
        })

    insights.append({"category": "AGRESSIVIDADE", "icon": "zap", "items": agg_items})

    # ── 3. PADROES DE JOGADA ──
    play_items = []

    if avg_w > 48 and stats["width"]["consistent"]:
        play_items.append({
            "title": "Jogadas ensaiadas pelas pontas",
            "detail": f"A largura consistente de {avg_w}m em todas as partidas indica que {team_name} tem um padrao claro de jogo pelas laterais. Os laterais ou pontas abrem o campo de forma padronizada — provavelmente com movimentos ensaiados de overlap (lateral passando por cima do ponta) ou underlap (lateral cortando por dentro).",
            "confidence": "alta"
        })

    if avg_d > 18 and stats["depth"]["consistent"]:
        play_items.append({
            "title": "Padrao de bolas em profundidade",
            "detail": f"Profundidade de {avg_d}m constante sugere que {team_name} trabalha com atacantes fazendo movimentos de ruptura (correndo nas costas da defesa). Esse padrao repetido indica jogada ensaiada — possivelmente bolas longas do meio-campo ou lançamentos do zagueiro direto para o atacante.",
            "confidence": "alta"
        })

    if avg_c < 450 and stats["compact"]["consistent"]:
        play_items.append({
            "title": "Triangulacoes curtas no meio",
            "detail": f"A compactacao baixa ({avg_c}m2) indica jogadores muito proximos. Isso favorece triangulacoes rapidas (toque-passa-recebe). Padrao tipico de times que jogam no estilo tiki-taka ou pressionam em bloco.",
            "confidence": "alta"
        })
    elif avg_c > 600:
        play_items.append({
            "title": "Time espaçado — jogo direto",
            "detail": f"A compactacao alta ({avg_c}m2) mostra jogadores espalhados. Isso indica um time que prefere jogo direto com passes longos, evitando construcao elaborada.",
            "confidence": "media"
        })

    if stats["pressing"]["consistent"] and stats["width"]["consistent"]:
        play_items.append({
            "title": "Sistema tatico automatizado",
            "detail": f"Tanto o pressing ({avg_p}m) quanto a largura ({avg_w}m) sao consistentes entre partidas. Isso e um forte indicador de que o time tem movimentos ensaiados e bem treinados — os jogadores sabem exatamente onde se posicionar independente do adversario.",
            "confidence": "alta"
        })

    if not play_items:
        play_items.append({
            "title": "Padroes variados",
            "detail": f"{team_name} nao repete um padrao claro de jogada entre as partidas analisadas. Pode indicar adaptacao tatica ou falta de identidade definida.",
            "confidence": "baixa"
        })

    insights.append({"category": "PADROES DE JOGADA", "icon": "target", "items": play_items})

    # ── 4. ORGANIZACAO DEFENSIVA ──
    def_items = []
    if pct_compact > 60:
        def_items.append({
            "title": f"Defesa organizada ({pct_compact}% mais compacto)",
            "detail": f"{team_name} foi o time mais compacto em {was_more_compact} de {n} partidas. Indica uma organizacao defensiva superior — os jogadores mantem as distancias corretas entre si, dificultando infiltracoes do adversario.",
            "confidence": "alta"
        })

    if avg_d < 16:
        def_items.append({
            "title": "Linhas defensivas juntas",
            "detail": f"Com profundidade de apenas {avg_d}m, {team_name} mantem defesa e meio-campo muito proximos. Isso elimina espacos entre linhas que o adversario poderia explorar.",
            "confidence": "alta"
        })
    elif avg_d > 22:
        def_items.append({
            "title": "Vulnerabilidade entre linhas",
            "detail": f"Profundidade de {avg_d}m cria um espaco grande entre defesa e meio-campo. Adversarios podem explorar esse espaco com jogadores entre linhas (meia-atacantes).",
            "confidence": "media"
        })

    if def_items:
        insights.append({"category": "ORGANIZACAO DEFENSIVA", "icon": "shield", "items": def_items})

    # ── 5. CONCLUSAO ──
    conclusion_parts = []
    conclusion_parts.append(f"{team_name} apresenta um estilo de jogo {'consistente' if stats['pressing']['consistent'] and stats['width']['consistent'] else 'adaptativo'} ao longo das {n} partidas analisadas.")

    if was_more_aggressive > n / 2:
        conclusion_parts.append(f"E um time predominantemente ofensivo que busca impor seu jogo.")
    else:
        conclusion_parts.append(f"Tende a adaptar sua abordagem ao adversario.")

    if stats["width"]["consistent"] and avg_w > 45:
        conclusion_parts.append(f"Suas jogadas ensaiadas priorizam amplitude pelas pontas ({avg_w}m de largura).")
    if stats["pressing"]["consistent"] and avg_p < 14:
        conclusion_parts.append(f"O pressing alto e coordenado ({avg_p}m) sugere triggers de pressao bem treinados.")
    if avg_c < 500 and stats["compact"]["consistent"]:
        conclusion_parts.append(f"A compactacao ({avg_c}m2) favorece troca de passes rapidos e triangulacoes.")

    insights.append({
        "category": "CONCLUSAO TATICA",
        "icon": "brain",
        "items": [{
            "title": "Resumo da identidade tatica",
            "detail": " ".join(conclusion_parts),
            "confidence": "alta"
        }]
    })

    return jsonify({
        "team": team_name,
        "matches_analyzed": n,
        "per_match": per_match,
        "stats": {k: calc_stats(v) for k, v in vals.items()},
        "top_formations": [{"formation": f, "count": c, "percent": round(c / total_forms * 100, 1)} for f, c in top_formations],
        "insights": insights
    })


if __name__ == "__main__":
    print("Soccer Mind Backend running on http://localhost:5000")
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
