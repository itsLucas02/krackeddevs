import { FIXED_STEP, lanes, sensors, pointInRect, shooter } from "./table.js";
import {
  createRules, resetForNewGame, tickRules, addScore, SCORE, hitRollover,
  hitLandmark, startRainstorm, hitCoast, hitSkybridge, endMultiball,
  nudge, calculateBonus, nextObjective,
} from "./rules.js";
import { createBall, createFlipperRuntime, updateFlippers, stepBall } from "./physics.js";
import { Renderer } from "./renderer.js";
import { AudioEngine } from "./audio.js";
import { loadData, saveMuted, qualifies, submitScore } from "./persistence.js";

const $ = (id) => document.getElementById(id);
const format = (value) => Math.floor(value).toString().padStart(8, "0");

export class MerdekaGame {
  constructor() {
    const saved = loadData();
    this.ui = {
      score: $("score"), balls: $("ballCount"), high: $("highScore"), multi: $("multiplier"),
      combo: $("comboValue"), tilt: $("tiltMeter"), objective: $("objectiveText"), status: $("statusText"),
      overlay: $("gameOverlay"), title: $("overlayTitle"), copy: $("overlayCopy"), start: $("startButton"),
      callout: $("callout"), leaderboard: $("leaderboard"), initials: $("initialsForm"), initialsInput: $("initialsInput"),
      stateSummary: $("stateSummary"), sound: $("soundButton"), pause: $("pauseButton"), rescue: $("rescueButton"),
    };
    this.rules = createRules();
    this.state = "ready";
    this.balls = [createBall()];
    this.flippers = createFlipperRuntime();
    this.controls = { left: false, right: false };
    this.renderer = new Renderer($("gameCanvas"), matchMedia("(prefers-reduced-motion: reduce)").matches);
    this.audio = new AudioEngine(saved.muted);
    this.muted = saved.muted;
    this.charge = 0;
    this.charging = false;
    this.accumulator = 0;
    this.lastTime = 0;
    this.transition = null;
    this.callouts = [];
    this.calloutClock = 0;
    this.hitTimers = { bumpers: [0, 0, 0], sling: { left: 0, right: 0 } };
    this.sensorCooldowns = new Map();
    this.stuckClock = 0;
    this.searchPulses = 0;
    this.renderLeaderboard(saved.scores);
    this.bindControls();
    this.updateUI();
    this.applyMuteUI();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  startGame() {
    this.audio.ensure();
    resetForNewGame(this.rules);
    this.state = "playing";
    this.transition = null;
    this.balls = [createBall()];
    this.flippers = createFlipperRuntime();
    this.controls.left = false;
    this.controls.right = false;
    this.charge = 0;
    this.charging = false;
    this.accumulator = 0;
    this.sensorCooldowns.clear();
    this.callouts.length = 0;
    this.ui.overlay.classList.add("hidden");
    this.ui.initials.hidden = true;
    this.queueCallout("JOM! BALL 1", "critical");
    this.audio.chord([196, 262, 330], 0.25, 0.03);
    this.updateUI();
  }

  resetBall() {
    this.balls = [createBall()];
    this.rules.ballInPlay = false;
    this.rules.tilted = false;
    this.rules.tilt = 0;
    this.rules.tiltWarning = 0;
    this.rules.landmarksThisBall = 0;
    this.rules.jackpotsThisBall = 0;
    this.rules.modesThisBall = 0;
    this.charge = 0;
    this.charging = false;
    this.stuckClock = 0;
    this.searchPulses = 0;
    this.ui.rescue.classList.remove("visible");
  }

  beginCharge() {
    if (this.state !== "playing" || this.rules.ballInPlay || this.transition) return;
    this.audio.ensure();
    this.charging = true;
    this.charge = Math.max(0.04, this.charge);
  }

  launch() {
    if (!this.charging || this.state !== "playing" || this.rules.ballInPlay) return;
    const ball = this.balls[0];
    this.charging = false;
    ball.active = true;
    ball.vx = 0;
    ball.vy = -(1420 + this.charge * 560);
    this.rules.ballInPlay = true;
    this.rules.ballSave = 7;
    this.audio.cue("launch");
    this.charge = 0;
  }

  detectSensors(ball, previous, onEvent) {
    const crossing = (sensor) => pointInRect(ball.x, ball.y, sensor) ||
      (previous.y > sensor.y + sensor.h && ball.y <= sensor.y + sensor.h && ball.x >= sensor.x && ball.x <= sensor.x + sensor.w);
    const check = (id, sensor, event, data = {}) => {
      const inside = sensor.r ? Math.hypot(ball.x - sensor.x, ball.y - sensor.y) < sensor.r + ball.r : crossing(sensor);
      const key = `${ball.id}:${id}`;
      if (inside && !ball.sensors.has(id) && !this.sensorCooldowns.has(key)) {
        ball.sensors.add(id);
        this.sensorCooldowns.set(key, 0.32);
        onEvent(event, { ...data, ball });
      } else if (!inside) ball.sensors.delete(id);
    };
    lanes.forEach((lane) => check(`lane-${lane.id}`, { x: lane.x - 31, y: 95, w: 62, h: 85 }, "rollover", { id: lane.id }));
    check("klTower", sensors.klTower, "landmark", { id: "klTower" });
    check("petronas", sensors.petronas, "landmark", { id: "petronas" });
    check("parliament", sensors.parliament, "landmark", { id: "parliament" });
    check("scoop", sensors.scoop, "scoop");
    check("west", sensors.west, "coast", { coast: "west" });
    check("east", sensors.east, "coast", { coast: "east" });
    check("skybridge", sensors.skybridge, "skybridge");
  }

  handleEvent(type, data) {
    if (type === "flipper") {
      this.audio.cue("flip");
      return;
    }
    if (type === "bumper") {
      if (this.hitTimers.bumpers[data.bumperIndex] > 0) return;
      this.hitTimers.bumpers[data.bumperIndex] = 0.16;
      addScore(this.rules, SCORE.bumper);
      this.audio.cue("bumper");
      this.renderer.shake = 3;
      return;
    }
    if (type === "sling") {
      if (this.hitTimers.sling[data.side] > 0) return;
      this.hitTimers.sling[data.side] = 0.16;
      addScore(this.rules, SCORE.sling);
      this.audio.tone(180, 0.06, "square", 0.03, 1.3);
      return;
    }
    if (type === "skillShot") {
      const gained = addScore(this.rules, SCORE.skillShot);
      this.queueCallout(`TEPAT! SKILL SHOT +${gained.toLocaleString()}`);
      return;
    }
    if (type === "rollover") {
      const result = hitRollover(this.rules, data.id);
      if (!result.gained) return;
      this.audio.cue("rollover");
      this.queueCallout(result.completed ? `${this.rules.playfieldMultiplier}X PLAYFIELD` : `${data.id} LIT`);
      return;
    }
    if (type === "landmark") {
      const result = hitLandmark(this.rules, data.id);
      const labels = { klTower: "KL TOWER", petronas: "PETRONAS TOWERS", parliament: "PARLIAMENT" };
      this.audio.cue("landmark");
      this.queueCallout(result.ready ? "THREE LOCKS! STORM READY" : `${labels[data.id]} +${result.gained.toLocaleString()}`, result.ready ? "critical" : "normal");
      return;
    }
    if (type === "scoop") {
      if (startRainstorm(this.rules)) this.beginMultiball(data.ball);
      else {
        addScore(this.rules, SCORE.scoop);
        data.ball.vx += data.ball.x < 360 ? -260 : 260;
        data.ball.vy = -Math.max(420, Math.abs(data.ball.vy));
      }
      return;
    }
    if (type === "coast") {
      const result = hitCoast(this.rules, data.coast);
      if (!result) return;
      this.audio.cue("jackpot");
      this.renderer.shake = 7;
      this.queueCallout(result.skybridgeReady ? "BOTH COASTS! SKYBRIDGE LIT" : `${data.coast.toUpperCase()} COAST JACKPOT +${result.gained.toLocaleString()}`, "critical");
      return;
    }
    if (type === "skybridge") {
      const result = hitSkybridge(this.rules);
      if (!result) return;
      this.audio.cue("super");
      this.renderer.celebrate();
      this.queueCallout(`MERDEKA SUPER JACKPOT +${result.gained.toLocaleString()}`, "critical");
    }
  }

  beginMultiball(capturedBall) {
    capturedBall.x = 360;
    capturedBall.y = 620;
    capturedBall.vx = -320;
    capturedBall.vy = -680;
    const second = createBall({ x: shooter.x, y: shooter.y - 30, vx: 0, vy: -1580, active: true });
    second.gated = false;
    this.balls.push(second);
    this.audio.chord([110, 165, 220, 330], 0.55, 0.04);
    this.renderer.shake = 9;
    this.queueCallout("RAINSTORM MULTIBALL!", "critical");
  }

  processDrains() {
    const drained = this.balls.filter((ball) => ball.drain);
    if (!drained.length) return;
    this.balls = this.balls.filter((ball) => !ball.drain);
    if (this.rules.ballSave > 0 && !this.rules.tilted) {
      drained.forEach(() => {
        this.balls.push(createBall({ x: shooter.x, y: shooter.y - 20, vy: -1520, active: true }));
      });
      this.queueCallout("BALL SAVED", "critical");
      this.audio.cue("launch");
      return;
    }
    if (this.balls.length > 0) {
      if (["multiball", "skybridgeReady", "completed"].includes(this.rules.mode)) {
        endMultiball(this.rules);
        this.queueCallout("RAINSTORM ENDS");
      }
      return;
    }
    this.rules.ballInPlay = false;
    this.audio.cue("drain");
    this.beginEndOfBall();
  }

  beginEndOfBall() {
    if (this.transition) return;
    const bonus = this.rules.tilted ? 0 : calculateBonus(this.rules);
    this.transition = { type: "bonus", clock: bonus ? 1.55 : 0.55, bonus, awarded: false };
    this.queueCallout(this.rules.tilted ? "TILT — NO BONUS" : `END OF BALL BONUS +${bonus.toLocaleString()}`, "critical");
  }

  finishEndOfBall() {
    if (!this.transition?.awarded) {
      this.rules.score += this.transition?.bonus || 0;
      if (this.transition) this.transition.awarded = true;
    }
    this.rules.balls -= 1;
    this.transition = null;
    if (this.rules.balls <= 0) this.gameOver();
    else {
      this.resetBall();
      this.queueCallout(`BALL ${4 - this.rules.balls} — JOM!`, "critical");
    }
  }

  gameOver() {
    this.state = "gameover";
    this.releaseControls();
    this.ui.title.innerHTML = "MALAM<br><em>SELESAI</em>";
    this.ui.copy.textContent = `FINAL SCORE ${format(this.rules.score)}`;
    this.ui.start.querySelector("span").textContent = "PLAY AGAIN";
    this.ui.overlay.classList.remove("hidden");
    const data = loadData();
    this.renderLeaderboard(data.scores);
    if (qualifies(this.rules.score, data.scores)) {
      this.ui.initials.hidden = false;
      this.ui.initialsInput.value = "";
      this.ui.initialsInput.focus();
    }
  }

  rescueBall() {
    if (this.state !== "playing" || !this.rules.ballInPlay || this.balls.length !== 1) return;
    const ball = this.balls[0];
    ball.x = 360;
    ball.y = 660;
    ball.vx = 180;
    ball.vy = -620;
    this.stuckClock = 0;
    this.searchPulses = 0;
    this.ui.rescue.classList.remove("visible");
    this.queueCallout("BALL RESCUED");
  }

  ballSearch(dt) {
    if (this.balls.length !== 1 || !this.balls[0].active || this.transition) {
      this.stuckClock = 0;
      return;
    }
    const ball = this.balls[0];
    if (Math.hypot(ball.vx, ball.vy) < 55) this.stuckClock += dt;
    else this.stuckClock = 0;
    if (this.stuckClock >= 4) this.ui.rescue.classList.add("visible");
    if (this.stuckClock >= 5 && this.searchPulses === 0) {
      this.searchPulses = 1;
      ball.vx += 170;
      ball.vy -= 150;
      this.queueCallout("BALL SEARCH 1/2");
    }
    if (this.stuckClock >= 6.2 && this.searchPulses === 1) {
      this.searchPulses = 2;
      ball.vx -= 340;
      ball.vy -= 230;
      this.queueCallout("BALL SEARCH 2/2");
    }
    if (this.stuckClock >= 7.4) this.rescueBall();
  }

  step(dt) {
    tickRules(this.rules, dt);
    updateFlippers(this, dt);
    if (this.charging) {
      this.charge = Math.min(1, this.charge + dt * 0.7);
      const ball = this.balls[0];
      ball.y = shooter.y + this.charge * 40;
    }
    this.sensorCooldowns.forEach((clock, key) => {
      const next = clock - dt;
      if (next <= 0) this.sensorCooldowns.delete(key);
      else this.sensorCooldowns.set(key, next);
    });
    this.hitTimers.bumpers = this.hitTimers.bumpers.map((clock) => Math.max(0, clock - dt));
    this.hitTimers.sling.left = Math.max(0, this.hitTimers.sling.left - dt);
    this.hitTimers.sling.right = Math.max(0, this.hitTimers.sling.right - dt);
    this.balls.forEach((ball) => stepBall(ball, {
      flippers: this.flippers,
      controls: this.controls,
      tilted: this.rules.tilted,
      detectSensors: this.detectSensors.bind(this),
    }, dt, this.handleEvent.bind(this)));
    this.processDrains();
    this.ballSearch(dt);
    if (this.transition) {
      this.transition.clock -= dt;
      if (this.transition.clock <= 0) this.finishEndOfBall();
    }
    this.updateCallouts(dt);
    this.updateUI();
  }

  queueCallout(text, priority = "normal") {
    const item = { text, priority };
    if (priority === "critical") this.callouts.unshift(item);
    else this.callouts.push(item);
    if (this.calloutClock <= 0) this.showNextCallout();
  }

  showNextCallout() {
    const item = this.callouts.shift();
    if (!item) return;
    this.ui.callout.textContent = item.text;
    this.ui.callout.classList.remove("pop");
    void this.ui.callout.offsetWidth;
    this.ui.callout.classList.add("pop");
    this.calloutClock = item.priority === "critical" ? 1.3 : 0.9;
  }

  updateCallouts(dt) {
    this.calloutClock = Math.max(0, this.calloutClock - dt);
    if (this.calloutClock === 0) this.showNextCallout();
  }

  nudge(direction) {
    if (this.state !== "playing" || !this.rules.ballInPlay) return;
    const result = nudge(this.rules);
    this.balls.forEach((ball) => { ball.vx += direction * 95; });
    if (result === "warning1") this.queueCallout("STEADY LAH!", "critical");
    if (result === "warning2") this.queueCallout("EH, JANGAN!", "critical");
    if (result === "tilt") {
      this.releaseControls();
      this.audio.cue("tilt");
      this.queueCallout("TILT", "critical");
    }
  }

  setFlipper(side, active) {
    if (this.rules.tilted) active = false;
    this.controls[side] = active;
    $(side === "left" ? "leftTouch" : "rightTouch").classList.toggle("active", active);
  }

  releaseControls() {
    this.setFlipper("left", false);
    this.setFlipper("right", false);
    this.charging = false;
  }

  togglePause() {
    if (this.state === "playing") {
      this.state = "paused";
      this.releaseControls();
      this.ui.title.innerHTML = "MALAM<br><em>PAUSED</em>";
      this.ui.copy.textContent = "The city is holding its breath.";
      this.ui.start.querySelector("span").textContent = "RESUME";
      this.ui.overlay.classList.remove("hidden");
    } else if (this.state === "paused") {
      this.state = "playing";
      this.ui.overlay.classList.add("hidden");
    }
    this.ui.pause.setAttribute("aria-pressed", String(this.state === "paused"));
    this.updateUI();
  }

  toggleFullscreen() {
    const shell = $("arcadeShell");
    const action = document.fullscreenElement ? document.exitFullscreen() : shell.requestFullscreen?.();
    Promise.resolve(action).catch(() => this.queueCallout("FULLSCREEN UNAVAILABLE"));
  }

  applyMuteUI() {
    this.ui.sound.classList.toggle("muted", this.muted);
    this.ui.sound.setAttribute("aria-pressed", String(this.muted));
    this.ui.sound.setAttribute("aria-label", this.muted ? "Enable sound" : "Mute sound");
  }

  renderLeaderboard(scores) {
    const rows = scores.length ? scores : [{ initials: "---", score: 0 }];
    this.ui.leaderboard.innerHTML = rows.map((entry, index) => `<li><span>${index + 1}. ${entry.initials}</span><strong>${format(entry.score)}</strong></li>`).join("");
    this.ui.high.textContent = format(scores[0]?.score || 0);
  }

  updateUI() {
    const high = loadData().scores[0]?.score || 0;
    this.ui.score.textContent = format(this.rules.score);
    this.ui.balls.textContent = this.rules.balls;
    this.ui.high.textContent = format(Math.max(high, this.rules.score));
    this.ui.multi.textContent = `${this.rules.playfieldMultiplier}X`;
    this.ui.combo.textContent = `${this.rules.combo.factor}X`;
    this.ui.tilt.style.setProperty("--tilt", `${Math.min(100, this.rules.tilt)}%`);
    this.ui.objective.textContent = nextObjective(this.rules);
    if (this.state === "ready") this.ui.status.textContent = "PRESS START";
    else if (this.state === "paused") this.ui.status.textContent = "PAUSED";
    else if (this.transition) this.ui.status.textContent = "COUNTING BONUS";
    else if (!this.rules.ballInPlay) this.ui.status.textContent = this.charging ? `PLUNGER ${Math.round(this.charge * 100)}%` : "HOLD SPACE TO CHARGE";
    else if (this.rules.ballSave > 0) this.ui.status.textContent = `BALL SAVE ${this.rules.ballSave.toFixed(1)}S`;
    else this.ui.status.textContent = `${this.balls.length} BALL${this.balls.length === 1 ? "" : "S"} IN PLAY`;
    this.ui.stateSummary.textContent = `Score ${this.rules.score}. Ball ${Math.max(1, 4 - this.rules.balls)} of 3. ${nextObjective(this.rules)}.`;
  }

  bindHold(id, side) {
    const element = $(id);
    element.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      element.setPointerCapture?.(event.pointerId);
      this.setFlipper(side, true);
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((name) => element.addEventListener(name, () => this.setFlipper(side, false)));
  }

  bindControls() {
    addEventListener("keydown", (event) => {
      if (["Space", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
      if (event.repeat) return;
      if (event.code === "KeyZ") this.setFlipper("left", true);
      if (event.code === "Slash") this.setFlipper("right", true);
      if (event.code === "ArrowLeft") this.nudge(-1);
      if (event.code === "ArrowRight") this.nudge(1);
      if (event.code === "Space") {
        if (["ready", "gameover"].includes(this.state)) this.startGame();
        else if (this.state === "paused") this.togglePause();
        else this.beginCharge();
      }
      if (event.code === "KeyP") this.togglePause();
    });
    addEventListener("keyup", (event) => {
      if (event.code === "KeyZ") this.setFlipper("left", false);
      if (event.code === "Slash") this.setFlipper("right", false);
      if (event.code === "Space") this.launch();
    });
    addEventListener("blur", () => this.releaseControls());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "playing") this.togglePause();
    });
    this.bindHold("leftTouch", "left");
    this.bindHold("rightTouch", "right");
    const launch = $("launchTouch");
    launch.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      launch.setPointerCapture?.(event.pointerId);
      if (["ready", "gameover"].includes(this.state)) this.startGame();
      else this.beginCharge();
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((name) => launch.addEventListener(name, () => this.launch()));
    this.ui.start.addEventListener("click", () => this.state === "paused" ? this.togglePause() : this.startGame());
    this.ui.pause.addEventListener("click", () => this.togglePause());
    $("restartButton").addEventListener("click", () => this.startGame());
    this.ui.rescue.addEventListener("click", () => this.rescueBall());
    $("fullscreenButton").addEventListener("click", () => this.toggleFullscreen());
    this.ui.sound.addEventListener("click", () => {
      this.muted = !this.muted;
      this.audio.setMuted(this.muted);
      saveMuted(this.muted);
      this.applyMuteUI();
    });
    this.ui.initials.addEventListener("submit", (event) => {
      event.preventDefault();
      const scores = submitScore(this.ui.initialsInput.value, this.rules.score);
      this.renderLeaderboard(scores);
      this.ui.initials.hidden = true;
    });
  }

