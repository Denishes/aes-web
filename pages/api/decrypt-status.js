// pages/api/decrypt-status.js
import { getDecStatus } from "./_jobs_dec";

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
    return res.status(405).json({ error: "Use GET" });
  }

  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ error: "jobId is required" });
  }

  const st = getDecStatus(jobId.toString());

  // In your style, getDecStatus likely returns { exists:false } when missing
  if (!st || st.exists === false) {
    return res.status(404).json({ error: "Job not found or expired" });
  }

  // DO NOT recompute AES here.
  // _jobs_dec.js should already compute:
  //   expectedPtHex and valid
  return res.status(200).json({
    jobId: jobId.toString(),
    status: st.status,
    ctHex: st.ctHex || "",
    ptHex: st.ptHex || "",
    expectedPtHex: st.expectedPtHex || "",
    valid: st.valid,
    timing: theoreticalTimingDecrypt({
      fclkMHz: 48,
      cyclesPerBlock: 10,
      blocks: 1,
    }),
  });
}
