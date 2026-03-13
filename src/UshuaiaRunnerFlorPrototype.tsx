import React, { useEffect, useRef, useState } from "react";
import runFlowRunIcon from "./assets/rfr.png";
import { fetchTopLeaderboard, normalizeNickname, submitBestLeaderboardScore, type LeaderboardRow } from "./lib/leaderboard";

type ObstacleType = "etios" | "prefectura" | "barrels" | "forklift" | "container" | "suitcase" | "ypfTruck" | "quizStar";
type Phase = "ready" | "running" | "quiz" | "gameover";

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
  baseY: number;
  collected?: boolean;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color?: string;
  gravity?: number;
};

type ScorePopup = {
  x: number;
  y: number;
  vy: number;
  life: number;
  text: string;
  color: string;
};

type QuizQuestion = {
  prompt: string;
  answers: [string, string, string];
  correctIndex: number;
};

type ActiveQuiz = {
  questionIndex: number;
  remainingMs: number;
};

type QuizOutcome = "correct" | "incorrect" | "timeout";

type QuizFeedback = {
  title: string;
  pointsText: string;
  color: string;
  glow: string;
  life: number;
  totalLife: number;
};

type GameState = {
  phase: Phase;
  speed: number;
  distance: number;
  bestDistance: number;
  score: number;
  worldTime: number;
  dayNightTime: number;
  nextObstacleDistance: number;
  nextStarDistance: number;
  player: PlayerState;
  obstacles: Obstacle[];
  particles: Particle[];
  activeQuiz: ActiveQuiz | null;
  quizOrder: number[];
  nextQuizQuestionIndex: number;
  scorePopups: ScorePopup[];
  quizFeedback: QuizFeedback | null;
};

const W = 360;
const H = 180;
const GROUND_Y = 144;
const FRAME_MS = 1000 / 60;
const DAY_NIGHT_CYCLE_MS = 180_000;
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
const QUIZ_STAR_SIZE = 32;
const QUIZ_DURATION_MS = 10000;
const QUIZ_SCORE_DELTA = 5000;
const QUIZ_WRONG_SCORE_DELTA = 2500;
const QUIZ_TIMEOUT_SCORE_DELTA = 5000;
const QUIZ_FEEDBACK_DURATION_MS = 950;
const QUIZ_STAR_YPOS = [GROUND_Y - 84, GROUND_Y - 66, GROUND_Y - 48] as const;
const QUIZ_CONFETTI_COLORS = ["#fde047", "#22c55e", "#38bdf8", "#f97316", "#f472b6"] as const;

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

const TWILIGHT_COLORS = {
  skyTop: "#713e56",
  skyMid: "#d86857",
  skyLow: "#ffaf5f",
  horizon: "#ffd77b",
  cloud: "#ffd2b4",
  mountainBack: "#644a63",
  mountainMid: "#533f57",
  mountainFront: "#413548",
  snow: "#ffe8d0",
  bayTop: "#9d5a55",
  bayLow: "#53355a",
} as const;

const NIGHT_COLORS = {
  skyTop: "#091632",
  skyMid: "#10284f",
  skyLow: "#1a3f70",
  horizon: "#2a5886",
  cloud: "#9fb6d8",
  mountainBack: "#2e3f59",
  mountainMid: "#26364d",
  mountainFront: "#1d2a3d",
  snow: "#adc4e1",
  bayTop: "#163e69",
  bayLow: "#0c2442",
  moon: "#f3f6ff",
} as const;

const STAR_FIELD: ReadonlyArray<readonly [number, number, number]> = [
  [24, 14, 2],
  [46, 28, 1],
  [74, 18, 1],
  [92, 36, 2],
  [128, 16, 1],
  [146, 28, 2],
  [178, 18, 1],
  [198, 34, 1],
  [224, 12, 2],
  [246, 26, 1],
  [276, 18, 1],
  [304, 30, 2],
  [328, 16, 1],
  [344, 28, 1],
] as const;

const CHARACTERS = [
  { id: "flor", name: "Flor", status: "available" },
  { id: "rocio", name: "Rocio", status: "available" },
  { id: "lucas", name: "Lucas", status: "available" },
  { id: "nico", name: "Nico C", status: "available" },
  { id: "josefina", name: "Josefina", status: "available" },
  { id: "jime", name: "Jime", status: "available" },
  { id: "santi", name: "Santi", status: "available" },
  { id: "pablo", name: "Pablo", status: "available" },
  { id: "eli", name: "Eliana", status: "available" },
  { id: "vero", name: "Vero", status: "available" },
  { id: "chino", name: "Chino", status: "available" },
  { id: "ger", name: "Ger", status: "available" },
] as const;
const NICKNAME_STORAGE_KEY = "runflowrun.nickname";

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    prompt: "¿Con cuántos vessels distintos trabajó Delver esta temporada 25-26? (Ops)",
    answers: ["24", "29", "32"] as [string, string, string],
    correctIndex: 0,
  },
  {
    prompt: "Al cierre de temporada 25-26, ¿cuántas recaladas atendimos entre todos los deptos?",
    answers: ["295", "311", "325"] as [string, string, string],
    correctIndex: 1,
  },
  {
    prompt: "¿Cuántas personas forman hoy el equipo Delver?",
    answers: ["61", "83", "78"] as [string, string, string],
    correctIndex: 1,
  },
  {
    prompt: "Del total de Expediciones Antárticas desde Ushuaia, ¿Qué porcentaje agencia Delver?",
    answers: ["38%", "entre 40% y 50%", "62%"] as [string, string, string],
    correctIndex: 1,
  },
  {
    prompt: "¿Cuántos contenedores entregamos esta temporada?",
    answers: ["179", "99", "253"] as [string, string, string],
    correctIndex: 0,
  },
  {
    prompt: "¿Cuántas AVE visas emitió Crewing esta temporada?",
    answers: ["653", "1897", "493"] as [string, string, string],
    correctIndex: 2,
  },
  {
    prompt: "¿Cuál es el total de personas (paxs + crew) embarcadas en la flota que atiende Delver?",
    answers: ["5896", "9022", "más de 10 mil personas"] as [string, string, string],
    correctIndex: 2,
  },
  {
    prompt: "¿Cuántos tripulantes movió crew en la temporada 24-25?",
    answers: ["1256", "5942", "8962"] as [string, string, string],
    correctIndex: 1,
  },
  {
    prompt: "¿Cuántas carpetas de stock (carga + descarga)  se crearon esta temporada?",
    answers: ["176", "380", "240"] as [string, string, string],
    correctIndex: 0,
  },
  {
    prompt: "¿Cuántas horas camión tuvo Shipments esta temporada?",
    answers: ["2845", "6482", "886"] as [string, string, string],
    correctIndex: 0,
  },
  {
    prompt: "¿Cuántas turnos de estiba se contrataron esta temporada?",
    answers: ["365", "556", "129"] as [string, string, string],
    correctIndex: 0,
  },
  {
    prompt: "¿Cuántos litros de nafta fueron registrados por FUEL ORDERS esta temporada?",
    answers: ["94500", "21240", "65800"] as [string, string, string],
    correctIndex: 0,
  },
  {
    prompt: "¿Cuántos drums de nafta se entregaron esta temporada? Segun FUEL ORDERS",
    answers: ["1389", "474", "267"] as [string, string, string],
    correctIndex: 1,
  },
  {
    prompt: "¿Cuál es la mediana en días de facturación de esta temporada?",
    answers: ["52", "39", "31"] as [string, string, string],
    correctIndex: 2,
  },
  {
    prompt: "¿Cuál es la mediana en días de facturación de la temporada pasada 24-25?",
    answers: ["53", "67", "59"] as [string, string, string],
    correctIndex: 0,
  },
  {
    prompt: "¿Cuántos vehículos componen hoy la flota Delver?",
    answers: ["9", "16", "24"] as [string, string, string],
    correctIndex: 1,
  },
  {
    prompt: "¿Cuántos documentos lleva procesado One Flow?",
    answers: ["2451", "6935", "más de 8 mil"] as [string, string, string],
    correctIndex: 2,
  },
  {
    prompt: "¿Qué significa el reporte ZDR para One Flow?",
    answers: ["Zone Dispatch Review", "Zero Discrepancy Report", "Zonal Delay Registry"] as [string, string, string],
    correctIndex: 1,
  },
  {
    prompt: "¿A cuántos días del ETD se emite el ZDR REPORT?",
    answers: ["14 días", "21 días", "30 días"] as [string, string, string],
    correctIndex: 1,
  },
  {
    prompt: "¿A cuántos días del ETD se emite el GAP REPORT?",
    answers: ["7 días", "14 días", "21 días"] as [string, string, string],
    correctIndex: 0,
  },
  {
    prompt: "¿Cuál es el mes de la temporada con más recaladas concurrentes?",
    answers: ["Diciembre", "Enero", "Febrero"] as [string, string, string],
    correctIndex: 1,
  },
  {
    prompt: "Del total del Mercado Antártico Mundial, ¿qué porcentaje aprox tiene Ushuaia como puerto?",
    answers: ["71%", "78%", "86%"] as [string, string, string],
    correctIndex: 2,
  },
  {
    prompt: "¿Cuántas noches de hotel gestionó Crewing en la temporada 25-26?",
    answers: ["4710", "2920", "5620"] as [string, string, string],
    correctIndex: 0,
  },
  {
    prompt: "¿Cuál es el buque que tuvo mayor volumen de facturación?",
    answers: ["Scenic Eclipse", "Fridtjof Nansen", "Roald Amundsen"] as [string, string, string],
    correctIndex: 0,
  },
  {
    prompt: "¿Cuántos servicios promedio solicita un buque en una recalada?",
    answers: ["44", "18", "32"] as [string, string, string],
    correctIndex: 0,
  },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