  frame(time) {
    const dt = Math.min(0.035, (time - this.lastTime) / 1000 || 0);
    this.lastTime = time;
    if (this.state === "playing") {
      this.accumulator += dt;
      while (this.accumulator >= FIXED_STEP) {
        this.step(FIXED_STEP);
        this.accumulator -= FIXED_STEP;
      }
    } else this.updateCallouts(dt);
    this.renderer.draw(this, dt);
    requestAnimationFrame(this.frame);
  }
}

const game = new MerdekaGame();

const testMode = new URLSearchParams(location.search).has("test") && ["localhost", "127.0.0.1"].includes(location.hostname);
if (testMode) {
  window.__MERDEKA_TEST__ = {
    game,
    snapshot: () => JSON.parse(JSON.stringify({ state: game.state, rules: game.rules, balls: game.balls.map(({ sensors: ignored, trail: ignoredTrail, ...ball }) => ball) })),
    emit: (type, data = {}) => game.handleEvent(type, data),
    advanceTicks: (count) => { for (let index = 0; index < count; index += 1) game.step(FIXED_STEP); },
    scenario: (name) => {
      game.startGame();
      if (name === "rainstorm-ready") {
        ["klTower", "petronas", "parliament"].forEach((id) => game.handleEvent("landmark", { id, ball: game.balls[0] }));
      }
      if (name === "multiball") {
        ["klTower", "petronas", "parliament"].forEach((id) => game.handleEvent("landmark", { id, ball: game.balls[0] }));
        game.handleEvent("scoop", { ball: game.balls[0] });
      }
    },
  };
}
