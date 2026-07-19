export const WIDTH = 720;
export const HEIGHT = 1080;
export const FIXED_STEP = 1 / 120;

export const COLORS = {
  ink: "#f4f1df",
  red: "#ef3340",
  blue: "#1455d9",
  cyan: "#5de4ff",
  yellow: "#ffd34e",
  midnight: "#070d24",
  field: "#0c1737",
  chrome: "#a8bad0",
};

export const walls = [
  [58, 130, 58, 770], [58, 130, 135, 62], [135, 62, 576, 62],
  [576, 62, 630, 128], [630, 128, 630, 892], [58, 770, 112, 865],
  [112, 865, 185, 920], [535, 920, 608, 865], [608, 865, 630, 790],
  [78, 650, 140, 770], [140, 770, 196, 820], [642, 650, 580, 770],
  [580, 770, 524, 820], [88, 210, 160, 140], [560, 140, 615, 220],
  [146, 360, 112, 474], [574, 360, 608, 474], [260, 235, 304, 315],
  [460, 235, 416, 315], [244, 315, 304, 315], [416, 315, 476, 315],
];

export const posts = [
  { x: 135, y: 640, r: 14 }, { x: 585, y: 640, r: 14 },
  { x: 110, y: 800, r: 12 }, { x: 610, y: 800, r: 12 },
  { x: 254, y: 330, r: 10 }, { x: 466, y: 330, r: 10 },
];

export const bumpers = [
  { x: 205, y: 430, r: 43, label: "BUNGA", color: COLORS.red },
  { x: 360, y: 385, r: 46, label: "RAYA", color: COLORS.yellow },
  { x: 515, y: 430, r: 43, label: "JAYA", color: COLORS.cyan },
];

export const lanes = [
  { id: "J", x: 205 }, { id: "O", x: 360 }, { id: "M", x: 515 },
];

export const landmarks = [
  { id: "klTower", label: "KL TOWER", x: 128, y: 286, w: 58, h: 125, color: COLORS.cyan },
  { id: "petronas", label: "PETRONAS", x: 330, y: 172, w: 60, h: 150, color: COLORS.yellow },
  { id: "parliament", label: "PARLIAMENT", x: 534, y: 286, w: 58, h: 125, color: COLORS.red },
];

export const slings = [
  { side: "left", points: [[150, 700], [235, 820], [150, 790]] },
  { side: "right", points: [[570, 700], [485, 820], [570, 790]] },
];

export const flippers = [
  { x: 218, y: 910, len: 122, rest: 0.28, active: -0.5, side: "left" },
  { x: 502, y: 910, len: 122, rest: Math.PI - 0.28, active: Math.PI + 0.5, side: "right" },
];

export const sensors = {
  klTower: { x: 90, y: 235, w: 92, h: 32 },
  petronas: { x: 315, y: 132, w: 90, h: 32 },
  parliament: { x: 538, y: 235, w: 92, h: 32 },
  scoop: { x: 360, y: 580, r: 28 },
  west: { x: 92, y: 520, w: 55, h: 90 },
  east: { x: 573, y: 520, w: 55, h: 90 },
  skybridge: { x: 320, y: 270, w: 80, h: 28 },
};

export const shooter = { x: 662, y: 935 };

export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
