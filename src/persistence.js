const KEY = "malamMania.v1";
const EMPTY = { scores: [], muted: false };

function storage() {
  try {
    const test = "__malam_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return localStorage;
  } catch {
    return null;
  }
}

export function loadData() {
  try {
    const raw = storage()?.getItem(KEY);
    const data = raw ? JSON.parse(raw) : EMPTY;
    return {
      scores: Array.isArray(data.scores) ? data.scores.filter((item) => Number.isFinite(item.score)).slice(0, 5).map((item) => ({
        initials: sanitizeInitials(item.initials),
        score: Math.max(0, Math.floor(item.score)),
        achievedAt: Number.isFinite(item.achievedAt) ? item.achievedAt : 0,
      })) : [],
      muted: Boolean(data.muted),
    };
  } catch {
    return { ...EMPTY, scores: [] };
  }
}

export function saveMuted(muted) {
  const data = loadData();
  data.muted = Boolean(muted);
  try { storage()?.setItem(KEY, JSON.stringify(data)); } catch { /* Persistence is optional. */ }
}

export function qualifies(score, scores = loadData().scores) {
  return score > 0 && (scores.length < 5 || score > scores[scores.length - 1].score);
}

export function sanitizeInitials(value) {
  return String(value || "AAA").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3).padEnd(3, "A");
}

export function submitScore(initials, score) {
  const data = loadData();
  data.scores.push({ initials: sanitizeInitials(initials), score: Math.floor(score), achievedAt: Date.now() });
  data.scores.sort((a, b) => b.score - a.score || a.achievedAt - b.achievedAt);
  data.scores = data.scores.slice(0, 5);
  try { storage()?.setItem(KEY, JSON.stringify(data)); } catch { /* Persistence is optional. */ }
  return data.scores;
}