function hexToRgb(hex: string) {
  if (hex.startsWith("rgb")) {
    const channels = hex.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
    return {
      r: channels[0] ?? 0,
      g: channels[1] ?? 0,
      b: channels[2] ?? 0,
    };
  }
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function mixColor(from: string, to: string, amount: number) {
  const t = clamp(amount, 0, 1);
  const source = hexToRgb(from);
  const target = hexToRgb(to);
  const r = Math.round(source.r + (target.r - source.r) * t);
  const g = Math.round(source.g + (target.g - source.g) * t);
  const b = Math.round(source.b + (target.b - source.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function getDayNightScene(dayNightTime: number) {
  const progress = (((dayNightTime % DAY_NIGHT_CYCLE_MS) + DAY_NIGHT_CYCLE_MS) % DAY_NIGHT_CYCLE_MS) / DAY_NIGHT_CYCLE_MS;
  const daylight = (Math.cos(progress * Math.PI * 2) + 1) / 2;
  const twilight = Math.sin(progress * Math.PI * 2) ** 2;
  const nightAmount = 1 - daylight;
  const dayTravel = clamp(progress / 0.5, 0, 1);
  const nightTravel = clamp((progress - 0.5) / 0.5, 0, 1);
  const twilightBlend = twilight * 0.68;
  const sunX = 304 - dayTravel * 156;
  const sunY = 14 + dayTravel * 66;
  const moonX = 308 - nightTravel * 212;
  const moonY = 80 - Math.sin(nightTravel * Math.PI) * 58;

  const blendSceneColor = (dayColor: string, twilightColor: string, nightColor: string) =>
    mixColor(mixColor(nightColor, dayColor, daylight), twilightColor, twilightBlend);

  return {
    skyTop: blendSceneColor(COLORS.skyTop, TWILIGHT_COLORS.skyTop, NIGHT_COLORS.skyTop),
    skyMid: blendSceneColor(COLORS.skyMid, TWILIGHT_COLORS.skyMid, NIGHT_COLORS.skyMid),
    skyLow: blendSceneColor(COLORS.skyLow, TWILIGHT_COLORS.skyLow, NIGHT_COLORS.skyLow),
    horizon: blendSceneColor("#dcefff", TWILIGHT_COLORS.horizon, NIGHT_COLORS.horizon),
    cloud: blendSceneColor(COLORS.cloud, TWILIGHT_COLORS.cloud, NIGHT_COLORS.cloud),
    mountainBack: blendSceneColor(COLORS.mountainBack, TWILIGHT_COLORS.mountainBack, NIGHT_COLORS.mountainBack),
    mountainMid: blendSceneColor(COLORS.mountainMid, TWILIGHT_COLORS.mountainMid, NIGHT_COLORS.mountainMid),
    mountainFront: blendSceneColor(COLORS.mountainFront, TWILIGHT_COLORS.mountainFront, NIGHT_COLORS.mountainFront),
    snow: blendSceneColor(COLORS.snow, TWILIGHT_COLORS.snow, NIGHT_COLORS.snow),
    bayTop: blendSceneColor(COLORS.bayTop, TWILIGHT_COLORS.bayTop, NIGHT_COLORS.bayTop),
    bayLow: blendSceneColor(COLORS.bayLow, TWILIGHT_COLORS.bayLow, NIGHT_COLORS.bayLow),
    sunX,
    sunY,
    sunVisible: progress < 0.5 && sunY < 80,
    moonX,
    moonY,
    moonVisible: progress >= 0.5 && moonY < 80,
    starAlpha: clamp((nightAmount - 0.12) / 0.52, 0, 1),
    sceneShade: clamp(nightAmount * 0.1 + twilight * 0.01, 0, 0.11),
    twilightGlow: clamp(twilight * (1 - nightAmount * 0.35) * 0.18, 0, 0.18),
    lampGlow: clamp(nightAmount * 0.32, 0, 0.32),
  };
}

function getCharacterName(characterId: string) {
  return CHARACTERS.find((character) => character.id === characterId)?.name ?? characterId;
}

function createQuizOrder() {
  const order = QUIZ_QUESTIONS.map((_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [order[index], order[swapIndex]] = [order[swapIndex]!, order[index]!];
  }
  return order;
}

function getNextStarDistance(distance: number) {
  return distance + 240 + Math.random() * 140;
}

function createInitialState(): GameState {
  return {
    phase: "ready",
    speed: START_SPEED,
    distance: 0,
    bestDistance: 0,
    score: 0,
    worldTime: 0,
    dayNightTime: 0,
    nextObstacleDistance: 100,
    nextStarDistance: getNextStarDistance(0),
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
    activeQuiz: null,
    quizOrder: createQuizOrder(),
    nextQuizQuestionIndex: 0,
    scorePopups: [],
    quizFeedback: null,
  };
}

function obstaclePool(distance: number): Array<Omit<Obstacle, "x" | "bob" | "baseY" | "collected">> {
  const pool: Array<Omit<Obstacle, "x" | "bob" | "baseY" | "collected">> = [
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
      baseY: GROUND_Y - 36,
      w: 120,
      h: 36,
      bob: 0,
    };
  }
  const base = pick(obstaclePool(distance));
  const resolvedY = base.type === "suitcase" ? pick([...SUITCASE_FLYING_YPOS]) : base.y;
  return {
    ...base,
    x: W + 20,
    y: resolvedY,
    baseY: resolvedY,
    bob: Math.random() * Math.PI * 2,
  };
}

function createQuizStar(): Obstacle {
  const baseY = pick([...QUIZ_STAR_YPOS]);
  return {
    type: "quizStar",
    x: W + 28,
    y: baseY,
    baseY,
    w: QUIZ_STAR_SIZE,
    h: QUIZ_STAR_SIZE,
    bob: Math.random() * Math.PI * 2,
  };
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
    quizStar: 190,
  };
  const scaledBaseMinGap = baseMinGapMap[obstacle.type] * (W / DINO_DEFAULT_WIDTH);
  const minGap = Math.round(obstacle.w * speed + scaledBaseMinGap * DINO_GAP_COEFFICIENT);
  const maxGap = Math.round(minGap * DINO_MAX_GAP_COEFFICIENT);
  return minGap + Math.random() * (maxGap - minGap);
}

function getAnimatedObstacleY(obstacle: Obstacle, worldTime: number) {
  if (obstacle.type === "suitcase") {
    return obstacle.baseY + Math.round(Math.sin(worldTime * 0.01 + obstacle.bob) * 1);
  }
  if (obstacle.type === "quizStar") {
    const hop = Math.abs(Math.sin(worldTime * 0.015 + obstacle.bob));
    return obstacle.baseY - Math.round(hop * 8);
  }
  return obstacle.baseY;
}

function getObstacleHitbox(obstacle: Obstacle, worldTime = 0) {
  const y = getAnimatedObstacleY(obstacle, worldTime);
  switch (obstacle.type) {
    case "prefectura":
      return { x: obstacle.x + 3, y: y + 2, w: 8, h: 23 };
    case "etios":
      return { x: obstacle.x + 1, y: y + 3, w: 31, h: 12 };
    case "barrels":
      return { x: obstacle.x + 2, y: y + 1, w: 10, h: 16 };
    case "forklift":
      return { x: obstacle.x + 1, y: y + 2, w: 28, h: 18 };
    case "container":
      return { x: obstacle.x + 1, y: y + 1, w: 28, h: 21 };
    case "suitcase":
      return { x: obstacle.x + 1, y: y + 2, w: 14, h: 18 };
    case "ypfTruck":
      return { x: obstacle.x + 2, y: y + 10, w: 116, h: 24 };
    case "quizStar":
      return { x: obstacle.x + 4, y: y + 3, w: obstacle.w - 8, h: obstacle.h - 8 };
  }
}

function getPlayerMetrics(player: PlayerState) {
  const airborne = player.rise > 0.1;
  const ducking = player.ducking && !airborne;
  const width = ducking ? 22 : 16;
  const height = ducking ? PLAYER_DUCK_HEIGHT : PLAYER_STAND_HEIGHT;
  const top = GROUND_Y - height - player.rise;
  return { airborne, ducking, width, height, top };
}

function collides(player: PlayerState, obstacle: Obstacle, worldTime: number): boolean {
  const metrics = getPlayerMetrics(player);
  const p = { x: player.x + 2, y: metrics.top + 2, w: metrics.width - 4, h: metrics.height - 3 };
  const o = getObstacleHitbox(obstacle, worldTime);
  return p.x < o.x + o.w && p.x + p.w > o.x && p.y < o.y + o.h && p.y + p.h > o.y;
}

function createScorePopup(text: string, color: string): ScorePopup {
  return {
    x: W / 2,
    y: 74,
    vy: -0.32,
    life: 1150,
    text,
    color,
  };
}

function updateScorePopups(scorePopups: ScorePopup[], elapsedMs: number, dt: number) {
  for (const popup of scorePopups) {
    popup.y += popup.vy * dt;
    popup.life -= elapsedMs;
  }
  return scorePopups.filter((popup) => popup.life > 0);
}

function getTruckPlatform(obstacle: Obstacle) {
  return { x: obstacle.x + 14, y: obstacle.baseY + 1, w: 84, h: 4 };
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

function makeConfettiParticle(x: number, y: number, color: string): Particle {
  return {
    x,
    y,
    vx: (Math.random() - 0.5) * 2.8,
    vy: -(1.8 + Math.random() * 1.7),
    life: 420 + Math.random() * 220,
    size: 2 + Math.floor(Math.random() * 2),
    color,
    gravity: 0.16,
  };
}

function createQuizFeedback(outcome: QuizOutcome): QuizFeedback {
  if (outcome === "correct") {
    return {
      title: "CORRECTO!",
      pointsText: "+5000 puntos",
      color: "#22c55e",
      glow: "rgba(34, 197, 94, 0.35)",
      life: QUIZ_FEEDBACK_DURATION_MS,
      totalLife: QUIZ_FEEDBACK_DURATION_MS,
    };
  }

  if (outcome === "incorrect") {
    return {
      title: "INCORRECTO",
      pointsText: "-2500 puntos",
      color: "#fb7185",
      glow: "rgba(251, 113, 133, 0.34)",
      life: QUIZ_FEEDBACK_DURATION_MS,
      totalLife: QUIZ_FEEDBACK_DURATION_MS,
    };
  }

  return {
    title: "TIEMPO!",
    pointsText: "-5000 puntos",
    color: "#f97316",
    glow: "rgba(249, 115, 22, 0.34)",
    life: QUIZ_FEEDBACK_DURATION_MS,
    totalLife: QUIZ_FEEDBACK_DURATION_MS,
  };
}

function updateQuizFeedback(quizFeedback: QuizFeedback | null, elapsedMs: number) {
  if (!quizFeedback) return null;
  quizFeedback.life -= elapsedMs;
  return quizFeedback.life > 0 ? quizFeedback : null;
}

function launchQuizConfetti(state: GameState, title: string) {
  const letterWidth = 7;
  const startX = W / 2 - (title.length * letterWidth) / 2;
  const baseY = 54;

  for (let index = 0; index < title.length; index += 1) {
    const char = title[index];
    if (!char || char === " ") continue;
    const x = startX + index * letterWidth + letterWidth / 2;
    state.particles.push(makeConfettiParticle(x - 1, baseY, pick([...QUIZ_CONFETTI_COLORS])));
    state.particles.push(makeConfettiParticle(x + 1, baseY - 1, pick([...QUIZ_CONFETTI_COLORS])));
  }
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

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1, color: string = COLORS.cloud) {
  const s = scale;
  drawRect(ctx, x, y + 2 * s, 14 * s, 4 * s, color);
  drawRect(ctx, x + 2 * s, y, 8 * s, 6 * s, color);
  drawRect(ctx, x + 8 * s, y + 1 * s, 8 * s, 5 * s, color);
}

function drawSun(ctx: CanvasRenderingContext2D, x = 290, y = 14) {
  drawRect(ctx, x, y, 16, 16, COLORS.sun);
  drawRect(ctx, x + 6, y - 8, 4, 4, COLORS.sun);
  drawRect(ctx, x + 6, y + 20, 4, 4, COLORS.sun);
  drawRect(ctx, x - 8, y + 6, 4, 4, COLORS.sun);
  drawRect(ctx, x + 20, y + 6, 4, 4, COLORS.sun);
}

function drawMoon(ctx: CanvasRenderingContext2D, x = 290, y = 14, skyColor: string) {
  const moonShadow = mixColor(skyColor, NIGHT_COLORS.skyTop, 0.72);
  const bodyRows = [
    [7, 4],
    [5, 8],
    [4, 10],
    [3, 11],
    [2, 12],
    [2, 12],
    [2, 12],
    [2, 12],
    [3, 11],
    [4, 10],
    [5, 8],
    [7, 4],
  ] as const;
  bodyRows.forEach(([offsetX, width], index) => {
    drawRect(ctx, x + offsetX, y + index, width, 1, NIGHT_COLORS.moon);
  });
  const shadowRows = [
    [8, 3],
    [8, 5],
    [8, 6],
    [7, 7],
    [7, 7],
    [7, 7],
    [7, 7],
    [7, 7],
    [7, 7],
    [8, 6],
    [8, 5],
    [8, 3],
  ] as const;
  shadowRows.forEach(([offsetX, width], index) => {
    drawRect(ctx, x + offsetX, y + index, width, 1, moonShadow);
  });
  const carveRows = [
    [9, 2],
    [9, 3],
    [9, 4],
    [8, 5],
    [8, 5],
    [8, 5],
    [8, 5],
    [8, 5],
    [8, 5],
    [9, 4],
    [9, 3],
    [9, 2],
  ] as const;
  carveRows.forEach(([offsetX, width], index) => {
    drawRect(ctx, x + offsetX, y + index, width, 1, skyColor);
  });
  drawRect(ctx, x + 4, y + 3, 1, 4, "rgba(255, 255, 255, 0.85)");
  drawRect(ctx, x + 5, y + 2, 1, 7, "rgba(255, 255, 255, 0.55)");
}

function drawStars(ctx: CanvasRenderingContext2D, alpha: number) {
  if (alpha <= 0) return;
  const glow = 0.24 + alpha * 0.76;
  STAR_FIELD.forEach(([x, y, size]) => {
    drawRect(ctx, x, y, size, size, `rgba(248, 250, 252, ${glow})`);
  });
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

function drawUshuaiaMountainProfiles(
  ctx: CanvasRenderingContext2D,
  palette: Pick<ReturnType<typeof getDayNightScene>, "mountainBack" | "mountainMid" | "mountainFront" | "snow">
) {
  drawPoly(ctx, [[0,106],[0,96],[22,96],[38,88],[52,72],[58,46],[62,36],[66,48],[74,70],[88,88],[110,97],[138,96],[156,84],[176,72],[192,60],[204,56],[220,68],[238,86],[258,97],[282,94],[302,78],[320,70],[340,68],[360,72],[360,106]], palette.mountainBack);
  drawPoly(ctx, [[0,108],[0,102],[28,101],[46,94],[58,76],[64,58],[68,52],[72,62],[84,86],[96,96],[122,104],[156,103],[176,92],[194,82],[206,72],[216,74],[232,86],[248,98],[280,104],[310,102],[330,94],[348,92],[360,94],[360,108]], palette.mountainMid);
  drawPoly(ctx, [[0,112],[0,108],[36,108],[60,104],[84,100],[114,103],[150,108],[200,107],[236,103],[274,104],[316,110],[360,112],[360,114],[0,114]], palette.mountainFront);
  drawPoly(ctx, [[56,52],[60,46],[63,40],[66,48],[69,56],[64,54],[61,58]], palette.snow);
  drawPoly(ctx, [[174,78],[188,68],[200,62],[210,70],[194,74],[182,82]], palette.snow);
  drawPoly(ctx, [[302,95],[314,89],[326,86],[336,90],[322,92],[308,98]], palette.snow);
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

function drawHorizonWaterAndShips(
  ctx: CanvasRenderingContext2D,
  palette: Pick<ReturnType<typeof getDayNightScene>, "bayTop" | "bayLow">
) {
  drawRect(ctx, 0, 114, W, 12, palette.bayTop);
  drawRect(ctx, 0, 126, W, 4, palette.bayLow);
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

function drawPierScene(ctx: CanvasRenderingContext2D, worldTime: number, lampGlow: number) {
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
    if (lampGlow > 0.02) {
      const glowX = i * 110 + 76 - streetOffset - 7;
      drawRect(ctx, glowX, 94, 17, 10, `rgba(248, 210, 59, ${lampGlow})`);
      drawRect(ctx, glowX + 6, 96, 3, 4, COLORS.mastLight);
    }
  }
  for (let i = 0; i < 7; i += 1) {
    const x = i * 52 + 12 - (worldTime * 0.025) % 52;
    drawRect(ctx, x, 140, 4, 4, COLORS.safetyYellow);
    drawRect(ctx, x + 1, 137, 2, 3, COLORS.bollard);
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, worldTime: number, dayNightTime: number) {
  const scene = getDayNightScene(dayNightTime);
  drawRect(ctx, 0, 0, W, 34, scene.skyTop);
  drawRect(ctx, 0, 34, W, 34, scene.skyMid);
  drawRect(ctx, 0, 68, W, 18, scene.skyLow);
  drawRect(ctx, 0, 86, W, 28, scene.horizon);
  drawStars(ctx, scene.starAlpha);
  if (scene.sunVisible) drawSun(ctx, scene.sunX, scene.sunY);
  if (scene.moonVisible) drawMoon(ctx, scene.moonX, scene.moonY, scene.skyMid);
  drawCloud(ctx, 18 - (worldTime * 0.006) % 420, 18, 1, scene.cloud);
  drawCloud(ctx, 110 - (worldTime * 0.004) % 440, 21, 2, scene.cloud);
  drawCloud(ctx, 262 - (worldTime * 0.005) % 460, 26, 1, scene.cloud);
  if (scene.twilightGlow > 0.01) {
    drawRect(ctx, 0, 60, W, 44, `rgba(255, 148, 94, ${scene.twilightGlow})`);
  }
  drawUshuaiaMountainProfiles(ctx, scene);
  drawHorizonWaterAndShips(ctx, scene);
  drawPierScene(ctx, worldTime, scene.lampGlow);
  if (scene.sceneShade > 0.01) {
    drawRect(ctx, 0, 0, W, H, `rgba(4, 10, 28, ${scene.sceneShade})`);
  }
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

function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha = 1) {
  const previousAlpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  drawRect(ctx, x + size, y, size, size * 3, "#fffbea");
  drawRect(ctx, x, y + size, size * 3, size, "#fffbea");
  drawRect(ctx, x + size, y + size, size, size, "#ffe27a");
  ctx.globalAlpha = previousAlpha;
}

function drawQuizStar(ctx: CanvasRenderingContext2D, obstacle: Obstacle, worldTime: number) {
  const x = obstacle.x;
  const y = getAnimatedObstacleY(obstacle, worldTime);
  const scale = obstacle.w / QUIZ_STAR_SIZE;
  const px = (value: number) => Math.round(value * scale);
  const drift = Math.sin(worldTime * 0.014 + obstacle.bob) * 1.6;
  const starY = y + drift;
  const toPoints = (points: Array<[number, number]>): Array<[number, number]> =>
    points.map(([pointX, pointY]) => [x + px(pointX), starY + px(pointY)]);
  const outline = toPoints([[16, 1], [20, 10], [30, 11], [23, 18], [26, 30], [16, 24], [6, 30], [9, 18], [2, 11], [12, 10]]);
  const border = toPoints([[16, 3], [19, 10], [28, 11], [22, 18], [24, 28], [16, 22], [8, 28], [10, 18], [4, 11], [13, 10]]);
  const fill = toPoints([[16, 4], [19, 11], [27, 12], [21, 18], [23, 27], [16, 22], [9, 27], [11, 18], [5, 12], [13, 11]]);
  const glow = toPoints([[16, 6], [18, 11], [24, 13], [20, 18], [21, 23], [16, 20], [11, 23], [12, 18], [8, 13], [14, 11]]);
  const topGloss = toPoints([[8, 9], [12, 7], [16, 7], [13, 10], [9, 11]]);
  const sideGloss = toPoints([[7, 18], [9, 15], [10, 16], [9, 22], [7, 25], [6, 22]]);
  const lowerShade = toPoints([[16, 20], [21, 23], [20, 26], [16, 24], [12, 26], [11, 23]]);
  const trail = [0.18, 0.12, 0.08, 0.05];

  for (let i = 0; i < trail.length; i += 1) {
    const alpha = trail[i]!;
    drawSparkle(
      ctx,
      x + px(13 + i * 2.4),
      y + px(10) + Math.sin(worldTime * 0.02 + obstacle.bob + i) * 2,
      Math.max(1, px(1 + i * 0.35)),
      alpha
    );
  }

  drawPoly(ctx, outline, 'rgba(7, 10, 28, 0.88)');
  drawPoly(ctx, border, '#ffca05');
  drawPoly(ctx, fill, '#fff200');
  drawPoly(ctx, glow, 'rgba(255, 250, 210, 0.92)');
  drawPoly(ctx, topGloss, 'rgba(255, 255, 255, 0.9)');
  drawPoly(ctx, sideGloss, 'rgba(255, 255, 255, 0.62)');
  drawPoly(ctx, lowerShade, 'rgba(248, 190, 10, 0.72)');
  drawRect(ctx, x + px(11), starY + px(12), px(3), px(6), '#141414');
  drawRect(ctx, x + px(18), starY + px(12), px(3), px(6), '#141414');
  drawRect(ctx, x + px(12), starY + px(13), px(1), px(2), '#fffbea');
  drawRect(ctx, x + px(19), starY + px(13), px(1), px(2), '#fffbea');
  drawRect(ctx, x + px(7), starY + px(9), px(7), px(1), 'rgba(255,255,255,0.7)');
  drawSparkle(ctx, x + px(8), starY + px(5), Math.max(1, px(1)), 0.92);
  drawSparkle(ctx, x + px(5), starY + px(20), Math.max(1, px(1)), 0.78);
  drawSparkle(ctx, x + px(24), starY + px(17), Math.max(1, px(1)), 0.82);
}

function drawObstacle(ctx: CanvasRenderingContext2D, obstacle: Obstacle, worldTime: number) {
  const x = obstacle.x;
  const y = getAnimatedObstacleY(obstacle, worldTime);
  if (obstacle.type === "quizStar") drawQuizStar(ctx, obstacle, worldTime);
  else if (obstacle.type === "prefectura") drawPrefectura(ctx, x, y);
  else if (obstacle.type === "etios") drawEtios(ctx, x, y);
  else if (obstacle.type === "barrels") drawBarrels(ctx, x, y);
  else if (obstacle.type === "container") drawContainer(ctx, x, y);
  else if (obstacle.type === "forklift") drawForklift(ctx, x, y);
  else if (obstacle.type === "ypfTruck") drawYpfTruck(ctx, x, y);
  else drawSuitcase(ctx, x, y);
}

function drawParticle(ctx: CanvasRenderingContext2D, particle: Particle) {
  drawRect(ctx, particle.x, particle.y, particle.size, particle.size, particle.color ?? COLORS.pierShade);
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
  const eyeBlue = "#4166d5";

  if (phase === "run-0") {
    p(2,2,2,1,hair2); p(4,1,5,1,hair); p(9,2,2,1,hair2); p(3,2,7,1,hair3); p(2,3,9,1,hair3); p(2,4,9,4,hair);
    p(3,4,7,5,skin); p(2,5,1,2,skin); p(10,5,1,2,skin); p(4,5,2,1,COLORS.white); p(7,5,2,1,COLORS.white); p(5,6,1,blink ? 1 : 2,eyeBlue); p(8,6,1,blink ? 1 : 2,eyeBlue); p(4,8,5,2,beard); p(6,7,1,1,skinShade); p(6,9,2,1,"#b87978");
    p(3,10,10,5,COLORS.shirt); p(4,10,1,1,COLORS.white); p(8,11,1,3,COLORS.white); p(6,12,4,1,COLORS.white); p(2,11,2,4,skin); p(11,11,2,4,skin); p(3,15,10,2,COLORS.shirt2);
    p(4,15,2,6,COLORS.pants); p(7,15,2,4,COLORS.pants); p(8,19,2,4,COLORS.pants); p(2,17,2,3,COLORS.pants); p(2,20,4,2,COLORS.shoe); p(7,22,4,2,COLORS.shoe); p(1,22,2,1,COLORS.shoeDark); p(9,23,2,1,COLORS.shoeDark); p(5,17,1,4,COLORS.pants2); p(7,18,1,5,COLORS.pants2);
  } else if (phase === "run-1") {
    p(2,2,2,1,hair2); p(4,1,5,1,hair); p(9,2,2,1,hair2); p(3,2,7,1,hair3); p(2,3,9,1,hair3); p(2,4,9,4,hair);
    p(3,4,7,5,skin); p(2,5,1,2,skin); p(10,5,1,2,skin); p(4,5,2,1,COLORS.white); p(7,5,2,1,COLORS.white); p(5,6,1,blink ? 1 : 2,eyeBlue); p(8,6,1,blink ? 1 : 2,eyeBlue); p(4,8,5,2,beard); p(6,7,1,1,skinShade); p(6,9,2,1,"#b87978");
    p(3,10,10,5,COLORS.shirt); p(4,10,1,1,COLORS.white); p(8,11,1,3,COLORS.white); p(6,12,4,1,COLORS.white); p(1,12,2,4,skin); p(11,10,2,4,skin); p(3,15,10,2,COLORS.shirt2);
    p(7,15,2,6,COLORS.pants); p(4,15,2,4,COLORS.pants); p(3,19,2,4,COLORS.pants); p(8,17,2,3,COLORS.pants); p(2,22,4,2,COLORS.shoe); p(7,20,4,2,COLORS.shoe); p(2,23,2,1,COLORS.shoeDark); p(9,21,2,1,COLORS.shoeDark); p(7,17,1,4,COLORS.pants2); p(4,18,1,5,COLORS.pants2);
  } else if (phase === "jump") {
    p(2,2,2,1,hair2); p(4,1,5,1,hair); p(9,2,2,1,hair2); p(3,2,7,1,hair3); p(2,3,9,1,hair3); p(2,4,9,4,hair);
    p(3,4,7,5,skin); p(2,5,1,2,skin); p(10,5,1,2,skin); p(4,5,2,1,COLORS.white); p(7,5,2,1,COLORS.white); p(5,6,1,blink ? 1 : 2,eyeBlue); p(8,6,1,blink ? 1 : 2,eyeBlue); p(4,8,5,2,beard); p(6,7,1,1,skinShade); p(6,9,2,1,"#b87978");
    p(3,10,10,5,COLORS.shirt); p(4,10,1,1,COLORS.white); p(8,11,1,3,COLORS.white); p(6,12,4,1,COLORS.white); p(1,11,2,4,skin); p(11,11,2,4,skin); p(3,15,10,2,COLORS.shirt2);
    p(4,16,2,4,COLORS.pants); p(7,16,2,4,COLORS.pants); p(3,18,3,2,COLORS.pants2); p(7,18,3,2,COLORS.pants2); p(2,20,4,2,COLORS.shoe); p(7,20,4,2,COLORS.shoe); p(2,21,2,1,COLORS.shoeDark); p(9,21,2,1,COLORS.shoeDark);
  } else if (phase === "duck-0") {
    p(3,5,7,1,hair3); p(2,6,9,1,hair3); p(2,7,9,4,hair); p(3,7,2,1,hair2); p(8,7,2,1,hair2); p(3,7,7,4,skin); p(4,8,2,1,COLORS.white); p(7,8,2,1,COLORS.white); p(5,9,1,1,eyeBlue); p(8,9,1,1,eyeBlue); p(5,10,4,2,beard); p(6,10,1,1,skinShade);
    p(5,12,12,3,COLORS.shirt); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,4,1,COLORS.white); p(2,13,3,2,skin); p(14,13,3,2,skin); p(7,15,10,2,COLORS.pants); p(4,16,6,2,COLORS.shoe); p(12,16,6,2,COLORS.shoe); p(4,17,2,1,COLORS.shoeDark); p(16,17,2,1,COLORS.shoeDark);
  } else {
    p(3,5,7,1,hair3); p(2,6,9,1,hair3); p(2,7,9,4,hair); p(3,7,2,1,hair2); p(8,7,2,1,hair2); p(3,7,7,4,skin); p(4,8,2,1,COLORS.white); p(7,8,2,1,COLORS.white); p(5,9,1,1,eyeBlue); p(8,9,1,1,eyeBlue); p(5,10,4,2,beard); p(6,10,1,1,skinShade);
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
  const eyeBlue = "#4166d5";

  if (phase === "run-0") {
    p(1,1,2,1,hairGold); p(2,1,3,2,hairGold); p(8,1,3,2,hairGold); p(10,2,2,1,hairGold); p(11,1,1,1,hairGold); p(0,4,3,2,hairCopper); p(10,4,3,2,hairCopper); p(1,6,2,4,hairCopper); p(10,6,2,4,hairCopper); p(3,1,8,1,hairCopper); p(2,2,10,1,hairCopper); p(1,3,12,7,hairShadow);
    p(2,4,10,4,hairCopper); p(3,4,8,5,COLORS.skin); p(4,3,7,2,hairGold); p(3,6,2,2,COLORS.skin); p(9,6,2,2,COLORS.skin); p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink ? 1 : 2,eyeBlue); p(9,6,1,blink ? 1 : 2,eyeBlue); p(6,8,1,1,COLORS.skinShade); p(5,8,5,1,cheek); p(7,9,2,1,"#bf7b70");
    p(4,10,8,5,COLORS.shirt); p(3,11,2,4,COLORS.skin); p(10,11,2,4,COLORS.skin); p(11,12,2,3,COLORS.skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white);
    p(5,15,6,2,COLORS.shirt2); p(5,15,2,6,COLORS.pants); p(8,15,2,4,COLORS.pants); p(9,19,2,4,COLORS.pants); p(3,17,2,3,COLORS.pants); p(2,20,4,2,COLORS.shoe); p(8,22,4,2,COLORS.shoe); p(1,22,2,1,COLORS.shoeDark); p(10,23,2,1,COLORS.shoeDark); p(6,17,1,4,COLORS.pants2); p(8,18,1,5,COLORS.pants2);
  } else if (phase === "run-1") {
    p(1,2,2,1,hairGold); p(2,1,3,2,hairGold); p(8,1,3,2,hairGold); p(10,1,2,1,hairGold); p(0,4,3,2,hairCopper); p(10,4,3,2,hairCopper); p(0,6,2,4,hairCopper); p(10,6,2,4,hairCopper); p(3,1,8,1,hairCopper); p(2,2,10,1,hairCopper); p(1,3,12,7,hairShadow);
    p(2,4,10,4,hairCopper); p(3,4,8,5,COLORS.skin); p(4,3,7,2,hairGold); p(3,6,2,2,COLORS.skin); p(9,6,2,2,COLORS.skin); p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink ? 1 : 2,eyeBlue); p(9,6,1,blink ? 1 : 2,eyeBlue); p(6,8,1,1,COLORS.skinShade); p(5,8,5,1,cheek); p(7,9,2,1,"#bf7b70");
    p(4,10,8,5,COLORS.shirt); p(2,12,2,4,COLORS.skin); p(10,10,2,4,COLORS.skin); p(11,12,2,2,COLORS.skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white); p(5,15,6,2,COLORS.shirt2); p(8,15,2,6,COLORS.pants); p(5,15,2,4,COLORS.pants); p(4,19,2,4,COLORS.pants); p(9,17,2,3,COLORS.pants); p(3,22,4,2,COLORS.shoe); p(8,20,4,2,COLORS.shoe); p(3,23,2,1,COLORS.shoeDark); p(10,21,2,1,COLORS.shoeDark); p(8,17,1,4,COLORS.pants2); p(5,18,1,5,COLORS.pants2);
  } else if (phase === "jump") {
    p(1,2,2,1,hairGold); p(2,2,3,2,hairGold); p(8,2,3,2,hairGold); p(10,3,2,1,hairGold); p(0,5,3,2,hairCopper); p(10,5,3,2,hairCopper); p(0,7,2,4,hairCopper); p(10,7,2,4,hairCopper); p(3,1,8,1,hairCopper); p(2,2,10,1,hairCopper); p(1,3,12,7,hairShadow);
    p(2,4,10,4,hairCopper); p(3,4,8,5,COLORS.skin); p(4,3,7,2,hairGold); p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink ? 1 : 2,eyeBlue); p(9,6,1,blink ? 1 : 2,eyeBlue); p(6,8,1,1,COLORS.skinShade); p(5,8,5,1,cheek); p(7,9,2,1,"#bf7b70"); p(4,10,8,5,COLORS.shirt); p(2,11,2,4,COLORS.skin); p(10,11,2,4,COLORS.skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white); p(5,15,6,2,COLORS.shirt2); p(5,16,2,4,COLORS.pants); p(8,16,2,4,COLORS.pants); p(4,18,3,2,COLORS.pants2); p(8,18,3,2,COLORS.pants2); p(3,20,4,2,COLORS.shoe); p(8,20,4,2,COLORS.shoe); p(3,21,2,1,COLORS.shoeDark); p(10,21,2,1,COLORS.shoeDark);
  } else if (phase === "duck-0") {
    p(2,6,4,2,hairGold); p(10,6,4,2,hairGold); p(0,8,4,2,hairCopper); p(12,8,4,2,hairCopper); p(1,10,2,3,hairCopper); p(13,10,2,3,hairCopper); p(4,5,8,1,hairCopper); p(3,6,10,1,hairCopper); p(2,7,12,6,hairShadow); p(3,8,10,4,hairCopper); p(4,8,8,4,COLORS.skin); p(5,7,7,2,hairGold); p(5,9,3,2,COLORS.white); p(9,9,3,2,COLORS.white); p(8,9,1,1,COLORS.white); p(6,10,1,1,eyeBlue); p(10,10,1,1,eyeBlue); p(7,11,1,1,COLORS.skinShade); p(6,11,5,1,cheek); p(8,11,2,1,"#bf7b70"); p(6,12,10,3,COLORS.shirt); p(3,13,3,2,COLORS.skin); p(13,13,3,2,COLORS.skin); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,3,1,COLORS.white); p(7,15,9,2,COLORS.pants); p(4,16,6,2,COLORS.shoe); p(12,16,6,2,COLORS.shoe); p(4,17,2,1,COLORS.shoeDark); p(16,17,2,1,COLORS.shoeDark);
  } else {
    p(2,6,4,2,hairGold); p(10,6,4,2,hairGold); p(1,8,4,2,hairCopper); p(11,8,4,2,hairCopper); p(1,10,2,3,hairCopper); p(13,10,2,3,hairCopper); p(4,5,8,1,hairCopper); p(3,6,10,1,hairCopper); p(2,7,12,6,hairShadow); p(3,8,10,4,hairCopper); p(4,8,8,4,COLORS.skin); p(5,7,7,2,hairGold); p(5,9,3,2,COLORS.white); p(9,9,3,2,COLORS.white); p(8,9,1,1,COLORS.white); p(6,10,1,1,eyeBlue); p(10,10,1,1,eyeBlue); p(7,11,1,1,COLORS.skinShade); p(6,11,5,1,cheek); p(8,11,2,1,"#bf7b70"); p(6,12,10,3,COLORS.shirt); p(2,13,3,2,COLORS.skin); p(13,12,3,2,COLORS.skin); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,3,1,COLORS.white); p(7,15,9,2,COLORS.pants); p(5,16,6,2,COLORS.shoe); p(12,15,6,2,COLORS.shoe); p(5,17,2,1,COLORS.shoeDark); p(16,16,2,1,COLORS.shoeDark);
  }
}

function drawJime(ctx: CanvasRenderingContext2D, player: PlayerState, worldTime: number) {
  const baseX = player.x;
  const { top, phase } = getRunnerPhase(player, worldTime);
  const blink = Math.floor(worldTime / 1400) % 9 === 0 && !player.dead;
  const p = (x: number, y: number, w = 1, h = 1, color: string = COLORS.ink) =>
    drawRect(ctx, baseX + x, top + y, w, h, color);
  const hairDark = "#1f1819";
  const hairMid = "#2f2528";
  const hairLight = "#4a3e42";
  const hairShine = "#695c61";
  const mouth = "#b87978";

  if (phase === "run-0") {
    p(1,1,2,1,hairShine); p(2,1,3,2,hairShine); p(8,1,3,2,hairShine); p(10,2,2,1,hairShine); p(0,4,3,2,hairMid); p(10,4,3,2,hairMid); p(1,6,2,4,hairDark); p(10,6,2,4,hairDark); p(3,1,8,1,hairMid); p(2,2,10,1,hairMid); p(1,3,12,7,hairDark);
    p(2,4,10,4,hairDark); p(3,4,8,5,COLORS.skin); p(4,3,7,2,hairLight); p(3,6,2,2,COLORS.skin); p(9,6,2,2,COLORS.skin);
    p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(9,6,1,blink ? 1 : 2,COLORS.ink); p(6,8,1,1,COLORS.skinShade); p(6,9,2,1,mouth);
    p(4,10,8,5,COLORS.shirt); p(3,11,2,4,COLORS.skin); p(10,11,2,4,COLORS.skin); p(11,12,2,3,COLORS.skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white);
    p(5,15,6,2,COLORS.shirt2); p(5,15,2,6,COLORS.pants); p(8,15,2,4,COLORS.pants); p(9,19,2,4,COLORS.pants); p(3,17,2,3,COLORS.pants); p(2,20,4,2,COLORS.shoe); p(8,22,4,2,COLORS.shoe); p(1,22,2,1,COLORS.shoeDark); p(10,23,2,1,COLORS.shoeDark); p(6,17,1,4,COLORS.pants2); p(8,18,1,5,COLORS.pants2);
  } else if (phase === "run-1") {
    p(1,2,2,1,hairShine); p(2,1,3,2,hairShine); p(8,1,3,2,hairShine); p(10,1,2,1,hairShine); p(0,4,3,2,hairMid); p(10,4,3,2,hairMid); p(0,6,2,4,hairDark); p(10,6,2,4,hairDark); p(3,1,8,1,hairMid); p(2,2,10,1,hairMid); p(1,3,12,7,hairDark);
    p(2,4,10,4,hairDark); p(3,4,8,5,COLORS.skin); p(4,3,7,2,hairLight); p(3,6,2,2,COLORS.skin); p(9,6,2,2,COLORS.skin); p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(9,6,1,blink ? 1 : 2,COLORS.ink); p(6,8,1,1,COLORS.skinShade); p(6,9,2,1,mouth);
    p(4,10,8,5,COLORS.shirt); p(2,12,2,4,COLORS.skin); p(10,10,2,4,COLORS.skin); p(11,12,2,2,COLORS.skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white); p(5,15,6,2,COLORS.shirt2); p(8,15,2,6,COLORS.pants); p(5,15,2,4,COLORS.pants); p(4,19,2,4,COLORS.pants); p(9,17,2,3,COLORS.pants); p(3,22,4,2,COLORS.shoe); p(8,20,4,2,COLORS.shoe); p(3,23,2,1,COLORS.shoeDark); p(10,21,2,1,COLORS.shoeDark); p(8,17,1,4,COLORS.pants2); p(5,18,1,5,COLORS.pants2);
  } else if (phase === "jump") {
    p(1,2,2,1,hairShine); p(2,2,3,2,hairShine); p(8,2,3,2,hairShine); p(10,3,2,1,hairShine); p(0,5,3,2,hairMid); p(10,5,3,2,hairMid); p(0,7,2,4,hairDark); p(10,7,2,4,hairDark); p(3,1,8,1,hairMid); p(2,2,10,1,hairMid); p(1,3,12,7,hairDark);
    p(2,4,10,4,hairDark); p(3,4,8,5,COLORS.skin); p(4,3,7,2,hairLight); p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(9,6,1,blink ? 1 : 2,COLORS.ink); p(6,8,1,1,COLORS.skinShade); p(6,9,2,1,mouth); p(4,10,8,5,COLORS.shirt); p(2,11,2,4,COLORS.skin); p(10,11,2,4,COLORS.skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white); p(5,15,6,2,COLORS.shirt2); p(5,16,2,4,COLORS.pants); p(8,16,2,4,COLORS.pants); p(4,18,3,2,COLORS.pants2); p(8,18,3,2,COLORS.pants2); p(3,20,4,2,COLORS.shoe); p(8,20,4,2,COLORS.shoe); p(3,21,2,1,COLORS.shoeDark); p(10,21,2,1,COLORS.shoeDark);
  } else if (phase === "duck-0") {
    p(2,6,4,2,hairLight); p(10,6,4,2,hairLight); p(0,8,4,2,hairMid); p(12,8,4,2,hairMid); p(1,10,2,3,hairDark); p(13,10,2,3,hairDark); p(4,5,8,1,hairMid); p(3,6,10,1,hairMid); p(2,7,12,6,hairDark); p(3,8,10,4,COLORS.skin);
    p(5,9,3,2,COLORS.white); p(9,9,3,2,COLORS.white); p(8,9,1,1,COLORS.white); p(6,10,1,1,COLORS.ink); p(10,10,1,1,COLORS.ink); p(7,11,1,1,COLORS.skinShade); p(8,11,2,1,mouth); p(6,12,10,3,COLORS.shirt); p(3,13,3,2,COLORS.skin); p(13,13,3,2,COLORS.skin); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,3,1,COLORS.white); p(7,15,9,2,COLORS.pants); p(4,16,6,2,COLORS.shoe); p(12,16,6,2,COLORS.shoe); p(4,17,2,1,COLORS.shoeDark); p(16,17,2,1,COLORS.shoeDark);
  } else {
    p(2,6,4,2,hairLight); p(10,6,4,2,hairLight); p(1,8,4,2,hairMid); p(11,8,4,2,hairMid); p(1,10,2,3,hairDark); p(13,10,2,3,hairDark); p(4,5,8,1,hairMid); p(3,6,10,1,hairMid); p(2,7,12,6,hairDark); p(3,8,10,4,COLORS.skin);
    p(5,9,3,2,COLORS.white); p(9,9,3,2,COLORS.white); p(8,9,1,1,COLORS.white); p(6,10,1,1,COLORS.ink); p(10,10,1,1,COLORS.ink); p(7,11,1,1,COLORS.skinShade); p(8,11,2,1,mouth); p(6,12,10,3,COLORS.shirt); p(2,13,3,2,COLORS.skin); p(13,12,3,2,COLORS.skin); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,3,1,COLORS.white); p(7,15,9,2,COLORS.pants); p(5,16,6,2,COLORS.shoe); p(12,15,6,2,COLORS.shoe); p(5,17,2,1,COLORS.shoeDark); p(16,16,2,1,COLORS.shoeDark);
  }
}

