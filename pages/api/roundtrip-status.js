// pages/api/roundtrip-status.js
import { getRoundtripStatus } from "./_roundtrip";

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

  const st = getRoundtripStatus(groupId);
  if (!st.exists) {
    res.status(404).json({ error: "Roundtrip group not found or expired" });
    return;
  }

  res.status(200).json(st);
}