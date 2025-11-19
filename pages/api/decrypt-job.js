// pages/api/decrypt-job.js
import { getDecJobForEsp } from "./_jobs_dec";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Use GET" });
    return;
  }

  const job = getDecJobForEsp();
  if (!job) {
    res.status(200).json({ hasJob: false });
    return;
  }

  res.status(200).json({
    hasJob: true,
    jobId: job.id,
    keyHex: job.keyHex,
    ctHex: job.ctHex,
    token: job.token,
  });
}