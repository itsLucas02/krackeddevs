export const SCORE = {
  bumper: 650, sling: 300, rollover: 500, landmark: 4000,
  skillShot: 5000, scoop: 1000, jackpot: 15000, superJackpot: 75000,
};

export function createRules() {
  return {
    score: 0,
    balls: 3,
    playfieldMultiplier: 1,
    combo: { count: 0, factor: 1, clock: 0, lastShot: null },
    rollovers: { J: false, O: false, M: false },
    landmarks: { klTower: false, petronas: false, parliament: false },
    mode: "qualifying",
    coast: "west",
    coastJackpots: { west: false, east: false },
    modeCompletions: 0,
    modesThisBall: 0,
    landmarksThisBall: 0,
    jackpotsThisBall: 0,
    tilt: 0,
    tiltWarning: 0,
    tilted: false,
    ballSave: 0,
    ballInPlay: false,
    pendingBonus: false,
  };
}

export function resetForNewGame(rules) {
  Object.assign(rules, createRules());
}

export function tickRules(rules, dt) {
  rules.combo.clock = Math.max(0, rules.combo.clock - dt);
  if (rules.combo.clock === 0) {
    rules.combo.count = 0;
    rules.combo.factor = 1;
    rules.combo.lastShot = null;
  }
  rules.tilt = Math.max(0, rules.tilt - dt * 10);
  if (rules.tilt < 38) rules.tiltWarning = 0;
  else if (rules.tilt < 68) rules.tiltWarning = Math.min(rules.tiltWarning, 1);
  rules.ballSave = Math.max(0, rules.ballSave - dt);
}

export function addScore(rules, base, { combo = false } = {}) {
  if (rules.tilted) return 0;
  const comboFactor = combo ? rules.combo.factor : 1;
  const gained = Math.round(base * rules.playfieldMultiplier * comboFactor);
  rules.score += gained;
  return gained;
}

export function registerMajorShot(rules, shot) {
  const qualifies = shot !== rules.combo.lastShot;
  if (qualifies && rules.combo.clock > 0) rules.combo.count += 1;
  else rules.combo.count = 1;
  rules.combo.lastShot = shot;
  rules.combo.clock = 3;
  rules.combo.factor = Math.min(5, 1 + Math.floor(rules.combo.count / 2));
  return rules.combo.factor;
}

export function hitRollover(rules, id) {
  if (rules.rollovers[id]) return { gained: 0 };
  rules.rollovers[id] = true;
  const gained = addScore(rules, SCORE.rollover);
  let completed = false;
  if (Object.values(rules.rollovers).every(Boolean)) {
    completed = true;
    rules.playfieldMultiplier = Math.min(5, rules.playfieldMultiplier + 1);
    Object.keys(rules.rollovers).forEach((key) => { rules.rollovers[key] = false; });
  }
  return { gained, completed };
}

export function hitLandmark(rules, id) {
  registerMajorShot(rules, id);
  const first = !rules.landmarks[id];
  const gained = addScore(rules, SCORE.landmark, { combo: true });
  if (first) {
    rules.landmarks[id] = true;
    rules.landmarksThisBall += 1;
    if (Object.values(rules.landmarks).every(Boolean)) rules.mode = "stormReady";
  }
  return { gained, first, ready: rules.mode === "stormReady" };
}

export function startRainstorm(rules) {
  if (rules.mode !== "stormReady") return false;
  rules.mode = "multiball";
  rules.coast = "west";
  rules.coastJackpots = { west: false, east: false };
  rules.ballSave = 8;
  addScore(rules, SCORE.scoop);
  return true;
}

export function hitCoast(rules, coast) {
  if (rules.mode !== "multiball" || coast !== rules.coast || rules.coastJackpots[coast]) return null;
  registerMajorShot(rules, coast);
  rules.coastJackpots[coast] = true;
  rules.jackpotsThisBall += 1;
  const gained = addScore(rules, SCORE.jackpot * (1 + rules.modeCompletions * 0.25), { combo: true });
  if (rules.coastJackpots.west && rules.coastJackpots.east) rules.mode = "skybridgeReady";
  else rules.coast = coast === "west" ? "east" : "west";
  return { gained, skybridgeReady: rules.mode === "skybridgeReady" };
}

export function hitSkybridge(rules) {
  if (rules.mode !== "skybridgeReady") return null;
  registerMajorShot(rules, "skybridge");
  const gained = addScore(rules, SCORE.superJackpot * (1 + rules.modeCompletions * 0.5), { combo: true });
  rules.mode = "completed";
  rules.modeCompletions += 1;
  rules.modesThisBall += 1;
  return { gained };
}

export function endMultiball(rules) {
  if (!["multiball", "skybridgeReady", "completed"].includes(rules.mode)) return;
  rules.mode = "qualifying";
  rules.landmarks = { klTower: false, petronas: false, parliament: false };
  rules.coastJackpots = { west: false, east: false };
  rules.coast = "west";
}

export function nudge(rules) {
  if (rules.tilted) return "tilted";
  rules.tilt += 28;
  if (rules.tilt >= 100) {
    rules.tilted = true;
    return "tilt";
  }
  const warning = rules.tilt >= 68 ? 2 : rules.tilt >= 38 ? 1 : 0;
  if (warning > rules.tiltWarning) {
    rules.tiltWarning = warning;
    return warning === 1 ? "warning1" : "warning2";
  }
  return "nudge";
}

export function calculateBonus(rules) {
  return Math.round((rules.landmarksThisBall * 2000 + rules.jackpotsThisBall * 5000 + rules.modesThisBall * 10000) * rules.playfieldMultiplier);
}

export function nextObjective(rules) {
  if (rules.tilted) return "TILT — FLIPPERS DISABLED";
  if (rules.mode === "stormReady") return "STORM READY — SHOOT THE CENTER SCOOP";
  if (rules.mode === "multiball") return `RAINSTORM — SHOOT ${rules.coast.toUpperCase()} COAST`;
  if (rules.mode === "skybridgeReady") return "SKYBRIDGE LIT — SUPER JACKPOT";
  if (rules.mode === "completed") return "MERDEKA! KEEP BOTH BALLS ALIVE";
  const missing = Object.entries(rules.landmarks).filter(([, lit]) => !lit).map(([id]) => ({ klTower: "KL TOWER", petronas: "PETRONAS", parliament: "PARLIAMENT" })[id]);
  return `LIGHT LANDMARKS: ${missing.join(" · ")}`;
}
