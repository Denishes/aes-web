// pages/api/decrypt-result.js
import { completeDecJobWithValidation } from "./_jobs_dec";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  const { jobId, ptHex } = req.body || {};
  if (!jobId || !ptHex) {
    res.status(400).json({ error: "jobId and ptHex required" });
    return;
  }

  const result = completeDecJobWithValidation(jobId, ptHex);
  if (!result.ok) {
    res
      .status(400)
      .json({ error: "Unknown or mismatched jobId", reason: result.reason });
    return;
  }

  res.status(200).json({
    ok: true,
    valid: result.valid,
    expectedPtHex: result.expectedPtHex,
  });
}