function drawSanti(ctx: CanvasRenderingContext2D, player: PlayerState, worldTime: number) {
  const baseX = player.x;
  const { top, phase } = getRunnerPhase(player, worldTime);
  const blink = Math.floor(worldTime / 1400) % 9 === 0 && !player.dead;
  const p = (x: number, y: number, w = 1, h = 1, color: string = COLORS.ink) =>
    drawRect(ctx, baseX + x, top + y, w, h, color);
  const skin = "#ddb18e";
  const skinShade = "#bc805d";
  const hairDark = "#1b171b";
  const hairMid = "#302930";
  const hairLight = "#4b414d";
  const cheek = "#d59a8f";
  const mouth = "#a56362";
  const beard = "#b88874";
  const beardSoft = "#d3ae97";
  const gust = Math.sin(worldTime * 0.028);
  const leftCurlX = gust < -0.2 ? 0 : 1;
  const rightCurlX = gust > 0.2 ? 11 : 10;
  const curlDrop = Math.cos(worldTime * 0.024) > 0 ? 1 : 0;

  if (phase === "run-0") {
    p(1,1,2,2,hairLight); p(3,1,6,1,hairMid); p(9,1,2,2,hairLight); p(0,3,3,3,hairMid); p(10,3,3,3,hairMid); p(0,5,2,6,hairDark); p(10,5,2,6,hairDark); p(2,2,9,1,hairMid); p(1,3,11,6,hairDark); p(2,0,2,1,hairLight); p(8,0,2,1,hairLight);
    p(leftCurlX, 9 + curlDrop, 2, 2, hairMid); p(rightCurlX, 9 + (curlDrop ? 0 : 1), 2, 2, hairMid);
    p(2,4,10,4,hairDark); p(3,4,8,5,skin); p(3,6,2,2,skin); p(9,6,2,2,skin); p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(9,6,1,blink ? 1 : 2,COLORS.ink); p(6,8,1,1,skinShade); p(5,8,5,1,cheek); p(6,9,3,1,mouth); p(4,9,5,1,beard); p(5,10,3,1,beardSoft);
    p(4,10,8,5,COLORS.shirt); p(3,11,2,4,skin); p(10,11,2,4,skin); p(11,12,2,3,skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white);
    p(5,15,6,2,COLORS.shirt2); p(5,15,2,6,COLORS.pants); p(8,15,2,4,COLORS.pants); p(9,19,2,4,COLORS.pants); p(3,17,2,3,COLORS.pants); p(2,20,4,2,COLORS.shoe); p(8,22,4,2,COLORS.shoe); p(1,22,2,1,COLORS.shoeDark); p(10,23,2,1,COLORS.shoeDark); p(6,17,1,4,COLORS.pants2); p(8,18,1,5,COLORS.pants2);
  } else if (phase === "run-1") {
    p(1,2,2,2,hairLight); p(3,1,6,1,hairMid); p(9,1,2,2,hairLight); p(0,3,3,3,hairMid); p(10,3,3,3,hairMid); p(0,5,2,6,hairDark); p(10,5,2,6,hairDark); p(2,2,9,1,hairMid); p(1,3,11,6,hairDark); p(2,0,2,1,hairLight); p(8,0,2,1,hairLight);
    p(leftCurlX, 9 + curlDrop, 2, 2, hairMid); p(rightCurlX, 9 + (curlDrop ? 0 : 1), 2, 2, hairMid);
    p(2,4,10,4,hairDark); p(3,4,8,5,skin); p(3,6,2,2,skin); p(9,6,2,2,skin); p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(9,6,1,blink ? 1 : 2,COLORS.ink); p(6,8,1,1,skinShade); p(5,8,5,1,cheek); p(6,9,3,1,mouth); p(4,9,5,1,beard); p(5,10,3,1,beardSoft);
    p(4,10,8,5,COLORS.shirt); p(2,12,2,4,skin); p(10,10,2,4,skin); p(11,12,2,2,skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white); p(5,15,6,2,COLORS.shirt2); p(8,15,2,6,COLORS.pants); p(5,15,2,4,COLORS.pants); p(4,19,2,4,COLORS.pants); p(9,17,2,3,COLORS.pants); p(3,22,4,2,COLORS.shoe); p(8,20,4,2,COLORS.shoe); p(3,23,2,1,COLORS.shoeDark); p(10,21,2,1,COLORS.shoeDark); p(8,17,1,4,COLORS.pants2); p(5,18,1,5,COLORS.pants2);
  } else if (phase === "jump") {
    p(1,2,2,2,hairLight); p(3,2,6,1,hairMid); p(9,2,2,2,hairLight); p(0,4,3,3,hairMid); p(10,4,3,3,hairMid); p(0,6,2,6,hairDark); p(10,6,2,6,hairDark); p(2,3,9,1,hairMid); p(1,4,11,6,hairDark); p(2,1,2,1,hairLight); p(8,1,2,1,hairLight);
    p(leftCurlX, 10 + curlDrop, 2, 2, hairMid); p(rightCurlX, 10 + (curlDrop ? 0 : 1), 2, 2, hairMid);
    p(2,5,10,3,hairDark); p(3,4,8,5,skin); p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(9,6,1,blink ? 1 : 2,COLORS.ink); p(6,8,1,1,skinShade); p(5,8,5,1,cheek); p(6,9,3,1,mouth); p(4,9,5,1,beard); p(5,10,3,1,beardSoft);
    p(4,10,8,5,COLORS.shirt); p(2,11,2,4,skin); p(10,11,2,4,skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white); p(5,15,6,2,COLORS.shirt2); p(5,16,2,4,COLORS.pants); p(8,16,2,4,COLORS.pants); p(4,18,3,2,COLORS.pants2); p(8,18,3,2,COLORS.pants2); p(3,20,4,2,COLORS.shoe); p(8,20,4,2,COLORS.shoe); p(3,21,2,1,COLORS.shoeDark); p(10,21,2,1,COLORS.shoeDark);
  } else if (phase === "duck-0") {
    p(1,6,3,2,hairLight); p(10,6,3,2,hairLight); p(0,8,4,2,hairMid); p(11,8,4,2,hairMid); p(1,10,2,3,hairDark); p(13,10,2,3,hairDark); p(4,5,8,1,hairMid); p(3,6,10,1,hairMid); p(2,7,12,6,hairDark); p(3,8,10,4,skin);
    p(leftCurlX, 11 + curlDrop, 2, 2, hairMid); p(rightCurlX + 1, 11 + (curlDrop ? 0 : 1), 2, 2, hairMid);
    p(5,9,3,2,COLORS.white); p(9,9,3,2,COLORS.white); p(8,9,1,1,COLORS.white); p(6,10,1,1,COLORS.ink); p(10,10,1,1,COLORS.ink); p(7,11,1,1,skinShade); p(6,11,5,1,cheek); p(8,11,2,1,mouth); p(5,11,5,1,beard); p(6,12,3,1,beardSoft); p(6,12,10,3,COLORS.shirt); p(3,13,3,2,skin); p(13,13,3,2,skin); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,3,1,COLORS.white); p(7,15,9,2,COLORS.pants); p(4,16,6,2,COLORS.shoe); p(12,16,6,2,COLORS.shoe); p(4,17,2,1,COLORS.shoeDark); p(16,17,2,1,COLORS.shoeDark);
  } else {
    p(2,6,4,2,hairLight); p(10,6,4,2,hairLight); p(1,8,4,2,hairMid); p(11,8,4,2,hairMid); p(1,10,2,3,hairDark); p(13,10,2,3,hairDark); p(4,5,8,1,hairMid); p(3,6,10,1,hairMid); p(2,7,12,6,hairDark); p(3,8,10,4,skin);
    p(leftCurlX, 11 + curlDrop, 2, 2, hairMid); p(rightCurlX + 1, 11 + (curlDrop ? 0 : 1), 2, 2, hairMid);
    p(5,9,3,2,COLORS.white); p(9,9,3,2,COLORS.white); p(8,9,1,1,COLORS.white); p(6,10,1,1,COLORS.ink); p(10,10,1,1,COLORS.ink); p(7,11,1,1,skinShade); p(6,11,5,1,cheek); p(8,11,2,1,mouth); p(5,11,5,1,beard); p(6,12,3,1,beardSoft); p(6,12,10,3,COLORS.shirt); p(2,13,3,2,skin); p(13,12,3,2,skin); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,3,1,COLORS.white); p(7,15,9,2,COLORS.pants); p(5,16,6,2,COLORS.shoe); p(12,15,6,2,COLORS.shoe); p(5,17,2,1,COLORS.shoeDark); p(16,16,2,1,COLORS.shoeDark);
  }
}

