import { useState, useRef } from "react";

// Map from token -> key (REPLACE keyHex for 1..F with your real keys)
const TOKEN_KEYS = {
  "0": {
    label: "Token 0",
    keyHex: "000102030405060708090A0B0C0D0E0F",
  },
  "1": {
    label: "Token 1",
    keyHex: "101112131415161718191A1B1C1D1E1F",
  },
  "2": {
    label: "Token 2",
    keyHex: "202122232425262728292A2B2C2D2E2F",
  },
  "3": {
    label: "Token 3",
    keyHex: "303132333435363738393A3B3C3D3E3F",
  },
  "4": {
    label: "Token 4",
    keyHex: "404142434445464748494A4B4C4D4E4F",
  },
  "5": {
    label: "Token 5",
    keyHex: "505152535455565758595A5B5C5D5E5F",
  },
  "6": {
    label: "Token 6",
    keyHex: "606162636465666768696A6B6C6D6E6F",
  },
  "7": {
    label: "Token 7",
    keyHex: "707172737475767778797A7B7C7D7E7F",
  },
  "8": {
    label: "Token 8",
    keyHex: "808182838485868788898A8B8C8D8E8F",
  },
  "9": {
    label: "Token 9",
    keyHex: "909192939495969798999A9B9C9D9E9F",
  },
  A: {
    label: "Token A",
    keyHex: "A0A1A2A3A4A5A6A7A8A9AAABACADAEAF",
  },
  B: {
    label: "Token B",
    keyHex: "B0B1B2B3B4B5B6B7B8B9BABBBCBDBEBF",
  },
  C: {
    label: "Token C",
    keyHex: "C0C1C2C3C4C5C6C7C8C9CACBCCCDCECF",
  },
  D: {
    label: "Token D",
    keyHex: "D0D1D2D3D4D5D6D7D8D9DADBDCDDDEDF",
  },
  E: {
    label: "Token E",
    keyHex: "E0E1E2E3E4E5E6E7E8E9EAEBECEDEEEF",
  },
  F: {
    label: "Token F",
    keyHex: "F0F1F2F3F4F5F6F7F8F9FAFBFCFDFEFF",
  },
};

