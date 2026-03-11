import React, { useEffect, useRef, useState } from "react";

type ObstacleType = "etios" | "prefectura" | "barrels" | "forklift" | "container" | "suitcase" | "ypfTruck";
type Phase = "ready" | "running" | "gameover";

type PlayerState = {
  x: number;
  rise: number;
  vy: number;
  ducking: boolean;
  dead: boolean;
  jumpHeld: boolean;
  reachedMinRise: boolean;
  speedDrop: boolean;
};

type Obstacle = {
  type: ObstacleType;
  x: number;
  y: number;
  w: number;
  h: number;
  bob: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
};

type GameState = {
  phase: Phase;
  speed: number;
  distance: number;
  bestDistance: number;
  worldTime: number;
  nextObstacleDistance: number;
  player: PlayerState;
  obstacles: Obstacle[];
  particles: Particle[];
};

const W = 360;
const H = 180;
const GROUND_Y = 144;
const FRAME_MS = 1000 / 60;
const DINO_DEFAULT_WIDTH = 600;
const DINO_DEFAULT_HEIGHT = 150;

// Chrome Dino normal mode values.
const BASE_START_SPEED = 6;
const BASE_MAX_SPEED = 13;
const BASE_ACCEL_PER_FRAME = 0.001;
const BASE_GRAVITY = 0.6;
const BASE_INITIAL_JUMP_VELOCITY = -10;
const BASE_DROP_VELOCITY = -3.5;
const BASE_SPEED_DROP_COEFFICIENT = 3;
const BASE_MIN_JUMP_HEIGHT = 30;
const BASE_MAX_JUMP_HEIGHT = 60;
const DINO_GAP_COEFFICIENT = 0.6;
const DINO_MAX_GAP_COEFFICIENT = 1.5;
const DINO_FLYING_YPOS = [100, 75, 50] as const;
const DINO_TREX_HEIGHT = 47;
const PLAYER_STAND_HEIGHT = 28;
const PLAYER_DUCK_HEIGHT = 20;

// Dino uses smaller effective speed on narrower screens.
const HORIZONTAL_SPEED_SCALE = (W / DINO_DEFAULT_WIDTH) * 1.2;
const START_SPEED = BASE_START_SPEED * HORIZONTAL_SPEED_SCALE;
const MAX_SPEED = BASE_MAX_SPEED * HORIZONTAL_SPEED_SCALE;
const ACCEL_PER_FRAME = BASE_ACCEL_PER_FRAME * HORIZONTAL_SPEED_SCALE;

// Keep Dino timing but scale vertical amplitude to fit this scene.
const VERTICAL_SCALE = 0.6;
const GRAVITY = BASE_GRAVITY * VERTICAL_SCALE;
const INITIAL_JUMP_VELOCITY = BASE_INITIAL_JUMP_VELOCITY * VERTICAL_SCALE;
const DROP_VELOCITY = BASE_DROP_VELOCITY * VERTICAL_SCALE;
const SPEED_DROP_COEFFICIENT = BASE_SPEED_DROP_COEFFICIENT;
const MIN_JUMP_RISE = BASE_MIN_JUMP_HEIGHT * VERTICAL_SCALE;
const MAX_JUMP_RISE = BASE_MAX_JUMP_HEIGHT * VERTICAL_SCALE;
const SUITCASE_FLYING_YPOS = DINO_FLYING_YPOS.map((y) => {
  const dinoGroundTop = 93;
  const dinoOffsetFromGroundTop = y - dinoGroundTop;
  const playerGroundTop = GROUND_Y - PLAYER_STAND_HEIGHT;
  return Math.round(playerGroundTop + dinoOffsetFromGroundTop * (PLAYER_STAND_HEIGHT / DINO_TREX_HEIGHT));
});

const COLORS = {
  ink: "#10151d",
  skyTop: "#63b9ff",
  skyMid: "#8fd2ff",
  skyLow: "#d0efff",
  sun: "#ffe27a",
  cloud: "#f7fbff",
  mountainBack: "#7f91a9",
  mountainMid: "#677b94",
  mountainFront: "#586c86",
  snow: "#eef6ff",
  bayTop: "#4a8fd2",
  bayLow: "#2d5d93",
  pier: "#727981",
  pierShade: "#4f555d",
  pierDark: "#343941",
  roadStripe: "#eee8bf",
  roadStripeDark: "#b8a775",
  bollard: "#1f252b",
  safetyYellow: "#f8d23b",
  shipWhite: "#d7dee7",
  shipSteel: "#aab6c4",
  shipNavy: "#20354f",
  shipTeal: "#5ea5b8",
  shipWindow: "#284057",
  shipGold: "#d8aa4a",
  shipShadow: "#7d8997",
  mast: "#bb5941",
  mastLight: "#f2d3a0",
  skin: "#f1c5a3",
  skinShade: "#d4a183",
  hair: "#6d3812",
  hair2: "#a8631f",
  shirt: "#143d7d",
  shirt2: "#0b2b58",
  white: "#f8fbff",
  pants: "#d3dae3",
  pants2: "#a1acba",
  shoe: "#33a544",
  shoeDark: "#1d5f2a",
  prefectura: "#c7b28b",
  prefectura2: "#9d8a68",
  suitcaseGreen: "#87d76a",
  suitcaseGreenDark: "#63a94f",
  suitcaseOutline: "#111318",
  suitcaseHandle: "#aeb6bf",
  suitcaseWheel: "#565e69",
  barrel: "#e33f36",
  barrelDark: "#b92822",
  container: "#1678c7",
  containerDark: "#0a5189",
  pallet: "#bf7c39",
  palletDark: "#895325",
  forkliftBody: "#f0c61f",
  forkliftDark: "#39556d",
  hud: "#0f172a",
  etiosBody: "#eff3f7",
  etiosShadow: "#bac4ce",
  etiosWindow: "#273646",
  etiosMark: "#221b6f",
  etiosMark2: "#5cc8ff",
  etiosWheel: "#1d2229",
  etiosWheel2: "#8893a0",
} as const;

const CHARACTERS = [
  { id: "flor", name: "Flor", status: "available" },
  { id: "rocio", name: "Rocio", status: "available" },
  { id: "lucas", name: "Lucas", status: "available" },
  { id: "nico", name: "Nico C", status: "available" },
  { id: "josefina", name: "Josefina", status: "available" },
] as const;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

function createInitialState(): GameState {
  return {
    phase: "ready",
    speed: START_SPEED,
    distance: 0,
    bestDistance: 0,
    worldTime: 0,
    nextObstacleDistance: 100,
    player: {
      x: 48,
      rise: 0,
      vy: 0,
      ducking: false,
      dead: false,
      jumpHeld: false,
      reachedMinRise: false,
      speedDrop: false,
    },
    obstacles: [],
    particles: [],
  };
}

function obstaclePool(distance: number): Array<Omit<Obstacle, "x" | "bob">> {
  const pool: Array<Omit<Obstacle, "x" | "bob">> = [
    { type: "etios", w: 34, h: 17, y: GROUND_Y - 17 },
    { type: "prefectura", w: 14, h: 27, y: GROUND_Y - 27 },
  ];
  if (distance >= 80) pool.push({ type: "barrels", w: 14, h: 18, y: GROUND_Y - 18 });
  if (distance >= 130) pool.push({ type: "forklift", w: 30, h: 21, y: GROUND_Y - 21 });
  if (distance >= 180) pool.push({ type: "container", w: 30, h: 23, y: GROUND_Y - 23 });
  if (distance >= 110) pool.push({ type: "suitcase", w: 16, h: 22, y: SUITCASE_FLYING_YPOS[0]! });
  return pool;
}

function createObstacle(distance: number): Obstacle {
  if (distance >= 260 && Math.random() < 0.14) {
    return {
      type: "ypfTruck",
      x: W + 24,
      y: GROUND_Y - 36,
      w: 120,
      h: 36,
      bob: 0,
    };
  }
  const base = pick(obstaclePool(distance));
  const obstacle: Obstacle = {
    ...base,
    x: W + 20,
    bob: Math.random() * Math.PI * 2,
  };
  if (obstacle.type === "suitcase") {
    obstacle.y = pick([...SUITCASE_FLYING_YPOS]);
  }
  return obstacle;
}

function getNextObstacleGap(obstacle: Obstacle, speed: number): number {
  const baseMinGapMap: Record<ObstacleType, number> = {
    prefectura: 120,
    etios: 120,
    barrels: 120,
    forklift: 120,
    container: 120,
    suitcase: 150,
    ypfTruck: 290,
  };
  const scaledBaseMinGap = baseMinGapMap[obstacle.type] * (W / DINO_DEFAULT_WIDTH);
  const minGap = Math.round(obstacle.w * speed + scaledBaseMinGap * DINO_GAP_COEFFICIENT);
  const maxGap = Math.round(minGap * DINO_MAX_GAP_COEFFICIENT);
  return minGap + Math.random() * (maxGap - minGap);
}

function getObstacleHitbox(obstacle: Obstacle) {
  switch (obstacle.type) {
    case "prefectura":
      return { x: obstacle.x + 3, y: obstacle.y + 2, w: 8, h: 23 };
    case "etios":
      return { x: obstacle.x + 1, y: obstacle.y + 3, w: 31, h: 12 };
    case "barrels":
      return { x: obstacle.x + 2, y: obstacle.y + 1, w: 10, h: 16 };
    case "forklift":
      return { x: obstacle.x + 1, y: obstacle.y + 2, w: 28, h: 18 };
    case "container":
      return { x: obstacle.x + 1, y: obstacle.y + 1, w: 28, h: 21 };
    case "suitcase":
      return { x: obstacle.x + 1, y: obstacle.y + 2, w: 14, h: 18 };
    case "ypfTruck":
      return { x: obstacle.x + 2, y: obstacle.y + 10, w: 116, h: 24 };
  }
}

function getTruckPlatform(obstacle: Obstacle) {
  return { x: obstacle.x + 14, y: obstacle.y + 1, w: 84, h: 4 };
}

function getPlayerMetrics(player: PlayerState) {
  const airborne = player.rise > 0.1;
  const ducking = player.ducking && !airborne;
  const width = ducking ? 22 : 16;
  const height = ducking ? PLAYER_DUCK_HEIGHT : PLAYER_STAND_HEIGHT;
  const top = GROUND_Y - height - player.rise;
  return { airborne, ducking, width, height, top };
}

function collides(player: PlayerState, obstacle: Obstacle): boolean {
  const metrics = getPlayerMetrics(player);
  const p = { x: player.x + 2, y: metrics.top + 2, w: metrics.width - 4, h: metrics.height - 3 };
  const o = getObstacleHitbox(obstacle);
  return p.x < o.x + o.w && p.x + p.w > o.x && p.y < o.y + o.h && p.y + p.h > o.y;
}

