import { completeJob } from "./_jobs";

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

  const ok = completeJob(jobId, ctHex.toUpperCase());
  if (!ok) {
    res.status(400).json({ error: "Unknown or mismatched jobId" });
    return;
  }

  res.status(200).json({ ok: true });
}