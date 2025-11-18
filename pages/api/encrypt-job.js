import { getJobForEsp } from "./_jobs";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Use GET" });
    return;
  }

  const job = getJobForEsp();
  if (!job) {
    res.status(200).json({ hasJob: false });
    return;
  }

  res.status(200).json({
    hasJob: true,
    jobId: job.id,
    keyHex: job.keyHex,
    ptHex: job.ptHex,
  });
}