function settlePlayerOnTruck(player: PlayerState, obstacles: Obstacle[], previousBottom: number): boolean {
  const metrics = getPlayerMetrics(player);
  const playerBox = { x: player.x + 2, y: metrics.top + 2, w: metrics.width - 4, h: metrics.height - 3 };
  const feetY = playerBox.y + playerBox.h;
  for (const obstacle of obstacles) {
    if (obstacle.type !== "ypfTruck") continue;
    const platform = getTruckPlatform(obstacle);
    const overlapsX = playerBox.x + playerBox.w > platform.x + 2 && playerBox.x < platform.x + platform.w - 2;
    const cameFromAbove = previousBottom <= platform.y + 2;
    const canLandNow = feetY >= platform.y && feetY <= platform.y + 8;
    if (overlapsX && player.vy >= 0 && cameFromAbove && canLandNow) {
      player.rise = GROUND_Y - platform.y;
      player.vy = 0;
      player.jumpHeld = false;
      player.reachedMinRise = true;
      player.speedDrop = false;
      return true;
    }
  }
  return false;
}

function makeParticle(x: number, y: number): Particle {
  return {
    x,
    y,
    vx: -(0.4 + Math.random() * 1.1),
    vy: -(Math.random() * 0.3),
    life: 230 + Math.random() * 160,
    size: 1 + Math.floor(Math.random() * 2),
  };
}

function startJumpVelocity(speed: number): number {
  return INITIAL_JUMP_VELOCITY - (speed / 10) * VERTICAL_SCALE;
}

function endJump(player: PlayerState) {
  if (player.reachedMinRise && player.vy < DROP_VELOCITY) {
    player.vy = DROP_VELOCITY;
  }
}

function setSpeedDrop(player: PlayerState) {
  player.speedDrop = true;
  player.vy = 1 * VERTICAL_SCALE;
}

function drawRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1) {
  const s = scale;
  drawRect(ctx, x, y + 2 * s, 14 * s, 4 * s, COLORS.cloud);
  drawRect(ctx, x + 2 * s, y, 8 * s, 6 * s, COLORS.cloud);
  drawRect(ctx, x + 8 * s, y + 1 * s, 8 * s, 5 * s, COLORS.cloud);
}

function drawSun(ctx: CanvasRenderingContext2D) {
  drawRect(ctx, 290, 14, 16, 16, COLORS.sun);
  drawRect(ctx, 296, 6, 4, 4, COLORS.sun);
  drawRect(ctx, 296, 34, 4, 4, COLORS.sun);
  drawRect(ctx, 282, 20, 4, 4, COLORS.sun);
  drawRect(ctx, 310, 20, 4, 4, COLORS.sun);
}

function drawPoly(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, color: string) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawUshuaiaMountainProfiles(ctx: CanvasRenderingContext2D) {
  drawPoly(ctx, [[0,106],[0,96],[22,96],[38,88],[52,72],[58,46],[62,36],[66,48],[74,70],[88,88],[110,97],[138,96],[156,84],[176,72],[192,60],[204,56],[220,68],[238,86],[258,97],[282,94],[302,78],[320,70],[340,68],[360,72],[360,106]], COLORS.mountainBack);
  drawPoly(ctx, [[0,108],[0,102],[28,101],[46,94],[58,76],[64,58],[68,52],[72,62],[84,86],[96,96],[122,104],[156,103],[176,92],[194,82],[206,72],[216,74],[232,86],[248,98],[280,104],[310,102],[330,94],[348,92],[360,94],[360,108]], COLORS.mountainMid);
  drawPoly(ctx, [[0,112],[0,108],[36,108],[60,104],[84,100],[114,103],[150,108],[200,107],[236,103],[274,104],[316,110],[360,112],[360,114],[0,114]], COLORS.mountainFront);
  drawPoly(ctx, [[56,52],[60,46],[63,40],[66,48],[69,56],[64,54],[61,58]], COLORS.snow);
  drawPoly(ctx, [[174,78],[188,68],[200,62],[210,70],[194,74],[182,82]], COLORS.snow);
  drawPoly(ctx, [[302,95],[314,89],[326,86],[336,90],[322,92],[308,98]], COLORS.snow);
}

function drawGenericCruiseShip(ctx: CanvasRenderingContext2D, x: number, y: number, variant: "large" | "medium" | "small") {
  const isLarge = variant === "large";
  const isSmall = variant === "small";
  const width = isLarge ? 154 : isSmall ? 72 : 112;
  const hullHeight = isLarge ? 12 : isSmall ? 7 : 10;
  const superHeight = isLarge ? 26 : isSmall ? 13 : 19;
  const bridgeWidth = isLarge ? 46 : isSmall ? 20 : 32;
  const bridgeX = isLarge ? x + 24 : isSmall ? x + 12 : x + 18;
  drawRect(ctx, x + 4, y + superHeight + hullHeight, width - 10, 2, COLORS.shipShadow);
  drawRect(ctx, x, y + superHeight, width, hullHeight, COLORS.shipNavy);
  drawRect(ctx, x + 5, y + 4, width - 22, superHeight - 1, COLORS.shipWhite);
  drawRect(ctx, bridgeX, y, bridgeWidth, 9, COLORS.shipWhite);
  drawRect(ctx, bridgeX + 6, y - 2, bridgeWidth - 14, 2, COLORS.shipWhite);
  drawRect(ctx, x + 10, y + superHeight - 5, width - 28, 2, COLORS.shipTeal);
  drawRect(ctx, x + 14, y + superHeight - 3, width - 38, 2, COLORS.shipGold);
  drawRect(ctx, x + 10, y + 8, width - 28, 1, COLORS.shipWindow);
  drawRect(ctx, x + 12, y + 12, width - 34, 1, COLORS.shipWindow);
  drawRect(ctx, x + 14, y + 16, width - 40, 1, COLORS.shipWindow);
  if (isLarge) {
    drawRect(ctx, x + 16, y + 20, width - 52, 1, COLORS.shipWindow);
    drawRect(ctx, x + 102, y + 5, 13, 9, COLORS.shipSteel);
    drawRect(ctx, x + 116, y + 1, 11, 5, COLORS.shipWhite);
    drawRect(ctx, x + 128, y + 3, 8, 3, COLORS.shipWhite);
  } else if (isSmall) {
    drawRect(ctx, x + 12, y + 10, width - 28, 1, COLORS.shipWindow);
    drawRect(ctx, x + 10, y + 13, width - 24, 1, COLORS.shipWindow);
    drawRect(ctx, x + 48, y + 4, 7, 5, COLORS.shipSteel);
    drawRect(ctx, x + 58, y + 3, 6, 3, COLORS.shipWhite);
  } else {
    drawRect(ctx, x + 12, y + 18, width - 36, 1, COLORS.shipWindow);
    drawRect(ctx, x + 76, y + 5, 10, 6, COLORS.shipSteel);
    drawRect(ctx, x + 89, y + 4, 7, 4, COLORS.shipWhite);
  }
  drawRect(ctx, x + width - 10, y + superHeight + 2, 10, 7, COLORS.shipNavy);
  drawRect(ctx, x - 2, y + superHeight + hullHeight - 1, 6, 2, COLORS.shipShadow);
}

function drawMooringLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    drawRect(ctx, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 1, 1, COLORS.ink);
  }
}

function drawHorizonWaterAndShips(ctx: CanvasRenderingContext2D) {
  drawRect(ctx, 0, 114, W, 12, COLORS.bayTop);
  drawRect(ctx, 0, 126, W, 4, COLORS.bayLow);
  drawRect(ctx, 0, 124, W, 1, "rgba(255,255,255,0.18)");
  drawGenericCruiseShip(ctx, 206, 92, "medium");
  drawGenericCruiseShip(ctx, 284, 103, "small");
  drawMooringLine(ctx, 266, 126, 282, 138);
  drawMooringLine(ctx, 248, 125, 264, 138);
}

function drawMast(ctx: CanvasRenderingContext2D, x: number, y: number) {
  drawRect(ctx, x, y, 3, 28, COLORS.mast);
  drawRect(ctx, x - 1, y + 6, 5, 3, COLORS.mastLight);
  drawRect(ctx, x - 5, y - 2, 13, 2, COLORS.ink);
  drawRect(ctx, x - 3, y - 5, 9, 3, COLORS.mastLight);
}