function drawPablo(ctx: CanvasRenderingContext2D, player: PlayerState, worldTime: number) {
  const baseX = player.x;
  const { top, phase } = getRunnerPhase(player, worldTime);
  const blink = Math.floor(worldTime / 1400) % 9 === 0 && !player.dead;
  const p = (x: number, y: number, w = 1, h = 1, color: string = COLORS.ink) =>
    drawRect(ctx, baseX + x, top + y, w, h, color);
  const skin = "#e8c3a5";
  const skinShade = "#c49274";
  const hairDark = "#5b5551";
  const hairMid = "#7c746f";
  const hairLight = "#a39b95";
  const beard = "#dad8d3";
  const beardShade = "#b9b5af";
  const moustache = "#8f857f";

  if (phase === "run-0") {
    p(2,2,2,1,hairLight); p(4,1,5,1,hairMid); p(9,2,2,1,hairLight); p(3,2,7,1,hairDark); p(2,3,9,1,hairDark); p(2,4,9,4,hairMid);
    p(3,4,7,5,skin); p(2,5,1,2,skin); p(10,5,1,2,skin); p(4,5,2,1,COLORS.white); p(7,5,2,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(8,6,1,blink ? 1 : 2,COLORS.ink); p(6,7,1,1,skinShade); p(4,8,5,1,moustache); p(3,9,7,4,beard); p(4,9,5,2,beardShade); p(6,12,2,1,"#b9857f");
    p(3,10,10,5,COLORS.shirt); p(4,10,1,1,COLORS.white); p(8,11,1,3,COLORS.white); p(6,12,4,1,COLORS.white); p(2,11,2,4,skin); p(11,11,2,4,skin); p(3,15,10,2,COLORS.shirt2);
    p(4,15,2,6,COLORS.pants); p(7,15,2,4,COLORS.pants); p(8,19,2,4,COLORS.pants); p(2,17,2,3,COLORS.pants); p(2,20,4,2,COLORS.shoe); p(7,22,4,2,COLORS.shoe); p(1,22,2,1,COLORS.shoeDark); p(9,23,2,1,COLORS.shoeDark); p(5,17,1,4,COLORS.pants2); p(7,18,1,5,COLORS.pants2);
  } else if (phase === "run-1") {
    p(2,2,2,1,hairLight); p(4,1,5,1,hairMid); p(9,2,2,1,hairLight); p(3,2,7,1,hairDark); p(2,3,9,1,hairDark); p(2,4,9,4,hairMid);
    p(3,4,7,5,skin); p(2,5,1,2,skin); p(10,5,1,2,skin); p(4,5,2,1,COLORS.white); p(7,5,2,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(8,6,1,blink ? 1 : 2,COLORS.ink); p(6,7,1,1,skinShade); p(4,8,5,1,moustache); p(3,9,7,4,beard); p(4,9,5,2,beardShade); p(6,12,2,1,"#b9857f");
    p(3,10,10,5,COLORS.shirt); p(4,10,1,1,COLORS.white); p(8,11,1,3,COLORS.white); p(6,12,4,1,COLORS.white); p(1,12,2,4,skin); p(11,10,2,4,skin); p(3,15,10,2,COLORS.shirt2);
    p(7,15,2,6,COLORS.pants); p(4,15,2,4,COLORS.pants); p(3,19,2,4,COLORS.pants); p(8,17,2,3,COLORS.pants); p(2,22,4,2,COLORS.shoe); p(7,20,4,2,COLORS.shoe); p(2,23,2,1,COLORS.shoeDark); p(9,21,2,1,COLORS.shoeDark); p(7,17,1,4,COLORS.pants2); p(4,18,1,5,COLORS.pants2);
  } else if (phase === "jump") {
    p(2,2,2,1,hairLight); p(4,1,5,1,hairMid); p(9,2,2,1,hairLight); p(3,2,7,1,hairDark); p(2,3,9,1,hairDark); p(2,4,9,4,hairMid);
    p(3,4,7,5,skin); p(2,5,1,2,skin); p(10,5,1,2,skin); p(4,5,2,1,COLORS.white); p(7,5,2,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(8,6,1,blink ? 1 : 2,COLORS.ink); p(6,7,1,1,skinShade); p(4,8,5,1,moustache); p(3,9,7,4,beard); p(4,9,5,2,beardShade); p(6,12,2,1,"#b9857f");
    p(3,10,10,5,COLORS.shirt); p(4,10,1,1,COLORS.white); p(8,11,1,3,COLORS.white); p(6,12,4,1,COLORS.white); p(1,11,2,4,skin); p(11,11,2,4,skin); p(3,15,10,2,COLORS.shirt2);
    p(4,16,2,4,COLORS.pants); p(7,16,2,4,COLORS.pants); p(3,18,3,2,COLORS.pants2); p(7,18,3,2,COLORS.pants2); p(2,20,4,2,COLORS.shoe); p(7,20,4,2,COLORS.shoe); p(2,21,2,1,COLORS.shoeDark); p(9,21,2,1,COLORS.shoeDark);
  } else if (phase === "duck-0") {
    p(3,5,7,1,hairDark); p(2,6,9,1,hairDark); p(2,7,9,4,hairMid); p(3,7,2,1,hairLight); p(8,7,2,1,hairLight); p(3,7,7,4,skin); p(4,8,2,1,COLORS.white); p(7,8,2,1,COLORS.white); p(5,9,1,1,COLORS.ink); p(8,9,1,1,COLORS.ink); p(5,10,4,1,moustache); p(4,11,6,3,beard); p(5,11,4,1,beardShade); p(6,10,1,1,skinShade);
    p(5,12,12,3,COLORS.shirt); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,4,1,COLORS.white); p(2,13,3,2,skin); p(14,13,3,2,skin); p(7,15,10,2,COLORS.pants); p(4,16,6,2,COLORS.shoe); p(12,16,6,2,COLORS.shoe); p(4,17,2,1,COLORS.shoeDark); p(16,17,2,1,COLORS.shoeDark);
  } else {
    p(3,5,7,1,hairDark); p(2,6,9,1,hairDark); p(2,7,9,4,hairMid); p(3,7,2,1,hairLight); p(8,7,2,1,hairLight); p(3,7,7,4,skin); p(4,8,2,1,COLORS.white); p(7,8,2,1,COLORS.white); p(5,9,1,1,COLORS.ink); p(8,9,1,1,COLORS.ink); p(5,10,4,1,moustache); p(4,11,6,3,beard); p(5,11,4,1,beardShade); p(6,10,1,1,skinShade);
    p(5,12,12,3,COLORS.shirt); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,4,1,COLORS.white); p(1,13,3,2,skin); p(14,12,3,2,skin); p(7,15,10,2,COLORS.pants); p(5,16,6,2,COLORS.shoe); p(12,15,6,2,COLORS.shoe); p(5,17,2,1,COLORS.shoeDark); p(16,16,2,1,COLORS.shoeDark);
  }
}

function drawEli(ctx: CanvasRenderingContext2D, player: PlayerState, worldTime: number) {
  const baseX = player.x;
  const { top, phase } = getRunnerPhase(player, worldTime);
  const blink = Math.floor(worldTime / 1400) % 9 === 0 && !player.dead;
  const p = (x: number, y: number, w = 1, h = 1, color: string = COLORS.ink) =>
    drawRect(ctx, baseX + x, top + y, w, h, color);
  const skin = "#ddb18e";
  const skinShade = "#bc805d";
  const hairDark = "#1b1718";
  const hairMid = "#2c2326";
  const hairLight = "#4a4044";
  const cheek = "#d9918a";
  const mouth = "#ae666c";
  const gust = Math.sin(worldTime * 0.026);
  const ponyOffset = gust > 0.24 ? 1 : gust < -0.24 ? -1 : 0;
  const ponyDrop = Math.cos(worldTime * 0.02) > 0 ? 1 : 0;

  if (phase === "run-0") {
    p(5,0,2,2,hairLight); p(4,1,4,2,hairDark); p(6,2,1,2,hairLight);
    p(2,3,3,2,hairLight); p(8,3,3,2,hairLight); p(3,2,8,1,hairMid); p(2,3,10,1,hairMid); p(2,4,10,5,hairDark);
    p(0 + ponyOffset, 7 + ponyDrop, 2, 3, hairMid); p(-1 + ponyOffset, 9 + ponyDrop, 2, 3, hairDark); p(-1 + ponyOffset, 11 + ponyDrop, 1, 2, hairLight);
    p(2,4,10,4,hairDark); p(3,4,8,5,skin); p(4,3,7,2,hairLight); p(3,6,2,2,skin); p(9,6,2,2,skin);
    p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(9,6,1,blink ? 1 : 2,COLORS.ink); p(6,8,1,1,skinShade); p(5,8,4,1,cheek); p(6,9,2,1,mouth);
    p(4,10,8,5,COLORS.shirt); p(3,11,2,4,skin); p(10,11,2,4,skin); p(11,12,2,3,skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white);
    p(5,15,6,2,COLORS.shirt2); p(5,15,2,6,COLORS.pants); p(8,15,2,4,COLORS.pants); p(9,19,2,4,COLORS.pants); p(3,17,2,3,COLORS.pants); p(2,20,4,2,COLORS.shoe); p(8,22,4,2,COLORS.shoe); p(1,22,2,1,COLORS.shoeDark); p(10,23,2,1,COLORS.shoeDark); p(6,17,1,4,COLORS.pants2); p(8,18,1,5,COLORS.pants2);
  } else if (phase === "run-1") {
    p(5,0,2,2,hairLight); p(4,1,4,2,hairDark); p(6,2,1,2,hairLight);
    p(1,3,4,2,hairLight); p(3,2,8,1,hairMid); p(2,3,10,1,hairMid); p(2,4,10,5,hairDark);
    p(0 + ponyOffset, 6 + ponyDrop, 2, 3, hairMid); p(-1 + ponyOffset, 8 + ponyDrop, 2, 3, hairDark); p(-1 + ponyOffset, 10 + ponyDrop, 1, 2, hairLight);
    p(2,4,10,4,hairDark); p(3,4,8,5,skin); p(4,3,7,2,hairLight); p(3,6,2,2,skin); p(9,6,2,2,skin);
    p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(9,6,1,blink ? 1 : 2,COLORS.ink); p(6,8,1,1,skinShade); p(5,8,4,1,cheek); p(6,9,2,1,mouth);
    p(4,10,8,5,COLORS.shirt); p(2,12,2,4,skin); p(10,10,2,4,skin); p(11,12,2,2,skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white);
    p(5,15,6,2,COLORS.shirt2); p(8,15,2,6,COLORS.pants); p(5,15,2,4,COLORS.pants); p(4,19,2,4,COLORS.pants); p(9,17,2,3,COLORS.pants); p(3,22,4,2,COLORS.shoe); p(8,20,4,2,COLORS.shoe); p(3,23,2,1,COLORS.shoeDark); p(10,21,2,1,COLORS.shoeDark); p(8,17,1,4,COLORS.pants2); p(5,18,1,5,COLORS.pants2);
  } else if (phase === "jump") {
    p(5,1,2,2,hairLight); p(4,2,4,2,hairDark); p(6,3,1,2,hairLight);
    p(1,4,4,2,hairLight); p(3,2,8,1,hairMid); p(2,3,10,1,hairMid); p(2,4,10,5,hairDark);
    p(0 + ponyOffset, 8 + ponyDrop, 2, 3, hairMid); p(-1 + ponyOffset, 10 + ponyDrop, 2, 3, hairDark); p(-1 + ponyOffset, 12 + ponyDrop, 1, 2, hairLight);
    p(2,4,10,4,hairDark); p(3,4,8,5,skin); p(4,3,7,2,hairLight);
    p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(9,6,1,blink ? 1 : 2,COLORS.ink); p(6,8,1,1,skinShade); p(5,8,4,1,cheek); p(6,9,2,1,mouth);
    p(4,10,8,5,COLORS.shirt); p(2,11,2,4,skin); p(10,11,2,4,skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white);
    p(5,15,6,2,COLORS.shirt2); p(5,16,2,4,COLORS.pants); p(8,16,2,4,COLORS.pants); p(4,18,3,2,COLORS.pants2); p(8,18,3,2,COLORS.pants2); p(3,20,4,2,COLORS.shoe); p(8,20,4,2,COLORS.shoe); p(3,21,2,1,COLORS.shoeDark); p(10,21,2,1,COLORS.shoeDark);
  } else if (phase === "duck-0") {
    p(4,5,7,1,hairMid); p(3,6,9,1,hairDark); p(2,7,10,5,hairDark); p(10,7,1,2,hairMid);
    p(1 + ponyOffset, 8 + ponyDrop, 2, 3, hairMid); p(0 + ponyOffset, 10 + ponyDrop, 2, 2, hairDark); p(0 + ponyOffset, 11 + ponyDrop, 1, 2, hairLight);
    p(4,7,7,4,skin); p(5,8,2,1,COLORS.white); p(8,8,2,1,COLORS.white); p(6,9,1,1,COLORS.ink); p(9,9,1,1,COLORS.ink); p(7,10,1,1,skinShade); p(6,10,4,1,cheek); p(7,11,2,1,mouth);
    p(6,12,10,3,COLORS.shirt); p(3,13,3,2,skin); p(13,13,3,2,skin); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,3,1,COLORS.white); p(7,15,9,2,COLORS.pants); p(4,16,6,2,COLORS.shoe); p(12,16,6,2,COLORS.shoe); p(4,17,2,1,COLORS.shoeDark); p(16,17,2,1,COLORS.shoeDark);
  } else {
    p(4,5,7,1,hairMid); p(3,6,9,1,hairDark); p(2,7,10,5,hairDark); p(10,7,1,2,hairMid);
    p(1 + ponyOffset, 8 + ponyDrop, 2, 3, hairMid); p(0 + ponyOffset, 9 + ponyDrop, 2, 2, hairDark); p(0 + ponyOffset, 11 + ponyDrop, 1, 2, hairLight);
    p(4,7,7,4,skin); p(5,8,2,1,COLORS.white); p(8,8,2,1,COLORS.white); p(6,9,1,1,COLORS.ink); p(9,9,1,1,COLORS.ink); p(7,10,1,1,skinShade); p(6,10,4,1,cheek); p(7,11,2,1,mouth);
    p(6,12,10,3,COLORS.shirt); p(2,13,3,2,skin); p(13,12,3,2,skin); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,3,1,COLORS.white); p(7,15,9,2,COLORS.pants); p(5,16,6,2,COLORS.shoe); p(12,15,6,2,COLORS.shoe); p(5,17,2,1,COLORS.shoeDark); p(16,16,2,1,COLORS.shoeDark);
  }
}

