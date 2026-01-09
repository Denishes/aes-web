// pages/api/_roundtrip.js
// Roundtrip orchestration: ENC → DEC for a single 128-bit block.
//
// Uses:
//   - createJob, getStatus from ./_jobs             (encrypt side)
//   - createDecJob, getDecStatus from ./_jobs_dec   (decrypt side)

import { createJob, getStatus as getEncStatus } from "./_jobs";
import { createDecJob, getDecStatus } from "./_jobs_dec";

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
    const decJob = createDecJob(currentGroup.keyHex, normCt, currentGroup.token);
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

  const normOrig = (currentGroup.ptHexOriginal || "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "");
  const normDec = (currentGroup.decPtHex || "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "");

  const roundtripOk =
    status === "done" && normOrig.length > 0 && normOrig === normDec;

  // ------------------------------------------------------------------
  // THEORETICAL TIMING (ANALYTICAL, NOT MEASURED)
  //
  // For the sequential AES-128 core:
  //   cycles_per_block = 10
  //   fclk = chosen core clock (MHz)
  //
  // T_block = cycles_per_block / fclk
  // Roundtrip total ≈ ENC + DEC (2 blocks)
  // ------------------------------------------------------------------
  const AES_FCLK_MHZ = 48;          // <<< set to your real FPGA core clock
  const AES_CYCLES_PER_BLOCK = 10;  // AES-128 sequential rounds

  const fclkHz = AES_FCLK_MHZ * 1e6;
  const tBlock_s = AES_CYCLES_PER_BLOCK / fclkHz;

  // This roundtrip implementation processes exactly 1 block
  const blocks = 1;

  const encTime_s = blocks * tBlock_s;
  const decTime_s = blocks * tBlock_s;
  const totalTime_s = encTime_s + decTime_s;

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

    // Returned so the UI can display it
    timing: {
      mode: "theoretical",
      fclkMHz: AES_FCLK_MHZ,
      cyclesPerBlock: AES_CYCLES_PER_BLOCK,
      blocks,
      encTime_s,
      decTime_s,
      totalTime_s,
      encTime_ns: encTime_s * 1e9,
      decTime_ns: decTime_s * 1e9,
      totalTime_ns: totalTime_s * 1e9,
    },
  };
}
