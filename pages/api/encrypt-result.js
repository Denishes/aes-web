// pages/api/encrypt-result.js
import { completeJobWithValidation } from "./_jobs";
import { noteEncryptResult } from "./_roundtrip";

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

  // Update roundtrip group (if this encrypt job belongs to one)
  noteEncryptResult(jobId, result.valid, result.expectedCtHex);

  res.status(200).json({
    ok: true,
    valid: result.valid,
    expectedCtHex: result.expectedCtHex,
  });
}