function drawVero(ctx: CanvasRenderingContext2D, player: PlayerState, worldTime: number) {
  const baseX = player.x;
  const { top, phase } = getRunnerPhase(player, worldTime);
  const blink = Math.floor(worldTime / 1400) % 9 === 0 && !player.dead;
  const p = (x: number, y: number, w = 1, h = 1, color: string = COLORS.ink) =>
    drawRect(ctx, baseX + x, top + y, w, h, color);
  const skin = "#e3ad87";
  const skinShade = "#c48261";
  const hairDark = "#512d21";
  const hairMid = "#744739";
  const hairLight = "#9d6f58";
  const cheek = "#de998f";
  const mouth = "#b96e71";
  const lash = "#2b1618";

  if (phase === "run-0") {
    p(1,1,2,2,hairLight); p(3,1,7,1,hairMid); p(10,2,2,1,hairLight); p(0,4,3,2,hairMid); p(10,4,3,2,hairMid); p(1,6,2,5,hairDark); p(10,6,2,5,hairDark); p(2,2,10,8,hairDark); p(3,3,8,2,hairMid);
    p(3,4,8,5,skin); p(3,6,2,2,skin); p(9,6,2,2,skin); p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(4,4,1,1,lash); p(9,4,1,1,lash); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(9,6,1,blink ? 1 : 2,COLORS.ink); p(6,7,1,1,skinShade); p(5,8,5,1,cheek); p(6,9,3,1,mouth);
    p(4,10,8,5,COLORS.shirt); p(3,11,2,4,skin); p(10,11,2,4,skin); p(11,12,2,3,skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white);
    p(5,15,6,2,COLORS.shirt2); p(5,15,2,6,COLORS.pants); p(8,15,2,4,COLORS.pants); p(9,19,2,4,COLORS.pants); p(3,17,2,3,COLORS.pants); p(2,20,4,2,COLORS.shoe); p(8,22,4,2,COLORS.shoe); p(1,22,2,1,COLORS.shoeDark); p(10,23,2,1,COLORS.shoeDark); p(6,17,1,4,COLORS.pants2); p(8,18,1,5,COLORS.pants2);
  } else if (phase === "run-1") {
    p(2,1,2,2,hairLight); p(3,1,7,1,hairMid); p(10,1,2,1,hairLight); p(0,4,3,2,hairMid); p(10,4,3,2,hairMid); p(0,6,2,5,hairDark); p(10,6,2,5,hairDark); p(2,2,10,8,hairDark); p(3,3,8,2,hairMid);
    p(3,4,8,5,skin); p(3,6,2,2,skin); p(9,6,2,2,skin); p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(4,4,1,1,lash); p(9,4,1,1,lash); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(9,6,1,blink ? 1 : 2,COLORS.ink); p(6,7,1,1,skinShade); p(5,8,5,1,cheek); p(6,9,3,1,mouth);
    p(4,10,8,5,COLORS.shirt); p(2,12,2,4,skin); p(10,10,2,4,skin); p(11,12,2,2,skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white); p(5,15,6,2,COLORS.shirt2); p(8,15,2,6,COLORS.pants); p(5,15,2,4,COLORS.pants); p(4,19,2,4,COLORS.pants); p(9,17,2,3,COLORS.pants); p(3,22,4,2,COLORS.shoe); p(8,20,4,2,COLORS.shoe); p(3,23,2,1,COLORS.shoeDark); p(10,21,2,1,COLORS.shoeDark); p(8,17,1,4,COLORS.pants2); p(5,18,1,5,COLORS.pants2);
  } else if (phase === "jump") {
    p(2,2,2,2,hairLight); p(3,2,7,1,hairMid); p(10,3,2,1,hairLight); p(0,5,3,2,hairMid); p(10,5,3,2,hairMid); p(0,7,2,5,hairDark); p(10,7,2,5,hairDark); p(2,3,10,8,hairDark); p(3,4,8,2,hairMid);
    p(3,4,8,5,skin); p(4,5,3,2,COLORS.white); p(8,5,3,2,COLORS.white); p(7,5,1,1,COLORS.white); p(4,4,1,1,lash); p(9,4,1,1,lash); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(9,6,1,blink ? 1 : 2,COLORS.ink); p(6,7,1,1,skinShade); p(5,8,5,1,cheek); p(6,9,3,1,mouth);
    p(4,10,8,5,COLORS.shirt); p(2,11,2,4,skin); p(10,11,2,4,skin); p(4,10,1,1,COLORS.white); p(7,11,1,3,COLORS.white); p(6,12,3,1,COLORS.white); p(5,15,6,2,COLORS.shirt2); p(5,16,2,4,COLORS.pants); p(8,16,2,4,COLORS.pants); p(4,18,3,2,COLORS.pants2); p(8,18,3,2,COLORS.pants2); p(3,20,4,2,COLORS.shoe); p(8,20,4,2,COLORS.shoe); p(3,21,2,1,COLORS.shoeDark); p(10,21,2,1,COLORS.shoeDark);
  } else if (phase === "duck-0") {
    p(2,6,4,2,hairLight); p(10,6,4,2,hairLight); p(0,8,4,2,hairMid); p(12,8,4,2,hairMid); p(1,10,2,3,hairDark); p(13,10,2,3,hairDark); p(4,5,8,1,hairMid); p(3,6,10,1,hairMid); p(2,7,12,6,hairDark); p(3,8,10,4,hairMid); p(4,8,8,4,skin); p(5,7,7,2,hairLight);
    p(5,9,3,2,COLORS.white); p(9,9,3,2,COLORS.white); p(8,9,1,1,COLORS.white); p(5,8,1,1,lash); p(10,8,1,1,lash); p(6,10,1,1,COLORS.ink); p(10,10,1,1,COLORS.ink); p(7,11,1,1,skinShade); p(6,11,5,1,cheek); p(8,11,2,1,mouth); p(6,12,10,3,COLORS.shirt); p(3,13,3,2,skin); p(13,13,3,2,skin); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,3,1,COLORS.white); p(7,15,9,2,COLORS.pants); p(4,16,6,2,COLORS.shoe); p(12,16,6,2,COLORS.shoe); p(4,17,2,1,COLORS.shoeDark); p(16,17,2,1,COLORS.shoeDark);
  } else {
    p(2,6,4,2,hairLight); p(10,6,4,2,hairLight); p(1,8,4,2,hairMid); p(11,8,4,2,hairMid); p(1,10,2,3,hairDark); p(13,10,2,3,hairDark); p(4,5,8,1,hairMid); p(3,6,10,1,hairMid); p(2,7,12,6,hairDark); p(3,8,10,4,hairMid); p(4,8,8,4,skin); p(5,7,7,2,hairLight);
    p(5,9,3,2,COLORS.white); p(9,9,3,2,COLORS.white); p(8,9,1,1,COLORS.white); p(5,8,1,1,lash); p(10,8,1,1,lash); p(6,10,1,1,COLORS.ink); p(10,10,1,1,COLORS.ink); p(7,11,1,1,skinShade); p(6,11,5,1,cheek); p(8,11,2,1,mouth); p(6,12,10,3,COLORS.shirt); p(2,13,3,2,skin); p(13,12,3,2,skin); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,3,1,COLORS.white); p(7,15,9,2,COLORS.pants); p(5,16,6,2,COLORS.shoe); p(12,15,6,2,COLORS.shoe); p(5,17,2,1,COLORS.shoeDark); p(16,16,2,1,COLORS.shoeDark);
  }
}

