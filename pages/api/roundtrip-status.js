// pages/api/roundtrip-status.js
import { getRoundtripStatus } from "./_roundtrip";

function hexToAscii(hex) {
  if (!hex) return "";
  let out = "";
  const clean = hex.replace(/[^0-9A-Fa-f]/g, "");
  for (let i = 0; i + 1 < clean.length; i += 2) {
    const byte = parseInt(clean.slice(i, i + 2), 16);
    if (!Number.isNaN(byte)) {
      out += String.fromCharCode(byte);
    }
  }
  // Strip padding spaces at the end
  return out.replace(/\s+$/g, "");
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Use GET" });
    return;
  }

  const { groupId } = req.query;
  if (!groupId) {
    res.status(400).json({ error: "groupId is required" });
    return;
  }

  const st = getRoundtripStatus(groupId.toString());
  if (!st.exists) {
    res
      .status(404)
      .json({ error: "Roundtrip group not found or expired" });
    return;
  }

  const ptHexOriginal = st.ptHexOriginal || "";
  const decPtHex = st.dec && st.dec.ptHex ? st.dec.ptHex : "";

  const ptAsciiOriginal = hexToAscii(ptHexOriginal);
  const ptAscii = hexToAscii(decPtHex);

  res.status(200).json({
    ...st,
    ptAsciiOriginal,
    ptAscii,
  });
}