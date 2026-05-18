import { useState, useEffect, useRef, useCallback } from "react";

// ─── Константы ───────────────────────────────────────────────
const CANVAS_W = 400;
const CANVAS_H = 560;
const GRAVITY = 0.22;
const JUMP_FORCE = -9.5;
const BOOST_FORCE = -15.5;
const PLAYER_W = 40;
const PLAYER_H = 40;
const PLAT_GAP = 80;

// ─── Типы ────────────────────────────────────────────────────
interface Platform {
  x: number; y: number; w: number;
  boost: boolean; color: string;
}

type EnemyDir = 1 | -1;
interface Enemy {
  x: number; y: number;       // мировые координаты (y = верх врага)
  w: number; h: number;
  dir: EnemyDir; speed: number;
  emoji: string;
}

type BonusKind = "star" | "shield" | "slow" | "fast" | "shrink" | "magnet";
interface Bonus {
  x: number; y: number;
  kind: BonusKind; collected: boolean;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; r: number;
}

interface GameState {
  playerX: number; playerY: number;
  velY: number; velX: number;
  platforms: Platform[];
  enemies: Enemy[];
  bonuses: Bonus[];
  particles: Particle[];
  score: number;
  cameraY: number;
  alive: boolean;
  facingLeft: boolean;
  highestY: number;
  nextPlatY: number;
  // эффекты
  shieldTimer: number;    // кадры неуязвимости
  slowTimer: number;      // замедление гравитации
  fastTimer: number;      // ускоренное движение
  magnetTimer: number;    // притяжение бонусов
  shrinkTimer: number;    // маленький размер
  invincible: number;     // мигание после удара
  stars: number;          // собранные звёзды
  hitCooldown: number;    // кадры после удара
}

// ─── Цвета ───────────────────────────────────────────────────
const PLAT_COLORS = ["#FF6B6B","#FFD93D","#6BCB77","#4D96FF","#FF6FD8","#FF922B"];
const BOOST_COLOR  = "#FFD700";

const BONUS_META: Record<BonusKind, { emoji: string; label: string; color: string }> = {
  star:   { emoji: "⭐", label: "+50 очков",       color: "#FFD93D" },
  shield: { emoji: "🛡️", label: "Щит 5 сек",       color: "#4D96FF" },
  slow:   { emoji: "🌀", label: "Лёгкость 4 сек",   color: "#B39DDB" },
  fast:   { emoji: "🔥", label: "Скорость 4 сек",   color: "#FF922B" },
  shrink: { emoji: "🔮", label: "Уменьшение 5 сек", color: "#FF6FD8" },
  magnet: { emoji: "🧲", label: "Магнит 5 сек",     color: "#26C6DA" },
};

const ENEMY_EMOJIS = ["🦀","👾","🐛","🕷️"];

// ─── Вспомогательные ─────────────────────────────────────────
function makePlatform(y: number, forceNormal = false): Platform {
  const boost = !forceNormal && Math.random() < 0.22;
  return {
    x: Math.random() * (CANVAS_W - 100) + 5,
    y,
    w: boost ? 65 : 90 + Math.random() * 55,  // шире
    boost,
    color: boost ? BOOST_COLOR : PLAT_COLORS[Math.floor(Math.random() * PLAT_COLORS.length)],
  };
}

function makeEnemy(y: number): Enemy {
  return {
    x: Math.random() * (CANVAS_W - 40),
    y,
    w: 36, h: 28,
    dir: Math.random() < 0.5 ? 1 : -1,
    speed: 0.6 + Math.random() * 0.9,  // медленнее
    emoji: ENEMY_EMOJIS[Math.floor(Math.random() * ENEMY_EMOJIS.length)],
  };
}

function makeBonus(y: number): Bonus {
  const kinds: BonusKind[] = ["star","shield","slow","fast","shrink","magnet"];
  // взвешенные шансы
  const weights = [0.4, 0.15, 0.15, 0.15, 0.075, 0.075];
  const r = Math.random(); let acc = 0; let kind: BonusKind = "star";
  for (let i = 0; i < kinds.length; i++) { acc += weights[i]; if (r < acc) { kind = kinds[i]; break; } }
  return { x: Math.random() * (CANVAS_W - 30) + 10, y, kind, collected: false };
}

