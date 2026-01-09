// pages/api/decrypt-status.js
import { getDecStatus } from "./_jobs_dec";
import crypto from "crypto";

// --- Helpers ---
function normHex(s) {
  return (s || "").toUpperCase().replace(/[^0-9A-F]/g, "");
}

// AES-ECB decrypt single 16B block (golden model)
function aesEcbDecryptHex(keyHex, ctHex) {
  const key = Buffer.from(normHex(keyHex), "hex");
  const ct = Buffer.from(normHex(ctHex), "hex");

  const alg =
    key.length === 16 ? "aes-128-ecb" :
    key.length === 24 ? "aes-192-ecb" :
    key.length === 32 ? "aes-256-ecb" :
    null;

  if (!alg) throw new Error("Invalid key length (must be 16/24/32 bytes)");

  const decipher = crypto.createDecipheriv(alg, key, null);
  decipher.setAutoPadding(false);
  const out = Buffer.concat([decipher.update(ct), decipher.final()]);
  return out.toString("hex").toUpperCase();
}

// Theoretical timing (analytical, not measured)
function theoreticalTimingDecrypt({ fclkMHz = 48, cyclesPerBlock = 10, blocks = 1 } = {}) {
  const fclkHz = fclkMHz * 1e6;
  const tBlock_s = cyclesPerBlock / fclkHz;
  const decTime_s = blocks * tBlock_s;
  return {
    mode: "theoretical",
    fclkMHz,
    cyclesPerBlock,
    blocks,
    decTime_s,
    decTime_ns: decTime_s * 1e9,
  };
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Use GET" });
    return;
  }

  const { jobId } = req.query;
  if (!jobId) {
    res.status(400).json({ error: "jobId is required" });
    return;
  }

  const st = getDecStatus(jobId.toString());
  if (!st) {
    res.status(404).json({ error: "Job not found or expired" });
    return;
  }

  // Not done yet: return current status (+ theoretical timing)
  if (st.status !== "done") {
    res.status(200).json({
      jobId: st.id,
      status: st.status,
      token: st.token,
      keyHex: st.keyHex,
      ctHex: st.ctHex,
      timing: theoreticalTimingDecrypt({
        fclkMHz: 48,        // <<< set to your real FPGA AES clock
        cyclesPerBlock: 10, // AES-128 sequential (adjust if needed)
        blocks: 1,
      }),
    });
    return;
  }

  // Done: compare FPGA pt to golden model
  let expectedPtHex = "";
  let valid = false;

  try {
    expectedPtHex = aesEcbDecryptHex(st.keyHex, st.ctHex);
    valid = normHex(st.ptHex) === normHex(expectedPtHex);
  } catch (e) {
    expectedPtHex = "";
    valid = false;
  }

  res.status(200).json({
    jobId: st.id,
    status: "done",
    token: st.token,
    keyHex: st.keyHex,
    ctHex: st.ctHex || "",
    ptHex: st.ptHex || "",
    expectedPtHex,
    valid,
    timing: theoreticalTimingDecrypt({
      fclkMHz: 48,        // <<< set to your real FPGA AES clock
      cyclesPerBlock: 10, // AES-128 sequential (adjust if needed)
      blocks: 1,
    }),
  });
}
