// pages/api/encrypt-status.js
import { getStatus } from "./_jobs";

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
    return res.status(405).json({ error: "Use GET" });
  }

  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ error: "jobId is required" });
  }

  const st = getStatus(jobId.toString());

  // Your getStatus returns { exists:false } (not null)
  if (!st || st.exists === false) {
    return res.status(404).json({ error: "Job not found or expired" });
  }

  // IMPORTANT:
  // _jobs.js is already the source of truth for:
  //   - expectedCtHex
  //   - valid
  // so we DO NOT recompute AES here.
  return res.status(200).json({
    jobId: jobId.toString(),
    status: st.status,            // "pending" | "assigned" | "done"
    ctHex: st.ctHex || "",
    expectedCtHex: st.expectedCtHex || "",
    valid: st.valid,
    timing: theoreticalTimingEncrypt({
      fclkMHz: 48,
      cyclesPerBlock: 10,
      blocks: 1,
    }),
  });
}
