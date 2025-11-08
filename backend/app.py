import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import psycopg2
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound

load_dotenv()

app = Flask(__name__)

# ✅ Allow requests from your React dev server (http://localhost:3000)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# ------------------------
# ENV + Database setup
# ------------------------
DATABASE_URL = os.getenv("DATABASE_URL")
HF_API_KEY = os.getenv("HF_API_KEY")
HF_MODEL = os.getenv("HF_MODEL", "facebook/bart-large-cnn")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL missing in environment (.env)")

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# ------------------------
# Helper: Hugging Face summarizer
# ------------------------
def hf_summarize(text, max_length=200):
    headers = {"Authorization": f"Bearer {HF_API_KEY}"} if HF_API_KEY else {}
    payload = {
        "inputs": text,
        "parameters": {"max_length": max_length, "min_length": 20, "do_sample": False},
    }
    url = f"https://router.huggingface.co/hf-inference/models/{HF_MODEL}"

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=120)
        resp.raise_for_status()
    except Exception as e:
        return None, f"Hugging Face error: {resp.status_code} - {resp.text}"

    data = resp.json()

    # Normalize model output
    if isinstance(data, list) and len(data) > 0 and "summary_text" in data[0]:
        return data[0]["summary_text"], None
    if isinstance(data, dict) and "summary_text" in data:
        return data["summary_text"], None
    if isinstance(data, str):
        return data, None

    return str(data), None


# ------------------------
# Health check
# ------------------------
@app.route("/api/ping")
def ping():
    return jsonify({"message": "pong"})


# ------------------------
# NOTES CRUD
# ------------------------
@app.route("/api/notes", methods=["GET"])
def get_notes():
    cur.execute(
        "SELECT id, title, content, summary, created_at FROM notes ORDER BY created_at DESC;"
    )
    rows = cur.fetchall()
    notes = [
        {
            "id": r[0],
            "title": r[1],
            "content": r[2],
            "summary": r[3],
            "created_at": r[4].isoformat(),
        }
        for r in rows
    ]
    return jsonify(notes)


@app.route("/api/notes", methods=["POST"])
def create_note():
    data = request.json or {}
    title = data.get("title", "")[:250]
    content = data.get("content", "")
    summary = data.get("summary", "")

    cur.execute(
        "INSERT INTO notes (title, content, summary) VALUES (%s, %s, %s) RETURNING id;",
        (title, content, summary),
    )
    new_id = cur.fetchone()[0]
    conn.commit()
    return jsonify({"id": new_id, "title": title, "content": content, "summary": summary})


@app.route("/api/notes/<int:note_id>", methods=["GET"])
def get_note(note_id):
    cur.execute("SELECT id, title, content, summary, created_at FROM notes WHERE id=%s", (note_id,))
    r = cur.fetchone()
    if not r:
        return jsonify({"error": "not found"}), 404
    note = {"id": r[0], "title": r[1], "content": r[2], "summary": r[3], "created_at": r[4].isoformat()}
    return jsonify(note)


# ------------------------
# SUMMARIZE TEXT
# ------------------------
@app.route("/api/summarize", methods=["POST"])
def summarize_text():
    data = request.json or {}
    text = data.get("text", "")
    if not text or not text.strip():
        return jsonify({"error": "No text provided"}), 400

    summary, err = hf_summarize(text)
    if err:
        return jsonify({"error": err}), 500
    return jsonify({"summary": summary})


# ------------------------
# YOUTUBE: fetch transcript + summarize
# ------------------------
@app.route("/api/youtube", methods=["POST"])
def summarize_youtube():
    data = request.json or {}
    video_id = data.get("video_id")
    if not video_id:
        return jsonify({"error": "No video ID provided"}), 400

    try:
        transcript_list = (
            YouTubeTranscriptApi.list_transcripts(video_id)
            .find_generated_transcript(["en"])
            .fetch()
        )
        full_text = " ".join([t["text"] for t in transcript_list])
    except (TranscriptsDisabled, NoTranscriptFound):
        return jsonify({"error": "Transcript not available for this video"}), 200
    except Exception as e:
        return jsonify({"error": f"Could not fetch transcript: {str(e)}"}), 200

    summary, err = hf_summarize(full_text)
    if err:
        return jsonify({"error": err}), 500

    return jsonify({"summary": summary})


# ------------------------
# RUN SERVER
# ------------------------
if __name__ == "__main__":
    # ✅ Make Flask accessible to your React dev server
    app.run(debug=True, host="0.0.0.0", port=5000)
