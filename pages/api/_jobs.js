// Simple in-memory single-job store (OK for prototype)

// { id, keyHex, ptHex, status: 'pending' | 'assigned' | 'done' }
let currentJob = null;
// { id, ctHex }
let lastResult = null;

function newJobId() {
  return Date.now().toString();
}

export function createJob(keyHex, ptHex) {
  const id = newJobId();
  currentJob = { id, keyHex, ptHex, status: "pending" };
  lastResult = null;
  return currentJob;
}

export function getJobForEsp() {
  if (!currentJob || currentJob.status !== "pending") return null;
  currentJob.status = "assigned";
  return currentJob;
}

export function completeJob(id, ctHex) {
  if (!currentJob || currentJob.id !== id) return false;
  currentJob.status = "done";
  lastResult = { id, ctHex };
  return true;
}

export function getStatus(id) {
  if (!currentJob || currentJob.id !== id) {
    return { exists: false };
  }
  return {
    exists: true,
    status: currentJob.status,
    ctHex: currentJob.status === "done" && lastResult ? lastResult.ctHex : null,
  };
}