function drawPierScene(ctx: CanvasRenderingContext2D, worldTime: number) {
  drawRect(ctx, 0, 130, W, 50, COLORS.pier);
  drawRect(ctx, 0, 136, W, 3, COLORS.pierShade);
  drawRect(ctx, 0, 144, W, 36, COLORS.pierDark);
  const streetOffset = (worldTime * 0.15) % 110;
  const stripeOffset = (worldTime * 0.15) % 28;
  for (let i = -2; i < 16; i += 1) {
    const x = i * 24 - stripeOffset;
    drawRect(ctx, x, 132, 12, 2, COLORS.roadStripe);
    drawRect(ctx, x + 3, 135, 11, 2, COLORS.roadStripeDark);
  }
  for (let i = -1; i < 5; i += 1) {
    drawMast(ctx, i * 110 + 76 - streetOffset, 102);
  }
  for (let i = 0; i < 7; i += 1) {
    const x = i * 52 + 12 - (worldTime * 0.025) % 52;
    drawRect(ctx, x, 140, 4, 4, COLORS.safetyYellow);
    drawRect(ctx, x + 1, 137, 2, 3, COLORS.bollard);
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, worldTime: number) {
  drawRect(ctx, 0, 0, W, 34, COLORS.skyTop);
  drawRect(ctx, 0, 34, W, 34, COLORS.skyMid);
  drawRect(ctx, 0, 68, W, 18, COLORS.skyLow);
  drawRect(ctx, 0, 86, W, 28, "#dcefff");
  drawSun(ctx);
  drawCloud(ctx, 18 - (worldTime * 0.006) % 420, 18, 1);
  drawCloud(ctx, 110 - (worldTime * 0.004) % 440, 21, 2);
  drawCloud(ctx, 262 - (worldTime * 0.005) % 460, 26, 1);
  drawUshuaiaMountainProfiles(ctx);
  drawHorizonWaterAndShips(ctx);
  drawPierScene(ctx, worldTime);
}

function drawPrefectura(ctx: CanvasRenderingContext2D, x: number, y: number) {
  drawRect(ctx, x + 4, y, 6, 2, COLORS.prefectura2);
  drawRect(ctx, x + 3, y + 2, 8, 2, COLORS.prefectura);
  drawRect(ctx, x + 3, y + 3, 8, 1, COLORS.ink);
  drawRect(ctx, x + 5, y + 1, 4, 1, "#d8c15a");
  drawRect(ctx, x + 6, y, 2, 2, "#e8d982");
  drawRect(ctx, x + 4, y + 4, 6, 4, COLORS.skin);
  drawRect(ctx, x + 5, y + 5, 1, 1, COLORS.ink);
  drawRect(ctx, x + 8, y + 5, 1, 1, COLORS.ink);
  drawRect(ctx, x + 6, y + 7, 2, 1, COLORS.skinShade);
  drawRect(ctx, x + 4, y + 8, 6, 8, COLORS.prefectura);
  drawRect(ctx, x + 4, y + 8, 2, 2, COLORS.ink);
  drawRect(ctx, x + 8, y + 8, 2, 2, COLORS.ink);
  drawRect(ctx, x + 6, y + 8, 2, 5, COLORS.ink);
  drawRect(ctx, x + 4, y + 10, 2, 1, "#d8c15a");
  drawRect(ctx, x + 8, y + 10, 2, 1, "#d8c15a");
  drawRect(ctx, x + 4, y + 12, 2, 1, COLORS.prefectura2);
  drawRect(ctx, x + 8, y + 12, 2, 1, "#58c5d8");
  drawRect(ctx, x + 8, y + 13, 2, 1, "#d8c15a");
  drawRect(ctx, x + 3, y + 10, 1, 6, COLORS.skin);
  drawRect(ctx, x + 10, y + 10, 1, 6, COLORS.skin);
  drawRect(ctx, x + 5, y + 10, 1, 4, COLORS.prefectura2);
  drawRect(ctx, x + 7, y + 10, 1, 4, COLORS.prefectura2);
  drawRect(ctx, x + 4, y + 16, 6, 5, COLORS.prefectura2);
  drawRect(ctx, x + 4, y + 21, 2, 6, COLORS.prefectura);
  drawRect(ctx, x + 8, y + 21, 2, 6, COLORS.prefectura);
  drawRect(ctx, x + 3, y + 27, 4, 1, COLORS.ink);
  drawRect(ctx, x + 7, y + 27, 4, 1, COLORS.ink);
}

function drawEtios(ctx: CanvasRenderingContext2D, x: number, y: number) {
  drawRect(ctx, x + 5, y + 2, 21, 1, COLORS.etiosShadow);
  drawRect(ctx, x + 2, y + 4, 24, 7, COLORS.etiosBody);
  drawRect(ctx, x + 9, y + 1, 14, 4, COLORS.etiosBody);
  drawRect(ctx, x + 1, y + 7, 7, 3, COLORS.etiosBody);
  drawRect(ctx, x + 25, y + 6, 6, 4, COLORS.etiosBody);
  drawRect(ctx, x + 10, y + 3, 6, 3, COLORS.etiosWindow);
  drawRect(ctx, x + 17, y + 3, 5, 3, COLORS.etiosWindow);
  drawRect(ctx, x + 16, y + 3, 1, 8, COLORS.etiosShadow);
  drawRect(ctx, x + 7, y + 11, 18, 1, COLORS.etiosShadow);
  drawRect(ctx, x + 13, y + 7, 10, 1, COLORS.etiosMark);
  drawRect(ctx, x + 11, y + 8, 7, 1, COLORS.etiosMark2);
  drawRect(ctx, x + 3, y + 7, 2, 2, COLORS.etiosShadow);
  drawRect(ctx, x + 27, y + 7, 2, 2, COLORS.etiosShadow);
  drawRect(ctx, x + 4, y + 11, 6, 6, COLORS.etiosWheel);
  drawRect(ctx, x + 23, y + 11, 6, 6, COLORS.etiosWheel);
  drawRect(ctx, x + 6, y + 13, 2, 2, COLORS.etiosWheel2);
  drawRect(ctx, x + 25, y + 13, 2, 2, COLORS.etiosWheel2);
}

function drawBarrels(ctx: CanvasRenderingContext2D, x: number, y: number) {
  drawRect(ctx, x + 1, y + 2, 4, 14, COLORS.barrel);
  drawRect(ctx, x + 5, y + 1, 4, 15, COLORS.barrelDark);
  drawRect(ctx, x + 9, y + 2, 4, 14, COLORS.barrel);
  drawRect(ctx, x + 1, y + 5, 12, 1, COLORS.barrelDark);
  drawRect(ctx, x + 1, y + 10, 12, 1, COLORS.barrelDark);
}

function drawContainer(ctx: CanvasRenderingContext2D, x: number, y: number) {
  drawRect(ctx, x, y, 30, 23, COLORS.container);
  for (let i = 1; i < 7; i += 1) {
    drawRect(ctx, x + i * 4, y + 1, 1, 21, COLORS.containerDark);
  }
  drawRect(ctx, x + 1, y + 1, 4, 19, COLORS.containerDark);
  drawRect(ctx, x + 2, y + 2, 1, 17, COLORS.container);
  drawRect(ctx, x + 28, y + 1, 1, 21, COLORS.containerDark);
}

function drawForklift(ctx: CanvasRenderingContext2D, x: number, y: number) {
  drawRect(ctx, x + 18, y + 2, 10, 8, COLORS.forkliftDark);
  drawRect(ctx, x + 16, y + 10, 12, 9, COLORS.forkliftBody);
  drawRect(ctx, x + 6, y + 4, 3, 16, COLORS.forkliftDark);
  drawRect(ctx, x + 10, y + 2, 2, 18, COLORS.forkliftDark);
  drawRect(ctx, x + 0, y + 16, 14, 2, COLORS.palletDark);
  drawRect(ctx, x + 0, y + 10, 14, 6, COLORS.pallet);
  drawRect(ctx, x + 1, y + 11, 12, 1, COLORS.palletDark);
  drawRect(ctx, x + 18, y + 18, 5, 5, COLORS.forkliftDark);
  drawRect(ctx, x + 6, y + 18, 5, 5, COLORS.forkliftDark);
  drawRect(ctx, x + 20, y + 20, 1, 1, COLORS.white);
  drawRect(ctx, x + 8, y + 20, 1, 1, COLORS.white);
}

function drawSuitcase(ctx: CanvasRenderingContext2D, x: number, y: number) {
  drawRect(ctx, x + 2, y + 2, 12, 18, COLORS.suitcaseOutline);
  drawRect(ctx, x + 3, y + 3, 10, 16, COLORS.suitcaseGreen);
  drawRect(ctx, x + 5, y - 1, 6, 4, COLORS.suitcaseOutline);
  drawRect(ctx, x + 6, y, 4, 3, COLORS.suitcaseHandle);
  drawRect(ctx, x + 5, y + 6, 1, 10, COLORS.suitcaseGreenDark);
  drawRect(ctx, x + 8, y + 6, 1, 10, COLORS.suitcaseGreenDark);
  drawRect(ctx, x + 11, y + 6, 1, 10, COLORS.suitcaseGreenDark);
  drawRect(ctx, x + 4, y + 20, 2, 2, COLORS.suitcaseWheel);
  drawRect(ctx, x + 10, y + 20, 2, 2, COLORS.suitcaseWheel);
}

function drawYpfTruck(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const silver = "#dce2e8";
  const silverDark = "#8e98a5";
  const chrome = "#bcc4cd";
  const blue = "#1178c9";
  const cabWhite = "#f5f8fb";
  const cabShade = "#cfd8e3";
  const cabWindow = "#31475e";
  const wheel = "#1c2128";
  const wheelHub = "#8c97a4";
  const under = "#5a616a";
  const rail = "#d3473f";

  drawRect(ctx, x + 8, y + 2, 84, 2, silver);
  drawRect(ctx, x + 10, y + 4, 82, 2, silverDark);
  drawRect(ctx, x + 9, y + 6, 86, 18, silver);
  drawRect(ctx, x + 10, y + 10, 84, 8, blue);
  drawRect(ctx, x + 42, y + 10, 3, 8, "#f8fbff");
  drawRect(ctx, x + 45, y + 14, 3, 4, "#f8fbff");
  drawRect(ctx, x + 48, y + 10, 3, 8, "#f8fbff");
  drawRect(ctx, x + 54, y + 10, 3, 8, "#f8fbff");
  drawRect(ctx, x + 57, y + 10, 3, 4, "#f8fbff");
  drawRect(ctx, x + 60, y + 10, 3, 4, "#f8fbff");
  drawRect(ctx, x + 57, y + 14, 3, 4, "#f8fbff");
  drawRect(ctx, x + 66, y + 10, 3, 8, "#f8fbff");
  drawRect(ctx, x + 69, y + 10, 5, 4, "#f8fbff");
  drawRect(ctx, x + 7, y + 24, 88, 2, chrome);
  drawRect(ctx, x + 16, y + 27, 70, 2, under);
  drawRect(ctx, x + 13, y + 25, 2, 8, under);
  drawRect(ctx, x + 88, y + 8, 4, 13, silverDark);
  drawRect(ctx, x + 90, y + 8, 2, 12, chrome);
  drawRect(ctx, x + 95, y + 15, 5, 2, under);
  drawRect(ctx, x + 97, y + 11, 11, 15, cabWhite);
  drawRect(ctx, x + 108, y + 9, 20, 17, cabWhite);
  drawRect(ctx, x + 109, y + 10, 10, 8, cabWindow);
  drawRect(ctx, x + 119, y + 10, 7, 7, cabShade);
  drawRect(ctx, x + 97, y + 26, 29, 2, under);
  drawRect(ctx, x + 103, y + 28, 14, 1, chrome);
  drawRect(ctx, x + 8, y + 26, 78, 1, rail);
  drawRect(ctx, x + 14, y + 26, 4, 1, "#f3f4f6");
  drawRect(ctx, x + 26, y + 26, 4, 1, "#f3f4f6");
  drawRect(ctx, x + 38, y + 26, 4, 1, "#f3f4f6");
  drawRect(ctx, x + 50, y + 26, 4, 1, "#f3f4f6");
  drawRect(ctx, x + 62, y + 26, 4, 1, "#f3f4f6");
  drawRect(ctx, x + 74, y + 26, 4, 1, "#f3f4f6");
  drawRect(ctx, x + 2, y + 25, 4, 4, "#c84842");
  drawRect(ctx, x + 3, y + 21, 2, 4, "#d38c33");

  const wheels = [12, 25, 38, 82, 95, 108];
  for (const wheelX of wheels) {
    drawRect(ctx, x + wheelX, y + 27, 8, 8, wheel);
    drawRect(ctx, x + wheelX + 2, y + 29, 4, 4, wheelHub);
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, obstacle: Obstacle, worldTime: number) {
  const bobOffset = obstacle.type === "suitcase" ? Math.round(Math.sin(worldTime * 0.01 + obstacle.bob) * 1) : 0;
  const x = obstacle.x;
  const y = obstacle.y + bobOffset;
  if (obstacle.type === "prefectura") drawPrefectura(ctx, x, y);
  else if (obstacle.type === "etios") drawEtios(ctx, x, y);
  else if (obstacle.type === "barrels") drawBarrels(ctx, x, y);
  else if (obstacle.type === "container") drawContainer(ctx, x, y);
  else if (obstacle.type === "forklift") drawForklift(ctx, x, y);
  else if (obstacle.type === "ypfTruck") drawYpfTruck(ctx, x, y);
  else drawSuitcase(ctx, x, y);
}

function drawParticle(ctx: CanvasRenderingContext2D, particle: Particle) {
  drawRect(ctx, particle.x, particle.y, particle.size, particle.size, COLORS.pierShade);
}

function getRunnerPhase(player: PlayerState, worldTime: number) {
  const metrics = getPlayerMetrics(player);
  const runFrame = Math.floor(worldTime / 90) % 2;
  const duckFrame = Math.floor(worldTime / 75) % 2;
  return {
    top: metrics.top,
    airborne: metrics.airborne,
    ducking: metrics.ducking,
    phase: metrics.ducking ? `duck-${duckFrame}` : metrics.airborne ? "jump" : `run-${runFrame}`,
  };
}

function drawFlor(ctx: CanvasRenderingContext2D, player: PlayerState, worldTime: number) {
  const baseX = player.x;
  const { top, phase } = getRunnerPhase(player, worldTime);
  const blink = Math.floor(worldTime / 1400) % 9 === 0 && !player.dead;
  const p = (x: number, y: number, w = 1, h = 1, color: string = COLORS.ink) =>
    drawRect(ctx, baseX + x, top + y, w, h, color);
  const hairDark = "#614636";
  const hairMid = "#755541";
  const hairLight = "#9b755e";
  const hairTip = "#b79579";

  if (phase === "run-0") {
    p(2,1,4,1,hairTip); p(6,1,5,1,hairMid); p(1,2,4,2,hairLight); p(8,2,3,2,hairLight); p(0,5,2,2,hairMid); p(10,5,2,2,hairMid); p(1,7,2,2,hairDark); p(10,7,1,2,hairDark); p(2,2,9,1,hairMid); p(1,3,11,6,hairDark); p(8,7,2,2,hairTip);
    p(2,4,10,4,hairDark); p(3,4,8,5,COLORS.skin); p(4,3,7,2,hairLight); p(3,6,2,2,COLORS.skin); p(9,6,2,2,COLORS.skin);
    p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink?1:2,COLORS.ink); p(9,6,1,blink?1:2,COLORS.ink); p(6,8,1,1,COLORS.skinShade); p(7,8,2,1,"#ed9090");
    p(4,10,8,5,COLORS.shirt); p(3,11,2,4,COLORS.skin); p(10,11,2,4,COLORS.skin); p(11,12,2,3,COLORS.skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white);
    p(5,15,6,2,COLORS.shirt2); p(5,15,2,6,COLORS.pants); p(8,15,2,4,COLORS.pants); p(9,19,2,4,COLORS.pants); p(3,17,2,3,COLORS.pants); p(2,20,4,2,COLORS.shoe); p(8,22,4,2,COLORS.shoe); p(1,22,2,1,COLORS.shoeDark); p(10,23,2,1,COLORS.shoeDark); p(6,17,1,4,COLORS.pants2); p(8,18,1,5,COLORS.pants2);
  } else if (phase === "run-1") {
    p(2,1,4,1,hairTip); p(6,1,5,1,hairMid); p(1,3,4,2,hairLight); p(8,3,3,2,hairLight); p(0,5,2,2,hairMid); p(10,5,2,2,hairMid); p(0,7,2,2,hairDark); p(10,7,1,2,hairDark); p(2,2,9,1,hairMid); p(1,3,11,6,hairDark); p(8,7,2,2,hairTip);
    p(2,4,10,4,hairDark); p(3,4,8,5,COLORS.skin); p(4,3,7,2,hairLight); p(3,6,2,2,COLORS.skin); p(9,6,2,2,COLORS.skin); p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink?1:2,COLORS.ink); p(9,6,1,blink?1:2,COLORS.ink); p(6,8,1,1,COLORS.skinShade); p(7,8,2,1,"#ed9090");
    p(4,10,8,5,COLORS.shirt); p(2,12,2,4,COLORS.skin); p(10,10,2,4,COLORS.skin); p(11,12,2,2,COLORS.skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white); p(5,15,6,2,COLORS.shirt2); p(8,15,2,6,COLORS.pants); p(5,15,2,4,COLORS.pants); p(4,19,2,4,COLORS.pants); p(9,17,2,3,COLORS.pants); p(3,22,4,2,COLORS.shoe); p(8,20,4,2,COLORS.shoe); p(3,23,2,1,COLORS.shoeDark); p(10,21,2,1,COLORS.shoeDark); p(8,17,1,4,COLORS.pants2); p(5,18,1,5,COLORS.pants2);
  } else if (phase === "jump") {
    p(2,1,4,1,hairTip); p(6,1,5,1,hairMid); p(1,4,4,2,hairLight); p(8,4,3,2,hairLight); p(0,6,2,2,hairMid); p(10,6,2,2,hairMid); p(0,8,2,2,hairDark); p(10,8,1,2,hairDark); p(2,2,9,1,hairMid); p(1,3,11,6,hairDark); p(8,8,2,2,hairTip);
    p(2,4,10,4,hairDark); p(3,4,8,5,COLORS.skin); p(4,3,7,2,hairLight); p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink?1:2,COLORS.ink); p(9,6,1,blink?1:2,COLORS.ink); p(6,8,1,1,COLORS.skinShade); p(7,8,2,1,"#ed9090"); p(4,10,8,5,COLORS.shirt); p(2,11,2,4,COLORS.skin); p(10,11,2,4,COLORS.skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white); p(5,15,6,2,COLORS.shirt2); p(5,16,2,4,COLORS.pants); p(8,16,2,4,COLORS.pants); p(4,18,3,2,COLORS.pants2); p(8,18,3,2,COLORS.pants2); p(3,20,4,2,COLORS.shoe); p(8,20,4,2,COLORS.shoe); p(3,21,2,1,COLORS.shoeDark); p(10,21,2,1,COLORS.shoeDark);
  } else if (phase === "duck-0") {
    p(2,7,4,2,hairLight); p(10,7,3,2,hairLight); p(0,9,4,2,hairMid); p(11,9,3,2,hairMid); p(1,11,2,2,hairDark); p(12,11,2,2,hairDark); p(4,5,8,1,hairMid); p(3,6,9,1,hairMid); p(2,7,11,5,hairDark); p(3,8,9,3,hairDark); p(4,8,8,4,COLORS.skin); p(5,7,3,2,hairTip); p(8,7,2,2,hairLight); p(5,9,3,2,COLORS.white); p(9,9,3,2,COLORS.white); p(8,9,1,1,COLORS.white); p(6,10,1,1,COLORS.ink); p(10,10,1,1,COLORS.ink); p(7,11,1,1,COLORS.skinShade); p(8,11,2,1,"#ed9090"); p(6,12,10,3,COLORS.shirt); p(3,13,3,2,COLORS.skin); p(13,13,3,2,COLORS.skin); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,3,1,COLORS.white); p(7,15,9,2,COLORS.pants); p(4,16,6,2,COLORS.shoe); p(12,16,6,2,COLORS.shoe); p(4,17,2,1,COLORS.shoeDark); p(16,17,2,1,COLORS.shoeDark);
  } else {
    p(3,7,4,2,hairLight); p(10,7,3,2,hairLight); p(1,9,4,2,hairMid); p(11,9,3,2,hairMid); p(1,11,2,2,hairDark); p(12,11,2,2,hairDark); p(4,5,8,1,hairMid); p(3,6,9,1,hairMid); p(2,7,11,5,hairDark); p(3,8,9,3,hairDark); p(4,8,8,4,COLORS.skin); p(5,7,3,2,hairTip); p(8,7,2,2,hairLight); p(5,9,3,2,COLORS.white); p(9,9,3,2,COLORS.white); p(8,9,1,1,COLORS.white); p(6,10,1,1,COLORS.ink); p(10,10,1,1,COLORS.ink); p(7,11,1,1,COLORS.skinShade); p(8,11,2,1,"#ed9090"); p(6,12,10,3,COLORS.shirt); p(2,13,3,2,COLORS.skin); p(13,12,3,2,COLORS.skin); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,3,1,COLORS.white); p(7,15,9,2,COLORS.pants); p(5,16,6,2,COLORS.shoe); p(12,15,6,2,COLORS.shoe); p(5,17,2,1,COLORS.shoeDark); p(16,16,2,1,COLORS.shoeDark);
  }
}

