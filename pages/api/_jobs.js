// Simple in-memory single-job store (OK for prototype)
let currentJob = null;   // { id, keyHex, ptHex, status: 'pending'|'assigned'|'done' }
let lastResult = null;   // { id, ctHex }

function newJobId() {
  return Date.now().toString();
}

function createJob(keyHex, ptHex) {
  const id = newJobId();
  currentJob = { id, keyHex, ptHex, status: 'pending' };
  lastResult = null;
  return currentJob;
}

function getJobForEsp() {
  if (!currentJob || currentJob.status !== 'pending') return null;
  currentJob.status = 'assigned';
  return currentJob;
}

function completeJob(id, ctHex) {
  if (!currentJob || currentJob.id !== id) return false;
  currentJob.status = 'done';
  lastResult = { id, ctHex };
  return true;
}

function getStatus(id) {
  if (!currentJob || currentJob.id !== id) {
    // job not found (expired or never existed)
    return { exists: false };
  }
  return {
    exists: true,
    status: currentJob.status,
    ctHex: currentJob.status === 'done' && lastResult ? lastResult.ctHex : null,
  };
}

module.exports = {
  createJob,
  getJobForEsp,
  completeJob,
  getStatus,
};