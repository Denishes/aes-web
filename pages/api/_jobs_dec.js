// pages/api/_jobs_dec.js
import crypto from "crypto";
import { recordDecResultForRoundtrip } from "./_roundtrip";

// Decrypt jobs:
// currentDecJob: { id, keyHex, ctHex, token, status, roundtrip?, groupId?, origPtHex? }
// lastDecResult: { id, ptHex, valid, expectedPtHex }

let currentDecJob = null;
let lastDecResult = null;

function newJobId() {
  return Date.now().toString();
}

// opts: { roundtrip?: boolean, groupId?: string, origPtHex?: string }
export function createDecJob(keyHex, ctHex, token = "0", opts = {}) {
  const id = newJobId();
  currentDecJob = {
    id,
    keyHex,
    ctHex,
    token,
    status: "pending",
    roundtrip: !!opts.roundtrip,
    groupId: opts.groupId || null,
    origPtHex: opts.origPtHex || null,
  };
  lastDecResult = null;
  return currentDecJob;
}

export function getDecJobForEsp() {
  if (!currentDecJob || currentDecJob.status !== "pending") return null;
  currentDecJob.status = "assigned";
  return currentDecJob;
}

// ---- helpers ----

// Normalize plaintext to pure hex (strip JSON etc.)
function normalizePlain(raw) {
  if (!raw) return "";
  let s = String(raw).trim();

  if (s.startsWith("{")) {
    try {
      const obj = JSON.parse(s);
      const cand =
        obj.PT ||
        obj.pt ||
        obj.Pt ||
        obj.ptHex ||
        obj.PTHex;
      if (cand) s = String(cand);
    } catch (e) {
      // ignore parse error
    }
  }

  s = s.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  return s;
}

// AES-ECB decrypt (no padding), 128/192/256 depending on key size
function aesEcbDecryptHex(keyHex, ctHex) {
  const key = Buffer.from(keyHex, "hex");
  const ct = Buffer.from(ctHex, "hex");

  const keyBits = key.length * 8;
  if (![128, 192, 256].includes(keyBits)) {
    throw new Error(`Unsupported AES key size: ${keyBits} bits`);
  }

  const algo = `aes-${keyBits}-ecb`;
  const decipher = crypto.createDecipheriv(algo, key, null);
  decipher.setAutoPadding(false);

  const out = Buffer.concat([decipher.update(ct), decipher.final()]);
  return out.toString("hex").toUpperCase();
}

// Called when DEC ESP/FPGA posts back the decrypted plaintext
export function completeDecJobWithValidation(id, ptHexRaw) {
  if (!currentDecJob || currentDecJob.id !== id) {
    return { ok: false, reason: "job-not-found" };
  }

  const normPt = normalizePlain(ptHexRaw);
  let expectedPtHex = null;
  let valid = false;

  try {
    expectedPtHex = aesEcbDecryptHex(
      currentDecJob.keyHex,
      currentDecJob.ctHex
    );
    valid = normPt === expectedPtHex;
  } catch (e) {
    expectedPtHex = null;
    valid = false;
  }

  currentDecJob.status = "done";
  lastDecResult = { id, ptHex: normPt, valid, expectedPtHex };

  // If this decrypt job is part of a roundtrip, notify the roundtrip tracker
  if (currentDecJob.roundtrip && currentDecJob.groupId) {
    recordDecResultForRoundtrip(currentDecJob.groupId, {
      ptHex: normPt,
      valid,
      expectedPtHex,
    });
  }

  return { ok: true, valid, expectedPtHex };
}

export function getDecStatus(id) {
  if (!currentDecJob || currentDecJob.id !== id) {
    return { exists: false };
  }

  return {
    exists: true,
    status: currentDecJob.status,
    ptHex:
      currentDecJob.status === "done" && lastDecResult
        ? lastDecResult.ptHex
        : null,
    valid:
      currentDecJob.status === "done" && lastDecResult
        ? !!lastDecResult.valid
        : null,
    expectedPtHex:
      currentDecJob.status === "done" && lastDecResult
        ? lastDecResult.expectedPtHex
        : null,
  };
}