function drawRocio(ctx: CanvasRenderingContext2D, player: PlayerState, worldTime: number) {
  const baseX = player.x;
  const { top, phase } = getRunnerPhase(player, worldTime);
  const blink = Math.floor(worldTime / 1400) % 9 === 0 && !player.dead;
  const p = (x: number, y: number, w = 1, h = 1, color: string = COLORS.ink) =>
    drawRect(ctx, baseX + x, top + y, w, h, color);
  const hairDark = "#5f4332";
  const hairLight = "#8d664d";
  const hairMid = "#745341";
  const cheek = "#e8b2a8";
  const lip = "#cb7d83";

  if (phase === "run-0") {
    p(5,0,2,3,hairLight); p(4,1,4,2,hairDark); p(6,2,1,2,hairLight);
    p(2,3,3,2,hairLight); p(9,3,3,2,hairLight); p(3,2,8,1,hairMid); p(2,3,10,1,hairMid); p(2,4,10,5,hairDark);
    p(2,4,10,4,hairDark); p(3,4,8,5,COLORS.skin); p(4,3,7,2,hairLight); p(3,6,2,2,COLORS.skin); p(9,6,2,2,COLORS.skin);
    p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(9,6,1,blink ? 1 : 2,COLORS.ink); p(6,8,1,1,COLORS.skinShade); p(5,8,5,1,cheek); p(6,9,3,1,lip);
    p(4,10,8,5,COLORS.shirt); p(3,11,2,4,COLORS.skin); p(10,11,2,4,COLORS.skin); p(11,12,2,3,COLORS.skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white);
    p(5,15,6,2,COLORS.shirt2); p(5,15,2,6,COLORS.pants); p(8,15,2,4,COLORS.pants); p(9,19,2,4,COLORS.pants); p(3,17,2,3,COLORS.pants); p(2,20,4,2,COLORS.shoe); p(8,22,4,2,COLORS.shoe); p(1,22,2,1,COLORS.shoeDark); p(10,23,2,1,COLORS.shoeDark); p(6,17,1,4,COLORS.pants2); p(8,18,1,5,COLORS.pants2);
  } else if (phase === "run-1") {
    p(5,0,2,3,hairLight); p(4,1,4,2,hairDark); p(6,2,1,2,hairLight);
    p(1,3,4,2,hairLight); p(3,2,8,1,hairMid); p(2,3,10,1,hairMid); p(2,4,10,5,hairDark);
    p(2,4,10,4,hairDark); p(3,4,8,5,COLORS.skin); p(4,3,7,2,hairLight); p(3,6,2,2,COLORS.skin); p(9,6,2,2,COLORS.skin); p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(9,6,1,blink ? 1 : 2,COLORS.ink); p(6,8,1,1,COLORS.skinShade); p(5,8,5,1,cheek); p(6,9,3,1,lip);
    p(4,10,8,5,COLORS.shirt); p(2,12,2,4,COLORS.skin); p(10,10,2,4,COLORS.skin); p(11,12,2,2,COLORS.skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white); p(5,15,6,2,COLORS.shirt2); p(8,15,2,6,COLORS.pants); p(5,15,2,4,COLORS.pants); p(4,19,2,4,COLORS.pants); p(9,17,2,3,COLORS.pants); p(3,22,4,2,COLORS.shoe); p(8,20,4,2,COLORS.shoe); p(3,23,2,1,COLORS.shoeDark); p(10,21,2,1,COLORS.shoeDark); p(8,17,1,4,COLORS.pants2); p(5,18,1,5,COLORS.pants2);
  } else if (phase === "jump") {
    p(5,1,2,3,hairLight); p(4,2,4,2,hairDark); p(6,3,1,2,hairLight);
    p(1,4,4,2,hairLight); p(3,2,8,1,hairMid); p(2,3,10,1,hairMid); p(2,4,10,5,hairDark);
    p(2,4,10,4,hairDark); p(3,4,8,5,COLORS.skin); p(4,3,7,2,hairLight); p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(9,6,1,blink ? 1 : 2,COLORS.ink); p(6,8,1,1,COLORS.skinShade); p(5,8,5,1,cheek); p(6,9,3,1,lip); p(4,10,8,5,COLORS.shirt); p(2,11,2,4,COLORS.skin); p(10,11,2,4,COLORS.skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white); p(5,15,6,2,COLORS.shirt2); p(5,16,2,4,COLORS.pants); p(8,16,2,4,COLORS.pants); p(4,18,3,2,COLORS.pants2); p(8,18,3,2,COLORS.pants2); p(3,20,4,2,COLORS.shoe); p(8,20,4,2,COLORS.shoe); p(3,21,2,1,COLORS.shoeDark); p(10,21,2,1,COLORS.shoeDark);
  } else if (phase === "duck-0") {
    p(6,3,2,3,hairLight); p(5,4,4,2,hairDark); p(7,5,1,2,hairLight);
    p(2,7,3,2,hairLight); p(10,7,3,2,hairLight); p(4,5,8,1,hairMid); p(3,6,10,1,hairMid); p(3,7,10,5,hairDark); p(4,8,8,4,COLORS.skin); p(5,7,7,2,hairLight); p(5,9,3,2,COLORS.white); p(9,9,3,2,COLORS.white); p(8,9,1,1,COLORS.white); p(6,10,1,1,COLORS.ink); p(10,10,1,1,COLORS.ink); p(7,11,1,1,COLORS.skinShade); p(6,11,5,1,cheek); p(8,11,2,1,lip); p(6,12,10,3,COLORS.shirt); p(3,13,3,2,COLORS.skin); p(13,13,3,2,COLORS.skin); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,3,1,COLORS.white); p(7,15,9,2,COLORS.pants); p(4,16,6,2,COLORS.shoe); p(12,16,6,2,COLORS.shoe); p(4,17,2,1,COLORS.shoeDark); p(16,17,2,1,COLORS.shoeDark);
  } else {
    p(6,3,2,3,hairLight); p(5,4,4,2,hairDark); p(7,5,1,2,hairLight);
    p(3,7,4,2,hairLight); p(10,7,3,2,hairLight); p(4,5,8,1,hairMid); p(3,6,10,1,hairMid); p(3,7,10,5,hairDark); p(4,8,8,4,COLORS.skin); p(5,7,7,2,hairLight); p(5,9,3,2,COLORS.white); p(9,9,3,2,COLORS.white); p(8,9,1,1,COLORS.white); p(6,10,1,1,COLORS.ink); p(10,10,1,1,COLORS.ink); p(7,11,1,1,COLORS.skinShade); p(6,11,5,1,cheek); p(8,11,2,1,lip); p(6,12,10,3,COLORS.shirt); p(2,13,3,2,COLORS.skin); p(13,12,3,2,COLORS.skin); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,3,1,COLORS.white); p(7,15,9,2,COLORS.pants); p(5,16,6,2,COLORS.shoe); p(12,15,6,2,COLORS.shoe); p(5,17,2,1,COLORS.shoeDark); p(16,16,2,1,COLORS.shoeDark);
  }
}

