// pages/api/_roundtrip.js

// Single active roundtrip group (OK for your prototype)
// {
//   groupId, token, keyHex, ptHex,
//   encCtHex, encValid, encExpectedCtHex,
//   decPtHex, decValid, decExpectedPtHex
// }
let active = null;

export function startRoundtrip(groupId, token, keyHex, ptHex) {
  active = {
    groupId,
    token: token || "0",
    keyHex: (keyHex || "").toUpperCase(),
    ptHex: (ptHex || "").toUpperCase(),
    encCtHex: null,
    encValid: null,
    encExpectedCtHex: null,
    decPtHex: null,
    decValid: null,
    decExpectedPtHex: null,
  };
}

// Called from encrypt side when ENC FPGA result is known
export function recordEncResultForRoundtrip(
  groupId,
  { token, keyHex, ptHex, ctHex, valid, expectedCtHex }
) {
  if (!active || active.groupId !== groupId) return;

  active.token = token || active.token;
  active.keyHex = (keyHex || active.keyHex || "").toUpperCase();
  active.ptHex = (ptHex || active.ptHex || "").toUpperCase();
  active.encCtHex = (ctHex || "").toUpperCase();
  active.encValid = !!valid;
  active.encExpectedCtHex = expectedCtHex || null;
}

// Called from decrypt side when DEC FPGA result is known
export function recordDecResultForRoundtrip(
  groupId,
  { ptHex, valid, expectedPtHex }
) {
  if (!active || active.groupId !== groupId) return;

  active.decPtHex = (ptHex || "").toUpperCase();
  active.decValid = !!valid;
  active.decExpectedPtHex = expectedPtHex || null;
}

export function getRoundtripStatus(groupId) {
  if (!active || active.groupId !== groupId) {
    return { exists: false };
  }

  const ptIn = active.ptHex || "";
  const ptDec = active.decPtHex || "";
  const roundtripOk =
    ptIn.length === 32 &&
    ptDec.length === 32 &&
    ptIn.toUpperCase() === ptDec.toUpperCase();

  return {
    exists: true,
    groupId: active.groupId,
    token: active.token,
    keyHex: active.keyHex,
    ptHexIn: active.ptHex,

    encCtHex: active.encCtHex,
    encValid: active.encValid,
    encExpectedCtHex: active.encExpectedCtHex,

    decPtHex: active.decPtHex,
    decValid: active.decValid,
    decExpectedPtHex: active.decExpectedPtHex,

    roundtripOk,
  };
}