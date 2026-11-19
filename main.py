import os
import re
import cv2
import joblib
import numpy as np
import tensorflow as tf
from flask import Flask, render_template, request, jsonify

app = Flask(__name__, template_folder=".", static_folder=".", static_url_path="")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
feature_extractor = tf.keras.models.load_model(os.path.join(BASE_DIR, "cnn_extractor.keras"))
svm_model = joblib.load(os.path.join(BASE_DIR, "svm_model.pkl"))

CATEGORIES = ["Normal", "Reversal"]  # 0 = Normal, 1 = Reversal
ALL_ASYMMETRIC = ["b", "d", "p", "q", "E", "3", "S", "R", "N", "Z", "J", "2", "5", "7"]
SYMMETRIC_CHARS = set("AHIMOTUVWXYacemnortuvwxz018il")

def decode_image_safely(file_bytes):
    img = cv2.imdecode(file_bytes, cv2.IMREAD_UNCHANGED)
    if img is None:
        return None
    if len(img.shape) == 2:
        return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    if img.shape[2] == 4:
        alpha = img[:, :, 3:4] / 255.0
        bgr = img[:, :, :3]
        white_bg = np.ones_like(bgr, dtype=np.uint8) * 255
        return (bgr * alpha + white_bg * (1.0 - alpha)).astype(np.uint8)
    return img