function drawLucas(ctx: CanvasRenderingContext2D, player: PlayerState, worldTime: number) {
  const baseX = player.x;
  const { top, phase } = getRunnerPhase(player, worldTime);
  const blink = Math.floor(worldTime / 1400) % 9 === 0 && !player.dead;
  const p = (x: number, y: number, w = 1, h = 1, color: string = COLORS.ink) =>
    drawRect(ctx, baseX + x, top + y, w, h, color);
  const skin = "#e7c0a2";
  const skinShade = "#c69676";
  const hair = "#7a7f86";
  const hair2 = "#b3b8bf";
  const hair3 = "#60656c";
  const beard = "#7b6550";

  if (phase === "run-0") {
    p(2,2,2,1,hair2); p(4,1,5,1,hair); p(9,2,2,1,hair2); p(3,2,7,1,hair3); p(2,3,9,1,hair3); p(2,4,9,4,hair);
    p(3,4,7,5,skin); p(2,5,1,2,skin); p(10,5,1,2,skin); p(4,5,2,1,COLORS.white); p(7,5,2,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(8,6,1,blink ? 1 : 2,COLORS.ink); p(4,8,5,2,beard); p(6,7,1,1,skinShade); p(6,9,2,1,"#b87978");
    p(3,10,10,5,COLORS.shirt); p(4,10,1,1,COLORS.white); p(8,11,1,3,COLORS.white); p(6,12,4,1,COLORS.white); p(2,11,2,4,skin); p(11,11,2,4,skin); p(3,15,10,2,COLORS.shirt2);
    p(4,15,2,6,COLORS.pants); p(7,15,2,4,COLORS.pants); p(8,19,2,4,COLORS.pants); p(2,17,2,3,COLORS.pants); p(2,20,4,2,COLORS.shoe); p(7,22,4,2,COLORS.shoe); p(1,22,2,1,COLORS.shoeDark); p(9,23,2,1,COLORS.shoeDark); p(5,17,1,4,COLORS.pants2); p(7,18,1,5,COLORS.pants2);
  } else if (phase === "run-1") {
    p(2,2,2,1,hair2); p(4,1,5,1,hair); p(9,2,2,1,hair2); p(3,2,7,1,hair3); p(2,3,9,1,hair3); p(2,4,9,4,hair);
    p(3,4,7,5,skin); p(2,5,1,2,skin); p(10,5,1,2,skin); p(4,5,2,1,COLORS.white); p(7,5,2,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(8,6,1,blink ? 1 : 2,COLORS.ink); p(4,8,5,2,beard); p(6,7,1,1,skinShade); p(6,9,2,1,"#b87978");
    p(3,10,10,5,COLORS.shirt); p(4,10,1,1,COLORS.white); p(8,11,1,3,COLORS.white); p(6,12,4,1,COLORS.white); p(1,12,2,4,skin); p(11,10,2,4,skin); p(3,15,10,2,COLORS.shirt2);
    p(7,15,2,6,COLORS.pants); p(4,15,2,4,COLORS.pants); p(3,19,2,4,COLORS.pants); p(8,17,2,3,COLORS.pants); p(2,22,4,2,COLORS.shoe); p(7,20,4,2,COLORS.shoe); p(2,23,2,1,COLORS.shoeDark); p(9,21,2,1,COLORS.shoeDark); p(7,17,1,4,COLORS.pants2); p(4,18,1,5,COLORS.pants2);
  } else if (phase === "jump") {
    p(2,2,2,1,hair2); p(4,1,5,1,hair); p(9,2,2,1,hair2); p(3,2,7,1,hair3); p(2,3,9,1,hair3); p(2,4,9,4,hair);
    p(3,4,7,5,skin); p(2,5,1,2,skin); p(10,5,1,2,skin); p(4,5,2,1,COLORS.white); p(7,5,2,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(8,6,1,blink ? 1 : 2,COLORS.ink); p(4,8,5,2,beard); p(6,7,1,1,skinShade); p(6,9,2,1,"#b87978");
    p(3,10,10,5,COLORS.shirt); p(4,10,1,1,COLORS.white); p(8,11,1,3,COLORS.white); p(6,12,4,1,COLORS.white); p(1,11,2,4,skin); p(11,11,2,4,skin); p(3,15,10,2,COLORS.shirt2);
    p(4,16,2,4,COLORS.pants); p(7,16,2,4,COLORS.pants); p(3,18,3,2,COLORS.pants2); p(7,18,3,2,COLORS.pants2); p(2,20,4,2,COLORS.shoe); p(7,20,4,2,COLORS.shoe); p(2,21,2,1,COLORS.shoeDark); p(9,21,2,1,COLORS.shoeDark);
  } else if (phase === "duck-0") {
    p(3,5,7,1,hair3); p(2,6,9,1,hair3); p(2,7,9,4,hair); p(3,7,2,1,hair2); p(8,7,2,1,hair2); p(3,7,7,4,skin); p(4,8,2,1,COLORS.white); p(7,8,2,1,COLORS.white); p(5,9,1,1,COLORS.ink); p(8,9,1,1,COLORS.ink); p(5,10,4,2,beard); p(6,10,1,1,skinShade);
    p(5,12,12,3,COLORS.shirt); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,4,1,COLORS.white); p(2,13,3,2,skin); p(14,13,3,2,skin); p(7,15,10,2,COLORS.pants); p(4,16,6,2,COLORS.shoe); p(12,16,6,2,COLORS.shoe); p(4,17,2,1,COLORS.shoeDark); p(16,17,2,1,COLORS.shoeDark);
  } else {
    p(3,5,7,1,hair3); p(2,6,9,1,hair3); p(2,7,9,4,hair); p(3,7,2,1,hair2); p(8,7,2,1,hair2); p(3,7,7,4,skin); p(4,8,2,1,COLORS.white); p(7,8,2,1,COLORS.white); p(5,9,1,1,COLORS.ink); p(8,9,1,1,COLORS.ink); p(5,10,4,2,beard); p(6,10,1,1,skinShade);
    p(5,12,12,3,COLORS.shirt); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,4,1,COLORS.white); p(1,13,3,2,skin); p(14,12,3,2,skin); p(7,15,10,2,COLORS.pants); p(5,16,6,2,COLORS.shoe); p(12,15,6,2,COLORS.shoe); p(5,17,2,1,COLORS.shoeDark); p(16,16,2,1,COLORS.shoeDark);
  }
}

function drawNico(ctx: CanvasRenderingContext2D, player: PlayerState, worldTime: number) {
  const baseX = player.x;
  const { top, phase } = getRunnerPhase(player, worldTime);
  const blink = Math.floor(worldTime / 1400) % 9 === 0 && !player.dead;
  const p = (x: number, y: number, w = 1, h = 1, color: string = COLORS.ink) =>
    drawRect(ctx, baseX + x, top + y, w, h, color);
  const skin = "#efc9a9";
  const skinShade = "#c89374";
  const hairDark = "#4b372d";
  const hairMid = "#6b5143";
  const beard = "#8d8a84";
  const beardDark = "#64615c";
  const beardLight = "#d9d6d0";
  const glasses = "#737b84";
  const glassesLight = "#d7dee7";

  if (phase === "run-0") {
    p(5,0,2,2,hairMid); p(4,1,5,1,hairDark); p(8,1,2,1,hairMid); p(3,2,7,1,hairDark); p(2,3,9,1,hairDark); p(2,4,9,3,hairDark);
    p(3,4,7,5,skin); p(2,5,1,2,skin); p(10,5,1,2,skin); p(4,5,2,2,glasses); p(7,5,2,2,glasses); p(6,5,1,1,glasses); p(4,5,1,1,glassesLight); p(7,5,1,1,glassesLight); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(8,6,1,blink ? 1 : 2,COLORS.ink); p(1,8,10,5,beard); p(2,8,8,3,beardDark); p(3,9,1,3,beardLight); p(6,9,2,4,beardLight); p(9,10,1,2,beardLight); p(8,12,2,1,beardDark); p(6,7,1,1,skinShade); p(6,11,2,1,"#b97d7a");
    p(3,10,10,5,COLORS.shirt); p(4,10,1,1,COLORS.white); p(8,11,1,3,COLORS.white); p(6,12,4,1,COLORS.white); p(2,11,2,4,skin); p(11,11,2,4,skin); p(3,15,10,2,COLORS.shirt2);
    p(4,15,2,6,COLORS.pants); p(7,15,2,4,COLORS.pants); p(8,19,2,4,COLORS.pants); p(2,17,2,3,COLORS.pants); p(2,20,4,2,COLORS.shoe); p(7,22,4,2,COLORS.shoe); p(1,22,2,1,COLORS.shoeDark); p(9,23,2,1,COLORS.shoeDark); p(5,17,1,4,COLORS.pants2); p(7,18,1,5,COLORS.pants2);
  } else if (phase === "run-1") {
    p(5,0,2,2,hairMid); p(4,1,5,1,hairDark); p(8,1,2,1,hairMid); p(3,2,7,1,hairDark); p(2,3,9,1,hairDark); p(2,4,9,3,hairDark);
    p(3,4,7,5,skin); p(2,5,1,2,skin); p(10,5,1,2,skin); p(4,5,2,2,glasses); p(7,5,2,2,glasses); p(6,5,1,1,glasses); p(4,5,1,1,glassesLight); p(7,5,1,1,glassesLight); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(8,6,1,blink ? 1 : 2,COLORS.ink); p(2,8,10,5,beard); p(3,8,8,3,beardDark); p(5,9,1,3,beardLight); p(7,9,2,4,beardLight); p(10,10,1,2,beardLight); p(3,12,2,1,beardDark); p(6,7,1,1,skinShade); p(6,11,2,1,"#b97d7a");
    p(3,10,10,5,COLORS.shirt); p(4,10,1,1,COLORS.white); p(8,11,1,3,COLORS.white); p(6,12,4,1,COLORS.white); p(1,12,2,4,skin); p(11,10,2,4,skin); p(3,15,10,2,COLORS.shirt2);
    p(7,15,2,6,COLORS.pants); p(4,15,2,4,COLORS.pants); p(3,19,2,4,COLORS.pants); p(8,17,2,3,COLORS.pants); p(2,22,4,2,COLORS.shoe); p(7,20,4,2,COLORS.shoe); p(2,23,2,1,COLORS.shoeDark); p(9,21,2,1,COLORS.shoeDark); p(7,17,1,4,COLORS.pants2); p(4,18,1,5,COLORS.pants2);
  } else if (phase === "jump") {
    p(5,0,2,2,hairMid); p(4,1,5,1,hairDark); p(8,1,2,1,hairMid); p(3,2,7,1,hairDark); p(2,3,9,1,hairDark); p(2,4,9,3,hairDark);
    p(3,4,7,5,skin); p(2,5,1,2,skin); p(10,5,1,2,skin); p(4,5,2,2,glasses); p(7,5,2,2,glasses); p(6,5,1,1,glasses); p(4,5,1,1,glassesLight); p(7,5,1,1,glassesLight); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(8,6,1,blink ? 1 : 2,COLORS.ink); p(1,8,10,5,beard); p(2,8,8,3,beardDark); p(4,9,1,3,beardLight); p(6,9,2,4,beardLight); p(9,10,1,2,beardLight); p(8,12,2,1,beardDark); p(6,7,1,1,skinShade); p(6,11,2,1,"#b97d7a");
    p(3,10,10,5,COLORS.shirt); p(4,10,1,1,COLORS.white); p(8,11,1,3,COLORS.white); p(6,12,4,1,COLORS.white); p(1,11,2,4,skin); p(11,11,2,4,skin); p(3,15,10,2,COLORS.shirt2);
    p(4,16,2,4,COLORS.pants); p(7,16,2,4,COLORS.pants); p(3,18,3,2,COLORS.pants2); p(7,18,3,2,COLORS.pants2); p(2,20,4,2,COLORS.shoe); p(7,20,4,2,COLORS.shoe); p(2,21,2,1,COLORS.shoeDark); p(9,21,2,1,COLORS.shoeDark);
  } else if (phase === "duck-0") {
    p(4,4,7,1,hairDark); p(3,5,9,1,hairDark); p(3,6,9,4,hairDark); p(4,6,2,1,hairMid); p(8,6,2,1,hairMid); p(4,7,7,4,skin); p(5,8,2,1,glasses); p(8,8,2,1,glasses); p(7,8,1,1,glasses); p(5,8,1,1,glassesLight); p(8,8,1,1,glassesLight); p(6,9,1,1,COLORS.ink); p(9,9,1,1,COLORS.ink); p(3,10,10,5,beard); p(4,10,8,2,beardDark); p(5,11,1,3,beardLight); p(8,11,2,4,beardLight); p(7,10,1,1,skinShade);
    p(5,12,12,3,COLORS.shirt); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,4,1,COLORS.white); p(2,13,3,2,skin); p(14,13,3,2,skin); p(7,15,10,2,COLORS.pants); p(4,16,6,2,COLORS.shoe); p(12,16,6,2,COLORS.shoe); p(4,17,2,1,COLORS.shoeDark); p(16,17,2,1,COLORS.shoeDark);
  } else {
    p(4,4,7,1,hairDark); p(3,5,9,1,hairDark); p(3,6,9,4,hairDark); p(4,6,2,1,hairMid); p(8,6,2,1,hairMid); p(4,7,7,4,skin); p(5,8,2,1,glasses); p(8,8,2,1,glasses); p(7,8,1,1,glasses); p(5,8,1,1,glassesLight); p(8,8,1,1,glassesLight); p(6,9,1,1,COLORS.ink); p(9,9,1,1,COLORS.ink); p(3,10,10,5,beard); p(4,10,8,2,beardDark); p(5,11,1,3,beardLight); p(8,11,2,4,beardLight); p(7,10,1,1,skinShade);
    p(5,12,12,3,COLORS.shirt); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,4,1,COLORS.white); p(1,13,3,2,skin); p(14,12,3,2,skin); p(7,15,10,2,COLORS.pants); p(5,16,6,2,COLORS.shoe); p(12,15,6,2,COLORS.shoe); p(5,17,2,1,COLORS.shoeDark); p(16,16,2,1,COLORS.shoeDark);
  }
}