function drawChino(ctx: CanvasRenderingContext2D, player: PlayerState, worldTime: number) {
  const baseX = player.x;
  const { top, phase } = getRunnerPhase(player, worldTime);
  const blink = Math.floor(worldTime / 1400) % 9 === 0 && !player.dead;
  const p = (x: number, y: number, w = 1, h = 1, color: string = COLORS.ink) =>
    drawRect(ctx, baseX + x, top + y, w, h, color);
  const skin = "#d8b090";
  const skinShade = "#b98565";
  const hairDark = "#403733";
  const hairMid = "#6d645f";
  const beard = "#6f6862";
  const beardLight = "#d8d6d1";
  const glasses = "#2b3037";
  const glassesLight = "#a2adbc";
  const vest = "#17191d";
  const vestLight = "#30343c";
  const zipper = "#aab2bc";

  if (phase === "run-0") {
    p(3,1,7,1,hairMid); p(2,2,9,1,hairDark); p(2,3,9,1,hairDark); p(2,4,9,3,hairDark); p(2,1,2,1,hairMid); p(9,1,2,1,hairMid);
    p(3,4,7,5,skin); p(2,5,1,2,skin); p(10,5,1,2,skin); p(4,5,2,2,glasses); p(7,5,2,2,glasses); p(6,5,1,1,glasses); p(4,5,1,1,glassesLight); p(7,5,1,1,glassesLight); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(8,6,1,blink ? 1 : 2,COLORS.ink); p(3,9,7,3,beard); p(4,9,5,1,beardLight); p(5,10,3,1,beardLight); p(6,7,1,1,skinShade); p(6,11,2,1,"#a06e67");
    p(3,10,10,5,COLORS.shirt); p(2,11,2,4,skin); p(11,11,2,4,skin); p(4,10,2,5,vest); p(8,10,2,5,vest); p(6,10,2,3,vestLight); p(6,10,1,5,zipper); p(7,10,1,2,zipper); p(3,15,10,2,COLORS.shirt2); p(4,15,2,2,vest); p(8,15,2,2,vest); p(6,15,1,2,zipper);
    p(4,15,2,6,COLORS.pants); p(7,15,2,4,COLORS.pants); p(8,19,2,4,COLORS.pants); p(2,17,2,3,COLORS.pants); p(2,20,4,2,COLORS.shoe); p(7,22,4,2,COLORS.shoe); p(1,22,2,1,COLORS.shoeDark); p(9,23,2,1,COLORS.shoeDark); p(5,17,1,4,COLORS.pants2); p(7,18,1,5,COLORS.pants2);
  } else if (phase === "run-1") {
    p(3,1,7,1,hairMid); p(2,2,9,1,hairDark); p(2,3,9,1,hairDark); p(2,4,9,3,hairDark); p(2,1,2,1,hairMid); p(9,1,2,1,hairMid);
    p(3,4,7,5,skin); p(2,5,1,2,skin); p(10,5,1,2,skin); p(4,5,2,2,glasses); p(7,5,2,2,glasses); p(6,5,1,1,glasses); p(4,5,1,1,glassesLight); p(7,5,1,1,glassesLight); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(8,6,1,blink ? 1 : 2,COLORS.ink); p(3,9,7,3,beard); p(4,9,5,1,beardLight); p(6,10,3,1,beardLight); p(6,7,1,1,skinShade); p(6,11,2,1,"#a06e67");
    p(3,10,10,5,COLORS.shirt); p(1,12,2,4,skin); p(11,10,2,4,skin); p(4,10,2,5,vest); p(8,10,2,5,vest); p(6,10,2,3,vestLight); p(6,10,1,5,zipper); p(7,10,1,2,zipper); p(3,15,10,2,COLORS.shirt2); p(4,15,2,2,vest); p(8,15,2,2,vest); p(6,15,1,2,zipper);
    p(7,15,2,6,COLORS.pants); p(4,15,2,4,COLORS.pants); p(3,19,2,4,COLORS.pants); p(8,17,2,3,COLORS.pants); p(2,22,4,2,COLORS.shoe); p(7,20,4,2,COLORS.shoe); p(2,23,2,1,COLORS.shoeDark); p(9,21,2,1,COLORS.shoeDark); p(7,17,1,4,COLORS.pants2); p(4,18,1,5,COLORS.pants2);
  } else if (phase === "jump") {
    p(3,1,7,1,hairMid); p(2,2,9,1,hairDark); p(2,3,9,1,hairDark); p(2,4,9,3,hairDark); p(2,1,2,1,hairMid); p(9,1,2,1,hairMid);
    p(3,4,7,5,skin); p(2,5,1,2,skin); p(10,5,1,2,skin); p(4,5,2,2,glasses); p(7,5,2,2,glasses); p(6,5,1,1,glasses); p(4,5,1,1,glassesLight); p(7,5,1,1,glassesLight); p(5,6,1,blink ? 1 : 2,COLORS.ink); p(8,6,1,blink ? 1 : 2,COLORS.ink); p(3,9,7,3,beard); p(4,9,5,1,beardLight); p(5,10,3,1,beardLight); p(6,7,1,1,skinShade); p(6,11,2,1,"#a06e67");
    p(3,10,10,5,COLORS.shirt); p(1,11,2,4,skin); p(11,11,2,4,skin); p(4,10,2,5,vest); p(8,10,2,5,vest); p(6,10,2,3,vestLight); p(6,10,1,5,zipper); p(7,10,1,2,zipper); p(3,15,10,2,COLORS.shirt2); p(4,15,2,2,vest); p(8,15,2,2,vest); p(6,15,1,2,zipper);
    p(4,16,2,4,COLORS.pants); p(7,16,2,4,COLORS.pants); p(3,18,3,2,COLORS.pants2); p(7,18,3,2,COLORS.pants2); p(2,20,4,2,COLORS.shoe); p(7,20,4,2,COLORS.shoe); p(2,21,2,1,COLORS.shoeDark); p(9,21,2,1,COLORS.shoeDark);
  } else if (phase === "duck-0") {
    p(4,4,7,1,hairDark); p(3,5,9,1,hairDark); p(3,6,9,4,hairDark); p(4,6,2,1,hairMid); p(8,6,2,1,hairMid); p(4,7,7,4,skin); p(5,8,2,1,glasses); p(8,8,2,1,glasses); p(7,8,1,1,glasses); p(5,8,1,1,glassesLight); p(8,8,1,1,glassesLight); p(6,9,1,1,COLORS.ink); p(9,9,1,1,COLORS.ink); p(4,10,7,3,beard); p(5,10,4,1,beardLight); p(6,11,3,1,beardLight); p(7,10,1,1,skinShade);
    p(5,12,12,3,COLORS.shirt); p(2,13,3,2,skin); p(14,13,3,2,skin); p(6,12,2,3,vest); p(10,12,2,3,vest); p(8,12,2,2,vestLight); p(8,12,1,4,zipper); p(7,15,10,2,COLORS.pants); p(8,15,2,2,vest); p(12,15,2,2,vest); p(9,15,1,2,zipper); p(4,16,6,2,COLORS.shoe); p(12,16,6,2,COLORS.shoe); p(4,17,2,1,COLORS.shoeDark); p(16,17,2,1,COLORS.shoeDark);
  } else {
    p(4,4,7,1,hairDark); p(3,5,9,1,hairDark); p(3,6,9,4,hairDark); p(4,6,2,1,hairMid); p(8,6,2,1,hairMid); p(4,7,7,4,skin); p(5,8,2,1,glasses); p(8,8,2,1,glasses); p(7,8,1,1,glasses); p(5,8,1,1,glassesLight); p(8,8,1,1,glassesLight); p(6,9,1,1,COLORS.ink); p(9,9,1,1,COLORS.ink); p(4,10,7,3,beard); p(5,10,4,1,beardLight); p(6,11,3,1,beardLight); p(7,10,1,1,skinShade);
    p(5,12,12,3,COLORS.shirt); p(1,13,3,2,skin); p(14,12,3,2,skin); p(6,12,2,3,vest); p(10,12,2,3,vest); p(8,12,2,2,vestLight); p(8,12,1,4,zipper); p(7,15,10,2,COLORS.pants); p(8,15,2,2,vest); p(12,15,2,2,vest); p(9,15,1,2,zipper); p(5,16,6,2,COLORS.shoe); p(12,15,6,2,COLORS.shoe); p(5,17,2,1,COLORS.shoeDark); p(16,16,2,1,COLORS.shoeDark);
  }
}

