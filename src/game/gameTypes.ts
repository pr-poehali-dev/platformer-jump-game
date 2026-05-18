// ─── Константы ───────────────────────────────────────────────
export const CANVAS_W = 400;
export const CANVAS_H = 560;
export const GRAVITY = 0.22;
export const JUMP_FORCE = -9.5;
export const BOOST_FORCE = -15.5;
export const PLAYER_W = 40;
export const PLAYER_H = 40;
export const PLAT_GAP = 80;

// ─── Цвета ───────────────────────────────────────────────────
export const PLAT_COLORS = ["#FF6B6B","#FFD93D","#6BCB77","#4D96FF","#FF6FD8","#FF922B"];
export const BOOST_COLOR  = "#FFD700";
export const ENEMY_EMOJIS = ["🦀","👾","🐛","🕷️"];

// ─── Типы ────────────────────────────────────────────────────
export interface Platform {
  x: number; y: number; w: number;
  boost: boolean; color: string;
}

export type EnemyDir = 1 | -1;
export interface Enemy {
  x: number; y: number;
  w: number; h: number;
  dir: EnemyDir; speed: number;
  emoji: string;
}

export type BonusKind = "star" | "shield" | "slow" | "fast" | "shrink" | "magnet";
export interface Bonus {
  x: number; y: number;
  kind: BonusKind; collected: boolean;
}

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; r: number;
}

export interface FloatText {
  x: number; y: number;
  text: string; color: string;
  life: number; maxLife: number;
}

export interface GameState {
  playerX: number; playerY: number;
  velY: number; velX: number;
  platforms: Platform[];
  enemies: Enemy[];
  bonuses: Bonus[];
  particles: Particle[];
  floatTexts: FloatText[];
  score: number;
  cameraY: number;
  alive: boolean;
  facingLeft: boolean;
  highestY: number;
  nextPlatY: number;
  shieldTimer: number;
  slowTimer: number;
  fastTimer: number;
  magnetTimer: number;
  shrinkTimer: number;
  invincible: number;
  stars: number;
  hitCooldown: number;
}

export const BONUS_META: Record<BonusKind, { emoji: string; label: string; color: string }> = {
  star:   { emoji: "⭐", label: "+50 очков",       color: "#FFD93D" },
  shield: { emoji: "🛡️", label: "Щит 5 сек",       color: "#4D96FF" },
  slow:   { emoji: "🌀", label: "Лёгкость 4 сек",   color: "#B39DDB" },
  fast:   { emoji: "🔥", label: "Скорость 4 сек",   color: "#FF922B" },
  shrink: { emoji: "🔮", label: "Уменьшение 5 сек", color: "#FF6FD8" },
  magnet: { emoji: "🧲", label: "Магнит 5 сек",     color: "#26C6DA" },
};

export type Page = "home" | "game" | "rules" | "leaderboard";
