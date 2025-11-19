// pages/api/_jobs.js
import crypto from "crypto";
import { recordEncResultForRoundtrip } from "./_roundtrip";

// currentJob: { id, keyHex, ptHex, token, status, roundtrip?, groupId?, origPtHex? }
// lastResult: { id, ctHex, valid, expectedCtHex }
let currentJob = null;
let lastResult = null;

function newJobId() {
  return Date.now().toString();
}

// opts: { roundtrip?: boolean, groupId?: string, origPtHex?: string }
export function createJob(keyHex, ptHex, token = "0", opts = {}) {
  const id = newJobId();
  currentJob = {
    id,
    keyHex,
    ptHex,
    token,
    status: "pending",
    roundtrip: !!opts.roundtrip,
    groupId: opts.groupId || null,
    origPtHex: (opts.origPtHex || ptHex),
  };
  lastResult = null;
  return currentJob;
}

export function getJobForEsp() {
  if (!currentJob || currentJob.status !== "pending") return null;
  currentJob.status = "assigned";
  return currentJob;
}

// ---- helpers ----

// Normalize ciphertext to pure hex (strip JSON etc.)
function normalizeCipher(raw) {
  if (!raw) return "";
  let s = String(raw).trim();

  // Try JSON first
  if (s.startsWith("{")) {
    try {
      const obj = JSON.parse(s);
      const cand =
        obj.PT ||
        obj.pt ||
        obj.CT ||
        obj.ct ||
        obj.ctHex ||
        obj.CTHex;
      if (cand) s = String(cand);
    } catch (e) {
      // ignore parse error
    }
  }

  s = s.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  return s;
}

// AES-ECB (no padding), 128/192/256 depending on key length
function aesEcbEncryptHex(keyHex, ptHex) {
  const key = Buffer.from(keyHex, "hex");
  const pt = Buffer.from(ptHex, "hex");

  const keyBits = key.length * 8;
  if (![128, 192, 256].includes(keyBits)) {
    throw new Error(`Unsupported AES key size: ${keyBits} bits`);
  }

  const algo = `aes-${keyBits}-ecb`;
  const cipher = crypto.createCipheriv(algo, key, null);
  cipher.setAutoPadding(false);

  const out = Buffer.concat([cipher.update(pt), cipher.final()]);
  return out.toString("hex").toUpperCase();
}

// Called when ENC ESP/FPGA posts back the ciphertext
export function completeJobWithValidation(id, ctHexRaw) {
  if (!currentJob || currentJob.id !== id) {
    return { ok: false, reason: "job-not-found" };
  }

  const normCt = normalizeCipher(ctHexRaw);
  let expectedCtHex = null;
  let valid = false;

  try {
    expectedCtHex = aesEcbEncryptHex(currentJob.keyHex, currentJob.ptHex);
    valid = normCt === expectedCtHex;
  } catch (e) {
    expectedCtHex = null;
    valid = false;
  }

  currentJob.status = "done";
  lastResult = { id, ctHex: normCt, valid, expectedCtHex };

  // If this encrypt job is part of a roundtrip, notify the roundtrip tracker
  if (currentJob.roundtrip && currentJob.groupId) {
    recordEncResultForRoundtrip(currentJob.groupId, {
      token: currentJob.token,
      keyHex: currentJob.keyHex,
      ptHex: currentJob.origPtHex || currentJob.ptHex,
      ctHex: normCt,
      valid,
      expectedCtHex,
    });
  }

  return { ok: true, valid, expectedCtHex };
}

export function getStatus(id) {
  if (!currentJob || currentJob.id !== id) {
    return { exists: false };
  }

  return {
    exists: true,
    status: currentJob.status,
    ctHex:
      currentJob.status === "done" && lastResult ? lastResult.ctHex : null,
    valid:
      currentJob.status === "done" && lastResult
        ? !!lastResult.valid
        : null,
    expectedCtHex:
      currentJob.status === "done" && lastResult
        ? lastResult.expectedCtHex
        : null,
  };
}