import { WIDTH, HEIGHT, COLORS, walls, posts, bumpers, lanes, landmarks, slings, sensors } from "./table.js";

function line(ctx, x1, y1, x2, y2, width = 8, color = COLORS.chrome) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function lamp(ctx, x, y, label, lit, color = COLORS.yellow, width = 64) {
  ctx.save();
  ctx.translate(x, y);
  if (lit) { ctx.shadowColor = color; ctx.shadowBlur = 18; }
  ctx.fillStyle = lit ? color : "#233257";
  ctx.strokeStyle = lit ? "#fff8cf" : "#4a5d83";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-width / 2, -15, width, 30, 14);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = lit ? COLORS.midnight : "#91a0bf";
  ctx.font = "800 12px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 0, 1);
  ctx.restore();
}

function drawSongket(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.11;
  ctx.strokeStyle = COLORS.yellow;
  ctx.lineWidth = 1;
  for (let y = 90; y < HEIGHT; y += 52) {
    for (let x = 15; x < WIDTH; x += 52) {
      ctx.beginPath();
      ctx.moveTo(x, y - 15); ctx.lineTo(x + 15, y); ctx.lineTo(x, y + 15); ctx.lineTo(x - 15, y); ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawSkyline(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = COLORS.blue;
  const buildings = [[80, 210, 35, 150], [125, 260, 54, 100], [192, 235, 38, 125], [278, 185, 34, 175], [318, 120, 28, 240], [374, 120, 28, 240], [414, 185, 34, 175], [490, 245, 55, 115], [556, 210, 38, 150]];
  buildings.forEach(([x, y, w, h]) => ctx.fillRect(x, y, w, h));
  line(ctx, 332, 120, 332, 78, 3, COLORS.cyan);
  line(ctx, 388, 120, 388, 78, 3, COLORS.cyan);
  line(ctx, 345, 238, 374, 238, 8, COLORS.yellow);
  ctx.restore();
}

export class Renderer {
  constructor(canvas, reducedMotion = false) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.reducedMotion = reducedMotion;
    this.shake = 0;
    this.flash = 0;
    this.fireworks = [];
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  celebrate() {
    if (!this.reducedMotion) {
      for (let index = 0; index < 55; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 220;
        this.fireworks.push({ x: WIDTH / 2, y: 270, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color: [COLORS.red, COLORS.yellow, COLORS.cyan, "#fff"][index % 4] });
      }
      this.shake = 12;
      this.flash = 1;
    }
  }

  draw(app, dt) {
    this.resize();
    const ctx = this.ctx;
    const sx = this.canvas.width / WIDTH;
    const sy = this.canvas.height / HEIGHT;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.save();
    const shake = this.reducedMotion ? 0 : this.shake;
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, "#08143c");
    gradient.addColorStop(0.55, COLORS.field);
    gradient.addColorStop(1, "#070a18");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    drawSongket(ctx);
    drawSkyline(ctx);

    if (["multiball", "skybridgeReady"].includes(app.rules.mode)) {
      ctx.fillStyle = "rgba(2, 6, 20, .38)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      if (!this.reducedMotion) {
        ctx.strokeStyle = "rgba(93, 228, 255, .28)";
        ctx.lineWidth = 2;
        for (let x = -200; x < WIDTH; x += 32) line(ctx, x + (performance.now() * 0.35) % 32, 0, x - 260 + (performance.now() * 0.35) % 32, HEIGHT, 2, "rgba(93,228,255,.25)");
      }
    }

    ctx.fillStyle = "rgba(8, 17, 48, .82)";
    ctx.beginPath();
    ctx.moveTo(70, 120); ctx.lineTo(138, 68); ctx.lineTo(578, 68); ctx.lineTo(624, 125); ctx.lineTo(624, 790); ctx.lineTo(535, 920); ctx.lineTo(500, 950); ctx.lineTo(220, 950); ctx.lineTo(185, 920); ctx.lineTo(70, 780); ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#101b3d";
    ctx.fillRect(634, 116, 68, 870);
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(634, 225, 4, 715);

    landmarks.forEach((landmark) => {
      const lit = app.rules.landmarks[landmark.id];
      ctx.save();
      if (lit) { ctx.shadowColor = landmark.color; ctx.shadowBlur = 24; }
      ctx.strokeStyle = lit ? landmark.color : "#35517c";
      ctx.lineWidth = 5;
      ctx.strokeRect(landmark.x, landmark.y, landmark.w, landmark.h);
      ctx.fillStyle = lit ? landmark.color : "#617293";
      ctx.font = "800 12px 'Barlow Condensed', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(landmark.label, landmark.x + landmark.w / 2, landmark.y - 10);
      ctx.restore();
    });

    lanes.forEach((lane) => lamp(ctx, lane.x, 115, lane.id, app.rules.rollovers[lane.id], COLORS.yellow, 46));
    lamp(ctx, 360, 580, app.rules.mode === "stormReady" ? "STORM" : "LOCK", app.rules.mode === "stormReady", COLORS.cyan, 86);
    lamp(ctx, 112, 565, "WEST", app.rules.mode === "multiball" && app.rules.coast === "west", COLORS.cyan, 74);
    lamp(ctx, 608, 565, "EAST", app.rules.mode === "multiball" && app.rules.coast === "east", COLORS.red, 74);
    lamp(ctx, 360, 286, "SKYBRIDGE", app.rules.mode === "skybridgeReady", COLORS.yellow, 112);

    walls.forEach((wall) => { line(ctx, ...wall, 10, "#607897"); line(ctx, ...wall, 3, "#dbeaff"); });
    slings.forEach((sling) => {
      ctx.fillStyle = sling.side === "left" ? "rgba(239,51,64,.3)" : "rgba(20,85,217,.35)";
      ctx.strokeStyle = sling.side === "left" ? COLORS.red : COLORS.cyan;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(...sling.points[0]); ctx.lineTo(...sling.points[1]); ctx.lineTo(...sling.points[2]); ctx.closePath(); ctx.fill(); ctx.stroke();
    });
    bumpers.forEach((bumper, index) => {
      const hot = app.hitTimers.bumpers[index] > 0;
      ctx.save(); ctx.translate(bumper.x, bumper.y); ctx.scale(hot ? 1.1 : 1, hot ? 1.1 : 1);
      if (hot) { ctx.shadowColor = bumper.color; ctx.shadowBlur = 25; }
      ctx.fillStyle = "#080d22"; ctx.strokeStyle = bumper.color; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.arc(0, 0, bumper.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = bumper.color; ctx.font = "900 15px 'Barlow Condensed', sans-serif"; ctx.textAlign = "center"; ctx.fillText(bumper.label, 0, 5); ctx.restore();
    });
    posts.forEach((post) => { ctx.fillStyle = COLORS.ink; ctx.beginPath(); ctx.arc(post.x, post.y, post.r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = COLORS.blue; ctx.beginPath(); ctx.arc(post.x, post.y, post.r - 6, 0, Math.PI * 2); ctx.fill(); });

    app.flippers.forEach((flipper) => {
      const ex = flipper.x + Math.cos(flipper.angle) * flipper.len;
      const ey = flipper.y + Math.sin(flipper.angle) * flipper.len;
      line(ctx, flipper.x, flipper.y, ex, ey, 29, COLORS.ink);
      line(ctx, flipper.x, flipper.y, ex, ey, 8, flipper.side === "left" ? COLORS.red : COLORS.blue);
    });

    app.balls.forEach((ball) => {
      if (!ball.active && app.balls.length > 1) return;
      if (!this.reducedMotion) ball.trail.forEach((point, index) => { ctx.globalAlpha = (1 - index / ball.trail.length) * 0.2; ctx.fillStyle = COLORS.cyan; ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(2, ball.r - index), 0, Math.PI * 2); ctx.fill(); });
      ctx.globalAlpha = 1;
      const radial = ctx.createRadialGradient(ball.x - 4, ball.y - 5, 2, ball.x, ball.y, ball.r);
      radial.addColorStop(0, "#fff"); radial.addColorStop(0.42, "#d8e7f4"); radial.addColorStop(1, "#50657f");
      ctx.fillStyle = radial; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
    });

    const plungerY = 970 + app.charge * 42;
    line(ctx, 648, plungerY, 688, plungerY, 4, COLORS.yellow);
    line(ctx, 668, plungerY + 4, 668, 1045, 5, COLORS.chrome);
    if (app.charging) { ctx.fillStyle = COLORS.yellow; ctx.fillRect(646, 1040, 44 * app.charge, 5); }

    this.fireworks.forEach((particle) => {
      particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 180 * dt; particle.life -= dt * 0.8;
      ctx.globalAlpha = Math.max(0, particle.life); ctx.fillStyle = particle.color; ctx.fillRect(particle.x, particle.y, 5, 5);
    });
    ctx.globalAlpha = 1;
    this.fireworks = this.fireworks.filter((particle) => particle.life > 0);
    ctx.restore();
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.45})`; ctx.fillRect(0, 0, WIDTH, HEIGHT); }
    this.shake *= 0.88;
    this.flash *= 0.88;

    if (new URLSearchParams(location.search).has("debug")) {
      ctx.save(); ctx.setTransform(sx, 0, 0, sy, 0, 0); ctx.strokeStyle = "#00ff9d"; ctx.lineWidth = 2;
      Object.values(sensors).forEach((sensor) => { if (sensor.r) { ctx.beginPath(); ctx.arc(sensor.x, sensor.y, sensor.r, 0, Math.PI * 2); ctx.stroke(); } else ctx.strokeRect(sensor.x, sensor.y, sensor.w, sensor.h); }); ctx.restore();
    }
  }
}
