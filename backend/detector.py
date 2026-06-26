import cv2
import numpy as np
from ultralytics import YOLO
from scipy.spatial import Delaunay, ConvexHull
from collections import Counter
import os
import json
import time
import base64

MODEL = None

# ═══════════════════════════════════════════
# BANCO DE CORES DE TIMES CONHECIDOS (HSV)
# ═══════════════════════════════════════════
KNOWN_TEAMS = {
    "palmeiras":    {"hsv": (45, 150, 100),  "label": "Palmeiras"},
    "corinthians":  {"hsv": (0, 0, 200),     "label": "Corinthians"},
    "flamengo":     {"hsv": (0, 200, 180),   "label": "Flamengo"},
    "fluminense":   {"hsv": (0, 0, 190),     "label": "Fluminense"},
    "vasco":        {"hsv": (0, 0, 40),      "label": "Vasco"},
    "botafogo":     {"hsv": (0, 0, 30),      "label": "Botafogo"},
    "sao paulo":    {"hsv": (0, 0, 220),     "label": "São Paulo"},
    "santos":       {"hsv": (0, 0, 230),     "label": "Santos"},
    "gremio":       {"hsv": (105, 180, 150), "label": "Grêmio"},
    "internacional":{"hsv": (0, 200, 170),   "label": "Internacional"},
    "cruzeiro":     {"hsv": (110, 200, 180), "label": "Cruzeiro"},
    "atletico mg":  {"hsv": (0, 0, 35),      "label": "Atlético MG"},
    "bahia":        {"hsv": (110, 180, 200), "label": "Bahia"},
    "fortaleza":    {"hsv": (0, 200, 160),   "label": "Fortaleza"},
    "vitoria":      {"hsv": (0, 220, 150),   "label": "Vitória"},
    "sport":        {"hsv": (0, 210, 160),   "label": "Sport"},
    "brasil":       {"hsv": (25, 200, 220),  "label": "Brasil"},
    "argentina":    {"hsv": (100, 120, 220), "label": "Argentina"},
    "japao":        {"hsv": (110, 200, 190), "label": "Japão"},
    "alemanha":     {"hsv": (0, 0, 240),     "label": "Alemanha"},
    "franca":       {"hsv": (110, 190, 170), "label": "França"},
    "espanha":      {"hsv": (0, 220, 190),   "label": "Espanha"},
    "portugal":     {"hsv": (0, 200, 160),   "label": "Portugal"},
    "italia":       {"hsv": (110, 180, 180), "label": "Itália"},
    "inglaterra":   {"hsv": (0, 0, 240),     "label": "Inglaterra"},
    "holanda":      {"hsv": (12, 230, 220),  "label": "Holanda"},
    "belgica":      {"hsv": (0, 220, 180),   "label": "Bélgica"},
    "uruguai":      {"hsv": (100, 160, 200), "label": "Uruguai"},
    "colombia":     {"hsv": (20, 220, 230),  "label": "Colômbia"},
    "mexico":       {"hsv": (50, 180, 130),  "label": "México"},
}


def get_model():
    global MODEL
    if MODEL is None:
        MODEL = YOLO("yolov8n.pt")
    return MODEL


def estimate_px_per_m(points, fw, fh):
    if len(points) < 2:
        return 5.0
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    sx = (max(xs) - min(xs)) or fw
    sy = (max(ys) - min(ys)) or fh
    return ((sx / 56.0) + (sy / 35.0)) / 2.0


def get_jersey_color_no_grass(frame, x1, y1, x2, y2):
    """Extrai cor do uniforme excluindo pixels verdes (gramado)"""
    x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
    h, w = frame.shape[:2]
    # Focar no tronco (metade superior da bounding box, centro horizontal)
    jy1 = max(0, y1 + int((y2 - y1) * 0.15))
    jy2 = min(h, y1 + int((y2 - y1) * 0.50))
    jx1 = max(0, x1 + int((x2 - x1) * 0.2))
    jx2 = min(w, x2 - int((x2 - x1) * 0.2))
    if jx2 <= jx1 or jy2 <= jy1:
        return None
    roi = frame[jy1:jy2, jx1:jx2]
    hsv_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    # Criar máscara para excluir pixels verdes (gramado) - H entre 35-85, S > 40
    h_chan = hsv_roi[:, :, 0]
    s_chan = hsv_roi[:, :, 1]
    grass_mask = (h_chan >= 35) & (h_chan <= 85) & (s_chan > 40)
    non_grass = ~grass_mask

    if np.sum(non_grass) < 10:
        # Quase tudo é gramado, usar média geral
        return cv2.mean(hsv_roi)[:3]

    # Média apenas dos pixels não-gramado
    masked = hsv_roi[non_grass]
    return tuple(np.mean(masked, axis=0))


