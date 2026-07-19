import { HEIGHT, WIDTH, walls, posts, bumpers, flippers, slings, shooter } from "./table.js";

let nextBallId = 1;

export function createBall({ x = shooter.x, y = shooter.y, vx = 0, vy = 0, active = false } = {}) {
  return { id: nextBallId++, x, y, vx, vy, r: 12, active, gated: false, trail: [], sensors: new Set(), drain: false };
}

export function closestPoint(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / length));
  return { x: x1 + t * dx, y: y1 + t * dy, t };
}

export function collideLine(ball, line, bounce = 0.78, kick = 0) {
  const point = closestPoint(ball.x, ball.y, ...line);
  let dx = ball.x - point.x;
  let dy = ball.y - point.y;
  let distance = Math.hypot(dx, dy);
  const minimum = ball.r + 5;
  if (distance >= minimum) return false;
  if (distance < 0.001) {
    dx = -(line[3] - line[1]);
    dy = line[2] - line[0];
    distance = Math.hypot(dx, dy) || 1;
  }
  const nx = dx / distance;
  const ny = dy / distance;
  ball.x += nx * (minimum - distance);
  ball.y += ny * (minimum - distance);
  const dot = ball.vx * nx + ball.vy * ny;
  if (dot < 0) {
    ball.vx -= (1 + bounce) * dot * nx;
    ball.vy -= (1 + bounce) * dot * ny;
    ball.vx += nx * kick;
    ball.vy += ny * kick;
  }
  return true;
}

export function collideCircle(ball, circle, bounce = 1, kick = 0) {
  let dx = ball.x - circle.x;
  let dy = ball.y - circle.y;
  let distance = Math.hypot(dx, dy);
  const minimum = ball.r + circle.r;
  if (distance >= minimum) return false;
  if (distance < 0.001) {
    dx = ball.vx || 1;
    dy = ball.vy || -1;
    distance = Math.hypot(dx, dy);
  }
  const nx = dx / distance;
  const ny = dy / distance;
  ball.x = circle.x + nx * minimum;
  ball.y = circle.y + ny * minimum;
  const dot = ball.vx * nx + ball.vy * ny;
  if (dot < 0) {
    ball.vx -= (1 + bounce) * dot * nx;
    ball.vy -= (1 + bounce) * dot * ny;
  }
  ball.vx += nx * kick;
  ball.vy += ny * kick;
  return true;
}

function pointInTriangle(px, py, points) {
  const [a, b, c] = points;
  const area = (p1, p2, p3) => (p1[0] * (p2[1] - p3[1]) + p2[0] * (p3[1] - p1[1]) + p3[0] * (p1[1] - p2[1]));
  const total = area(a, b, c);
  const s = area([px, py], b, c) / total;
  const t = area(a, [px, py], c) / total;
  const u = area(a, b, [px, py]) / total;
  return s >= 0 && t >= 0 && u >= 0;
}

export function updateFlippers(runtime, dt) {
  runtime.flippers.forEach((flipper) => {
    const source = flippers.find((item) => item.side === flipper.side);
    const target = runtime.controls[flipper.side] && !runtime.tilted ? source.active : source.rest;
    const before = flipper.angle;
    flipper.angle += (target - flipper.angle) * Math.min(1, dt * 34);
    flipper.speed = (flipper.angle - before) / dt;
  });
}

export function stepBall(ball, runtime, dt, onEvent) {
  if (!ball.active) return;
  const speed = Math.hypot(ball.vx, ball.vy);
  const substeps = Math.min(4, Math.max(1, Math.ceil(speed * dt / 11)));
  const step = dt / substeps;
  for (let index = 0; index < substeps; index += 1) {
    const previous = { x: ball.x, y: ball.y };
    ball.vy += 810 * step;
    ball.vx *= 0.9994;
    ball.vy *= 0.9994;
    ball.x += ball.vx * step;
    ball.y += ball.vy * step;

    walls.forEach((wall) => collideLine(ball, wall));
    posts.forEach((post) => collideCircle(ball, post, 0.84, 20));
    bumpers.forEach((bumper, bumperIndex) => {
      if (collideCircle(ball, bumper, 1.08, 250)) onEvent("bumper", { bumperIndex, ball });
    });
    slings.forEach((sling) => {
      if (pointInTriangle(ball.x, ball.y, sling.points)) {
        ball.vx += sling.side === "left" ? 170 : -170;
        ball.vy -= 260;
        onEvent("sling", { side: sling.side, ball });
      }
    });
    runtime.flippers.forEach((flipper) => {
      const endpoint = [flipper.x + Math.cos(flipper.angle) * flipper.len, flipper.y + Math.sin(flipper.angle) * flipper.len];
      if (collideLine(ball, [flipper.x, flipper.y, ...endpoint], 0.78)) {
        const contact = closestPoint(ball.x, ball.y, flipper.x, flipper.y, ...endpoint);
        const rx = contact.x - flipper.x;
        const ry = contact.y - flipper.y;
        ball.vx += -ry * flipper.speed * 0.88;
        ball.vy += rx * flipper.speed * 0.88;
        onEvent("flipper", { ball });
      }
    });

    if (ball.y < 210 && ball.x > 632 && !ball.gated) {
      ball.vx -= 1900 * step;
      ball.vy += 190 * step;
    }
    if (ball.y < 250 && ball.x < 628 && !ball.gated) {
      ball.gated = true;
      onEvent("skillShot", { ball });
    }
    if (ball.y > 230 && ball.x > 634 && ball.x < 700) {
      if (ball.x + ball.r > 700) { ball.x = 700 - ball.r; ball.vx = -Math.abs(ball.vx) * 0.7; }
      if (ball.x - ball.r < 634) { ball.x = 634 + ball.r; ball.vx = Math.abs(ball.vx) * 0.7; }
    }

    runtime.detectSensors(ball, previous, onEvent);
    const maxSpeed = 2200;
    const currentSpeed = Math.hypot(ball.vx, ball.vy);
    if (currentSpeed > maxSpeed) {
      ball.vx *= maxSpeed / currentSpeed;
      ball.vy *= maxSpeed / currentSpeed;
    }
    if (ball.y > HEIGHT + 25 || ball.x < -45 || ball.x > WIDTH + 45) {
      ball.drain = true;
      return;
    }
  }
  ball.trail.unshift({ x: ball.x, y: ball.y });
  if (ball.trail.length > 10) ball.trail.pop();
}

export function createFlipperRuntime() {
  return flippers.map((flipper) => ({ ...flipper, angle: flipper.rest, speed: 0 }));
}
