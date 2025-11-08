import { useState } from "react";

const API_BASE = "http://127.0.0.1:5000/api";

export default function YouTubeSummarizer({ setYoutubeSummary }) {
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const pickId = (url) => {
    if (!url) return null;
    const vMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (vMatch) return vMatch[1];
    const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (short) return short[1];
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
    return null;
  };

  const handleClick = async () => {
    const id = pickId(videoUrl.trim());
    if (!id) return alert("Invalid YouTube URL or video ID.");
    setLoading(true);
    setYoutubeSummary("Fetching transcript & summarizing...");
    try {
      const res = await fetch(`${API_BASE}/youtube`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: id }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Status ${res.status}`);
      }
      const data = await res.json();
      if (data.error) setYoutubeSummary("Error: " + data.error);
      else setYoutubeSummary(data.summary || "");
    } catch (err) {
      setYoutubeSummary("Error calling server: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: "1rem" }}>
      <input
        placeholder="YouTube URL or ID"
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
        style={{ flex: 1, padding: "0.5rem", borderRadius: "8px", border: "1px solid #d1d5db" }}
      />
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          padding: "0.5rem 1rem",
          borderRadius: "8px",
          border: "none",
          background: "#3b82f6",
          color: "white",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "..." : "Summarize Video"}
      </button>
    </div>
  );
}