function drawJosefina(ctx: CanvasRenderingContext2D, player: PlayerState, worldTime: number) {
  const baseX = player.x;
  const { top, phase } = getRunnerPhase(player, worldTime);
  const blink = Math.floor(worldTime / 1400) % 9 === 0 && !player.dead;
  const p = (x: number, y: number, w = 1, h = 1, color: string = COLORS.ink) =>
    drawRect(ctx, baseX + x, top + y, w, h, color);
  const hairCopper = "#b56439";
  const hairGold = "#d8a76a";
  const hairShadow = "#8b4f30";
  const cheek = "#e6a88f";

  if (phase === "run-0") {
    p(1,1,2,1,hairGold); p(2,1,3,2,hairGold); p(8,1,3,2,hairGold); p(10,2,2,1,hairGold); p(11,1,1,1,hairGold); p(0,4,3,2,hairCopper); p(10,4,3,2,hairCopper); p(1,6,2,4,hairCopper); p(10,6,2,4,hairCopper); p(3,1,8,1,hairCopper); p(2,2,10,1,hairCopper); p(1,3,12,7,hairShadow);
    p(2,4,10,4,hairCopper); p(3,4,8,5,COLORS.skin); p(4,3,7,2,hairGold); p(3,6,2,2,COLORS.skin); p(9,6,2,2,COLORS.skin); p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(9,6,1,blink ? 1 : 2,COLORS.ink); p(6,8,1,1,COLORS.skinShade); p(5,8,5,1,cheek); p(7,9,2,1,"#bf7b70");
    p(4,10,8,5,COLORS.shirt); p(3,11,2,4,COLORS.skin); p(10,11,2,4,COLORS.skin); p(11,12,2,3,COLORS.skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white);
    p(5,15,6,2,COLORS.shirt2); p(5,15,2,6,COLORS.pants); p(8,15,2,4,COLORS.pants); p(9,19,2,4,COLORS.pants); p(3,17,2,3,COLORS.pants); p(2,20,4,2,COLORS.shoe); p(8,22,4,2,COLORS.shoe); p(1,22,2,1,COLORS.shoeDark); p(10,23,2,1,COLORS.shoeDark); p(6,17,1,4,COLORS.pants2); p(8,18,1,5,COLORS.pants2);
  } else if (phase === "run-1") {
    p(1,2,2,1,hairGold); p(2,1,3,2,hairGold); p(8,1,3,2,hairGold); p(10,1,2,1,hairGold); p(0,4,3,2,hairCopper); p(10,4,3,2,hairCopper); p(0,6,2,4,hairCopper); p(10,6,2,4,hairCopper); p(3,1,8,1,hairCopper); p(2,2,10,1,hairCopper); p(1,3,12,7,hairShadow);
    p(2,4,10,4,hairCopper); p(3,4,8,5,COLORS.skin); p(4,3,7,2,hairGold); p(3,6,2,2,COLORS.skin); p(9,6,2,2,COLORS.skin); p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(9,6,1,blink ? 1 : 2,COLORS.ink); p(6,8,1,1,COLORS.skinShade); p(5,8,5,1,cheek); p(7,9,2,1,"#bf7b70");
    p(4,10,8,5,COLORS.shirt); p(2,12,2,4,COLORS.skin); p(10,10,2,4,COLORS.skin); p(11,12,2,2,COLORS.skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white); p(5,15,6,2,COLORS.shirt2); p(8,15,2,6,COLORS.pants); p(5,15,2,4,COLORS.pants); p(4,19,2,4,COLORS.pants); p(9,17,2,3,COLORS.pants); p(3,22,4,2,COLORS.shoe); p(8,20,4,2,COLORS.shoe); p(3,23,2,1,COLORS.shoeDark); p(10,21,2,1,COLORS.shoeDark); p(8,17,1,4,COLORS.pants2); p(5,18,1,5,COLORS.pants2);
  } else if (phase === "jump") {
    p(1,2,2,1,hairGold); p(2,2,3,2,hairGold); p(8,2,3,2,hairGold); p(10,3,2,1,hairGold); p(0,5,3,2,hairCopper); p(10,5,3,2,hairCopper); p(0,7,2,4,hairCopper); p(10,7,2,4,hairCopper); p(3,1,8,1,hairCopper); p(2,2,10,1,hairCopper); p(1,3,12,7,hairShadow);
    p(2,4,10,4,hairCopper); p(3,4,8,5,COLORS.skin); p(4,3,7,2,hairGold); p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(9,6,1,blink ? 1 : 2,COLORS.ink); p(6,8,1,1,COLORS.skinShade); p(5,8,5,1,cheek); p(7,9,2,1,"#bf7b70"); p(4,10,8,5,COLORS.shirt); p(2,11,2,4,COLORS.skin); p(10,11,2,4,COLORS.skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white); p(5,15,6,2,COLORS.shirt2); p(5,16,2,4,COLORS.pants); p(8,16,2,4,COLORS.pants); p(4,18,3,2,COLORS.pants2); p(8,18,3,2,COLORS.pants2); p(3,20,4,2,COLORS.shoe); p(8,20,4,2,COLORS.shoe); p(3,21,2,1,COLORS.shoeDark); p(10,21,2,1,COLORS.shoeDark);
  } else if (phase === "duck-0") {
    p(2,6,4,2,hairGold); p(10,6,4,2,hairGold); p(0,8,4,2,hairCopper); p(12,8,4,2,hairCopper); p(1,10,2,3,hairCopper); p(13,10,2,3,hairCopper); p(4,5,8,1,hairCopper); p(3,6,10,1,hairCopper); p(2,7,12,6,hairShadow); p(3,8,10,4,hairCopper); p(4,8,8,4,COLORS.skin); p(5,7,7,2,hairGold); p(5,9,3,2,COLORS.white); p(9,9,3,2,COLORS.white); p(8,9,1,1,COLORS.white); p(6,10,1,1,COLORS.ink); p(10,10,1,1,COLORS.ink); p(7,11,1,1,COLORS.skinShade); p(6,11,5,1,cheek); p(8,11,2,1,"#bf7b70"); p(6,12,10,3,COLORS.shirt); p(3,13,3,2,COLORS.skin); p(13,13,3,2,COLORS.skin); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,3,1,COLORS.white); p(7,15,9,2,COLORS.pants); p(4,16,6,2,COLORS.shoe); p(12,16,6,2,COLORS.shoe); p(4,17,2,1,COLORS.shoeDark); p(16,17,2,1,COLORS.shoeDark);
  } else {
    p(2,6,4,2,hairGold); p(10,6,4,2,hairGold); p(1,8,4,2,hairCopper); p(11,8,4,2,hairCopper); p(1,10,2,3,hairCopper); p(13,10,2,3,hairCopper); p(4,5,8,1,hairCopper); p(3,6,10,1,hairCopper); p(2,7,12,6,hairShadow); p(3,8,10,4,hairCopper); p(4,8,8,4,COLORS.skin); p(5,7,7,2,hairGold); p(5,9,3,2,COLORS.white); p(9,9,3,2,COLORS.white); p(8,9,1,1,COLORS.white); p(6,10,1,1,COLORS.ink); p(10,10,1,1,COLORS.ink); p(7,11,1,1,COLORS.skinShade); p(6,11,5,1,cheek); p(8,11,2,1,"#bf7b70"); p(6,12,10,3,COLORS.shirt); p(2,13,3,2,COLORS.skin); p(13,12,3,2,COLORS.skin); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,3,1,COLORS.white); p(7,15,9,2,COLORS.pants); p(5,16,6,2,COLORS.shoe); p(12,15,6,2,COLORS.shoe); p(5,17,2,1,COLORS.shoeDark); p(16,16,2,1,COLORS.shoeDark);
  }
}

