// pages/api/roundtrip-request.js
import { createJob } from "./_jobs";
import { startRoundtrip } from "./_roundtrip";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  const { keyHex, ptHex, token } = req.body || {};

  if (!keyHex || !ptHex) {
    res.status(400).json({ error: "keyHex and ptHex required" });
    return;
  }

  if (![32, 48, 64].includes(keyHex.length)) {
    res
      .status(400)
      .json({ error: "keyHex must be 32/48/64 hex chars (128/192/256 bits)" });
    return;
  }
  if (ptHex.length !== 32) {
    res.status(400).json({ error: "ptHex must be 32 hex chars (128-bit block)" });
    return;
  }

  const keyUp = keyHex.toUpperCase();
  const ptUp = ptHex.toUpperCase();
  const tok = (token || "0").toString().toUpperCase();

  const groupId = "rt-" + Date.now().toString();

  // Start roundtrip tracking
  startRoundtrip(groupId, tok, keyUp, ptUp);

  // Create an ENCRYPT job with roundtrip metadata
  const job = createJob(keyUp, ptUp, tok, {
    roundtrip: true,
    groupId,
    origPtHex: ptUp,
  });

  res.status(200).json({
    groupId,
    encJobId: job.id,
    status: job.status,
  });
}