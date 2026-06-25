import cv2
import numpy as np
from ultralytics import YOLO
from scipy.spatial import Delaunay, ConvexHull
from collections import Counter
import os
import json
import time

MODEL = None

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


def classify_teams(frame, boxes, h, w):
    colors = []
    for (x1, y1, x2, y2) in boxes:
        x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
        jy1 = max(0, y1)
        jy2 = min(h, y1 + (y2 - y1) // 2)
        jx1 = max(0, x1 + (x2 - x1) // 4)
        jx2 = min(w, x2 - (x2 - x1) // 4)
        if jx2 <= jx1 or jy2 <= jy1:
            colors.append((0, 0, 0))
            continue
        roi = frame[jy1:jy2, jx1:jx2]
        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
        colors.append(cv2.mean(hsv)[:3])
    if len(colors) < 2:
        return [0] * len(colors)
    arr = np.float32(colors)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, labels, _ = cv2.kmeans(arr, 2, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
    return labels.flatten().tolist()


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


def draw_overlay(frame, detections, h, w):
    if len(detections) < 3:
        return frame

    result = frame.copy()
    boxes = [d['box'] for d in detections]
    foot_pts = [(int((x1 + x2) / 2), int(y2)) for (x1, y1, x2, y2) in boxes]
    teams = classify_teams(frame, boxes, h, w)
    px_m = estimate_px_per_m(foot_pts, w, h)

    t0_idx = [i for i, t in enumerate(teams) if t == 0]
    t1_idx = [i for i, t in enumerate(teams) if t == 1]
    if len(t0_idx) >= len(t1_idx):
        main_idx, other_idx = t0_idx, t1_idx
    else:
        main_idx, other_idx = t1_idx, t0_idx

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


def process_video(video_path, output_dir, team_a_name="Team A", team_b_name="Team B", progress_callback=None):
    model = get_model()
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None, None

    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    timestamp = int(time.time())
    video_out_path = os.path.join(output_dir, f"tactical_{timestamp}.mp4")
    report_path = os.path.join(output_dir, f"report_{timestamp}.json")

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

        result_frame = draw_overlay(frame, last_dets, h, w)
        out.write(result_frame)

        if count % skip_analysis == 0 and len(last_dets) >= 4:
            boxes = [d['box'] for d in last_dets]
            foot = [(int((a + c) / 2), int(d)) for a, b, c, d in boxes]
            teams = classify_teams(frame, boxes, h, w)
            px_m = estimate_px_per_m(foot, w, h)
            t0 = [foot[i] for i, t in enumerate(teams) if t == 0]
            t1 = [foot[i] for i, t in enumerate(teams) if t == 1]
            if len(t0) >= 2 and len(t1) >= 2:
                wa = (max(p[0] for p in t0) - min(p[0] for p in t0)) / px_m
                da = (max(p[1] for p in t0) - min(p[1] for p in t0)) / px_m
                wb = (max(p[0] for p in t1) - min(p[0] for p in t1)) / px_m
                db = (max(p[1] for p in t1) - min(p[1] for p in t1)) / px_m
                c0 = (np.mean([p[0] for p in t0]), np.mean([p[1] for p in t0]))
                c1 = (np.mean([p[0] for p in t1]), np.mean([p[1] for p in t1]))
                gap = np.sqrt((c0[0] - c1[0]) ** 2 + (c0[1] - c1[1]) ** 2) / px_m
                stats.append({
                    'fa': detect_formation(t0, h),
                    'fb': detect_formation(t1, h),
                    'ca': calc_compactness(t0, px_m),
                    'cb': calc_compactness(t1, px_m),
                    'wa': wa, 'da': da, 'wb': wb, 'db': db,
                    'pab': calc_pressing(t0, t1, px_m),
                    'pba': calc_pressing(t1, t0, px_m),
                    'gap': gap,
                    'na': len(t0), 'nb': len(t1)
                })

        if progress_callback and count % 100 == 0:
            progress_callback(count, total)

    cap.release()
    out.release()

    report = generate_report(stats, team_a_name, team_b_name)
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

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
        style = "ALTA PRESSÃO (Gegenpressing)"
    elif pavg < 12:
        style = "BLOCO MÉDIO-ALTO"
    elif pavg < 16:
        style = "BLOCO MÉDIO"
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
