# NeuroScript — AI-Powered Dyslexia Handwriting Screening Portal

**NeuroScript** is an interactive, web-based preliminary screening tool designed to detect dyslexia-related handwriting character reversals (strephosymbolia) across both isolated characters and multi-character printed words. Built with a **Python/FastAPI** backend and a responsive clinical dashboard frontend, it combines a **Convolutional Neural Network (CNN)** feature extractor, a **Support Vector Machine (SVM)** classifier, **OpenCV connected-component word segmentation**, and **mirror-orientation verification**.

---

## Key Features

- **Dual Screening Modes:**
  - **Single Character Mode:** Interactive `280×280` HTML5 drawing canvas and image uploader with a targeted asymmetric character checklist (`b`, `d`, `p`, `q`, `E`, `3`, `S`, `R`).
  - **Word-Level Character Segmentation (`/predict_word`):** Wide `460×170` pad that slices handwritten words from left to right using OpenCV connected-component bounding boxes, merges multi-stroke glyphs, and evaluates each letter individually.
- **Selectable Evaluation Models:**
  - Dropdown defaults to the recommended **CNN + SVM** pipeline; alternatives are **CNN + Random Forest**, **MobileNetV2 + SVM**, and **MobileNetV2 + Random Forest**. Only the selected model performs inference, and each result shows which model produced it.
- **Hybrid Classification & Orientation Engine:**
  - Resizes handwriting samples to `32×32` grayscale using the training pipeline (Otsu threshold, ink-normalization, tight crop, square padding), extracts `512`-dimensional spatial features via `feature_extractor.keras`, normalizes them with `scaler.pkl`, and classifies reversals with the binary RBF-SVM `svm_binary_v2.pkl` (trained on the `Gambo` handwriting dataset).
  - Resolves symmetric-pair visual ambiguity (`b` vs. `d`, `p` vs. `q`) on live canvas drawings by comparing normalized `48×48` ink masks against expected glyphs and their horizontally flipped mirror counterparts.
- **Post-Evaluation Confidence Heatmap:**
  - Every result includes a seaborn-generated heatmap of per-class confidence (Normal vs. Reversal for the recommended pipeline; Corrected / Normal / Reversal for the alternative pipelines). Word Mode averages the per-character scores.
- **Input Quality Gatekeeper (`is_valid_handwriting`):**
  - Inspects inputs at `256×256` resolution and checks HSV color saturation to reject blank pads, UI screenshots, colorful photos, and non-character clutter before inference.
- **Behavioral Telemetry & Session Risk Aggregation:**
  - Passively tracks pen-lift stroke count and writing duration (`performance.now()`), logs recent samples, computes the live **Reversal Rate (%)**, and displays a color-coded **Screening Risk Indicator** once 3 or more valid samples are analyzed.
- **Evaluator Authentication & Printable Reports:**
  - Includes alphanumeric **Sign In / Create Account** validation and a print-optimized report layout (`window.print()`).

---

## Tech Stack

- **Backend:** Python, FastAPI, Uvicorn, TensorFlow / Keras, OpenCV (`cv2`), Scikit-Learn, Joblib, NumPy
- **Frontend:** HTML5 Canvas, CSS3 (Responsive Grid & Print Media Queries), Vanilla JavaScript (`Fetch API`, `FormData`, `localStorage` / `sessionStorage`)

---

## Setup

After cloning, copy the two large Random Forest model files from your local `Dys-le` project. They are not stored in this GitHub repository because it is a public fork and GitHub blocks Git LFS uploads for public forks.

```powershell
& "C:\Users\Nandan\AppData\Local\Programs\Python\Python311\python.exe" setup_models.py
```

If the source folder is different, pass it explicitly:

```powershell
& "C:\Users\Nandan\AppData\Local\Programs\Python\Python311\python.exe" setup_models.py --source "C:\Users\Nandan\Dys-le\backend\models"
```

This copies `MobileNetV2_RF_Original.pkl` and `final_clean_cnn_random_forest.pkl` into `models/`. All other model files are already included in the repository.

---

## Project Structure

```text
neuroscript-dyslexia-screening/
├── main.py                  # FastAPI server, gatekeeper, segmentation & selectable-model inference
├── setup_models.py          # Copies the two large RF models from local Dys-le folder
├── index.html               # Sign-in portal and split-screen clinical screening dashboard
├── style.css                # Clinical UI styling, risk badges, and print report layout
├── script.js                # Canvas drawing engine, telemetry tracking, auth & API integration
├── feature_extractor.keras  # 32x32 -> 512-d CNN spatial feature extractor (training pipeline)
├── svm_binary_v2.pkl        # Binary RBF-SVM: Reversal vs. not-reversed (94%+ test accuracy)
├── scaler.pkl               # Feature normalization scaler
├── cnn_extractor.keras      # Legacy 64x64 extractor (kept for reference, not used at inference)
├── svm_model.pkl            # Legacy 2-class SVM (kept for reference, not used at inference)
├── models/                  # Alternative model pipelines from Dys-le
│   ├── mobilenet_feature_extractor.keras   # 96x96 -> 1280-d MobileNetV2 features
│   ├── best_mobilenet_svm.pkl              # MobileNetV2 + SVM classifier
│   ├── final_clean_cnn_random_forest.pkl   # CNN + Random Forest classifier
│   ├── MobileNetV2_RF_Original.pkl          # MobileNetV2 + Random Forest classifier
│   └── model_metrics.json                  # Published held-out accuracy metrics
└── cnn/                     # Model metadata and weights
```

## Model Performance

Evaluated on held-out `Gambo` test images through the live `/predict` endpoint (upload mode, no target character):

| Model | Accuracy |
| --- | --- |
| Legacy `cnn_extractor.keras` + `svm_model.pkl` (64-d) | ~77.6% |
| CNN + SVM (default / recommended) | **~94.9%** |
| CNN + Random Forest | ~90.7% |
| MobileNetV2 + SVM | ~74.2% |
| MobileNetV2 + Random Forest | ~73.8% |

The **Evaluation Model** dropdown defaults to the recommended CNN + SVM pipeline. Only the selected model runs inference; the other pipelines are not consulted. Selecting a target character from the checklist enables the mirror-orientation check for the recommended CNN + SVM pipeline, which is required to distinguish `b` vs. `d` and `p` vs. `q` (a shape alone is ambiguous). With a target selected, synthetic canvas glyphs scored 16/16.
