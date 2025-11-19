// pages/api/_jobs.js
import crypto from "crypto";

// Simple in-memory single-job store (OK for prototype)
// currentJob: { id, keyHex, ptHex, token, status: 'pending'|'assigned'|'done' }
// lastResult: { id, ctHex, valid, expectedCtHex }

let currentJob = null;
let lastResult = null;

function newJobId() {
  return Date.now().toString();
}

export function createJob(keyHex, ptHex, token = "0") {
  const id = newJobId();
  currentJob = { id, keyHex, ptHex, token, status: "pending" };
  lastResult = null;
  return currentJob;
}

export function getJobForEsp() {
  if (!currentJob || currentJob.status !== "pending") return null;
  currentJob.status = "assigned";
  return currentJob;
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

// Called when ESP/FPGA posts back the ciphertext
export function completeJobWithValidation(id, ctHexRaw) {
  if (!currentJob || currentJob.id !== id) {
    return { ok: false, reason: "job-not-found" };
  }

  const normCt = (ctHexRaw || "").toString().trim().toUpperCase();
  let expectedCtHex = null;
  let valid = false;

  try {
    expectedCtHex = aesEcbEncryptHex(currentJob.keyHex, currentJob.ptHex);
    valid = normCt === expectedCtHex;
  } catch (e) {
    // If software AES fails, still store what we got
    expectedCtHex = null;
    valid = false;
  }

  currentJob.status = "done";
  lastResult = { id, ctHex: normCt, valid, expectedCtHex };

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