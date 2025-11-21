// pages/api/_roundtrip.js
// Roundtrip orchestration: ENC → DEC for a single 128-bit block.
//
// Uses:
//   - createJob, getStatus from ./_jobs          (encrypt side)
//   - createDecJob, getDecStatus from ./_jobs_dec (decrypt side)

import { createJob, getStatus as getEncStatus } from "./_jobs";
import {
  createDecJob,
  getDecStatus,
} from "./_jobs_dec";

let currentGroup = null;

function newGroupId() {
  return Date.now().toString();
}

// Start a new roundtrip (one 128-bit block)
export function startRoundtrip(keyHex, ptHex, token = "0") {
  const groupId = newGroupId();

  const encJob = createJob(keyHex, ptHex, token);

  currentGroup = {
    groupId,
    keyHex,
    token,
    ptHexOriginal: ptHex,
    encJobId: encJob.id,
    encDone: false,
    encCtHex: null,
    encValid: null,
    encExpectedCtHex: null,
    decJobId: null,
    decDone: false,
    decPtHex: null,
    decValid: null,
    decExpectedPtHex: null,
    startedAt: Date.now(),
  };

  return { groupId, encJobId: encJob.id };
}

// Called by /api/encrypt-result after validation
export function noteEncryptResult(jobId, valid, expectedCtHex) {
  if (!currentGroup || currentGroup.encJobId !== jobId) return;

  const st = getEncStatus(jobId);
  const normCt = st && st.ctHex ? st.ctHex : null;

  currentGroup.encDone = true;
  currentGroup.encCtHex = normCt;
  currentGroup.encValid = valid;
  currentGroup.encExpectedCtHex = expectedCtHex;

  // If we have a ciphertext, start decrypt job with same key and token
  if (normCt) {
    const decJob = createDecJob(
      currentGroup.keyHex,
      normCt,
      currentGroup.token
    );
    currentGroup.decJobId = decJob.id;
  }
}

// Called by /api/decrypt-result after validation
export function noteDecryptResult(jobId, valid, expectedPtHex) {
  if (!currentGroup || currentGroup.decJobId !== jobId) return;

  const st = getDecStatus(jobId);
  const normPt = st && st.ptHex ? st.ptHex : null;

  currentGroup.decDone = true;
  currentGroup.decPtHex = normPt;
  currentGroup.decValid = valid;
  currentGroup.decExpectedPtHex = expectedPtHex;
}

// Compute roundtrip status + theoretical timing
export function getRoundtripStatus(groupId) {
  if (!currentGroup || currentGroup.groupId !== groupId) {
    return { exists: false };
  }

  let status = "waiting-enc";
  if (currentGroup.encDone && !currentGroup.decDone) status = "waiting-dec";
  else if (currentGroup.encDone && currentGroup.decDone) status = "done";

  const normOrig =
    (currentGroup.ptHexOriginal || "")
      .toUpperCase()
      .replace(/[^0-9A-F]/g, "");
  const normDec =
    (currentGroup.decPtHex || "")
      .toUpperCase()
      .replace(/[^0-9A-F]/g, "");
  const roundtripOk =
    status === "done" &&
    normOrig.length > 0 &&
    normOrig === normDec;

  // Theoretical timing: AES-128, 10 cycles per block, 48 MHz
  const AES_FCLK_MHZ = 48;
  const AES_CYCLES_PER_BLOCK = 10;
  const blocks = 1; // Step A: single block

  const AES_FCLK_HZ = AES_FCLK_MHZ * 1e6;
  const tBlock_s = AES_CYCLES_PER_BLOCK / AES_FCLK_HZ;
  const encTime_s = blocks * tBlock_s;
  const decTime_s = blocks * tBlock_s;

  return {
    exists: true,
    status,
    keyHex: currentGroup.keyHex,
    token: currentGroup.token,
    ptHexOriginal: currentGroup.ptHexOriginal,
    enc: {
      jobId: currentGroup.encJobId,
      done: currentGroup.encDone,
      ctHex: currentGroup.encCtHex,
      valid: currentGroup.encValid,
      expectedCtHex: currentGroup.encExpectedCtHex,
    },
    dec: {
      jobId: currentGroup.decJobId,
      done: currentGroup.decDone,
      ptHex: currentGroup.decPtHex,
      valid: currentGroup.decValid,
      expectedPtHex: currentGroup.decExpectedPtHex,
    },
    roundtripOk,
    timing: {
      fclkMHz: AES_FCLK_MHZ,
      cyclesPerBlock: AES_CYCLES_PER_BLOCK,
      blocks,
      encTime_s,
      decTime_s,
      totalTime_s: encTime_s + decTime_s,
    },
  };
}