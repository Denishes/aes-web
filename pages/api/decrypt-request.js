// pages/api/decrypt-request.js
import { createDecJob } from "./_jobs_dec";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  const { keyHex, ctHex, token } = req.body || {};

  if (!keyHex || !ctHex) {
    res.status(400).json({ error: "keyHex and ctHex required" });
    return;
  }

  if (![32, 48, 64].includes(keyHex.length)) {
    res
      .status(400)
      .json({ error: "keyHex must be 32/48/64 hex chars (128/192/256 bits)" });
    return;
  }
  if (ctHex.length !== 32) {
    res.status(400).json({ error: "ctHex must be 32 hex chars (128-bit block)" });
    return;
  }

  const job = createDecJob(
    keyHex.toUpperCase(),
    ctHex.toUpperCase(),
    token || "0"
  );

  res.status(200).json({ jobId: job.id, status: job.status });
}