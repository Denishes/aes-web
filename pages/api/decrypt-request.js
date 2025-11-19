// pages/api/roundtrip-request.js
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
    res.status(400).json({ error: "ptHex must be 32 hex chars" });
    return;
  }

  const { groupId, encJobId } = startRoundtrip(
    keyHex.toUpperCase(),
    ptHex.toUpperCase(),
    token || "0"
  );

  res.status(200).json({
    groupId,
    encJobId,
    status: "waiting-enc",
  });
}