export default function Home() {
  const [token, setToken] = useState("0");
  const [keyHex, setKeyHex] = useState(TOKEN_KEYS["0"].keyHex);
  const [ptHex, setPtHex] = useState("00112233445566778899AABBCCDDEEFF");

  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState("");
  const [ctHex, setCtHex] = useState("");
  const [expectedHex, setExpectedHex] = useState("");
  const [valid, setValid] = useState(null);

  const pollTimer = useRef(null);

  function onTokenChange(e) {
    const t = e.target.value;
    setToken(t);
    const entry = TOKEN_KEYS[t];
    if (entry) {
      setKeyHex(entry.keyHex);
    } else {
      setKeyHex("");
    }
  }

  async function submitJob(e) {
    e.preventDefault();
    setCtHex("");
    setExpectedHex("");
    setValid(null);
    setStatus("Submitting job...");

    const trimmedKey = keyHex.trim();
    const trimmedPt = ptHex.trim();

    try {
      const res = await fetch("/api/encrypt-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          keyHex: trimmedKey,
          ptHex: trimmedPt,
        }),
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
      const res = await fetch(
        `/api/encrypt-status?jobId=${encodeURIComponent(id)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setStatus("Status error: " + (data.error || res.statusText));
        stopPolling();
        return;
      }
      if (data.status === "done") {
        setStatus("Done");
        setCtHex(data.ctHex || "");
        setExpectedHex(data.expectedCtHex || "");
        setValid(data.valid);
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

  const validBox =
    valid === true ? (
      <div
        style={{
          marginTop: "1rem",
          padding: "0.75rem 1rem",
          borderRadius: "8px",
          backgroundColor: "#e6ffed",
          border: "1px solid #2ecc71",
          color: "#1e8449",
          fontWeight: 500,
        }}
      >
        ✅ FPGA output matches software AES.
      </div>
    ) : valid === false ? (
      <div
        style={{
          marginTop: "1rem",
          padding: "0.75rem 1rem",
          borderRadius: "8px",
          backgroundColor: "#ffecec",
          border: "1px solid #e74c3c",
          color: "#c0392b",
          fontWeight: 500,
        }}
      >
        ❌ Mismatch between FPGA and software AES.
      </div>
    ) : null;

  return (
    <>
      <main
        style={{
          minHeight: "100vh",
          margin: 0,
          padding: "2rem 1rem",
          background:
            "radial-gradient(circle at top, #1f2933 0, #0b1015 50%, #000 100%)",
          color: "#f9fafb",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "720px",
            background: "rgba(15, 23, 42, 0.92)",
            borderRadius: "16px",
            padding: "1.75rem",
            boxShadow: "0 18px 40px rgba(0, 0, 0, 0.55)",
            border: "1px solid rgba(148, 163, 184, 0.25)",
            backdropFilter: "blur(16px)",
          }}
        >
          <header style={{ marginBottom: "1.5rem" }}>
            <h1
              style={{
                fontSize: "1.6rem",
                fontWeight: 600,
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              AES FPGA Control Panel
              <span
                style={{
                  fontSize: "0.8rem",
                  padding: "0.1rem 0.6rem",
                  borderRadius: "999px",
                  border: "1px solid rgba(56, 189, 248, 0.6)",
                  color: "#e0f2fe",
                  background: "rgba(8, 47, 73, 0.6)",
                }}
              >
                via ESP32 + Vercel
              </span>
            </h1>
            <p
              style={{
                margin: "0.4rem 0 0",
                fontSize: "0.9rem",
                color: "#cbd5f5",
              }}
            >
              Select a key token, review the corresponding AES key and send a
              128-bit block to be processed by the FPGA. The result is checked
              against a software AES implementation.
            </p>
          </header>

          <form
            onSubmit={submitJob}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr",
              gap: "1rem 1.5rem",
              alignItems: "flex-start",
            }}
          >
            {/* Token selector */}
            <div style={{ gridColumn: "1 / 2" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  marginBottom: "0.35rem",
                  color: "#e5e7eb",
                }}
              >
                Key token
              </label>
              <select
                value={token}
                onChange={onTokenChange}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.6rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(148, 163, 184, 0.7)",
                  background: "rgba(15, 23, 42, 0.9)",
                  color: "#f9fafb",
                  fontSize: "0.9rem",
                }}
              >
                {Object.entries(TOKEN_KEYS).map(([t, info]) => (
                  <option key={t} value={t}>
                    {t} — {info.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Key display */}
            <div style={{ gridColumn: "1 / 3" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  marginBottom: "0.35rem",
                  color: "#e5e7eb",
                }}
              >
                Key (hex, derived from token)
              </label>
              <div
                style={{
                  width: "100%",
                  padding: "0.45rem 0.6rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(148, 163, 184, 0.7)",
                  background: "rgba(15, 23, 42, 0.9)",
                  fontFamily: "monospace",
                  fontSize: "0.9rem",
                  wordBreak: "break-all",
                }}
              >
                {keyHex}
              </div>
            </div>

            {/* Plaintext input */}
            <div style={{ gridColumn: "1 / 3" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  marginBottom: "0.35rem",
                  color: "#e5e7eb",
                }}
              >
                Plaintext (128-bit, hex)
              </label>
              <input
                value={ptHex}
                onChange={(e) => setPtHex(e.target.value.trim())}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.6rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(148, 163, 184, 0.7)",
                  background: "rgba(15, 23, 42, 0.9)",
                  color: "#f9fafb",
                  fontFamily: "monospace",
                  fontSize: "0.9rem",
                }}
              />
            </div>

            {/* Submit button */}
            <div style={{ gridColumn: "1 / 3", textAlign: "right" }}>
              <button
                type="submit"
                style={{
                  padding: "0.55rem 1.4rem",
                  borderRadius: "999px",
                  border: "none",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  background:
                    "linear-gradient(135deg, #0ea5e9 0%, #22c55e 50%, #a855f7 100%)",
                  color: "#0f172a",
                  boxShadow: "0 8px 20px rgba(56, 189, 248, 0.5)",
                  transition:
                    "transform 0.08s ease, box-shadow 0.08s ease",
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = "scale(0.97)";
                  e.currentTarget.style.boxShadow =
                    "0 3px 10px rgba(56, 189, 248, 0.4)";
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 20px rgba(56, 189, 248, 0.5)";
                }}
              >
                Send block to FPGA
              </button>
            </div>
          </form>

          {/* Status + results */}
          <section style={{ marginTop: "1.5rem" }}>
            <div
              style={{
                fontSize: "0.9rem",
                color: "#e5e7eb",
                marginBottom: "0.4rem",
              }}
            >
              <strong>Status:</strong> {status || "Idle"}
            </div>
            {jobId && (
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#9ca3af",
                  marginBottom: "0.6rem",
                }}
              >
                <strong>Job ID:</strong> {jobId}
              </div>
            )}

            {ctHex && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.6rem 0.7rem",
                  borderRadius: "8px",
                  background: "rgba(15, 23, 42, 0.9)",
                  border: "1px solid rgba(148, 163, 184, 0.5)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    marginBottom: "0.25rem",
                    color: "#e5e7eb",
                  }}
                >
                  Ciphertext from FPGA
                </div>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.9rem",
                    wordBreak: "break-all",
                    color: "#e5e7eb",
                  }}
                >
                  {ctHex}
                </div>

                {expectedHex && (
                  <>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        marginTop: "0.6rem",
                        marginBottom: "0.15rem",
                        color: "#a5b4fc",
                      }}
                    >
                      Expected (software AES)
                    </div>
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontSize: "0.85rem",
                        wordBreak: "break-all",
                        color: "#e5e7eb",
                      }}
                    >
                      {expectedHex}
                    </div>
                  </>
                )}
              </div>
            )}

            {validBox}
          </section>
        </div>
      </main>

      {/* Remove white border: reset body/html margins + background */}
      <style jsx global>{`
        html,
        body,
        #__next {
          margin: 0;
          padding: 0;
          height: 100%;
          background: #000;
        }
      `}</style>
    </>
  );
}