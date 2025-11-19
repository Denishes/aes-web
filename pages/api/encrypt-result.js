// pages/api/encrypt-result.js
import { completeJobWithValidation } from "./_jobs";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  const { jobId, ctHex } = req.body || {};
  if (!jobId || !ctHex) {
    res.status(400).json({ error: "jobId and ctHex required" });
    return;
  }

  const result = completeJobWithValidation(jobId, ctHex);
  if (!result.ok) {
    res
      .status(400)
      .json({ error: "Unknown or mismatched jobId", reason: result.reason });
    return;
  }

  res.status(200).json({
    ok: true,
    valid: result.valid,
    expectedCtHex: result.expectedCtHex,
  });
}