function drawGer(ctx: CanvasRenderingContext2D, player: PlayerState, worldTime: number) {
  const baseX = player.x;
  const { top, phase } = getRunnerPhase(player, worldTime);
  const blink = Math.floor(worldTime / 1400) % 9 === 0 && !player.dead;
  const p = (x: number, y: number, w = 1, h = 1, color: string = COLORS.ink) =>
    drawRect(ctx, baseX + x, top + y, w, h, color);
  const skin = "#e4ba9a";
  const skinShade = "#c88b69";
  const hairDark = "#5a4f49";
  const hairLight = "#7d716b";
  const stubble = "#b8957c";
  const lip = "#b97f76";
  const eyeBlue = "#4166d5";

  if (phase === "run-0") {
    p(3,1,6,1,hairLight); p(2,2,8,1,hairDark); p(2,3,8,1,hairDark); p(2,4,8,2,hairDark);
    p(3,4,7,5,skin); p(2,5,1,2,skin); p(10,5,1,2,skin);
    p(4,5,2,1,COLORS.white); p(7,5,2,1,COLORS.white); p(5,6,1,blink ? 1 : 2,eyeBlue); p(8,6,1,blink ? 1 : 2,eyeBlue);
    p(4,8,5,2,stubble); p(6,7,1,1,skinShade); p(6,9,2,1,lip);
    p(3,10,10,5,COLORS.shirt); p(4,10,1,1,COLORS.white); p(8,11,1,3,COLORS.white); p(6,12,4,1,COLORS.white); p(2,11,2,4,skin); p(11,11,2,4,skin); p(3,15,10,2,COLORS.shirt2);
    p(4,15,2,6,COLORS.pants); p(7,15,2,4,COLORS.pants); p(8,19,2,4,COLORS.pants); p(2,17,2,3,COLORS.pants); p(2,20,4,2,COLORS.shoe); p(7,22,4,2,COLORS.shoe); p(1,22,2,1,COLORS.shoeDark); p(9,23,2,1,COLORS.shoeDark); p(5,17,1,4,COLORS.pants2); p(7,18,1,5,COLORS.pants2);
  } else if (phase === "run-1") {
    p(3,1,6,1,hairLight); p(2,2,8,1,hairDark); p(2,3,8,1,hairDark); p(2,4,8,2,hairDark);
    p(3,4,7,5,skin); p(2,5,1,2,skin); p(10,5,1,2,skin);
    p(4,5,2,1,COLORS.white); p(7,5,2,1,COLORS.white); p(5,6,1,blink ? 1 : 2,eyeBlue); p(8,6,1,blink ? 1 : 2,eyeBlue);
    p(4,8,5,2,stubble); p(6,7,1,1,skinShade); p(6,9,2,1,lip);
    p(3,10,10,5,COLORS.shirt); p(4,10,1,1,COLORS.white); p(8,11,1,3,COLORS.white); p(6,12,4,1,COLORS.white); p(1,12,2,4,skin); p(11,10,2,4,skin); p(3,15,10,2,COLORS.shirt2);
    p(7,15,2,6,COLORS.pants); p(4,15,2,4,COLORS.pants); p(3,19,2,4,COLORS.pants); p(8,17,2,3,COLORS.pants); p(2,22,4,2,COLORS.shoe); p(7,20,4,2,COLORS.shoe); p(2,23,2,1,COLORS.shoeDark); p(9,21,2,1,COLORS.shoeDark); p(7,17,1,4,COLORS.pants2); p(4,18,1,5,COLORS.pants2);
  } else if (phase === "jump") {
    p(3,1,6,1,hairLight); p(2,2,8,1,hairDark); p(2,3,8,1,hairDark); p(2,4,8,2,hairDark);
    p(3,4,7,5,skin); p(2,5,1,2,skin); p(10,5,1,2,skin);
    p(4,5,2,1,COLORS.white); p(7,5,2,1,COLORS.white); p(5,6,1,blink ? 1 : 2,eyeBlue); p(8,6,1,blink ? 1 : 2,eyeBlue);
    p(4,8,5,2,stubble); p(6,7,1,1,skinShade); p(6,9,2,1,lip);
    p(3,10,10,5,COLORS.shirt); p(4,10,1,1,COLORS.white); p(8,11,1,3,COLORS.white); p(6,12,4,1,COLORS.white); p(1,11,2,4,skin); p(11,11,2,4,skin); p(3,15,10,2,COLORS.shirt2);
    p(4,16,2,4,COLORS.pants); p(7,16,2,4,COLORS.pants); p(3,18,3,2,COLORS.pants2); p(7,18,3,2,COLORS.pants2); p(2,20,4,2,COLORS.shoe); p(7,20,4,2,COLORS.shoe); p(2,21,2,1,COLORS.shoeDark); p(9,21,2,1,COLORS.shoeDark);
  } else if (phase === "duck-0") {
    p(3,5,7,1,hairDark); p(2,6,9,1,hairDark); p(2,7,9,3,hairDark); p(3,7,2,1,hairLight); p(8,7,2,1,hairLight);
    p(3,7,7,4,skin); p(4,8,2,1,COLORS.white); p(7,8,2,1,COLORS.white); p(5,9,1,1,eyeBlue); p(8,9,1,1,eyeBlue); p(5,10,4,2,stubble); p(6,10,1,1,skinShade);
    p(5,12,12,3,COLORS.shirt); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,4,1,COLORS.white); p(2,13,3,2,skin); p(14,13,3,2,skin); p(7,15,10,2,COLORS.pants); p(4,16,6,2,COLORS.shoe); p(12,16,6,2,COLORS.shoe); p(4,17,2,1,COLORS.shoeDark); p(16,17,2,1,COLORS.shoeDark);
  } else {
    p(3,5,7,1,hairDark); p(2,6,9,1,hairDark); p(2,7,9,3,hairDark); p(3,7,2,1,hairLight); p(8,7,2,1,hairLight);
    p(3,7,7,4,skin); p(4,8,2,1,COLORS.white); p(7,8,2,1,COLORS.white); p(5,9,1,1,eyeBlue); p(8,9,1,1,eyeBlue); p(5,10,4,2,stubble); p(6,10,1,1,skinShade);
    p(5,12,12,3,COLORS.shirt); p(7,12,1,1,COLORS.white); p(10,12,1,2,COLORS.white); p(9,13,4,1,COLORS.white); p(1,13,3,2,skin); p(14,12,3,2,skin); p(7,15,10,2,COLORS.pants); p(5,16,6,2,COLORS.shoe); p(12,15,6,2,COLORS.shoe); p(5,17,2,1,COLORS.shoeDark); p(16,16,2,1,COLORS.shoeDark);
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
  if (characterId === "jime") {
    drawJime(ctx, player, worldTime);
    return;
  }
  if (characterId === "santi") {
    drawSanti(ctx, player, worldTime);
    return;
  }
  if (characterId === "pablo") {
    drawPablo(ctx, player, worldTime);
    return;
  }
  if (characterId === "eli") {
    drawEli(ctx, player, worldTime);
    return;
  }
  if (characterId === "vero") {
    drawVero(ctx, player, worldTime);
    return;
  }
  if (characterId === "chino") {
    drawChino(ctx, player, worldTime);
    return;
  }
  if (characterId === "ger") {
    drawGer(ctx, player, worldTime);
    return;
  }
  drawFlor(ctx, player, worldTime);
}

function RunnerPreview({ characterId, active }: { characterId: string; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.scale(3, 3);
    ctx.translate(0, -114);
    drawRunner(
      ctx,
      {
        x: 8,
        rise: 0,
        vy: 0,
        ducking: false,
        dead: false,
        jumpHeld: false,
        reachedMinRise: false,
        speedDrop: false,
      },
      2000,
      characterId
    );
    ctx.restore();
  }, [characterId]);

  return <canvas ref={canvasRef} className={`runner-preview-canvas${active ? " is-active" : ""}`} width={96} height={96} aria-hidden="true" />;
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine && ctx.measureText(candidate).width > maxWidth) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawScorePopups(ctx: CanvasRenderingContext2D, state: GameState) {
  if (!state.scorePopups.length) return;
  const previousAlign = ctx.textAlign;
  const previousBaseline = ctx.textBaseline;
  const previousAlpha = ctx.globalAlpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 11px monospace";
  for (const popup of state.scorePopups) {
    ctx.globalAlpha = clamp(popup.life / 1150, 0, 1);
    ctx.fillStyle = popup.color;
    ctx.fillText(popup.text, popup.x, popup.y);
  }
  ctx.globalAlpha = previousAlpha;
  ctx.textAlign = previousAlign;
  ctx.textBaseline = previousBaseline;
}

function drawQuizFeedback(ctx: CanvasRenderingContext2D, state: GameState) {
  if (!state.quizFeedback) return;

  const feedback = state.quizFeedback;
  const previousAlign = ctx.textAlign;
  const previousBaseline = ctx.textBaseline;
  const previousAlpha = ctx.globalAlpha;
  const progress = 1 - feedback.life / feedback.totalLife;
  const fadeIn = clamp(progress / 0.16, 0, 1);
  const fadeOut = clamp(feedback.life / (feedback.totalLife * 0.42), 0, 1);
  const alpha = Math.min(fadeIn, fadeOut);
  const y = 48 - progress * 6;
  const width = Math.max(152, feedback.title.length * 8 + 34);
  const left = (W - width) / 2;

  ctx.globalAlpha = alpha;
  drawRect(ctx, left, y - 18, width, 36, "rgba(15, 23, 42, 0.88)");
  drawRect(ctx, left, y - 18, width, 5, feedback.glow);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = feedback.color;
  ctx.font = "bold 13px monospace";
  ctx.fillText(feedback.title, W / 2, y - 2);
  ctx.font = "bold 8px monospace";
  ctx.fillText(feedback.pointsText, W / 2, y + 10);
  ctx.globalAlpha = previousAlpha;
  ctx.textAlign = previousAlign;
  ctx.textBaseline = previousBaseline;
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState) {
  drawRect(ctx, 8, 8, 86, 24, "rgba(255,255,255,0.75)");
  drawRect(ctx, 114, 8, 132, 24, "rgba(255,255,255,0.75)");
  drawRect(ctx, 264, 8, 88, 24, "rgba(255,255,255,0.75)");
  ctx.fillStyle = COLORS.hud;
  ctx.font = "bold 8px monospace";
  ctx.fillText(`DIST ${String(Math.floor(state.distance)).padStart(4, "0")}`, 14, 18);
  const formattedScore = `${state.score < 0 ? "-" : "+"}${String(Math.abs(state.score)).padStart(5, "0")}`;
  ctx.fillText(`SCORE ${formattedScore}`, 120, 18);
  ctx.fillText(`BEST ${String(Math.floor(state.bestDistance)).padStart(4, "0")}`, 270, 18);
  ctx.font = "7px monospace";
  ctx.fillText("Jump: Space / Up", 14, 27);
  ctx.fillText("Quiz: 1 / 2 / 3", 138, 27);
  ctx.fillText("Duck: Down", 270, 27);
}

function drawQuizOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
  if (!state.activeQuiz) return;
  drawRect(ctx, 0, 0, W, H, "rgba(2, 6, 23, 0.72)");
}

function drawOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
  if (state.phase === "quiz") {
    drawQuizOverlay(ctx, state);
    return;
  }

  drawRect(ctx, 80, 22, 200, 96, "rgba(255,255,255,0.84)");
  ctx.fillStyle = COLORS.hud;
  ctx.textAlign = "center";
  ctx.font = "bold 10px monospace";
  if (state.phase === "gameover") {
    ctx.fillText("GAME OVER", W / 2, 56);
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
  invariant(QUIZ_QUESTIONS.every((question) => question.answers.length === 3), "Each quiz question should expose exactly three answers");
  invariant(QUIZ_QUESTIONS.every((question) => question.correctIndex >= 0 && question.correctIndex < 3), "Each quiz question must have a valid correct answer");
}