function spawnParticles(arr: Particle[], x: number, y: number, color: string, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 2 + Math.random() * 3;
    arr.push({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 30 + Math.random() * 20, maxLife: 50, color, r: 3 + Math.random() * 4,
    });
  }
}

function initGame(): GameState {
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
    platforms, enemies: [], bonuses: [], particles: [],
    score: 0, cameraY: 0,
    alive: true, facingLeft: false,
    highestY: CANVAS_H - 60 - PLAYER_H,
    nextPlatY: topPlatY - PLAT_GAP,
    shieldTimer: 0, slowTimer: 0, fastTimer: 0, magnetTimer: 0, shrinkTimer: 0,
    invincible: 0, stars: 0, hitCooldown: 0,
  };
}

// ─── Рисование лягушонка-эмодзи (без белого фона) ────────────
function drawFrog(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, left: boolean, shielded: boolean) {
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

type Page = "home" | "game" | "rules" | "leaderboard";

// ─── Компонент ───────────────────────────────────────────────
export default function Index() {
  const [page, setPage] = useState<Page>("home");
  const [records, setRecords] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("jumpRecords") || "[]"); } catch { return []; }
  });
  const [finalScore, setFinalScore] = useState(0);
  const [gameRunning, setGameRunning] = useState(false);
  const [activeEffect, setActiveEffect] = useState<string>("");

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const gameRef    = useRef<GameState | null>(null);
  const animRef    = useRef<number>(0);
  const keysRef    = useRef({ left: false, right: false });
  const effectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashEffect = useCallback((label: string) => {
    setActiveEffect(label);
    if (effectTimerRef.current) clearTimeout(effectTimerRef.current);
    effectTimerRef.current = setTimeout(() => setActiveEffect(""), 1800);
  }, []);

  const saveRecord = useCallback((score: number) => {
    setRecords(prev => {
      const updated = [...prev, score].sort((a, b) => b - a).slice(0, 10);
      localStorage.setItem("jumpRecords", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // ── Отрисовка ──────────────────────────────────────────────
  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const s = gameRef.current;
    if (!ctx || !s) return;

    // Небо
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    skyGrad.addColorStop(0, "#4BA8D8");
    skyGrad.addColorStop(1, "#C8E8FF");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Облака
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    [[55,80],[190,160],[320,55],[120,290],[265,410]].forEach(([cx, cyB]) => {
      const cy = ((cyB - s.cameraY * 0.28) % (CANVAS_H + 120) + (CANVAS_H + 120)) % (CANVAS_H + 120) - 60;
      ctx.beginPath();
      ctx.arc(cx,cy,20,0,Math.PI*2);
      ctx.arc(cx+24,cy-9,15,0,Math.PI*2);
      ctx.arc(cx+44,cy,18,0,Math.PI*2);
      ctx.fill();
    });

    // Платформы
    s.platforms.forEach(p => {
      const sy = p.y - s.cameraY;
      if (sy < -24 || sy > CANVAS_H + 12) return;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.2)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.roundRect(p.x, sy, p.w, 16, 8); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.38)";
      ctx.beginPath(); ctx.roundRect(p.x+5, sy+2, p.w-10, 5, 3); ctx.fill();
      if (p.boost) {
        ctx.font = "13px serif"; ctx.textAlign = "center";
        ctx.fillText("⚡", p.x + p.w/2, sy - 4);
      }
      ctx.restore();
    });

    // Враги
    s.enemies.forEach(e => {
      const sy = e.y - s.cameraY;
      if (sy < -40 || sy > CANVAS_H + 10) return;
      ctx.font = `${e.w}px serif`;
      ctx.textAlign = "left";
      ctx.fillText(e.emoji, e.x, sy + e.h * 0.92);
    });

    // Бонусы
    s.bonuses.forEach(b => {
      if (b.collected) return;
      const sy = b.y - s.cameraY;
      if (sy < -30 || sy > CANVAS_H + 10) return;
      // мягкое свечение
      ctx.save();
      ctx.shadowColor = BONUS_META[b.kind].color;
      ctx.shadowBlur = 14;
      ctx.font = "24px serif";
      ctx.textAlign = "center";
      ctx.fillText(BONUS_META[b.kind].emoji, b.x + 14, sy + 22);
      ctx.restore();
    });

    // Частицы
    s.particles.forEach(p => {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - s.cameraY * 0 + 0, p.y - s.cameraY, p.r * alpha, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Игрок
    const pw = s.shrinkTimer > 0 ? PLAYER_W * 0.6 : PLAYER_W;
    const ph = s.shrinkTimer > 0 ? PLAYER_H * 0.6 : PLAYER_H;
    const screenPX = s.playerX + (PLAYER_W - pw) / 2;
    const screenPY = s.playerY - s.cameraY + (PLAYER_H - ph);
    // Мигание при уроне
    const visible = s.invincible > 0 ? Math.floor(s.invincible / 4) % 2 === 0 : true;
    if (visible) drawFrog(ctx, screenPX, screenPY, pw, ph, s.facingLeft, s.shieldTimer > 0);

    // HUD
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath(); ctx.roundRect(10,10,145,40,12); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 15px Nunito, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`⭐ ${s.score}  🌟${s.stars}`, 20, 34);

    // Иконки активных эффектов
    let ex = CANVAS_W - 14;
    const effs: [number, string][] = [
      [s.shieldTimer,"🛡️"],[s.slowTimer,"🌀"],[s.fastTimer,"🔥"],
      [s.magnetTimer,"🧲"],[s.shrinkTimer,"🔮"]
    ];
    effs.forEach(([t, em]) => {
      if (t <= 0) return;
      ctx.font = "20px serif"; ctx.textAlign = "right";
      ctx.fillText(em, ex, 34);
      ex -= 28;
    });

    ctx.fillStyle = "rgba(0,0,0,0.14)";
    ctx.font = "11px Nunito, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("← → или кнопки ниже", CANVAS_W/2, CANVAS_H - 8);
  }, []);

  // ── Игровой цикл ───────────────────────────────────────────
  const gameLoop = useCallback(() => {
    const s = gameRef.current;
    if (!s || !s.alive) return;

    // Таймеры эффектов
    if (s.shieldTimer > 0) s.shieldTimer--;
    if (s.slowTimer > 0) s.slowTimer--;
    if (s.fastTimer > 0) s.fastTimer--;
    if (s.magnetTimer > 0) s.magnetTimer--;
    if (s.shrinkTimer > 0) s.shrinkTimer--;
    if (s.invincible > 0) s.invincible--;
    if (s.hitCooldown > 0) s.hitCooldown--;

    const gravity = s.slowTimer > 0 ? GRAVITY * 0.45 : GRAVITY;
    const speed   = s.fastTimer > 0 ? 7 : 4.2;

    // Управление
    if (keysRef.current.left)  { s.velX = -speed; s.facingLeft = true; }
    else if (keysRef.current.right) { s.velX = speed; s.facingLeft = false; }
    else s.velX *= 0.78;

    // Физика
    s.velY += gravity;
    s.playerX += s.velX;
    s.playerY += s.velY;

    // Wrap
    if (s.playerX > CANVAS_W) s.playerX = -PLAYER_W;
    if (s.playerX + PLAYER_W < 0) s.playerX = CANVAS_W;

    // Коллизия с платформами
    if (s.velY > 0) {
      for (const p of s.platforms) {
        const prevBot = s.playerY + PLAYER_H - s.velY;
        const currBot = s.playerY + PLAYER_H;
        if (prevBot <= p.y && currBot >= p.y && s.playerX + PLAYER_W - 6 > p.x && s.playerX + 6 < p.x + p.w) {
          s.playerY = p.y - PLAYER_H;
          const jf = p.boost ? BOOST_FORCE : JUMP_FORCE;
          s.velY = s.slowTimer > 0 ? jf * 0.75 : jf;
          spawnParticles(s.particles, s.playerX + PLAYER_W/2, p.y, p.boost ? "#FFD700" : "#fff", p.boost ? 12 : 5);
          break;
        }
      }
    }

    // Камера
    const screenPY = s.playerY - s.cameraY;
    const thresh = CANVAS_H * 0.38;
    if (screenPY < thresh) s.cameraY -= thresh - screenPY;

    // Высота и счёт
    if (s.playerY < s.highestY) {
      s.highestY = s.playerY;
      s.score = Math.floor((CANVAS_H - s.highestY) / 8) + s.stars * 50;
    }

    // Генерация платформ + врагов + бонусов
    while (s.nextPlatY > s.cameraY - 120) {
      s.platforms.push(makePlatform(s.nextPlatY));
      // Враг раз в ~9 платформ (реже)
      if (Math.random() < 0.11) s.enemies.push(makeEnemy(s.nextPlatY - 30));
      // Бонус раз в ~3 платформы (чаще)
      if (Math.random() < 0.33) s.bonuses.push(makeBonus(s.nextPlatY - 50));
      s.nextPlatY -= PLAT_GAP + Math.random() * 15;
    }
    // Очищаем далёкие объекты
    const cutoff = s.cameraY + CANVAS_H + 250;
    s.platforms = s.platforms.filter(p => p.y < cutoff);
    s.enemies   = s.enemies.filter(e => e.y < cutoff);
    s.bonuses   = s.bonuses.filter(b => b.y < cutoff);

    // Движение врагов
    s.enemies.forEach(e => {
      e.x += e.dir * e.speed;
      if (e.x < 0) { e.x = 0; e.dir = 1; }
      if (e.x + e.w > CANVAS_W) { e.x = CANVAS_W - e.w; e.dir = -1; }
    });

    // Магнит: притягиваем бонусы к игроку
    if (s.magnetTimer > 0) {
      s.bonuses.forEach(b => {
        if (b.collected) return;
        const dx = (s.playerX + PLAYER_W/2) - (b.x + 14);
        const dy = (s.playerY + PLAYER_H/2) - (b.y + 14);
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 180) { b.x += dx * 0.07; b.y += dy * 0.07; }
      });
    }

    // Коллизия с бонусами
    s.bonuses.forEach(b => {
      if (b.collected) return;
      const px = s.playerX + PLAYER_W/2, py = s.playerY + PLAYER_H/2;
      const bx = b.x + 14, by = b.y + 14;
      if (Math.abs(px - bx) < 28 && Math.abs(py - by) < 28) {
        b.collected = true;
        spawnParticles(s.particles, bx, by, BONUS_META[b.kind].color, 10);
        const FPS = 60;
        switch (b.kind) {
          case "star":   s.stars++; s.score += 50; break;
          case "shield": s.shieldTimer = 5 * FPS; break;
          case "slow":   s.slowTimer = 4 * FPS; break;
          case "fast":   s.fastTimer = 4 * FPS; break;
          case "shrink": s.shrinkTimer = 5 * FPS; break;
          case "magnet": s.magnetTimer = 5 * FPS; break;
        }
        flashEffect(BONUS_META[b.kind].label);
      }
    });

    // Коллизия с врагами
    s.enemies.forEach(e => {
      const margin = s.shrinkTimer > 0 ? 10 : 5;
      const overlapX = s.playerX + PLAYER_W - margin > e.x && s.playerX + margin < e.x + e.w;
      const overlapY = s.playerY + PLAYER_H - margin > e.y && s.playerY + margin < e.y + e.h;
      if (!overlapX || !overlapY) return;

      // Прыжок сверху: игрок летит вниз и его ноги выше середины врага
      const stompedFromAbove = s.velY > 0 && (s.playerY + PLAYER_H - s.velY) <= e.y + e.h * 0.55;
      if (stompedFromAbove) {
        // Убиваем врага
        spawnParticles(s.particles, e.x + e.w/2, e.y, "#FFD93D", 14);
        e.y = 99999; // выкидываем за экран (удалим на очистке)
        s.score += 100;
        s.velY = JUMP_FORCE * 0.7; // отскок
        flashEffect("💀 +100 очков!");
      } else if (s.hitCooldown === 0) {
        if (s.shieldTimer > 0) {
          s.shieldTimer = 0;
          spawnParticles(s.particles, s.playerX + PLAYER_W/2, s.playerY + PLAYER_H/2, "#4D96FF", 14);
          flashEffect("🛡️ Щит сломан!");
        } else {
          s.score = Math.max(0, s.score - 100);
          s.invincible = 90;
          s.hitCooldown = 90;
          spawnParticles(s.particles, s.playerX + PLAYER_W/2, s.playerY + PLAYER_H/2, "#FF6B6B", 12);
          flashEffect("💥 -100 очков!");
        }
      }
    });

    // Частицы
    s.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
    });
    s.particles = s.particles.filter(p => p.life > 0);

    // Смерть
    if (s.playerY - s.cameraY > CANVAS_H + 100) {
      s.alive = false;
      setGameRunning(false);
      setFinalScore(s.score);
      saveRecord(s.score);
    }

    drawGame();
    animRef.current = requestAnimationFrame(gameLoop);
  }, [drawGame, saveRecord, flashEffect]);

  const startGame = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    gameRef.current = initGame();
    setFinalScore(0);
    setActiveEffect("");
    setGameRunning(true);
    setPage("game");
  }, []);

  useEffect(() => {
    if (gameRunning) animRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameRunning, gameLoop]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft"  || e.key === "a") keysRef.current.left  = true;
      if (e.key === "ArrowRight" || e.key === "d") keysRef.current.right = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft"  || e.key === "a") keysRef.current.left  = false;
      if (e.key === "ArrowRight" || e.key === "d") keysRef.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  useEffect(() => {
    if (page !== "game") return;
    const tilt = (e: DeviceOrientationEvent) => {
      const g = e.gamma || 0;
      keysRef.current.left  = g < -8;
      keysRef.current.right = g > 8;
    };
    window.addEventListener("deviceorientation", tilt);
    return () => window.removeEventListener("deviceorientation", tilt);
  }, [page]);

  const tL = (v: boolean) => { keysRef.current.left  = v; };
  const tR = (v: boolean) => { keysRef.current.right = v; };
  const navLabel = (p: Page) => p === "home" ? "🏠 Главная" : p === "rules" ? "📖 Правила" : "🏆 Рекорды";
  const goPage = (p: Page) => { cancelAnimationFrame(animRef.current); setGameRunning(false); setPage(p); };

  // ── JSX ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center" style={{ background: "var(--bg-main)", fontFamily: "'Nunito', sans-serif", color: "var(--color-text)" }}>

      {/* NAV */}
      <nav className="w-full flex items-center justify-between px-5 py-3 shadow-md sticky top-0 z-50" style={{ background: "var(--nav-bg)" }}>
        <span className="text-xl cursor-pointer select-none" style={{ fontFamily: "'Pacifico', cursive", color: "var(--color-accent)" }} onClick={() => goPage("home")}>
          🐸 ПрыгУн!
        </span>
        <div className="flex gap-1">
          {(["home","rules","leaderboard"] as Page[]).map(p => (
            <button key={p} onClick={() => goPage(p)}
              className="px-3 py-1 rounded-xl text-sm font-bold transition-all"
              style={{ background: page === p ? "var(--color-accent)" : "var(--btn-secondary)", color: page === p ? "#fff" : "var(--color-text)" }}>
              {navLabel(p)}
            </button>
          ))}
        </div>
      </nav>

      {/* HOME */}
      {page === "home" && (
        <div className="flex flex-col items-center flex-1 gap-7 py-10 px-4 text-center w-full">
          <div className="animate-bounce-in">
            <h1 className="text-6xl md:text-7xl mb-1" style={{ fontFamily: "'Pacifico', cursive", color: "var(--color-accent)", textShadow: "4px 4px 0 #FF922B, 7px 7px 0 rgba(0,0,0,0.08)" }}>
              ПрыгУн!
            </h1>
            <p className="text-xl font-bold mt-1">Прыгай выше, бей рекорды!</p>
          </div>

          <div className="text-8xl" style={{ animation: "float 3s ease-in-out infinite" }}>🐸</div>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={startGame} className="text-xl font-black py-4 px-10 rounded-2xl transition-all hover:scale-105 active:scale-95"
              style={{ background: "var(--color-accent)", color: "#fff", boxShadow: "0 6px 0 #c9510c,0 10px 20px rgba(0,0,0,0.15)" }}>
              🎮 ИГРАТЬ!
            </button>
            <button onClick={() => setPage("rules")} className="text-lg font-bold py-3 px-8 rounded-2xl transition-all hover:scale-105"
              style={{ background: "var(--btn-secondary)", color: "var(--color-text)", boxShadow: "0 4px 0 rgba(0,0,0,0.1)" }}>
              📖 Правила
            </button>
            <button onClick={() => setPage("leaderboard")} className="text-lg font-bold py-3 px-8 rounded-2xl transition-all hover:scale-105"
              style={{ background: "#FFD93D", color: "#7a4100", boxShadow: "0 4px 0 #c9a200" }}>
              🏆 Рекорды {records.length > 0 && `· лучший: ${records[0]}`}
            </button>
          </div>

          {/* Легенда */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
            {(Object.entries(BONUS_META) as [BonusKind, typeof BONUS_META[BonusKind]][]).map(([, m]) => (
              <div key={m.emoji} className="rounded-2xl p-2 text-center shadow" style={{ background: "var(--card-bg)" }}>
                <div className="text-xl">{m.emoji}</div>
                <div className="text-xs font-bold mt-1 leading-tight opacity-80">{m.label}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
            {[["🦀👾🐛🕷️","Враги","Касание = -100 очков"],["🛡️","Щит","Один бесплатный удар"]].map(([icon,title,desc])=>(
              <div key={title} className="rounded-2xl p-3 text-center shadow" style={{ background: "var(--card-bg)" }}>
                <div className="text-xl">{icon}</div>
                <div className="text-xs font-black mt-1" style={{ color: "var(--color-accent)" }}>{title}</div>
                <div className="text-xs opacity-60 mt-0.5">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GAME */}
      {page === "game" && (
        <div className="flex flex-col items-center gap-3 py-4 w-full">
          {/* Флэш эффекта */}
          {activeEffect && (
            <div className="fixed top-20 left-1/2 z-50 px-5 py-2 rounded-2xl font-black text-lg text-white pointer-events-none"
              style={{ transform: "translateX(-50%)", background: "rgba(0,0,0,0.7)", animation: "fade-in-out 1.8s ease forwards" }}>
              {activeEffect}
            </div>
          )}

          <div className="relative" style={{ borderRadius: 20, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.3),0 0 0 4px #FFD93D", maxWidth: "100vw" }}>
            <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={{ display: "block", maxWidth: "100vw", maxHeight: "70vh" }} />

            {!gameRunning && finalScore > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}>
                <p className="text-5xl font-black" style={{ fontFamily: "'Pacifico', cursive", color: "#FFD93D" }}>Упс! 😵</p>
                <p className="text-white text-2xl font-bold">Счёт: <span style={{ color: "#FFD93D" }}>{finalScore}</span></p>
                {records[0] === finalScore && <p className="text-green-300 font-bold text-lg">🎉 Новый рекорд!</p>}
                <button onClick={startGame} className="mt-1 text-xl font-black py-3 px-10 rounded-2xl"
                  style={{ background: "var(--color-accent)", color: "#fff", boxShadow: "0 5px 0 #c9510c" }}>🔄 Ещё раз!</button>
                <button onClick={() => { setPage("home"); setFinalScore(0); }} className="text-base font-bold py-2 px-6 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>🏠 Главная</button>
              </div>
            )}
          </div>

          <div className="flex gap-8 mt-1">
            {[["◀", tL], ["▶", tR]].map(([label, fn]) => (
              <button key={label as string}
                onPointerDown={() => (fn as (v:boolean)=>void)(true)}
                onPointerUp={() => (fn as (v:boolean)=>void)(false)}
                onPointerLeave={() => (fn as (v:boolean)=>void)(false)}
                className="w-16 h-16 rounded-2xl text-2xl font-black flex items-center justify-center shadow-lg select-none"
                style={{ background: "var(--color-accent)", color: "#fff", boxShadow: "0 4px 0 #c9510c" }}>
                {label as string}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* RULES */}
      {page === "rules" && (
        <div className="flex flex-col items-center gap-5 py-10 px-4 w-full max-w-lg">
          <h2 className="text-4xl font-black" style={{ fontFamily: "'Pacifico', cursive", color: "var(--color-accent)" }}>📖 Правила</h2>
          <div className="w-full flex flex-col gap-3">
            {[
              { icon: "🎯", title: "Цель", text: "Прыгай выше по платформам, собирай бонусы, избегай врагов!" },
              { icon: "🕹️", title: "Управление", text: "Стрелки ← → на клавиатуре, кнопки ◀▶ на экране, или наклон телефона." },
              { icon: "⚡", title: "Ускоритель", text: "Золотые платформы — мега-прыжок в 1.6× выше!" },
              { icon: "⭐🛡️🔥🌀🔮🧲", title: "Бонусы", text: "Очки, щит, скорость, лёгкость, уменьшение, магнит." },
              { icon: "🦀👾🐛🕷️", title: "Враги", text: "Касание = −100 очков и мигание. Щит спасает один раз." },
            ].map(({ icon, title, text }) => (
              <div key={title} className="flex gap-3 items-start p-4 rounded-2xl shadow" style={{ background: "var(--card-bg)" }}>
                <span className="text-2xl flex-shrink-0">{icon}</span>
                <div>
                  <p className="font-black text-sm" style={{ color: "var(--color-accent)" }}>{title}</p>
                  <p className="text-sm mt-0.5 opacity-80">{text}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={startGame} className="text-xl font-black py-4 px-12 rounded-2xl"
            style={{ background: "var(--color-accent)", color: "#fff", boxShadow: "0 6px 0 #c9510c" }}>🎮 Начать!</button>
        </div>
      )}

      {/* LEADERBOARD */}
      {page === "leaderboard" && (
        <div className="flex flex-col items-center gap-6 py-10 px-4 w-full max-w-lg">
          <h2 className="text-4xl font-black" style={{ fontFamily: "'Pacifico', cursive", color: "var(--color-accent)" }}>🏆 Рекорды</h2>
          {records.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-6xl mb-4">🎮</p>
              <p className="text-xl font-bold opacity-60">Ещё нет рекордов!</p>
            </div>
          ) : (
            <div className="w-full flex flex-col gap-3">
              {records.map((score, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3 rounded-2xl shadow"
                  style={{ background: i===0 ? "linear-gradient(135deg,#FFD93D,#FF922B)" : "var(--card-bg)", transform: i===0 ? "scale(1.03)" : "scale(1)" }}>
                  <span className="text-3xl w-10 text-center">{i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`}</span>
                  <span className="font-black text-xl flex-1" style={{ color: i===0?"#7a3000":"var(--color-accent)" }}>{score} очков</span>
                  {i===0 && <span className="text-sm font-bold" style={{ color:"#7a3000" }}>Лучший!</span>}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3 flex-wrap justify-center">
            <button onClick={startGame} className="text-xl font-black py-3 px-10 rounded-2xl"
              style={{ background: "var(--color-accent)", color: "#fff", boxShadow: "0 5px 0 #c9510c" }}>🎮 Играть!</button>
            {records.length > 0 && (
              <button onClick={() => { setRecords([]); localStorage.removeItem("jumpRecords"); }}
                className="text-base font-bold py-3 px-6 rounded-2xl"
                style={{ background: "#FF6B6B", color: "#fff", boxShadow: "0 4px 0 #c0392b" }}>🗑️ Сбросить</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}