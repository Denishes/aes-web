// pages/api/_roundtrip.js
import { createJob, getStatus as getEncStatus } from "./_jobs";
import { createDecJob, getDecStatus } from "./_jobs_dec";

// Single roundtrip group (OK for prototype)
// currentGroup:
// {
//   groupId, keyHex, ptHex, token,
//   encJobId, encDone, encCtHex, encValid, encExpectedCtHex,
//   decJobId, decDone, decPtHex, decValid, decExpectedPtHex
// }
let currentGroup = null;

function newGroupId() {
  return Date.now().toString();
}

// Called by /api/roundtrip-request
export function startRoundtrip(keyHex, ptHex, token = "0") {
  const groupId = newGroupId();

  const encJob = createJob(keyHex, ptHex, token);

  currentGroup = {
    groupId,
    keyHex,
    ptHex,
    token,
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
  };

  return { groupId, encJobId: encJob.id };
}

// Called by /api/encrypt-result after validation
export function noteEncryptResult(jobId, valid, expectedCtHex) {
  if (!currentGroup || currentGroup.encJobId !== jobId) return;

  // Get normalized ctHex from encrypt job status
  const st = getEncStatus(jobId);
  const normCt = st && st.ctHex ? st.ctHex : null;

  currentGroup.encDone = true;
  currentGroup.encCtHex = normCt;
  currentGroup.encValid = valid;
  currentGroup.encExpectedCtHex = expectedCtHex;

  // If we have a ciphertext, create a decrypt job using that ct
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

// Called by /api/roundtrip-status
export function getRoundtripStatus(groupId) {
  if (!currentGroup || currentGroup.groupId !== groupId) {
    return { exists: false };
  }

  let status = "waiting-enc";
  if (currentGroup.encDone && !currentGroup.decDone) status = "waiting-dec";
  else if (currentGroup.encDone && currentGroup.decDone) status = "done";

  // Roundtrip OK if DEC plaintext == original PT (ignoring non-hex, case)
  const normOrig =
    (currentGroup.ptHex || "").toUpperCase().replace(/[^0-9A-F]/g, "");
  const normDec =
    (currentGroup.decPtHex || "").toUpperCase().replace(/[^0-9A-F]/g, "");
  const roundtripOk =
    status === "done" && normOrig.length && normOrig === normDec;

  return {
    exists: true,
    status,
    keyHex: currentGroup.keyHex,
    ptHexOriginal: currentGroup.ptHex,
    token: currentGroup.token,
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
  };
}