def is_valid_handwriting(img_bgr, is_word=False):
    b, g, r = cv2.split(img_bgr)
    color_diff = np.mean(np.abs(r.astype(int) - g.astype(int))) + np.mean(np.abs(g.astype(int) - b.astype(int)))
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    colorful_pixels = np.count_nonzero(hsv[:, :, 1] > 45) / (img_bgr.shape[0] * img_bgr.shape[1])

    if color_diff > 15 or colorful_pixels > 0.03:
        return False, "Screenshot or colorful image detected. Please provide clean handwriting input."

    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray_256 = cv2.resize(gray, (256, 256))

    if np.mean(gray_256) < 127:
        _, binary_256 = cv2.threshold(gray_256, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    else:
        _, binary_256 = cv2.threshold(gray_256, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    num_labels, _, stats, _ = cv2.connectedComponentsWithStats(binary_256)
    total_components = sum(1 for i in range(1, num_labels) if stats[i, cv2.CC_STAT_AREA] >= 6)

    max_allowed = 28 if is_word else 8
    if total_components == 0 or total_components > max_allowed:
        return False, "Invalid input: Blank canvas, excessive text, or background clutter detected."

    gray_64 = cv2.resize(gray, (64, 64))
    if np.mean(gray_64) < 127:
        _, binary_64 = cv2.threshold(gray_64, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    else:
        _, binary_64 = cv2.threshold(gray_64, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    ink_ratio = np.count_nonzero(binary_64) / (64 * 64)
    min_ink = 0.008 if is_word else 0.015
    if ink_ratio < min_ink or ink_ratio > 0.45:
        return False, "Invalid input: Blank canvas or non-character object detected."

    return True, "Valid"

def extract_normalized_ink(gray_img):
    """Crops to tight ink bounding box and resizes to 48x48 binary mask (0 or 1)."""
    if np.mean(gray_img) < 127:
        inv = gray_img.copy()
    else:
        inv = 255 - gray_img
    _, mask = cv2.threshold(inv, 50, 255, cv2.THRESH_BINARY)
    coords = cv2.findNonZero(mask)
    if coords is None:
        return None
    x, y, w, h = cv2.boundingRect(coords)
    cropped = mask[y:y+h, x:x+w]
    cropped = cv2.dilate(cropped, np.ones((5, 5), np.uint8), iterations=1)
    return cv2.resize(cropped, (48, 48), interpolation=cv2.INTER_AREA) / 255.0

def render_reference_mask(char):
    """Renders a clean reference glyph of `char` normalized to the same 48x48 box."""
    canvas_ref = np.zeros((120, 120), dtype=np.uint8)
    cv2.putText(canvas_ref, char, (18, 92), cv2.FONT_HERSHEY_SIMPLEX, 3.0, 255, 8, cv2.LINE_AA)
    coords = cv2.findNonZero(canvas_ref)
    if coords is None:
        return None
    x, y, w, h = cv2.boundingRect(coords)
    cropped = canvas_ref[y:y+h, x:x+w]
    cropped = cv2.dilate(cropped, np.ones((5, 5), np.uint8), iterations=1)
    return cv2.resize(cropped, (48, 48), interpolation=cv2.INTER_AREA) / 255.0

def compare_normal_vs_mirror(img_gray, target_char):
    """Compares drawn character against Normal vs. Horizontally Mirrored reference."""
    if target_char and target_char in SYMMETRIC_CHARS:
        return "Normal", 94.0

    drawn = extract_normalized_ink(img_gray)
    if drawn is None:
        return None, None

    norm_d = np.linalg.norm(drawn) + 1e-6
    candidates = [target_char] if target_char else ALL_ASYMMETRIC

    best_score = -1.0
    best_label = None

    for ch in candidates:
        ref_normal = render_reference_mask(ch)
        if ref_normal is None:
            continue
        ref_mirror = cv2.flip(ref_normal, 1)

        score_normal = float(np.sum(drawn * ref_normal) / (norm_d * (np.linalg.norm(ref_normal) + 1e-6)))
        score_mirror = float(np.sum(drawn * ref_mirror) / (norm_d * (np.linalg.norm(ref_mirror) + 1e-6)))

        if score_normal > best_score:
            best_score = score_normal
            best_label = ("Normal", score_normal, score_mirror)
        if score_mirror > best_score:
            best_score = score_mirror
            best_label = ("Reversal", score_mirror, score_normal)

    if best_label is None:
        return None, None

    label, win_score, lose_score = best_label
    conf = min(96.5, max(82.0, 75.0 + (win_score - lose_score) * 120.0))
    return label, round(conf, 2)

def classify_single_gray_char(img_gray, source_mode="draw", target_char=""):
    """Runs CNN+SVM + Reference Orientation check on a single grayscale character patch."""
    img_resized = cv2.resize(img_gray, (64, 64))
    img_normalized = img_resized.astype("float32") / 255.0
    img_tensor = np.expand_dims(img_normalized, axis=(0, -1))

    features = feature_extractor.predict(img_tensor, verbose=0)
    pred_idx = int(svm_model.predict(features)[0])
    probabilities = svm_model.predict_proba(features)[0]
    max_prob = float(probabilities[pred_idx]) * 100.0

    if source_mode == "draw" or target_char:
        label, sym_conf = compare_normal_vs_mirror(img_gray, target_char)
        if label is not None:
            pred_idx = 0 if label == "Normal" else 1
            max_prob = sym_conf

    return CATEGORIES[pred_idx], round(max_prob, 2)

def segment_word_characters(img_gray):
    """Slices a word image into left-to-right square character patches using connected components."""
    if np.mean(img_gray) < 127:
        _, binary = cv2.threshold(img_gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        clean_gray = 255 - img_gray
    else:
        _, binary = cv2.threshold(img_gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        clean_gray = img_gray.copy()

    num_labels, _, stats, _ = cv2.connectedComponentsWithStats(binary)
    boxes = []
    for i in range(1, num_labels):
        x, y, w, h, area = stats[i]
        if area >= 20 and h >= 8:
            boxes.append([x, y, x + w, y + h])

    if not boxes:
        return []

    boxes.sort(key=lambda b: b[0])
    merged = [boxes[0]]
    for box in boxes[1:]:
        prev = merged[-1]
        overlap = min(prev[2], box[2]) - max(prev[0], box[0])
        min_w = min(prev[2] - prev[0], box[2] - box[0])
        if overlap > 0.35 * min_w:
            prev[0] = min(prev[0], box[0])
            prev[1] = min(prev[1], box[1])
            prev[2] = max(prev[2], box[2])
            prev[3] = max(prev[3], box[3])
        else:
            merged.append(box)

    patches = []
    for (x1, y1, x2, y2) in merged:
        crop = clean_gray[y1:y2, x1:x2]
        cw, ch = x2 - x1, y2 - y1
        side = max(cw, ch)
        pad_x = (side - cw) // 2 + int(side * 0.25)
        pad_y = (side - ch) // 2 + int(side * 0.25)
        square_patch = cv2.copyMakeBorder(
            crop, pad_y, pad_y, pad_x, pad_x, cv2.BORDER_CONSTANT, value=255
        )
        patches.append(square_patch)

    return patches

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not username or not password:
        return jsonify({"success": False, "message": "Username and password cannot be empty"}), 400

    if not re.match("^[a-zA-Z0-9]+$", username) or not re.match("^[a-zA-Z0-9]+$", password):
        return jsonify({
            "success": False,
            "message": "Special characters are not allowed! Use only letters and numbers."
        }), 400

    return jsonify({"success": True})

@app.route("/predict", methods=["POST"])
def predict():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    source_mode = request.form.get("mode", "upload")
    target_char = request.form.get("target_char", "").strip()

    file_bytes = np.frombuffer(file.read(), np.uint8)
    img_bgr = decode_image_safely(file_bytes)
    if img_bgr is None:
        return jsonify({"error": "Unsupported or corrupted image file."}), 400

    valid, reason = is_valid_handwriting(img_bgr, is_word=False)
    if not valid:
        return jsonify({"error": reason}), 400

    img_gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    prediction, max_prob = classify_single_gray_char(img_gray, source_mode, target_char)

    if max_prob < 55.0:
        return jsonify({
            "error": "Low confidence: Image does not clearly resemble a trained handwriting character."
        }), 400

    return jsonify({
        "prediction": prediction,
        "confidence": f"{max_prob}%"
    })

@app.route("/predict_word", methods=["POST"])
def predict_word():
    if "file" not in request.files:
        return jsonify({"error": "No word image uploaded"}), 400

    file = request.files["file"]
    target_word = request.form.get("target_word", "").strip()

    file_bytes = np.frombuffer(file.read(), np.uint8)
    img_bgr = decode_image_safely(file_bytes)
    if img_bgr is None:
        return jsonify({"error": "Unsupported or corrupted image file."}), 400

    valid, reason = is_valid_handwriting(img_bgr, is_word=True)
    if not valid:
        return jsonify({"error": reason}), 400

    img_gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    patches = segment_word_characters(img_gray)

    if len(patches) < 2:
        return jsonify({
            "error": "Could not segment multiple letters. Write with small spaces between letters (print style)."
        }), 400

    results = []
    reversal_count = 0
    for idx, patch in enumerate(patches):
        expected_ch = target_word[idx] if idx < len(target_word) else ""
        pred, conf = classify_single_gray_char(patch, source_mode="draw", target_char=expected_ch)
        if pred == "Reversal":
            reversal_count += 1
        results.append({
            "index": idx + 1,
            "expected": expected_ch if expected_ch else f"Char {idx + 1}",
            "prediction": pred,
            "confidence": f"{conf}%"
        })

    overall = "Reversal" if reversal_count > 0 else "Normal"
    avg_conf = round(sum(float(r["confidence"].replace("%", "")) for r in results) / len(results), 2)

    return jsonify({
        "prediction": overall,
        "confidence": f"{avg_conf}%",
        "segmented_count": len(results),
        "reversal_count": reversal_count,
        "characters": results
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)