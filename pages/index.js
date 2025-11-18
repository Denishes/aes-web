import { useState, useRef } from "react";

export default function Home() {
  const [keyHex, setKeyHex] = useState("000102030405060708090A0B0C0D0E0F");
  const [ptHex, setPtHex] = useState("00112233445566778899AABBCCDDEEFF");
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState("");
  const [ctHex, setCtHex] = useState("");
  const pollTimer = useRef(null);

  async function submitJob(e) {
    e.preventDefault();
    setCtHex("");
    setStatus("Submitting job...");

    try {
      const res = await fetch("/api/encrypt-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyHex, ptHex }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("Error: " + (data.error || res.statusText));
        return;
      }
      setJobId(data.jobId);
      setStatus("Job created, waiting for FPGA...");
      startPolling(data.jobId);
    } catch (err) {
      setStatus("Request error: " + err.message);
    }
  }

  async function pollOnce(id) {
    try {
      const res = await fetch(`/api/encrypt-status?jobId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) {
        setStatus("Status error: " + (data.error || res.statusText));
        stopPolling();
        return;
      }
      if (data.status === "done") {
        setStatus("Done");
        setCtHex(data.ctHex || "");
        stopPolling();
      } else {
        setStatus(`Status: ${data.status} (waiting for FPGA...)`);
      }
    } catch (err) {
      setStatus("Poll error: " + err.message);
      stopPolling();
    }
  }

  function startPolling(id) {
    stopPolling();
    pollTimer.current = setInterval(() => pollOnce(id), 1000);
  }

  function stopPolling() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  return (
    <main style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>AES FPGA Frontend</h1>
      <p>Enter key and plaintext (hex) and send job to the FPGA via ESP.</p>

      <form
        onSubmit={submitJob}
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
      >
        <label>
          Key (hex, 128/192/256-bit):
          <input
            value={keyHex}
            onChange={(e) => setKeyHex(e.target.value.trim())}
            style={{ width: "100%", fontFamily: "monospace" }}
          />
        </label>
        <label>
          Plaintext (hex, 128-bit block):
          <input
            value={ptHex}
            onChange={(e) => setPtHex(e.target.value.trim())}
            style={{ width: "100%", fontFamily: "monospace" }}
          />
        </label>
        <button type="submit">Encrypt (send job)</button>
      </form>

      <div style={{ marginTop: "1rem" }}>
        <div>
          <strong>Status:</strong> {status}
        </div>
        {jobId && (
          <div>
            <strong>Job ID:</strong> {jobId}
          </div>
        )}
        {ctHex && (
          <div>
            <strong>Ciphertext (from FPGA):</strong>
            <div style={{ fontFamily: "monospace" }}>{ctHex}</div>
          </div>
        )}
      </div>
    </main>
  );
}
