// Persistence for the no-server build: everything lives in the visitor's
// own browser via localStorage. No network requests, nothing leaves the device.
import { SAMPLE_DATA } from './sample-data.js';

const KEY = (mediaId) => `medialog:data:${mediaId}`;

function makeSampleEntries(mediaId) {
  return (SAMPLE_DATA[mediaId] || []).map((e, i) => ({
    ...e,
    id: `sample-${mediaId}-${i}`,
    sample: true
  }));
}

// First-ever visit to a log boots pre-populated with sample data (equivalent
// to test mode being on by default), so there's always something to look at.
export function loadEntries(mediaId) {
  const raw = localStorage.getItem(KEY(mediaId));
  if (raw === null) {
    const seeded = makeSampleEntries(mediaId);
    localStorage.setItem(KEY(mediaId), JSON.stringify(seeded));
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveEntries(mediaId, entries) {
  localStorage.setItem(KEY(mediaId), JSON.stringify(entries));
}

// Mirrors the server's /api/testmode logic: sample entries are tagged, so
// toggling only ever touches those, leaving anything real untouched.
export function setTestMode(on, mediaIds) {
  const results = {};
  for (const id of mediaIds) {
    const current = loadEntries(id);
    const real = current.filter((e) => !e.sample);
    if (on) {
      const sampleEntries = makeSampleEntries(id);
      saveEntries(id, [...real, ...sampleEntries]);
      results[id] = sampleEntries.length;
    } else {
      results[id] = current.length - real.length;
      saveEntries(id, real);
    }
  }
  return results;
}
