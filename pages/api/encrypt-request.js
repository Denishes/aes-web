import { createJob } from "./_jobs";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  const { keyHex, ptHex } = req.body || {};

  if (!keyHex || !ptHex) {
    res.status(400).json({ error: "keyHex and ptHex required" });
    return;
  }

  // Simple sanity check: 32, 48 or 64 hex chars for 128/192/256 bits
  if (![32, 48, 64].includes(keyHex.length)) {
    res.status(400).json({ error: "keyHex must be 32/48/64 hex chars" });
    return;
  }
  if (ptHex.length !== 32) {
    res.status(400).json({ error: "ptHex must be 32 hex chars (128-bit block)" });
    return;
  }

  const job = createJob(keyHex.toUpperCase(), ptHex.toUpperCase());
  res.status(200).json({ jobId: job.id, status: job.status });
}