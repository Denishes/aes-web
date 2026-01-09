// pages/api/encrypt-status.js
import { getStatus } from "./_jobs";
import crypto from "crypto";

// --- Helpers ---
function normHex(s) {
  return (s || "").toUpperCase().replace(/[^0-9A-F]/g, "");
}

// AES-ECB encrypt single 16B block (golden model)
function aesEcbEncryptHex(keyHex, ptHex) {
  const key = Buffer.from(normHex(keyHex), "hex");
  const pt = Buffer.from(normHex(ptHex), "hex");

  // Select AES variant based on key length
  const alg =
    key.length === 16 ? "aes-128-ecb" :
    key.length === 24 ? "aes-192-ecb" :
    key.length === 32 ? "aes-256-ecb" :
    null;

  if (!alg) throw new Error("Invalid key length (must be 16/24/32 bytes)");

  const cipher = crypto.createCipheriv(alg, key, null);
  cipher.setAutoPadding(false); // 16-byte block, no padding
  const out = Buffer.concat([cipher.update(pt), cipher.final()]);
  return out.toString("hex").toUpperCase();
}

// Theoretical timing (analytical, not measured)
function theoreticalTimingEncrypt({ fclkMHz = 48, cyclesPerBlock = 10, blocks = 1 } = {}) {
  const fclkHz = fclkMHz * 1e6;
  const tBlock_s = cyclesPerBlock / fclkHz;
  const encTime_s = blocks * tBlock_s;
  return {
    mode: "theoretical",
    fclkMHz,
    cyclesPerBlock,
    blocks,
    encTime_s,
    encTime_ns: encTime_s * 1e9,
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

  const st = getStatus(jobId.toString());
  if (!st) {
    res.status(404).json({ error: "Job not found or expired" });
    return;
  }

  // If not done yet, return current status (plus theoretical timing)
  if (st.status !== "done") {
    res.status(200).json({
      jobId: st.id,
      status: st.status,
      token: st.token,
      keyHex: st.keyHex,
      ptHex: st.ptHex,
      timing: theoreticalTimingEncrypt({
        fclkMHz: 48,        // <<< set to your real FPGA AES clock
        cyclesPerBlock: 10, // AES-128 sequential (adjust if needed)
        blocks: 1,
      }),
    });
    return;
  }

  // Done: compare FPGA ct to golden model
  let expectedCtHex = "";
  let valid = false;

  try {
    expectedCtHex = aesEcbEncryptHex(st.keyHex, st.ptHex);
    valid = normHex(st.ctHex) === normHex(expectedCtHex);
  } catch (e) {
    expectedCtHex = "";
    valid = false;
  }

  res.status(200).json({
    jobId: st.id,
    status: "done",
    token: st.token,
    keyHex: st.keyHex,
    ptHex: st.ptHex,
    ctHex: st.ctHex || "",
    expectedCtHex,
    valid,
    timing: theoreticalTimingEncrypt({
      fclkMHz: 48,        // <<< set to your real FPGA AES clock
      cyclesPerBlock: 10, // AES-128 sequential (adjust if needed)
      blocks: 1,
    }),
  });
}
