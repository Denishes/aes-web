// pages/api/roundtrip-request.js
import { startRoundtrip } from "./_roundtrip";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  const { keyHex, ptHex, ptAscii, token } = req.body || {};

  if (!keyHex) {
    res.status(400).json({ error: "keyHex is required" });
    return;
  }

  let ptHexFinal = ptHex;

  // If ptAscii is provided and ptHex is not, convert ASCII → hex with space padding to 16 bytes
  if (ptAscii && !ptHex) {
    const padded = (ptAscii + " ".repeat(16)).slice(0, 16);
    let h = "";
    for (let i = 0; i < 16; i++) {
      const code = padded.charCodeAt(i) & 0xff;
      h += code.toString(16).padStart(2, "0");
    }
    ptHexFinal = h.toUpperCase();
  }

  if (!ptHexFinal) {
    res
      .status(400)
      .json({ error: "Either ptHex or ptAscii must be provided" });
    return;
  }

  const k = keyHex.toUpperCase();
  const p = ptHexFinal.toUpperCase();

  if (![32, 48, 64].includes(k.length)) {
    res.status(400).json({
      error:
        "keyHex must be 32, 48 or 64 hex chars (128/192/256 bits)",
    });
    return;
  }
  if (p.length !== 32) {
    res
      .status(400)
      .json({ error: "ptHex must be exactly 32 hex chars" });
    return;
  }

  const { groupId, encJobId } = startRoundtrip(
    k,
    p,
    (token || "0").toString()
  );

  res.status(200).json({
    groupId,
    encJobId,
    status: "waiting-enc",
  });
}