export default function UshuaiaRunnerFlorPrototype() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderScaleRef = useRef(3);
  const rafRef = useRef(0);
  const keysRef = useRef({ duckHeld: false });
  const stateRef = useRef<GameState>(createInitialState());
  const selectedCharacterRef = useRef("flor");
  const nicknameRef = useRef("");
  const submittedScoreRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<Phase>("ready");
  const [distance, setDistance] = useState(0);
  const [best, setBest] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedCharacter, setSelectedCharacter] = useState("flor");
  const [quizUi, setQuizUi] = useState<ActiveQuiz | null>(null);
  const [nickname, setNickname] = useState("");
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [leaderboardStatus, setLeaderboardStatus] = useState("");

  useEffect(() => {
    document.title = "Run Flow Run";
  }, []);

  useEffect(() => {
    selectedCharacterRef.current = selectedCharacter;
  }, [selectedCharacter]);

  useEffect(() => {
    nicknameRef.current = nickname;
  }, [nickname]);

  useEffect(() => {
    const storedNickname = window.localStorage.getItem(NICKNAME_STORAGE_KEY) ?? "";
    const normalizedStoredNickname = normalizeNickname(storedNickname);
    if (normalizedStoredNickname) {
      if (normalizedStoredNickname !== storedNickname) {
        window.localStorage.setItem(NICKNAME_STORAGE_KEY, normalizedStoredNickname);
      }
      setNickname(normalizedStoredNickname);
      setNicknameDraft(normalizedStoredNickname);
    } else {
      setIsNicknameModalOpen(true);
    }

    let cancelled = false;
    const loadLeaderboard = async () => {
      setLeaderboardLoading(true);
      setLeaderboardError("");
      try {
        const rows = await fetchTopLeaderboard();
        if (!cancelled) setLeaderboard(rows);
      } catch {
        if (!cancelled) setLeaderboardError("No pudimos cargar el Top 10.");
      } finally {
        if (!cancelled) setLeaderboardLoading(false);
      }
    };

    void loadLeaderboard();
    return () => {
      cancelled = true;
    };
  }, []);

  const syncCanvasResolution = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const width = Math.max(container.clientWidth || W, 320);
    const scale = clamp(Math.ceil(width / W), 2, 5);
    renderScaleRef.current = scale;
    canvas.width = W * scale;
    canvas.height = H * scale;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${(width * H) / W}px`;
  };

  const resumeFromQuiz = () => {
    const state = stateRef.current;
    state.activeQuiz = null;
    state.phase = "running";
    setQuizUi(null);
    setPhase("running");
  };

  const triggerQuiz = () => {
    const state = stateRef.current;
    if (state.phase !== "running") return;
    keysRef.current.duckHeld = false;
    state.player.ducking = false;
    state.player.jumpHeld = false;
    state.player.speedDrop = false;
    if (state.nextQuizQuestionIndex >= state.quizOrder.length) {
      state.quizOrder = createQuizOrder();
      state.nextQuizQuestionIndex = 0;
    }
    const questionIndex = state.quizOrder[state.nextQuizQuestionIndex] ?? 0;
    state.activeQuiz = {
      questionIndex,
      remainingMs: QUIZ_DURATION_MS,
    };
    state.nextQuizQuestionIndex += 1;
    state.phase = "quiz";
    setQuizUi({ questionIndex, remainingMs: QUIZ_DURATION_MS });
    setPhase("quiz");
  };

  const resolveQuizOutcome = (outcome: QuizOutcome) => {
    const state = stateRef.current;
    if (state.phase !== "quiz" || !state.activeQuiz) return;
    const delta =
      outcome === "correct"
        ? QUIZ_SCORE_DELTA
        : outcome === "incorrect"
          ? -QUIZ_WRONG_SCORE_DELTA
          : -QUIZ_TIMEOUT_SCORE_DELTA;
    state.score += delta;
    state.quizFeedback = createQuizFeedback(outcome);
    if (outcome === "correct") launchQuizConfetti(state, state.quizFeedback.title);
    setScore(state.score);
    resumeFromQuiz();
  };

  const resolveQuizChoice = (choiceIndex: number) => {
    const state = stateRef.current;
    if (state.phase !== "quiz" || !state.activeQuiz) return;
    const question = QUIZ_QUESTIONS[state.activeQuiz.questionIndex]!;
    resolveQuizOutcome(choiceIndex === question.correctIndex ? "correct" : "incorrect");
  };

  const resetGame = (startRunning = true) => {
    const bestDistance = Math.max(stateRef.current.bestDistance, stateRef.current.distance);
    const dayNightTime = stateRef.current.dayNightTime;
    stateRef.current = { ...createInitialState(), bestDistance, dayNightTime, phase: startRunning ? "running" : "ready" };
    submittedScoreRef.current = null;
    setBest(Math.floor(bestDistance));
    setDistance(0);
    setScore(0);
    setQuizUi(null);
    setPhase(startRunning ? "running" : "ready");
  };

  const pressJump = () => {
    if (!nicknameRef.current.trim()) {
      setNicknameDraft("");
      setIsNicknameModalOpen(true);
      return;
    }
    let state = stateRef.current;
    if (state.phase === "ready") {
      resetGame(true);
      state = stateRef.current;
    }
    if (state.phase === "gameover" || state.phase === "quiz") return;
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
    const state = stateRef.current;
    if (state.phase === "gameover" || state.phase === "quiz") {
      keysRef.current.duckHeld = false;
      state.player.ducking = false;
      return;
    }
    keysRef.current.duckHeld = value;
    const player = state.player;
    if (value && player.rise > 0) setSpeedDrop(player);
    if (!value && state.phase === "ready") player.ducking = false;
  };

  const saveNickname = () => {
    const nextNickname = normalizeNickname(nicknameDraft);
    if (!nextNickname) return;
    window.localStorage.setItem(NICKNAME_STORAGE_KEY, nextNickname);
    setNickname(nextNickname);
    setNicknameDraft(nextNickname);
    setIsNicknameModalOpen(false);
  };

  useEffect(() => {
    if (phase !== "gameover") return;
    const currentNickname = nicknameRef.current.trim();
    if (!currentNickname) return;

    const state = stateRef.current;
    const signature = `${currentNickname}:${selectedCharacterRef.current}:${Math.floor(state.distance)}:${state.score}`;
    if (submittedScoreRef.current === signature) return;
    submittedScoreRef.current = signature;

    let cancelled = false;
    const syncLeaderboard = async () => {
      setLeaderboardStatus("Guardando en el ranking...");
      setLeaderboardError("");
      try {
        const result = await submitBestLeaderboardScore({
          nickname: currentNickname,
          character_id: selectedCharacterRef.current,
          score: state.score,
          distance: Math.floor(state.distance),
        });
        const rows = await fetchTopLeaderboard();
        if (!cancelled) {
          setLeaderboard(rows);
          setLeaderboardStatus(
            result.status === "kept-existing"
              ? "Tu mejor corrida anterior sigue arriba."
              : "Ranking actualizado con tu mejor corrida."
          );
        }
      } catch (error) {
        if (!cancelled) {
          const detail = error instanceof Error ? error.message : "Error desconocido";
          setLeaderboardError(`No pudimos guardar esta corrida en Supabase. ${detail}`);
          setLeaderboardStatus("");
        }
      }
    };

    void syncLeaderboard();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  useEffect(() => {
    runSelfChecks();
    syncCanvasResolution();
    const observer = new ResizeObserver(() => syncCanvasResolution());
    if (containerRef.current) observer.observe(containerRef.current);

    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "Space", "Enter", "KeyW", "KeyS", "Digit1", "Digit2", "Digit3", "Numpad1", "Numpad2", "Numpad3"].includes(event.code)) {
        event.preventDefault();
      }

      if (stateRef.current.phase === "gameover") {
        if (!event.repeat && event.code === "Enter") resetGame(true);
        return;
      }

      if (stateRef.current.phase === "quiz") {
        if (event.repeat) return;
        if (event.code === "Digit1" || event.code === "Numpad1") resolveQuizChoice(0);
        if (event.code === "Digit2" || event.code === "Numpad2") resolveQuizChoice(1);
        if (event.code === "Digit3" || event.code === "Numpad3") resolveQuizChoice(2);
        return;
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
      if (stateRef.current.phase === "quiz") return;
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
      state.dayNightTime += dtMs;
      state.scorePopups = updateScorePopups(state.scorePopups, dtMs, dt);
      state.quizFeedback = updateQuizFeedback(state.quizFeedback, dtMs);

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

        const hasQuizStarOnScreen = state.obstacles.some((obstacle) => obstacle.type === "quizStar");
        const hasGameplayObstaclesOnScreen = state.obstacles.some((obstacle) => obstacle.type !== "quizStar");
        const enoughRoomBeforeNextObstacle = state.nextObstacleDistance - state.distance > 42;
        const canSpawnQuizStar =
          !hasQuizStarOnScreen &&
          !hasGameplayObstaclesOnScreen &&
          enoughRoomBeforeNextObstacle &&
          state.distance >= state.nextStarDistance;

        if (canSpawnQuizStar) {
          state.obstacles.push(createQuizStar());
          state.nextStarDistance = getNextStarDistance(state.distance);
        } else if (!hasQuizStarOnScreen && state.distance >= state.nextObstacleDistance) {
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
          particle.vy += (particle.gravity ?? 0) * dt;
          particle.life -= dtMs;
        }
        state.particles = state.particles.filter((particle) => particle.life > 0);

        const collectedStarIndex = state.obstacles.findIndex(
          (obstacle) => obstacle.type === "quizStar" && collides(player, obstacle, state.worldTime)
        );
        if (collectedStarIndex >= 0) {
          state.obstacles.splice(collectedStarIndex, 1);
          triggerQuiz();
        }

        if (
          state.phase === "running" &&
          state.obstacles.some((obstacle) => obstacle.type !== "quizStar" && collides(player, obstacle, state.worldTime))
        ) {
          state.phase = "gameover";
          player.dead = true;
          player.jumpHeld = false;
          state.bestDistance = Math.max(state.bestDistance, state.distance);
          setBest(Math.floor(state.bestDistance));
          setPhase("gameover");
        }

        setDistance(Math.floor(state.distance));
      } else if (state.phase === "quiz") {
        if (state.activeQuiz) {
          state.activeQuiz.remainingMs -= dtMs;
          setQuizUi({
            questionIndex: state.activeQuiz.questionIndex,
            remainingMs: Math.max(0, state.activeQuiz.remainingMs),
          });
          if (state.activeQuiz.remainingMs <= 0) {
            resolveQuizOutcome("timeout");
          }
        }
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
      drawBackground(ctx, state.worldTime, state.dayNightTime);
      state.obstacles.forEach((obstacle) => drawObstacle(ctx, obstacle, state.worldTime));
      state.particles.forEach((particle) => drawParticle(ctx, particle));
      drawRunner(ctx, state.player, state.worldTime, selectedCharacterRef.current);
      drawHud(ctx, state);
      drawScorePopups(ctx, state);
      if (state.phase !== "running") drawOverlay(ctx, state);
      drawQuizFeedback(ctx, state);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const activeQuizQuestion = phase === "quiz" && quizUi
    ? QUIZ_QUESTIONS[quizUi.questionIndex] ?? null
    : null;
  const quizTimeRatio = quizUi ? Math.max(0, Math.min(1, quizUi.remainingMs / QUIZ_DURATION_MS)) : 0;

  return (
    <div className="app-shell">
      <div className="app-layout">
        <section className="top-band">
          <div className="hero-block">
            <img className="hero-logo" src={runFlowRunIcon} alt="Run Flow Run" />
            <p className="hero-copy">
              {"Sos un agente de Delver y ten\u00E9s que superar obst\u00E1culos en el muelle!"}
            </p>
          </div>

          <div className="picker-band">
            <div className="picker-head">
              <div>
                <div className="picker-title">Elegi tu corredor</div>
                <div className="picker-copy">Cada agente tiene su propio slot visual.</div>
              </div>
              <div className="team-chip">Delver Team</div>
            </div>

            <div className="runner-picker-row">
              {CHARACTERS.map((character) => {
                const active = selectedCharacter === character.id;
                const disabled = character.status !== "available";
                return (
                  <button
                    key={character.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && setSelectedCharacter(character.id)}
                    className={`runner-choice ${active ? "is-active" : ""} ${disabled ? "is-disabled" : ""}`}
                  >
                    <span className="runner-choice-sprite">
                      <RunnerPreview characterId={character.id} active={active && !disabled} />
                    </span>
                    <span className="runner-choice-name">{character.name}</span>
                    <span className="runner-choice-state">{disabled ? "soon" : active ? "selected" : "ready"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="controls-inline">
            <span className="controls-inline-item"><span className="key-chip">Space / Up</span> saltar</span>
            <span className="controls-inline-item"><span className="key-chip">Down</span> duck</span>
            <span className="controls-inline-item"><span className="key-chip">1 / 2 / 3</span> responder quiz</span>
            <span className="controls-inline-item"><span className="key-chip">Nick</span> {nickname || "pendiente"}</span>
            <button type="button" className="nickname-trigger" onClick={() => setIsNicknameModalOpen(true)}>
              Cambiar nick
            </button>
          </div>
        </section>

        <main className="game-shell">
          <div className="game-card">
            <div ref={containerRef} className="canvas-frame">
              <div
                className="game-stage"
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
                {(phase === "running" || phase === "ready") && (
                  <div className="stage-action-bar">
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
                {phase === "quiz" && activeQuizQuestion && (
                  <div className="quiz-touch-panel">
                    <div className="quiz-touch-title">Tocá una respuesta</div>
                    <div className="quiz-touch-header">
                      <div className="quiz-touch-kicker">Quiz Star</div>
                      <div className="quiz-touch-timer">{((quizUi?.remainingMs ?? 0) / 1000).toFixed(1)}s</div>
                    </div>
                    <div className="quiz-touch-progress">
                      <div className="quiz-touch-progress-bar" style={{ transform: `scaleX(${quizTimeRatio})` }} />
                    </div>
                    <div className="quiz-touch-question">{activeQuizQuestion.prompt}</div>
                    <div className="quiz-touch-options">
                      {activeQuizQuestion.answers.map((answer, index) => (
                        <button
                          key={`${activeQuizQuestion.prompt}-${index}`}
                          type="button"
                          onClick={() => resolveQuizChoice(index)}
                          className="quiz-choice-button"
                        >
                          <span className="quiz-choice-index">{index + 1}</span>
                          <span className="quiz-choice-text">{answer}</span>
                        </button>
                      ))}
                    </div>
                    <div className="quiz-touch-hint">Podes tocar una opcion o usar el teclado con 1 / 2 / 3.</div>
                  </div>
                )}
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
                      <div style={{ marginTop: 16, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
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
                            Puntos
                          </div>
                          <div style={{ marginTop: 6, fontSize: 24, fontWeight: 700, color: "#ffffff" }}>{score}</div>
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
                        {"Presion\u00E1 Enter para empezar de nuevo"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <section className="leaderboard-panel">
            <div className="leaderboard-head">
              <div>
                <div className="leaderboard-title">Top 10 corredores</div>
                <div className="leaderboard-copy">Ordenado por total de puntos = puntos + distancia.</div>
              </div>
              <div className="leaderboard-badge">Supabase Live</div>
            </div>

            {leaderboardStatus ? <div className="leaderboard-status">{leaderboardStatus}</div> : null}
            {leaderboardError ? <div className="leaderboard-error">{leaderboardError}</div> : null}

            <div className="leaderboard-table-wrap">
              <div className="leaderboard-table">
                <div className="leaderboard-row leaderboard-row-head">
                  <span>#</span>
                  <span>Nick</span>
                  <span>Corredor</span>
                  <span>Puntos</span>
                  <span>Distancia</span>
                  <span>Total</span>
                </div>
                {leaderboardLoading ? (
                  <div className="leaderboard-empty">Cargando ranking...</div>
                ) : leaderboard.length ? (
                  leaderboard.map((entry, index) => (
                    <div key={entry.id} className="leaderboard-row">
                      <span>{index + 1}</span>
                      <span>{entry.nickname}</span>
                      <span>{getCharacterName(entry.character_id)}</span>
                      <span>{entry.score}</span>
                      <span>{entry.distance}</span>
                      <span>{entry.total_points}</span>
                    </div>
                  ))
                ) : (
                  <div className="leaderboard-empty">Todavia no hay corridas guardadas.</div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>

      {isNicknameModalOpen && (
        <div className="nickname-modal-backdrop">
          <div className="nickname-modal">
            <div className="nickname-modal-kicker">Leaderboard</div>
            <h2 className="nickname-modal-title">Ingresa tu nickname</h2>
            <p className="nickname-modal-copy">
              Vamos a guardar tus mejores corridas con tu nick, el corredor elegido, puntos y distancia.
            </p>
            <form
              className="nickname-form"
              onSubmit={(event) => {
                event.preventDefault();
                saveNickname();
              }}
            >
              <input
                autoFocus
                maxLength={24}
                value={nicknameDraft}
                onChange={(event) => setNicknameDraft(event.target.value)}
                className="nickname-input"
                placeholder="Tu nick..."
              />
              <div className="nickname-actions">
                {nickname ? (
                  <button type="button" className="nickname-secondary" onClick={() => setIsNicknameModalOpen(false)}>
                    Cancelar
                  </button>
                ) : null}
                <button type="submit" className="nickname-primary" disabled={!nicknameDraft.trim()}>
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
