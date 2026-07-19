import test from "node:test";
import assert from "node:assert/strict";
import { createRules, hitLandmark, startRainstorm, hitCoast, hitSkybridge, nudge, hitRollover, calculateBonus } from "../src/rules.js";
import { createBall, collideCircle, collideLine } from "../src/physics.js";
import { sanitizeInitials } from "../src/persistence.js";

test("Rainstorm progresses through landmarks, coasts, and super jackpot", () => {
  const rules = createRules();
  hitLandmark(rules, "klTower");
  hitLandmark(rules, "petronas");
  assert.equal(rules.mode, "qualifying");
  hitLandmark(rules, "parliament");
  assert.equal(rules.mode, "stormReady");
  assert.equal(startRainstorm(rules), true);
  assert.equal(hitCoast(rules, "east"), null);
  assert.ok(hitCoast(rules, "west").gained > 0);
  assert.ok(hitCoast(rules, "east").skybridgeReady);
  assert.ok(hitSkybridge(rules).gained >= 75000);
  assert.equal(rules.mode, "completed");
});

test("JOM completion raises and caps playfield multiplier", () => {
  const rules = createRules();
  for (let bank = 0; bank < 7; bank += 1) ["J", "O", "M"].forEach((id) => hitRollover(rules, id));
  assert.equal(rules.playfieldMultiplier, 5);
});

test("tilt requires warnings before lockout", () => {
  const rules = createRules();
  assert.equal(nudge(rules), "nudge");
  assert.equal(nudge(rules), "warning1");
  assert.equal(nudge(rules), "warning2");
  assert.equal(nudge(rules), "tilt");
  assert.equal(rules.tilted, true);
});

test("bonus reflects landmarks, jackpots, and multiplier", () => {
  const rules = createRules();
  rules.landmarksThisBall = 3;
  rules.jackpotsThisBall = 2;
  rules.modesThisBall = 1;
  rules.playfieldMultiplier = 2;
  assert.equal(calculateBonus(rules), 52000);
});

test("zero-distance collisions remain finite", () => {
  const ball = createBall({ x: 100, y: 100, vx: 0, vy: 0, active: true });
  assert.equal(collideCircle(ball, { x: 100, y: 100, r: 20 }), true);
  assert.ok(Number.isFinite(ball.x) && Number.isFinite(ball.y));
  ball.x = 100; ball.y = 100;
  assert.equal(collideLine(ball, [80, 100, 120, 100]), true);
  assert.ok(Number.isFinite(ball.x) && Number.isFinite(ball.y));
});

test("initials are normalized and bounded", () => {
  assert.equal(sanitizeInitials("a!2z9"), "A2Z");
  assert.equal(sanitizeInitials("x"), "XAA");
});
