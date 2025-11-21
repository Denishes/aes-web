// pages/index.js
import { useState, useRef } from "react";

// EXACT match to your FPGA key_lookup in top.v
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
  // Shared: token + key
  const [token, setToken] = useState("0");
  const [keyHex, setKeyHex] = useState(TOKEN_KEYS["0"].keyHex);

  // Plaintext mode: hex or ASCII
  const [asciiMode, setAsciiMode] = useState(false);
  const [ptHex, setPtHex] = useState(
    "00112233445566778899AABBCCDDEEFF"
  );
  const [ptAscii, setPtAscii] = useState("");

  // Encrypt panel (ENC only)
  const [encJobId, setEncJobId] = useState(null);
  const [encStatus, setEncStatus] = useState("");
  const [encCtHex, setEncCtHex] = useState("");
  const [encExpectedHex, setEncExpectedHex] = useState("");
  const [encValid, setEncValid] = useState(null);
  const encPollTimer = useRef(null);

  // Decrypt panel
  const [decCtHex, setDecCtHex] = useState(
    "69C4E0D86A7B0430D8CDB78070B4C55A"
  );
  const [decJobId, setDecJobId] = useState(null);
  const [decStatus, setDecStatus] = useState("");
  const [decPtHex, setDecPtHex] = useState("");
  const [decExpectedHex, setDecExpectedHex] = useState("");
  const [decValid, setDecValid] = useState(null);
  const decPollTimer = useRef(null);

  // Roundtrip mode (ENC → DEC auto)
  const [roundtripMode, setRoundtripMode] = useState(false);
  const [rtGroupId, setRtGroupId] = useState(null);
  const [rtStatus, setRtStatus] = useState("");
  const [rtEncCtHex, setRtEncCtHex] = useState("");
  const [rtEncValid, setRtEncValid] = useState(null);
  const [rtDecPtHex, setRtDecPtHex] = useState("");
  const [rtDecValid, setRtDecValid] = useState(null);
  const [rtRoundtripOk, setRtRoundtripOk] = useState(null);
  const [rtAsciiOriginal, setRtAsciiOriginal] = useState("");
  const [rtAsciiDec, setRtAsciiDec] = useState("");
  const [rtTiming, setRtTiming] = useState(null);
  const rtPollTimer = useRef(null);

  // ========== Shared token handler ==========
  function onTokenChange(e) {
    const t = e.target.value;
    setToken(t);
    const entry = TOKEN_KEYS[t];
    if (entry) setKeyHex(entry.keyHex);
    else setKeyHex("");
  }

  // ========== ENC-only API logic ==========
  async function submitEncrypt(e) {
    e.preventDefault();
    setEncCtHex("");
    setEncExpectedHex("");
    setEncValid(null);
    setEncStatus("Submitting encrypt job...");

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
        setEncStatus("Error: " + (data.error || res.statusText));
        return;
      }
      setEncJobId(data.jobId);
      setEncStatus("Encrypt job created, waiting for ENC FPGA...");
      startEncPolling(data.jobId);
    } catch (err) {
      setEncStatus("Request error: " + err.message);
    }
  }

  async function pollEncryptOnce(id) {
    try {
      const res = await fetch(
        `/api/encrypt-status?jobId=${encodeURIComponent(id)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setEncStatus("Status error: " + (data.error || res.statusText));
        stopEncPolling();
        return;
      }
      if (data.status === "done") {
        setEncStatus("Encryption done");
        setEncCtHex(data.ctHex || "");
        setEncExpectedHex(data.expectedCtHex || "");
        setEncValid(data.valid);
        stopEncPolling();
      } else {
        setEncStatus(
          `Status: ${data.status} (waiting for ENC FPGA...)`
        );
      }
    } catch (err) {
      setEncStatus("Poll error: " + err.message);
      stopEncPolling();
    }
  }

  function startEncPolling(id) {
    stopEncPolling();
    encPollTimer.current = setInterval(() => pollEncryptOnce(id), 1000);
  }

  function stopEncPolling() {
    if (encPollTimer.current) {
      clearInterval(encPollTimer.current);
      encPollTimer.current = null;
    }
  }

  // ========== Decrypt API logic ==========
  async function submitDecrypt(e) {
    e.preventDefault();
    setDecPtHex("");
    setDecExpectedHex("");
    setDecValid(null);
    setDecStatus("Submitting decrypt job...");

    const trimmedKey = keyHex.trim();
    const trimmedCt = decCtHex.trim();

    try {
      const res = await fetch("/api/decrypt-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          keyHex: trimmedKey,
          ctHex: trimmedCt,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDecStatus("Error: " + (data.error || res.statusText));
        return;
      }
      setDecJobId(data.jobId);
      setDecStatus("Decrypt job created, waiting for DEC FPGA...");
      startDecPolling(data.jobId);
    } catch (err) {
      setDecStatus("Request error: " + err.message);
    }
  }

  async function pollDecryptOnce(id) {
    try {
      const res = await fetch(
        `/api/decrypt-status?jobId=${encodeURIComponent(id)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setDecStatus("Status error: " + (data.error || res.statusText));
        stopDecPolling();
        return;
      }
      if (data.status === "done") {
        setDecStatus("Decryption done");
        setDecPtHex(data.ptHex || "");
        setDecExpectedHex(data.expectedPtHex || "");
        setDecValid(data.valid);
        stopDecPolling();
      } else {
        setDecStatus(
          `Status: ${data.status} (waiting for DEC FPGA...)`
        );
      }
    } catch (err) {
      setDecStatus("Poll error: " + err.message);
      stopDecPolling();
    }
  }

  function startDecPolling(id) {
    stopDecPolling();
    decPollTimer.current = setInterval(() => pollDecryptOnce(id), 1000);
  }

  function stopDecPolling() {
    if (decPollTimer.current) {
      clearInterval(decPollTimer.current);
      decPollTimer.current = null;
    }
  }

  // ========== Roundtrip API logic (ENC → DEC) ==========
  async function submitRoundtrip(e) {
    e.preventDefault();

    // Reset roundtrip state
    setRtEncCtHex("");
    setRtEncValid(null);
    setRtDecPtHex("");
    setRtDecValid(null);
    setRtRoundtripOk(null);
    setRtAsciiOriginal("");
    setRtAsciiDec("");
    setRtTiming(null);
    setRtStatus("Submitting roundtrip (ENC → DEC) job...");

    const trimmedKey = keyHex.trim();
    const trimmedPtHex = ptHex.trim();

    const body = asciiMode
      ? {
          token,
          keyHex: trimmedKey,
          ptAscii,
        }
      : {
          token,
          keyHex: trimmedKey,
          ptHex: trimmedPtHex,
        };

    try {
      const res = await fetch("/api/roundtrip-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setRtStatus("Error: " + (data.error || res.statusText));
        return;
      }
      setRtGroupId(data.groupId);
      setRtStatus("Roundtrip started: waiting for ENC FPGA...");
      startRtPolling(data.groupId);
    } catch (err) {
      setRtStatus("Request error: " + err.message);
    }
  }

  async function pollRoundtripOnce(groupId) {
    try {
      const res = await fetch(
        `/api/roundtrip-status?groupId=${encodeURIComponent(groupId)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setRtStatus("Status error: " + (data.error || res.statusText));
        stopRtPolling();
        return;
      }

      if (data.status === "waiting-enc") {
        setRtStatus("Waiting for ENC FPGA...");
      } else if (data.status === "waiting-dec") {
        setRtStatus("ENC done, waiting for DEC FPGA...");
      } else if (data.status === "done") {
        setRtStatus("Roundtrip done");
      } else {
        setRtStatus("Status: " + data.status);
      }

      if (data.enc) {
        setRtEncCtHex(data.enc.ctHex || "");
        setRtEncValid(data.enc.valid ?? null);
      } else {
        setRtEncCtHex("");
        setRtEncValid(null);
      }

      if (data.dec) {
        setRtDecPtHex(data.dec.ptHex || "");
        setRtDecValid(data.dec.valid ?? null);
      } else {
        setRtDecPtHex("");
        setRtDecValid(null);
      }

      setRtRoundtripOk(data.roundtripOk ?? null);

      if (data.ptAsciiOriginal !== undefined) {
        setRtAsciiOriginal(data.ptAsciiOriginal || "");
      }
      if (data.ptAscii !== undefined) {
        setRtAsciiDec(data.ptAscii || "");
      }

      if (data.timing) {
        setRtTiming(data.timing);
      } else {
        setRtTiming(null);
      }

      if (data.status === "done") {
        stopRtPolling();
      }
    } catch (err) {
      setRtStatus("Poll error: " + err.message);
      stopRtPolling();
    }
  }

  function startRtPolling(groupId) {
    stopRtPolling();
    rtPollTimer.current = setInterval(
      () => pollRoundtripOnce(groupId),
      1000
    );
  }

  function stopRtPolling() {
    if (rtPollTimer.current) {
      clearInterval(rtPollTimer.current);
      rtPollTimer.current = null;
    }
  }

  function toggleRoundtrip() {
    const next = !roundtripMode;
    setRoundtripMode(next);
    if (next) {
      // entering roundtrip -> clear ENC-only state
      stopEncPolling();
      setEncStatus("");
      setEncCtHex("");
      setEncExpectedHex("");
      setEncValid(null);
    } else {
      // leaving roundtrip -> clear RT state
      stopRtPolling();
      setRtStatus("");
      setRtEncCtHex("");
      setRtEncValid(null);
      setRtDecPtHex("");
      setRtDecValid(null);
      setRtRoundtripOk(null);
      setRtAsciiOriginal("");
      setRtAsciiDec("");
      setRtTiming(null);
      setRtGroupId(null);
    }
  }

  // ========== UI helper boxes ==========
  const encValidBox =
    encValid === true ? (
      <div
        style={{
          marginTop: "0.7rem",
          padding: "0.6rem 0.9rem",
          borderRadius: "8px",
          backgroundColor: "#e6ffed",
          border: "1px solid #2ecc71",
          color: "#1e8449",
          fontWeight: 500,
          fontSize: "0.85rem",
        }}
      >
        ✅ ENC FPGA output matches software AES encryption.
      </div>
    ) : encValid === false ? (
      <div
        style={{
          marginTop: "0.7rem",
          padding: "0.6rem 0.9rem",
          borderRadius: "8px",
          backgroundColor: "#ffecec",
          border: "1px solid #e74c3c",
          color: "#c0392b",
          fontWeight: 500,
          fontSize: "0.85rem",
        }}
      >
        ❌ ENC FPGA ciphertext does not match software AES.
      </div>
    ) : null;

  const decValidBox =
    decValid === true ? (
      <div
        style={{
          marginTop: "0.7rem",
          padding: "0.6rem 0.9rem",
          borderRadius: "8px",
          backgroundColor: "#e6ffed",
          border: "1px solid #2ecc71",
          color: "#1e8449",
          fontWeight: 500,
          fontSize: "0.85rem",
        }}
      >
        ✅ DEC FPGA output matches software AES decryption.
      </div>
    ) : decValid === false ? (
      <div
        style={{
          marginTop: "0.7rem",
          padding: "0.6rem 0.9rem",
          borderRadius: "8px",
          backgroundColor: "#ffecec",
          border: "1px solid #e74c3c",
          color: "#c0392b",
          fontWeight: 500,
          fontSize: "0.85rem",
        }}
      >
        ❌ DEC FPGA plaintext does not match software AES.
      </div>
    ) : null;

  const roundtripBanner =
    rtRoundtripOk === true ? (
      <div
        style={{
          marginTop: "0.9rem",
          padding: "0.7rem 1rem",
          borderRadius: "10px",
          backgroundColor: "#e6ffed",
          border: "1px solid #16a34a",
          color: "#166534",
          fontWeight: 600,
          fontSize: "0.9rem",
        }}
      >
        ✅ Roundtrip OK: DEC plaintext matches original.
      </div>
    ) : rtRoundtripOk === false ? (
      <div
        style={{
          marginTop: "0.9rem",
          padding: "0.7rem 1rem",
          borderRadius: "10px",
          backgroundColor: "#fef2f2",
          border: "1px solid #b91c1c",
          color: "#7f1d1d",
          fontWeight: 600,
          fontSize: "0.9rem",
        }}
      >
        ❌ Roundtrip FAILED: DEC plaintext differs from original.
      </div>
    ) : null;

  function formatTimeNs(tSeconds) {
    if (tSeconds == null) return "";
    const ns = tSeconds * 1e9;
    if (ns < 1000) return `${ns.toFixed(1)} ns`;
    const us = ns / 1e3;
    if (us < 1000) return `${us.toFixed(1)} µs`;
    const ms = us / 1e3;
    return `${ms.toFixed(3)} ms`;
  }

  const timingBox =
    rtTiming != null ? (
      <div
        style={{
          marginTop: "0.6rem",
          fontSize: "0.8rem",
          color: "#9ca3af",
        }}
      >
        <strong>Theoretical AES core time</strong> (f ={" "}
        {rtTiming.fclkMHz} MHz, {rtTiming.cyclesPerBlock} cycles/block):{" "}
        ENC {formatTimeNs(rtTiming.encTime_s)}, DEC{" "}
        {formatTimeNs(rtTiming.decTime_s)}, total{" "}
        {formatTimeNs(rtTiming.totalTime_s)}.
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
            maxWidth: "900px",
            background: "rgba(15, 23, 42, 0.92)",
            borderRadius: "16px",
            padding: "1.75rem",
            boxShadow: "0 18px 40px rgba(0, 0, 0, 0.55)",
            border: "1px solid rgba(148, 163, 184, 0.25)",
            backdropFilter: "blur(16px)",
          }}
        >
          {/* Header */}
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
                ENC + DEC via ESP32 + Vercel
              </span>
            </h1>
            <p
              style={{
                margin: "0.4rem 0 0",
                fontSize: "0.9rem",
                color: "#cbd5f5",
              }}
            >
              Choose a key token. You can run encryption and
              decryption independently, or enable roundtrip mode to
              stream the ciphertext from ENC FPGA into DEC FPGA
              automatically. Plaintext can be given in hex or ASCII
              (≤16 chars, padded with spaces).
            </p>
          </header>

          {/* Shared token + key + roundtrip toggle */}
          <section
            style={{
              marginBottom: "1.5rem",
              paddingBottom: "1.2rem",
              borderBottom: "1px solid rgba(148, 163, 184, 0.3)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 2.6fr",
                columnGap: "1.5rem",
                rowGap: "0.8rem",
                alignItems: "flex-start",
              }}
            >
              <div>
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

              <div>
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
                    color: "#e5e7eb",
                  }}
                >
                  {keyHex}
                </div>
              </div>

              <div
                style={{
                  gridColumn: "1 / 3",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.55rem",
                  marginTop: "0.4rem",
                }}
              >
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    cursor: "pointer",
                    fontSize: "0.87rem",
                    color: "#e5e7eb",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={roundtripMode}
                    onChange={toggleRoundtrip}
                    style={{ cursor: "pointer" }}
                  />
                  <span>
                    Roundtrip via both FPGAs (auto ENC → DEC)
                  </span>
                </label>
                <span
                  style={{
                    fontSize: "0.78rem",
                    color: "#9ca3af",
                  }}
                >
                  Off = encrypt only. On = encrypt then decrypt with
                  the same key and ciphertext.
                </span>
              </div>
            </div>
          </section>

          {/* Encrypt / Roundtrip panel */}
          <section
            style={{
              marginBottom: "1.8rem",
              paddingBottom: "1.4rem",
              borderBottom: "1px solid rgba(148, 163, 184, 0.3)",
            }}
          >
            <h2
              style={{
                fontSize: "1.1rem",
                fontWeight: 600,
                margin: "0 0 0.7rem",
                color: "#e5e7eb",
              }}
            >
              {roundtripMode
                ? "Roundtrip (ENC → DEC automatically)"
                : "Encryption (FPGA ENC node)"}
            </h2>

            <form
              onSubmit={roundtripMode ? submitRoundtrip : submitEncrypt}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "0.9rem",
              }}
            >
              {/* Plaintext mode selector */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    marginBottom: "0.35rem",
                  }}
                >
                  <label
                    style={{
                      fontWeight: 500,
                      fontSize: "0.85rem",
                      color: "#e5e7eb",
                    }}
                  >
                    Plaintext mode
                  </label>
                  <label
                    style={{
                      fontSize: "0.85rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    }}
                  >
                    <input
                      type="radio"
                      name="ptmode"
                      checked={!asciiMode}
                      onChange={() => setAsciiMode(false)}
                    />
                    Hex (32 chars)
                  </label>
                  <label
                    style={{
                      fontSize: "0.85rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    }}
                  >
                    <input
                      type="radio"
                      name="ptmode"
                      checked={asciiMode}
                      onChange={() => setAsciiMode(true)}
                    />
                    ASCII (≤ 16 chars)
                  </label>
                </div>

                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 400,
                    marginBottom: "0.2rem",
                    color: "#9ca3af",
                  }}
                >
                  {asciiMode
                    ? "ASCII text will be padded with spaces to 16 bytes and converted to hex."
                    : "128-bit plaintext as 32 hex characters."}
                </label>

                {asciiMode ? (
                  <input
                    value={ptAscii}
                    onChange={(e) =>
                      setPtAscii(e.target.value.slice(0, 16))
                    }
                    placeholder="ASCII text (max 16 chars)"
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.6rem",
                      borderRadius: "8px",
                      border:
                        "1px solid rgba(148, 163, 184, 0.7)",
                      background: "rgba(15, 23, 42, 0.9)",
                      color: "#f9fafb",
                      fontFamily: "monospace",
                      fontSize: "0.9rem",
                    }}
                  />
                ) : (
                  <input
                    value={ptHex}
                    onChange={(e) =>
                      setPtHex(e.target.value.trim())
                    }
                    placeholder="32 hex chars"
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.6rem",
                      borderRadius: "8px",
                      border:
                        "1px solid rgba(148, 163, 184, 0.7)",
                      background: "rgba(15, 23, 42, 0.9)",
                      color: "#f9fafb",
                      fontFamily: "monospace",
                      fontSize: "0.9rem",
                    }}
                  />
                )}
              </div>

              <div style={{ textAlign: "right" }}>
                <button
                  type="submit"
                  style={{
                    padding: "0.5rem 1.4rem",
                    borderRadius: "999px",
                    border: "none",
                    fontSize: "0.9rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    background: roundtripMode
                      ? "linear-gradient(135deg, #22c55e 0%, #0ea5e9 40%, #a855f7 100%)"
                      : "linear-gradient(135deg, #0ea5e9 0%, #22c55e 50%, #a855f7 100%)",
                    color: "#0f172a",
                    boxShadow:
                      "0 8px 20px rgba(56, 189, 248, 0.5)",
                    transition:
                      "transform 0.08s ease, box-shadow 0.08s ease",
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform =
                      "scale(0.97)";
                    e.currentTarget.style.boxShadow =
                      "0 3px 10px rgba(56, 189, 248, 0.4)";
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform =
                      "scale(1)";
                    e.currentTarget.style.boxShadow =
                      "0 8px 20px rgba(56, 189, 248, 0.5)";
                  }}
                >
                  {roundtripMode
                    ? "Run roundtrip ENC → DEC"
                    : "Send to ENC FPGA"}
                </button>
              </div>
            </form>

            <div
              style={{
                marginTop: "0.8rem",
                fontSize: "0.9rem",
                color: "#e5e7eb",
              }}
            >
              <strong>Status:</strong>{" "}
              {roundtripMode
                ? rtStatus || "Idle (roundtrip mode)"
                : encStatus || "Idle"}
            </div>
            {roundtripMode ? (
              rtGroupId && (
                <div
                  style={{
                    marginTop: "0.2rem",
                    fontSize: "0.8rem",
                    color: "#9ca3af",
                  }}
                >
                  <strong>Roundtrip group ID:</strong>{" "}
                  {rtGroupId}
                </div>
              )
            ) : (
              encJobId && (
                <div
                  style={{
                    marginTop: "0.2rem",
                    fontSize: "0.8rem",
                    color: "#9ca3af",
                  }}
                >
                  <strong>Job ID:</strong> {encJobId}
                </div>
              )
            )}

            {/* ENC-only results */}
            {!roundtripMode && encCtHex && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.6rem 0.7rem",
                  borderRadius: "8px",
                  background: "rgba(15, 23, 42, 0.9)",
                  border:
                    "1px solid rgba(148, 163, 184, 0.5)",
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
                  Ciphertext from ENC FPGA
                </div>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.9rem",
                    wordBreak: "break-all",
                    color: "#e5e7eb",
                  }}
                >
                  {encCtHex}
                </div>

                {encExpectedHex && (
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
                      Expected (software AES ENC)
                    </div>
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontSize: "0.85rem",
                        wordBreak: "break-all",
                        color: "#e5e7eb",
                      }}
                    >
                      {encExpectedHex}
                    </div>
                  </>
                )}
              </div>
            )}

            {!roundtripMode && encValidBox}

            {/* Roundtrip results */}
            {roundtripMode && (rtEncCtHex || rtDecPtHex) && (
              <div
                style={{
                  marginTop: "0.9rem",
                  padding: "0.7rem 0.8rem",
                  borderRadius: "8px",
                  background: "rgba(15, 23, 42, 0.9)",
                  border:
                    "1px solid rgba(148, 163, 184, 0.5)",
                }}
              >
                {rtEncCtHex && (
                  <>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 500,
                        marginBottom: "0.25rem",
                        color: "#e5e7eb",
                      }}
                    >
                      Ciphertext from ENC FPGA
                    </div>
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontSize: "0.9rem",
                        wordBreak: "break-all",
                        color: "#e5e7eb",
                      }}
                    >
                      {rtEncCtHex}
                    </div>
                    {rtEncValid != null && (
                      <div
                        style={{
                          marginTop: "0.25rem",
                          fontSize: "0.8rem",
                          color: rtEncValid
                            ? "#22c55e"
                            : "#f97316",
                        }}
                      >
                        ENC vs software AES ENC:{" "}
                        {rtEncValid ? "OK" : "mismatch"}
                      </div>
                    )}
                    <div
                      style={{
                        margin: "0.7rem 0 0.3rem",
                        borderTop:
                          "1px dashed rgba(148, 163, 184, 0.6)",
                      }}
                    />
                  </>
                )}

                {rtDecPtHex && (
                  <>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 500,
                        marginBottom: "0.25rem",
                        color: "#e5e7eb",
                      }}
                    >
                      Plaintext from DEC FPGA (hex)
                    </div>
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontSize: "0.9rem",
                        wordBreak: "break-all",
                        color: "#e5e7eb",
                      }}
                    >
                      {rtDecPtHex}
                    </div>
                    {rtDecValid != null && (
                      <div
                        style={{
                          marginTop: "0.25rem",
                          fontSize: "0.8rem",
                          color: rtDecValid
                            ? "#22c55e"
                            : "#f97316",
                        }}
                      >
                        DEC vs software AES DEC:{" "}
                        {rtDecValid ? "OK" : "mismatch"}
                      </div>
                    )}
                  </>
                )}

                {(rtAsciiOriginal || rtAsciiDec) && (
                  <div
                    style={{
                      marginTop: "0.7rem",
                      paddingTop: "0.5rem",
                      borderTop:
                        "1px dashed rgba(148, 163, 184, 0.6)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        marginBottom: "0.2rem",
                        color: "#a5b4fc",
                      }}
                    >
                      ASCII view (spaces padded to 16 bytes)
                    </div>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "#e5e7eb",
                        marginBottom: "0.2rem",
                      }}
                    >
                      <strong>Original:</strong>{" "}
                      {rtAsciiOriginal || "—"}
                    </div>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "#e5e7eb",
                      }}
                    >
                      <strong>Decrypted:</strong>{" "}
                      {rtAsciiDec || "—"}
                    </div>
                  </div>
                )}
              </div>
            )}

            {roundtripMode && roundtripBanner}
            {roundtripMode && timingBox}
          </section>

          {/* Decrypt panel (manual) */}
          <section>
            <h2
              style={{
                fontSize: "1.1rem",
                fontWeight: 600,
                margin: "0 0 0.7rem",
                color: "#e5e7eb",
              }}
            >
              Manual decryption (FPGA DEC node)
            </h2>

            <form
              onSubmit={submitDecrypt}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "0.9rem",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    marginBottom: "0.35rem",
                    color: "#e5e7eb",
                  }}
                >
                  Ciphertext (128-bit, hex)
                </label>
                <input
                  value={decCtHex}
                  onChange={(e) =>
                    setDecCtHex(e.target.value.trim())
                  }
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.6rem",
                    borderRadius: "8px",
                    border:
                      "1px solid rgba(148, 163, 184, 0.7)",
                    background: "rgba(15, 23, 42, 0.9)",
                    color: "#f9fafb",
                    fontFamily: "monospace",
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              <div style={{ textAlign: "right" }}>
                <button
                  type="submit"
                  style={{
                    padding: "0.5rem 1.4rem",
                    borderRadius: "999px",
                    border: "none",
                    fontSize: "0.9rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    background:
                      "linear-gradient(135deg, #f97316 0%, #facc15 40%, #ec4899 100%)",
                    color: "#0f172a",
                    boxShadow:
                      "0 8px 20px rgba(248, 181, 0, 0.45)",
                    transition:
                      "transform 0.08s ease, box-shadow 0.08s ease",
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform =
                      "scale(0.97)";
                    e.currentTarget.style.boxShadow =
                      "0 3px 10px rgba(248, 181, 0, 0.35)";
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform =
                      "scale(1)";
                    e.currentTarget.style.boxShadow =
                      "0 8px 20px rgba(248, 181, 0, 0.45)";
                  }}
                >
                  Send to DEC FPGA
                </button>
              </div>
            </form>

            <div
              style={{
                marginTop: "0.8rem",
                fontSize: "0.9rem",
                color: "#e5e7eb",
              }}
            >
              <strong>Status:</strong>{" "}
              {decStatus || "Idle"}
            </div>
            {decJobId && (
              <div
                style={{
                  marginTop: "0.2rem",
                  fontSize: "0.8rem",
                  color: "#9ca3af",
                }}
              >
                <strong>Job ID:</strong> {decJobId}
              </div>
            )}

            {decPtHex && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.6rem 0.7rem",
                  borderRadius: "8px",
                  background: "rgba(15, 23, 42, 0.9)",
                  border:
                    "1px solid rgba(148, 163, 184, 0.5)",
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
                  Plaintext from DEC FPGA
                </div>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.9rem",
                    wordBreak: "break-all",
                    color: "#e5e7eb",
                  }}
                >
                  {decPtHex}
                </div>

                {decExpectedHex && (
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
                      Expected (software AES DEC)
                    </div>
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontSize: "0.85rem",
                        wordBreak: "break-all",
                        color: "#e5e7eb",
                      }}
                    >
                      {decExpectedHex}
                    </div>
                  </>
                )}
              </div>
            )}

            {decValidBox}
          </section>
        </div>
      </main>

      {/* Full black background, no white border */}
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