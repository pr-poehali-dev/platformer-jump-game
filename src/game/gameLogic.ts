import {
  CANVAS_W, CANVAS_H, PLAT_GAP, PLAYER_W, PLAYER_H,
  PLAT_COLORS, BOOST_COLOR, ENEMY_EMOJIS,
  Platform, Enemy, Bonus, BonusKind, Particle, GameState,
} from "./gameTypes";

export function makePlatform(y: number, forceNormal = false): Platform {
  const boost = !forceNormal && Math.random() < 0.22;
  return {
    x: Math.random() * (CANVAS_W - 100) + 5,
    y,
    w: boost ? 65 : 90 + Math.random() * 55,
    boost,
    color: boost ? BOOST_COLOR : PLAT_COLORS[Math.floor(Math.random() * PLAT_COLORS.length)],
  };
}

export function makeEnemy(y: number): Enemy {
  return {
    x: Math.random() * (CANVAS_W - 40),
    y,
    w: 36, h: 28,
    dir: Math.random() < 0.5 ? 1 : -1,
    speed: 0.6 + Math.random() * 0.9,
    emoji: ENEMY_EMOJIS[Math.floor(Math.random() * ENEMY_EMOJIS.length)],
  };
}

export function makeBonus(y: number): Bonus {
  const kinds: BonusKind[] = ["star","shield","slow","fast","shrink","magnet"];
  const weights = [0.4, 0.15, 0.15, 0.15, 0.075, 0.075];
  const r = Math.random(); let acc = 0; let kind: BonusKind = "star";
  for (let i = 0; i < kinds.length; i++) { acc += weights[i]; if (r < acc) { kind = kinds[i]; break; } }
  return { x: Math.random() * (CANVAS_W - 30) + 10, y, kind, collected: false };
}

export function spawnParticles(arr: Particle[], x: number, y: number, color: string, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 2 + Math.random() * 3;
    arr.push({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 30 + Math.random() * 20, maxLife: 50, color, r: 3 + Math.random() * 4,
    });
  }
}

export function initGame(): GameState {
  const platforms: Platform[] = [];
  for (let i = 0; i < 16; i++) {
    const y = CANVAS_H - 60 - i * PLAT_GAP;
    platforms.push(makePlatform(y, i === 0));
  }
  platforms[0] = { x: CANVAS_W / 2 - 50, y: CANVAS_H - 60, w: 100, boost: false, color: "#6BCB77" };
  const topPlatY = Math.min(...platforms.map(p => p.y));

  return {
    playerX: CANVAS_W / 2 - PLAYER_W / 2,
    playerY: CANVAS_H - 60 - PLAYER_H,
    velY: 0, velX: 0,
    platforms, enemies: [], bonuses: [], particles: [], floatTexts: [],
    score: 0, cameraY: 0,
    alive: true, facingLeft: false,
    highestY: CANVAS_H - 60 - PLAYER_H,
    nextPlatY: topPlatY - PLAT_GAP,
    shieldTimer: 0, slowTimer: 0, fastTimer: 0, magnetTimer: 0, shrinkTimer: 0,
    invincible: 0, stars: 0, hitCooldown: 0,
  };
}

export function drawFrog(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  left: boolean, shielded: boolean
) {
  ctx.save();
  if (shielded) {
    ctx.shadowColor = "#4D96FF";
    ctx.shadowBlur = 18;
  }
  if (left) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.font = `${w}px serif`;
    ctx.textAlign = "left";
    ctx.fillText("🐸", 0, h * 0.92);
  } else {
    ctx.font = `${w}px serif`;
    ctx.textAlign = "left";
    ctx.fillText("🐸", x, y + h * 0.92);
  }
  if (shielded) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(77,150,255,0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2 + 4, h / 2 + 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