function drawRunner(ctx: CanvasRenderingContext2D, player: PlayerState, worldTime: number, characterId: string) {
  if (characterId === "rocio") {
    drawRocio(ctx, player, worldTime);
    return;
  }
  if (characterId === "lucas") {
    drawLucas(ctx, player, worldTime);
    return;
  }
  if (characterId === "nico") {
    drawNico(ctx, player, worldTime);
    return;
  }
  if (characterId === "josefina") {
    drawJosefina(ctx, player, worldTime);
    return;
  }
  drawFlor(ctx, player, worldTime);
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState) {
  drawRect(ctx, 8, 8, 86, 24, "rgba(255,255,255,0.75)");
  drawRect(ctx, 264, 8, 88, 24, "rgba(255,255,255,0.75)");
  ctx.fillStyle = COLORS.hud;
  ctx.font = "bold 8px monospace";
  ctx.fillText(`DIST ${String(Math.floor(state.distance)).padStart(4, "0")}`, 14, 18);
  ctx.fillText(`BEST ${String(Math.floor(state.bestDistance)).padStart(4, "0")}`, 270, 18);
  ctx.font = "7px monospace";
  ctx.fillText("Jump: Space / Up", 14, 27);
  ctx.fillText("Duck: Down", 270, 27);
}

function drawOverlay(ctx: CanvasRenderingContext2D, phase: Phase) {
  drawRect(ctx, 92, 36, 176, 44, "rgba(255,255,255,0.84)");
  ctx.fillStyle = COLORS.hud;
  ctx.textAlign = "center";
  ctx.font = "bold 10px monospace";
  if (phase === "gameover") {
    ctx.fillText("GAME OVER", W / 2, 58);
  } else {
    ctx.fillText("RUN FLOW RUN", W / 2, 52);
    ctx.font = "7px monospace";
    ctx.fillText("Corre por el muelle y suma puntos para ganar", W / 2, 65);
  }
  ctx.textAlign = "left";
}

