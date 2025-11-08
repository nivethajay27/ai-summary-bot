import { useState, useRef, useEffect } from "react";
import YouTubeSummarizer from "./components/YouTubeSummarizer";
import "./App.css";

const API_BASE = "http://127.0.0.1:5000/api";

export default function App() {
  const [textNote, setTextNote] = useState("");
  const [youtubeSummary, setYoutubeSummary] = useState("");
  const [summary, setSummary] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  // Load saved notes
  const loadNotes = async () => {
    try {
      const res = await fetch(`${API_BASE}/notes`);
      const data = await res.json();
      setNotes(data);
    } catch (err) {
      console.error("Error loading notes:", err);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  // File upload
  const onFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    setTextNote(text);
  };

  const handleSummarizeAll = async () => {
    const combined = [textNote || "", youtubeSummary || ""].filter(Boolean).join("\n\n");
    if (!combined.trim()) {
      alert("Please provide text in the editor or a YouTube summary.");
      return;
    }
    setSummary("Summarizing...");
    const r = await fetch(`${API_BASE}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: combined }),
    });
    const data = await r.json();
    if (data.error) {
      setSummary("Error: " + data.error);
    } else {
      setSummary(data.summary);
    }
  };

  // Save summary
  const handleSaveSummary = async () => {
    if (!textNote && !summary && !youtubeSummary)
      return alert("Nothing to save!");

    const payload = {
      title: title || "Untitled",
      content: textNote,
      summary:
        summary +
        (youtubeSummary ? "\n\nYouTube Summary:\n" + youtubeSummary : ""),
    };

    try {
      await fetch(`${API_BASE}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setTextNote("");
      setSummary("");
      setYoutubeSummary("");
      setTitle("");
      if (fileRef.current) fileRef.current.value = null;
      loadNotes();
      alert("Saved successfully!");
    } catch (err) {
      alert("Error saving note: " + err.message);
    }
  };

  // Load note from sidebar
  const loadNote = (note) => {
    setTextNote(note.content);
    setSummary(note.summary);
    setTitle(note.title);
  };

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <h1> AI Summary Bot</h1>
        <p>
          Summarize long notes, documents, or YouTube videos instantly using
          Hugging Face AI. Upload, edit, and store all your insights here.
        </p>
      </header>

      <div className="app-container">
        {/* Sidebar */}
        <div className="sidebar">
          <h3>Saved Notes</h3>
          <ul>
            {notes.map((note, idx) => (
              <li
                key={note.id}
                onClick={() => loadNote(note)}
                className={`note-item ${
                  idx % 2 === 0 ? "note-item-light" : "note-item-dark"
                }`}
              >
                <strong>{note.title || "Untitled"}</strong>
                <div className="note-summary-preview">
                  {note.summary
                    ? note.summary.slice(0, 50) +
                      (note.summary.length > 50 ? "..." : "")
                    : "No summary yet"}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Main Editor */}
        <div className="editor-container">
        <div className="title-row">
          <input
            className="title-input"
            placeholder="Note Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div className="button-row-inline">
            <label className="upload-btn">
              Upload .txt/.md
              <input
                type="file"
                ref={fileRef}
                accept=".txt,.md"
                onChange={onFileChange}
              />
            </label>

            <button
              className="clear-btn"
              onClick={() => {
                setTextNote("");
                setSummary("");
                setYoutubeSummary("");
                if (fileRef.current) fileRef.current.value = null;
              }}
            >
              Clear
            </button>

   
         </div>
          </div>

          <textarea
            className="note-textarea"
            value={textNote}
            onChange={(e) => setTextNote(e.target.value)}
            placeholder="Type your notes here or upload a .txt/.md file..."
          />

        
          <div className="controls-row">
          <button className="primary"     style={{
          padding: "0.5rem 1rem",
          borderRadius: "8px",
          border: "none",
          background: "#3b82f6",
          color: "white",
          cursor: loading ? "not-allowed" : "pointer",
        }} 
        onClick={handleSummarizeAll}>Summarize Text</button>
        </div>
        <div>
          <YouTubeSummarizer setYoutubeSummary={setYoutubeSummary} />
        </div>
          <div className="summary-box">
            {summary ||
              (youtubeSummary
                ? "\n\nYouTube Summary:\n" + youtubeSummary
                : "Summary will appear here...")}
          </div>

          <button className="save-btn" onClick={handleSaveSummary}>
            Save Summary
          </button>
        </div>
      </div>
    </div>
  );
}
