# NeuroScript — AI-Powered Dyslexia Handwriting Screening Portal

**NeuroScript** is an interactive, web-based preliminary screening tool designed to detect dyslexia-related handwriting character reversals (strephosymbolia) across both isolated characters and multi-character printed words. Built with a **Python/Flask** backend and a responsive clinical dashboard frontend, it combines a **Convolutional Neural Network (CNN)** feature extractor, a **Support Vector Machine (SVM)** classifier, **OpenCV connected-component word segmentation**, and **mirror-orientation verification**.

---

## Key Features

- **Dual Screening Modes:**
  - **Single Character Mode:** Interactive `280×280` HTML5 drawing canvas and image uploader with a targeted asymmetric character checklist (`b`, `d`, `p`, `q`, `E`, `3`, `S`, `R`).
  - **Word-Level Character Segmentation (`/predict_word`):** Wide `460×170` pad that slices handwritten words from left to right using OpenCV connected-component bounding boxes, merges multi-stroke glyphs, and evaluates each letter individually.
- **Hybrid Classification & Orientation Engine:**
  - Resizes handwriting samples to `64×64` grayscale, extracts deep spatial stroke representations via `cnn_extractor.keras`, and classifies them using `svm_model.pkl`.
  - Resolves symmetric-pair visual ambiguity (`b` vs. `d`, `p` vs. `q`) on live canvas drawings by comparing normalized `48×48` ink masks against expected glyphs and their horizontally flipped mirror counterparts.
- **Input Quality Gatekeeper (`is_valid_handwriting`):**
  - Inspects inputs at `256×256` resolution and checks HSV color saturation to reject blank pads, UI screenshots, colorful photos, and non-character clutter before inference.
- **Behavioral Telemetry & Session Risk Aggregation:**
  - Passively tracks pen-lift stroke count and writing duration (`performance.now()`), logs recent samples, computes the live **Reversal Rate (%)**, and displays a color-coded **Screening Risk Indicator** once 3 or more valid samples are analyzed.
- **Evaluator Authentication & Printable Reports:**
  - Includes alphanumeric **Sign In / Create Account** validation and a print-optimized report layout (`window.print()`).

---

## Tech Stack

- **Backend:** Python, Flask, TensorFlow / Keras, OpenCV (`cv2`), Scikit-Learn, Joblib, NumPy
- **Frontend:** HTML5 Canvas, CSS3 (Responsive Grid & Print Media Queries), Vanilla JavaScript (`Fetch API`, `FormData`, `localStorage` / `sessionStorage`)

---

## Project Structure

```text
neuroscript-dyslexia-screening/
├── main.py                  # Flask server, OpenCV gatekeeper, word segmentation & CNN+SVM inference
├── index.html               # Sign-in portal and split-screen clinical screening dashboard
├── style.css                # Clinical UI styling, risk badges, and print report layout
├── script.js                # Canvas drawing engine, telemetry tracking, auth & API integration
├── cnn_extractor.keras      # Pre-trained CNN spatial feature extractor
├── feature_extractor.keras  # Auxiliary feature extraction weights
├── svm_model.pkl            # Trained RBF-kernel SVM classifier
├── scaler.pkl               # Feature normalization scaler
└── cnn/                     # Model metadata and weights