def classify_teams(frame, boxes, h, w):
    """Classifica jogadores em 2 times usando cor sem gramado"""
    colors = []
    for (x1, y1, x2, y2) in boxes:
        c = get_jersey_color_no_grass(frame, x1, y1, x2, y2)
        colors.append(c if c else (0, 0, 0))
    if len(colors) < 2:
        return [0] * len(colors), [(0, 0, 0), (0, 0, 0)]
    arr = np.float32(colors)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, labels, centers = cv2.kmeans(arr, 2, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
    return labels.flatten().tolist(), centers.tolist()


def match_team_to_cluster(team_name, centers):
    """Tenta associar o nome do time ao cluster correto usando banco de cores"""
    key = team_name.lower().strip()
    if key not in KNOWN_TEAMS:
        return None
    known_hsv = np.array(KNOWN_TEAMS[key]["hsv"], dtype=np.float32)
    dists = []
    for c in centers:
        c_arr = np.array(c, dtype=np.float32)
        # Distância ponderada: Hue é circular, Sat e Val normais
        h_diff = min(abs(c_arr[0] - known_hsv[0]), 180 - abs(c_arr[0] - known_hsv[0]))
        sv_diff = np.sqrt((c_arr[1] - known_hsv[1])**2 + (c_arr[2] - known_hsv[2])**2)
        dists.append(h_diff * 2 + sv_diff)
    return int(np.argmin(dists))


COLOR_NAME_TO_HSV = {
    "amarelo":  (25, 200, 220),
    "azul":     (110, 200, 180),
    "vermelho": (0, 220, 180),
    "branco":   (0, 0, 230),
    "preto":    (0, 0, 35),
    "verde":    (50, 180, 130),
    "laranja":  (12, 230, 200),
    "roxo":     (140, 180, 150),
    "cinza":    (0, 0, 130),
    "vinho":    (170, 180, 100),
}


def match_color_hint_to_cluster(color_name, centers):
    """Associa uma cor de camisa selecionada pelo usuário ao cluster correto"""
    hsv = COLOR_NAME_TO_HSV.get(color_name.lower().strip())
    if not hsv:
        return None
    known = np.array(hsv, dtype=np.float32)
    dists = []
    for c in centers:
        c_arr = np.array(c, dtype=np.float32)
        h_diff = min(abs(c_arr[0] - known[0]), 180 - abs(c_arr[0] - known[0]))
        sv_diff = np.sqrt((c_arr[1] - known[1])**2 + (c_arr[2] - known[2])**2)
        dists.append(h_diff * 2 + sv_diff)
    return int(np.argmin(dists))


def assign_teams(team_a_name, team_b_name, centers, calibration=None):
    """
    Determina qual cluster (0 ou 1) corresponde a qual time.
    Prioridade: calibração manual > cor da camisa > banco de cores > padrão
    Retorna: (cluster_idx_para_team_a, cluster_idx_para_team_b)
    """
    if calibration:
        # Calibração manual por clique
        if "team_a_cluster" in calibration:
            return calibration["team_a_cluster"], calibration.get("team_b_cluster", 1)

        # Cor da camisa selecionada pelo usuário
        if "jersey_color_hint" in calibration:
            match = match_color_hint_to_cluster(calibration["jersey_color_hint"], centers)
            if match is not None:
                return match, 1 - match

    match_a = match_team_to_cluster(team_a_name, centers)
    match_b = match_team_to_cluster(team_b_name, centers)

    if match_a is not None and match_b is not None and match_a != match_b:
        return match_a, match_b
    if match_a is not None:
        return match_a, 1 - match_a
    if match_b is not None:
        return 1 - match_b, match_b
    return 0, 1


# ═══════════════════════════════════════════
# CALIBRAÇÃO - Primeiro frame
# ═══════════════════════════════════════════

def extract_calibration_frame(video_path):
    """Extrai primeiro frame com detecções e retorna imagem + dados dos jogadores"""
    model = get_model()
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None

    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Tentar encontrar um bom frame nos primeiros 5 segundos
    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
    best_frame = None
    best_dets = []

    for _ in range(fps * 5):
        ret, frame = cap.read()
        if not ret:
            break
        results = model(frame, verbose=False, conf=0.3, classes=[0])
        dets = []
        if results and results[0].boxes is not None:
            for box in results[0].boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                bh, bw = y2 - y1, x2 - x1
                if bh > h * 0.4 or bw > w * 0.3 or bh < 15 or bw < 8:
                    continue
                dets.append((float(x1), float(y1), float(x2), float(y2)))
        if len(dets) > len(best_dets):
            best_dets = dets
            best_frame = frame.copy()
        if len(dets) >= 8:
            break

    cap.release()
    if best_frame is None or len(best_dets) < 4:
        return None

    labels, centers = classify_teams(best_frame, best_dets, h, w)

    # Desenhar marcadores no frame
    display = best_frame.copy()
    players = []
    for i, (x1, y1, x2, y2) in enumerate(best_dets):
        cx = int((x1 + x2) / 2)
        cy = int(y2)
        cluster = labels[i]
        color = (255, 200, 50) if cluster == 0 else (50, 50, 255)
        cv2.circle(display, (cx, cy), 12, color, 2, cv2.LINE_AA)
        cv2.circle(display, (cx, cy), 5, color, -1, cv2.LINE_AA)
        cv2.putText(display, str(i), (cx + 14, cy + 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1, cv2.LINE_AA)
        players.append({
            "id": i,
            "x": cx, "y": cy,
            "cluster": cluster,
            "box": [x1, y1, x2, y2]
        })

    # Legenda
    cv2.putText(display, "Cluster 0", (10, 25),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 200, 50), 2)
    cv2.putText(display, "Cluster 1", (10, 50),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (50, 50, 255), 2)

    _, buffer = cv2.imencode('.jpg', display, [cv2.IMWRITE_JPEG_QUALITY, 85])
    frame_b64 = base64.b64encode(buffer).decode('utf-8')

    return {
        "frame": frame_b64,
        "players": players,
        "centers": centers,
        "width": w,
        "height": h
    }


# ═══════════════════════════════════════════
# ANÁLISE TÁTICA
# ═══════════════════════════════════════════

def calc_compactness(points, px_m):
    if len(points) < 3:
        return 0
    try:
        hull = ConvexHull(np.array(points))
        return hull.volume / (px_m ** 2)
    except:
        return 0


def detect_formation(points, frame_h):
    if len(points) < 3:
        return "?"
    ys = sorted([p[1] for p in points])
    lines, cur = [], [ys[0]]
    threshold = frame_h * 0.08
    for i in range(1, len(ys)):
        if ys[i] - ys[i - 1] > threshold:
            lines.append(cur)
            cur = [ys[i]]
        else:
            cur.append(ys[i])
    lines.append(cur)
    counts = [len(l) for l in lines]
    if counts and counts[0] == 1:
        counts = counts[1:]
    if counts and counts[-1] == 1:
        counts = counts[:-1]
    return "-".join(str(c) for c in counts) if counts else "?"


def calc_pressing(t_a, t_b, px_m):
    if not t_a or not t_b:
        return 0
    mins = []
    for pa in t_a:
        d = min(np.sqrt((pa[0] - q[0]) ** 2 + (pa[1] - q[1]) ** 2) for q in t_b)
        mins.append(d / px_m)
    return float(np.mean(mins))


def draw_overlay(frame, detections, h, w, team_a_cluster=0):
    if len(detections) < 3:
        return frame

    result = frame.copy()
    boxes = [d['box'] for d in detections]
    foot_pts = [(int((x1 + x2) / 2), int(y2)) for (x1, y1, x2, y2) in boxes]
    teams, _ = classify_teams(frame, boxes, h, w)
    px_m = estimate_px_per_m(foot_pts, w, h)

    main_idx = [i for i, t in enumerate(teams) if t == team_a_cluster]
    other_idx = [i for i, t in enumerate(teams) if t != team_a_cluster]

    if not main_idx:
        t0_idx = [i for i, t in enumerate(teams) if t == 0]
        t1_idx = [i for i, t in enumerate(teams) if t == 1]
        main_idx = t0_idx if len(t0_idx) >= len(t1_idx) else t1_idx
        other_idx = t1_idx if main_idx == t0_idx else t0_idx

    main_pts = [foot_pts[i] for i in main_idx]

    if len(main_pts) >= 3:
        arr = np.array(main_pts)
        try:
            tri = Delaunay(arr)
            edges_done = set()
            for simplex in tri.simplices:
                for a in range(3):
                    for b in range(a + 1, 3):
                        ia, ib = simplex[a], simplex[b]
                        edge = (min(ia, ib), max(ia, ib))
                        if edge in edges_done:
                            continue
                        edges_done.add(edge)
                        p1, p2 = main_pts[ia], main_pts[ib]
                        dist_px = np.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)
                        dist_m = dist_px / px_m
                        if dist_m > 28:
                            continue
                        cv2.line(result, p1, p2, (255, 255, 255), 1, cv2.LINE_AA)
                        mx, my = (p1[0] + p2[0]) // 2, (p1[1] + p2[1]) // 2
                        label = f"{dist_m:.1f}m"
                        font = cv2.FONT_HERSHEY_SIMPLEX
                        sc = 0.30
                        (tw, th), _ = cv2.getTextSize(label, font, sc, 1)
                        rx1, ry1 = mx - tw // 2 - 2, my - th // 2 - 2
                        rx2, ry2 = mx + tw // 2 + 2, my + th // 2 + 2
                        sub = result[max(0, ry1):min(h, ry2), max(0, rx1):min(w, rx2)]
                        if sub.size > 0:
                            cv2.addWeighted(sub, 0.35, np.zeros_like(sub), 0.65, 0, sub)
                        cv2.putText(result, label, (mx - tw // 2, my + th // 2),
                                    font, sc, (255, 255, 255), 1, cv2.LINE_AA)
        except:
            pass

    for p in main_pts:
        cv2.circle(result, p, 9, (255, 255, 255), 1, cv2.LINE_AA)
        cv2.circle(result, p, 4, (255, 255, 255), -1, cv2.LINE_AA)
    for i in other_idx:
        p = foot_pts[i]
        cv2.circle(result, p, 7, (0, 0, 200), 1, cv2.LINE_AA)
        cv2.circle(result, p, 3, (0, 0, 200), -1, cv2.LINE_AA)

    return result


def process_video(video_path, output_dir, team_a_name="Team A", team_b_name="Team B",
                  progress_callback=None, calibration=None):
    model = get_model()
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None, None

    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Determinar mapeamento de clusters no primeiro frame
    team_a_cluster = 0
    team_b_cluster = 1

    # Ler alguns frames pra determinar clusters
    temp_frames = []
    for _ in range(min(fps * 3, total)):
        ret, frame = cap.read()
        if not ret:
            break
        temp_frames.append(frame)

    if temp_frames:
        best_frame = temp_frames[-1]
        results = model(best_frame, verbose=False, conf=0.3, classes=[0])
        if results and results[0].boxes is not None:
            init_boxes = []
            for box in results[0].boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                bh, bw = y2 - y1, x2 - x1
                if bh > h * 0.4 or bw > w * 0.3 or bh < 15 or bw < 8:
                    continue
                init_boxes.append((float(x1), float(y1), float(x2), float(y2)))
            if len(init_boxes) >= 4:
                _, centers = classify_teams(best_frame, init_boxes, h, w)
                team_a_cluster, team_b_cluster = assign_teams(
                    team_a_name, team_b_name, centers, calibration
                )

    # Reset video
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

    timestamp = int(time.time())
    video_out_path = os.path.join(output_dir, f"tactical_{timestamp}.mp4")

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(video_out_path, fourcc, fps, (w, h))

    count = 0
    last_dets = []
    stats = []
    skip_analysis = max(1, fps)

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        count += 1

        if count % 2 == 0:
            results = model(frame, verbose=False, conf=0.3, classes=[0])
            dets = []
            if results and results[0].boxes is not None:
                for box in results[0].boxes:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    bh, bw = y2 - y1, x2 - x1
                    if bh > h * 0.4 or bw > w * 0.3 or bh < 15 or bw < 8:
                        continue
                    dets.append({'box': (float(x1), float(y1), float(x2), float(y2)),
                                 'conf': float(box.conf[0])})
            last_dets = dets

        result_frame = draw_overlay(frame, last_dets, h, w, team_a_cluster)
        out.write(result_frame)

        if count % skip_analysis == 0 and len(last_dets) >= 4:
            boxes = [d['box'] for d in last_dets]
            foot = [(int((a + c) / 2), int(d)) for a, b, c, d in boxes]
            teams, _ = classify_teams(frame, boxes, h, w)
            px_m = estimate_px_per_m(foot, w, h)
            ta = [foot[i] for i, t in enumerate(teams) if t == team_a_cluster]
            tb = [foot[i] for i, t in enumerate(teams) if t == team_b_cluster]
            if len(ta) >= 2 and len(tb) >= 2:
                wa = (max(p[0] for p in ta) - min(p[0] for p in ta)) / px_m
                da = (max(p[1] for p in ta) - min(p[1] for p in ta)) / px_m
                wb = (max(p[0] for p in tb) - min(p[0] for p in tb)) / px_m
                db = (max(p[1] for p in tb) - min(p[1] for p in tb)) / px_m
                c0 = (np.mean([p[0] for p in ta]), np.mean([p[1] for p in ta]))
                c1 = (np.mean([p[0] for p in tb]), np.mean([p[1] for p in tb]))
                gap = np.sqrt((c0[0] - c1[0]) ** 2 + (c0[1] - c1[1]) ** 2) / px_m
                stats.append({
                    'fa': detect_formation(ta, h),
                    'fb': detect_formation(tb, h),
                    'ca': calc_compactness(ta, px_m),
                    'cb': calc_compactness(tb, px_m),
                    'wa': wa, 'da': da, 'wb': wb, 'db': db,
                    'pab': calc_pressing(ta, tb, px_m),
                    'pba': calc_pressing(tb, ta, px_m),
                    'gap': gap,
                    'na': len(ta), 'nb': len(tb)
                })

        if progress_callback and count % 100 == 0:
            progress_callback(count, total)

    cap.release()
    out.release()

    report = generate_report(stats, team_a_name, team_b_name)
    return video_out_path, report


def generate_report(stats, team_a, team_b):
    if not stats:
        return {"error": "Nenhum dado coletado"}

    def avg(k):
        vals = [s[k] for s in stats if k in s and s[k] > 0]
        return round(float(np.mean(vals)), 1) if vals else 0

    fa = Counter([s['fa'] for s in stats])
    fb = Counter([s['fb'] for s in stats])
    n = len(stats)
    pab, pba = avg('pab'), avg('pba')
    pavg = round((pab + pba) / 2, 1)
    ca, cb = avg('ca'), avg('cb')
    wa, wb = avg('wa'), avg('wb')

    if pavg < 8:
        style = "ALTA PRESSAO (Gegenpressing)"
    elif pavg < 12:
        style = "BLOCO MEDIO-ALTO"
    elif pavg < 16:
        style = "BLOCO MEDIO"
    else:
        style = "BLOCO BAIXO (Reativo)"

    top_forms_a = [{"formation": f, "percent": round(c / n * 100, 1)} for f, c in fa.most_common(5)]
    top_forms_b = [{"formation": f, "percent": round(c / n * 100, 1)} for f, c in fb.most_common(5)]

    return {
        "frames_analyzed": n,
        "team_a": {
            "name": team_a,
            "formations": top_forms_a,
            "compactness": ca,
            "width": avg('wa'),
            "depth": avg('da'),
            "pressing": pab,
            "players_avg": round(float(np.mean([s['na'] for s in stats])), 1)
        },
        "team_b": {
            "name": team_b,
            "formations": top_forms_b,
            "compactness": cb,
            "width": avg('wb'),
            "depth": avg('db'),
            "pressing": pba,
            "players_avg": round(float(np.mean([s['nb'] for s in stats])), 1)
        },
        "matchup": {
            "gap": avg('gap'),
            "pressing_avg": pavg,
            "style": style,
            "more_compact": team_a if ca < cb else team_b,
            "wider_play": team_a if wa > wb else team_b,
            "more_aggressive": team_a if pab < pba else team_b
        }
    }
