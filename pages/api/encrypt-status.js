// pages/api/encrypt-status.js
import { getStatus } from "./_jobs";

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

  const st = getStatus(jobId);
  if (!st.exists) {
    res.status(404).json({ error: "Job not found or expired" });
    return;
  }

  res.status(200).json({
    status: st.status,
    ctHex: st.ctHex,
    valid: st.valid,
    expectedCtHex: st.expectedCtHex,
  });
}