function invariant(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function runSelfChecks() {
  const earlyPool = obstaclePool(0);
  const latePool = obstaclePool(200);
  const container = latePool.find((item) => item.type === "container");
  const forklift = latePool.find((item) => item.type === "forklift");
  invariant(earlyPool.some((item) => item.type === "etios"), "Expected etios obstacle in early pool");
  invariant(latePool.some((item) => item.type === "suitcase"), "Suitcase obstacle should appear later");
  invariant(!!container && !!forklift && container.h > forklift.h, "Container should be taller than forklift");
  invariant(Math.abs(START_SPEED - 4.32) < 0.001, "Initial speed should match Dino narrow-screen proportion");
  invariant(Math.abs(MAX_SPEED - 9.36) < 0.001, "Max speed should match Dino narrow-screen proportion");
  invariant(Math.abs(ACCEL_PER_FRAME - 0.00072) < 0.00001, "Acceleration should match Dino narrow-screen proportion");
  invariant(Math.abs(GRAVITY / BASE_GRAVITY - VERTICAL_SCALE) < 0.0001, "Vertical gravity must keep Dino proportions");
  invariant(Math.abs(INITIAL_JUMP_VELOCITY / BASE_INITIAL_JUMP_VELOCITY - VERTICAL_SCALE) < 0.0001, "Jump launch must keep Dino proportions");
  invariant(Math.abs(MAX_JUMP_RISE - 36) < 0.001, "Max jump rise should preserve a clearly taller held jump while keeping Dino-like proportions");
  invariant(JSON.stringify(SUITCASE_FLYING_YPOS) === JSON.stringify([120, 105, 90]), "Flying obstacle heights should keep Dino-like proportions relative to the runner");
}

export default function UshuaiaRunnerFlorPrototype() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderScaleRef = useRef(3);
  const rafRef = useRef(0);
  const keysRef = useRef({ duckHeld: false });
  const stateRef = useRef<GameState>(createInitialState());
  const selectedCharacterRef = useRef("flor");

  const [phase, setPhase] = useState<Phase>("ready");
  const [distance, setDistance] = useState(0);
  const [best, setBest] = useState(0);
  const [selectedCharacter, setSelectedCharacter] = useState("flor");

  useEffect(() => {
    document.title = "Run Flow Run";
  }, []);

  useEffect(() => {
    selectedCharacterRef.current = selectedCharacter;
  }, [selectedCharacter]);

  const syncCanvasResolution = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const width = container.clientWidth || 1080;
    const scale = clamp(Math.floor(width / W), 2, 5);
    renderScaleRef.current = scale;
    canvas.width = W * scale;
    canvas.height = H * scale;
    canvas.style.width = `${W * scale}px`;
    canvas.style.height = `${H * scale}px`;
  };

  const resetGame = (startRunning = true) => {
    const bestDistance = Math.max(stateRef.current.bestDistance, stateRef.current.distance);
    stateRef.current = { ...createInitialState(), bestDistance, phase: startRunning ? "running" : "ready" };
    setBest(Math.floor(bestDistance));
    setDistance(0);
    setPhase(startRunning ? "running" : "ready");
  };

  const pressJump = () => {
    const state = stateRef.current;
    if (state.phase === "ready") resetGame(true);
    if (state.phase === "gameover") return;
    const player = state.player;
    if (player.rise <= 0.01) {
      player.vy = startJumpVelocity(state.speed);
      player.rise = 0.1;
      player.ducking = false;
      player.jumpHeld = true;
      player.reachedMinRise = false;
      player.speedDrop = false;
    }
  };

  const releaseJump = () => {
    const player = stateRef.current.player;
    player.jumpHeld = false;
    endJump(player);
  };

  const setDuck = (value: boolean) => {
    if (stateRef.current.phase === "gameover") {
      keysRef.current.duckHeld = false;
      return;
    }
    keysRef.current.duckHeld = value;
    const player = stateRef.current.player;
    if (value && player.rise > 0) setSpeedDrop(player);
    if (!value && stateRef.current.phase === "ready") player.ducking = false;
  };

  useEffect(() => {
    runSelfChecks();
    syncCanvasResolution();
    const observer = new ResizeObserver(() => syncCanvasResolution());
    if (containerRef.current) observer.observe(containerRef.current);

    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "Space", "KeyW", "KeyS"].includes(event.code)) {
        event.preventDefault();
      }
      if (event.code === "ArrowUp" || event.code === "Space" || event.code === "KeyW") {
        pressJump();
      }
      if (event.code === "ArrowDown" || event.code === "KeyS") {
        if (stateRef.current.phase === "ready") resetGame(true);
        setDuck(true);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "ArrowUp" || event.code === "Space" || event.code === "KeyW") {
        releaseJump();
      }
      if (event.code === "ArrowDown" || event.code === "KeyS") {
        setDuck(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      observer.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    let last = performance.now();
    const tick = (now: number) => {
      const canvas = canvasRef.current;
      const state = stateRef.current;
      if (!canvas) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const dtMs = Math.min(32, now - last || 16.67);
      const dt = dtMs / 16.67;
      last = now;

      if (state.phase === "running") {
        state.worldTime += dtMs;
        state.speed = clamp(state.speed + ACCEL_PER_FRAME * (dtMs / FRAME_MS), START_SPEED, MAX_SPEED);
        state.distance += state.speed * (dtMs / FRAME_MS);

        const player = state.player;
        const previousBottom = GROUND_Y - player.rise;
        const airborne = player.rise > 0 || player.vy !== 0;
        if (airborne) {
          const framesElapsed = dtMs / FRAME_MS;
          const dropFactor = player.speedDrop ? SPEED_DROP_COEFFICIENT : 1;
          player.rise -= player.vy * framesElapsed * dropFactor;
          player.vy += GRAVITY * framesElapsed;
          if (player.rise >= MIN_JUMP_RISE || player.speedDrop) player.reachedMinRise = true;
          if (!player.jumpHeld && player.reachedMinRise) endJump(player);
          if (player.rise >= MAX_JUMP_RISE || player.speedDrop) endJump(player);
          if (player.rise <= 0) {
            player.rise = 0;
            player.vy = 0;
            player.jumpHeld = false;
            player.reachedMinRise = false;
            player.speedDrop = false;
          }
        }

        player.ducking = keysRef.current.duckHeld && player.rise === 0;

        if (state.distance >= state.nextObstacleDistance) {
          const obstacle = createObstacle(state.distance);
          state.obstacles.push(obstacle);
          state.nextObstacleDistance = state.distance + getNextObstacleGap(obstacle, state.speed);
        }

        for (const obstacle of state.obstacles) {
          obstacle.x -= state.speed * (dtMs / FRAME_MS);
        }
        state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.w > -40);

        const onTruck = settlePlayerOnTruck(player, state.obstacles, previousBottom);
        if (onTruck) {
          player.ducking = false;
        }

        if (player.rise === 0 && !player.ducking && Math.random() < 0.22 * dt) {
          state.particles.push(makeParticle(player.x + 4, GROUND_Y - 1));
        }
        for (const particle of state.particles) {
          particle.x += particle.vx * dt;
          particle.y += particle.vy * dt;
          particle.life -= dtMs;
        }
        state.particles = state.particles.filter((particle) => particle.life > 0);

        if (state.obstacles.some((obstacle) => collides(player, obstacle))) {
          state.phase = "gameover";
          player.dead = true;
          player.jumpHeld = false;
          state.bestDistance = Math.max(state.bestDistance, state.distance);
          setBest(Math.floor(state.bestDistance));
          setPhase("gameover");
        }

        setDistance(Math.floor(state.distance));
      } else {
        state.worldTime += dtMs * 0.42;
        state.player.ducking = keysRef.current.duckHeld && state.phase === "ready";
        state.bestDistance = Math.max(state.bestDistance, state.distance);
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const scale = renderScaleRef.current;
      ctx.imageSmoothingEnabled = false;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, W, H);
      drawBackground(ctx, state.worldTime);
      state.obstacles.forEach((obstacle) => drawObstacle(ctx, obstacle, state.worldTime));
      state.particles.forEach((particle) => drawParticle(ctx, particle));
      drawRunner(ctx, state.player, state.worldTime, selectedCharacterRef.current);
      drawHud(ctx, state);
      if (state.phase !== "running") drawOverlay(ctx, state.phase);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="app-shell">
      <div className="app-layout">
        <aside className="sidebar-panel">
          <div className="hero-block">
            <h1 className="hero-title">Run Flow Run</h1>
            <p className="hero-copy">
              Sos un agente de Delver y tenes que superar obstaculos en el muelle!
            </p>
          </div>

          <div className="section-panel">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>Elegi tu corredor</div>
                <div style={{ marginTop: 4, fontSize: 12, color: "#94a3b8" }}>Cada agente tiene su propio slot visual.</div>
              </div>
              <div
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "rgba(56, 189, 248, 0.14)",
                  border: "1px solid rgba(56, 189, 248, 0.28)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#7dd3fc",
                }}
              >
                Delver Team
              </div>
            </div>
            <div className="grid gap-2">
              {CHARACTERS.map((character) => {
                const active = selectedCharacter === character.id;
                const disabled = character.status !== "available";
                return (
                  <button
                    key={character.id}
                    disabled={disabled}
                    onClick={() => !disabled && setSelectedCharacter(character.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${disabled ? "border-slate-700 bg-slate-800/40 text-slate-500 cursor-not-allowed" : active ? "border-sky-400 bg-sky-500/10 text-white" : "border-slate-700 bg-slate-800/60 hover:border-slate-500"}`}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "14px 16px",
                      borderRadius: 18,
                      border: active ? "1px solid #38bdf8" : "1px solid rgba(148, 163, 184, 0.22)",
                      background: disabled
                        ? "rgba(30, 41, 59, 0.45)"
                        : active
                          ? "linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(37, 99, 235, 0.18))"
                          : "rgba(15, 23, 42, 0.72)",
                      color: disabled ? "#64748b" : "#f8fafc",
                      cursor: disabled ? "not-allowed" : "pointer",
                      boxShadow: active ? "0 14px 28px rgba(14, 165, 233, 0.16)" : "none",
                    }}
                  >
                    <div
                      className="font-semibold flex items-center justify-between"
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 999,
                            background: disabled ? "#475569" : active ? "#38bdf8" : "#94a3b8",
                            boxShadow: active ? "0 0 0 4px rgba(56, 189, 248, 0.18)" : "none",
                          }}
                        />
                        <span style={{ fontSize: 16, fontWeight: 700 }}>{character.name}</span>
                      </div>
                      <span
                        className="text-xs uppercase tracking-widest"
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: disabled ? "#94a3b8" : active ? "#bae6fd" : "#cbd5e1",
                        }}
                      >
                        {disabled ? "soon" : "ready"}
                      </span>
                    </div>
                    <div
                      className="text-xs mt-1 text-slate-400"
                      style={{ marginTop: 8, fontSize: 12, color: disabled ? "#94a3b8" : "#cbd5e1" }}
                    >
                      {disabled ? "Reservado para futuros agentes" : "Corredor activo en esta partida"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="section-panel">
            <div className="section-title">Controles</div>
            <ul className="controls-list">
              <li><span className="key-chip">Space</span> o <span className="key-chip">Up</span> para saltar</li>
              <li><span className="key-chip">Down</span> para agacharte o caer mas rapido</li>
              <li>Un toque corto hace un salto corto y mantenerlo llega al maximo</li>
              <li>Click en la pantalla para arrancar la corrida</li>
            </ul>
          </div>
        </aside>

        <main className="game-shell">
          <div className="game-card">
            <div ref={containerRef} className="canvas-frame">
              <div
                className="relative shrink-0"
                style={{
                  position: "relative",
                  display: "inline-block",
                  lineHeight: 0,
                }}
              >
                <canvas
                  ref={canvasRef}
                  onMouseDown={() => {
                    if (phase === "gameover") return;
                    pressJump();
                  }}
                  onMouseUp={releaseJump}
                  onMouseLeave={releaseJump}
                  className="block max-w-full h-auto cursor-pointer"
                  style={{ display: "block" }}
                />
                {phase === "gameover" && (
                  <div
                    className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/55"
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 20,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(2, 6, 23, 0.58)",
                    }}
                  >
                    <div
                      className="pointer-events-auto min-w-[240px] rounded-3xl border border-slate-200/20 bg-slate-900/95 px-6 py-5 text-center shadow-2xl backdrop-blur-sm"
                      style={{
                        pointerEvents: "auto",
                        minWidth: 240,
                        padding: "20px 24px",
                        borderRadius: 24,
                        border: "1px solid rgba(226, 232, 240, 0.18)",
                        background: "rgba(15, 23, 42, 0.96)",
                        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.45)",
                        color: "#e2e8f0",
                        textAlign: "center",
                        lineHeight: 1.2,
                      }}
                    >
                      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.24em", color: "#94a3b8" }}>
                        Run finished
                      </div>
                      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: "#ffffff" }}>Tus stats</div>
                      <div style={{ marginTop: 16, display: "flex", gap: 12, justifyContent: "center" }}>
                        <div
                          style={{
                            minWidth: 92,
                            borderRadius: 16,
                            background: "#1e293b",
                            padding: "12px 14px",
                            color: "#e2e8f0",
                          }}
                        >
                          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>
                            Distancia
                          </div>
                          <div style={{ marginTop: 6, fontSize: 24, fontWeight: 700, color: "#ffffff" }}>{distance}</div>
                        </div>
                        <div
                          style={{
                            minWidth: 92,
                            borderRadius: 16,
                            background: "#1e293b",
                            padding: "12px 14px",
                            color: "#e2e8f0",
                          }}
                        >
                          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>
                            Mejor
                          </div>
                          <div style={{ marginTop: 6, fontSize: 24, fontWeight: 700, color: "#ffffff" }}>{best}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => resetGame(true)}
                        className="mt-5 rounded-2xl bg-sky-400 px-5 py-3 font-semibold text-slate-950 shadow-lg shadow-sky-400/20 transition hover:bg-sky-300"
                        style={{
                          marginTop: 20,
                          border: 0,
                          borderRadius: 16,
                          background: "#38bdf8",
                          color: "#020617",
                          padding: "12px 20px",
                          fontSize: 16,
                          fontWeight: 700,
                          cursor: "pointer",
                          boxShadow: "0 12px 30px rgba(56, 189, 248, 0.28)",
                        }}
                      >
                        Empezar de nuevo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {phase !== "gameover" && (
              <div className="action-bar">
                <button
                onMouseDown={pressJump}
                onMouseUp={releaseJump}
                onMouseLeave={releaseJump}
                onTouchStart={(e) => {
                  e.preventDefault();
                  pressJump();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  releaseJump();
                }}
                className="action-button jump-button"
              >
                Jump
              </button>
              <button
                onMouseDown={() => setDuck(true)}
                onMouseUp={() => setDuck(false)}
                onMouseLeave={() => setDuck(false)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  setDuck(true);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  setDuck(false);
                }}
                className="action-button duck-button"
              >
                Duck
              </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
