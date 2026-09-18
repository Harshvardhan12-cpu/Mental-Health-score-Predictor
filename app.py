import os
import joblib
import pandas as pd
from flask import Flask, request, jsonify,render_template
from flask_cors import CORS

# ── App Setup ────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)  # Allow requests from the frontend (file:// or localhost)

# ── Load Model ───────────────────────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), "Mental_health_predictor_model.pkl")

try:
    model = joblib.load(MODEL_PATH)
    print(f"[OK] Model loaded successfully from: {MODEL_PATH}")
except FileNotFoundError:
    print(f"[ERROR] Model file not found at: {MODEL_PATH}")
    model = None

# ── Expected Feature Columns (must match training data exactly) ──────────────
FEATURE_COLUMNS = [
    "Country",
    "Academic_Level",
    "Most_Used_Platform",
    "Purpose_Of_Use",
    "Avg_Daily_Usage_Hours",
    "Study_Hours",
    "Physical_Activity_Hours",
    "Sleep_Hours_Per_Night",
    "Stress_Level",
    "Age",
    "Gender",
]


# ── Routes ───────────────────────────────────────────────────────────────────
@app.route("/", methods=["GET"])
def health_check():
    """Simple health-check endpoint."""
    status = "loaded" if model is not None else "not loaded"
    return jsonify({"status": "ok", "model": status})


@app.route("/predict", methods=["POST"])
def predict():
    """
    Accepts a JSON payload with the nine feature fields,
    runs inference, and returns {"score": <float>, "status": "success"}.
    """
    if model is None:
        return jsonify({"status": "error", "message": "Model is not loaded on the server."}), 500

    payload = request.get_json(silent=True)
    if payload is None:
        return jsonify({"status": "error", "message": "Invalid or missing JSON body."}), 400

    # ── Validate required fields ─────────────────────────────────────────────
    missing = [col for col in FEATURE_COLUMNS if col not in payload]
    if missing:
        return jsonify({
            "status": "error",
            "message": f"Missing required fields: {missing}"
        }), 400

    # ── Build DataFrame ──────────────────────────────────────────────────────
    try:
        input_df = pd.DataFrame(
            {
                "Country":                 [str(payload["Country"])],
                "Academic_Level":          [str(payload["Academic_Level"])],
                "Most_Used_Platform":      [str(payload["Most_Used_Platform"])],
                "Purpose_Of_Use":          [str(payload["Purpose_Of_Use"])],
                "Avg_Daily_Usage_Hours":   [float(payload["Avg_Daily_Usage_Hours"])],
                "Study_Hours":             [float(payload["Study_Hours"])],
                "Physical_Activity_Hours": [float(payload["Physical_Activity_Hours"])],
                "Sleep_Hours_Per_Night":   [float(payload["Sleep_Hours_Per_Night"])],
                "Stress_Level":            [str(payload["Stress_Level"])],
                "Age":                     [float(payload["Age"])],
                "Gender":                  [str(payload["Gender"])],
            }
        )
    except (ValueError, TypeError) as exc:
        return jsonify({"status": "error", "message": f"Invalid field value: {exc}"}), 400

    # ── Inference ────────────────────────────────────────────────────────────
    try:
        raw_score = float(model.predict(input_df)[0])
    except Exception as exc:
        return jsonify({"status": "error", "message": f"Prediction failed: {exc}"}), 500

    # Clamp to [0, 10] and round to 1 decimal place
    score = round(max(0.0, min(10.0, raw_score)), 1)

    print(f"[PREDICT] raw={raw_score:.4f}  clamped={score}")
    return jsonify({"score": score, "status": "success"})


# ── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
