import { useState, useEffect, useRef, useCallback } from "react";
import {
  CANVAS_W, CANVAS_H, GRAVITY, JUMP_FORCE, BOOST_FORCE,
  PLAYER_W, PLAYER_H, PLAT_GAP, BONUS_META,
  GameState,
} from "./gameTypes";
import { initGame, makePlatform, makeEnemy, makeBonus, spawnParticles, drawFrog } from "./gameLogic";

interface Props {
  onGameOver: (score: number) => void;
  onGoHome: () => void;
  finalScore: number;
  records: number[];
}

export default function GameCanvas({ onGameOver, onGoHome, finalScore, records }: Props) {
  const [gameRunning, setGameRunning] = useState(false);
  const [activeEffect, setActiveEffect] = useState<string>("");

  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const gameRef        = useRef<GameState | null>(null);
  const animRef        = useRef<number>(0);
  const keysRef        = useRef({ left: false, right: false });
  const effectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashEffect = useCallback((label: string) => {
    setActiveEffect(label);
    if (effectTimerRef.current) clearTimeout(effectTimerRef.current);
    effectTimerRef.current = setTimeout(() => setActiveEffect(""), 1800);
  }, []);

  // ── Отрисовка ────────────────────────────────────────────────
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
      ctx.arc(p.x, p.y - s.cameraY, p.r * alpha, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Всплывающие тексты
    s.floatTexts.forEach(ft => {
      const alpha = ft.life / ft.maxLife;
      const sy = ft.y - s.cameraY;
      const scale = 0.8 + 0.4 * (1 - alpha);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(ft.x, sy);
      ctx.scale(scale, scale);
      ctx.font = "bold 22px Nunito, sans-serif";
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, 0, 0);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, 0, 0);
      ctx.restore();
    });

    // Игрок
    const pw = s.shrinkTimer > 0 ? PLAYER_W * 0.6 : PLAYER_W;
    const ph = s.shrinkTimer > 0 ? PLAYER_H * 0.6 : PLAYER_H;
    const screenPX = s.playerX + (PLAYER_W - pw) / 2;
    const screenPY = s.playerY - s.cameraY + (PLAYER_H - ph);
    const visible = s.invincible > 0 ? Math.floor(s.invincible / 4) % 2 === 0 : true;
    if (visible) drawFrog(ctx, screenPX, screenPY, pw, ph, s.facingLeft, s.shieldTimer > 0);

    // HUD
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath(); ctx.roundRect(10,10,145,40,12); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 15px Nunito, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`⭐ ${s.score}  🌟${s.stars}`, 20, 34);

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

  // ── Игровой цикл ─────────────────────────────────────────────
  const gameLoop = useCallback(() => {
    const s = gameRef.current;
    if (!s || !s.alive) return;

    if (s.shieldTimer > 0) s.shieldTimer--;
    if (s.slowTimer > 0) s.slowTimer--;
    if (s.fastTimer > 0) s.fastTimer--;
    if (s.magnetTimer > 0) s.magnetTimer--;
    if (s.shrinkTimer > 0) s.shrinkTimer--;
    if (s.invincible > 0) s.invincible--;
    if (s.hitCooldown > 0) s.hitCooldown--;

    const gravity = s.slowTimer > 0 ? GRAVITY * 0.45 : GRAVITY;
    const speed   = s.fastTimer > 0 ? 7 : 4.2;

    if (keysRef.current.left)  { s.velX = -speed; s.facingLeft = true; }
    else if (keysRef.current.right) { s.velX = speed; s.facingLeft = false; }
    else s.velX *= 0.78;

    s.velY += gravity;
    s.playerX += s.velX;
    s.playerY += s.velY;

    if (s.playerX > CANVAS_W) s.playerX = -PLAYER_W;
    if (s.playerX + PLAYER_W < 0) s.playerX = CANVAS_W;

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

    const screenPY = s.playerY - s.cameraY;
    const thresh = CANVAS_H * 0.38;
    if (screenPY < thresh) s.cameraY -= thresh - screenPY;

    if (s.playerY < s.highestY) {
      s.highestY = s.playerY;
      s.score = Math.floor((CANVAS_H - s.highestY) / 8) + s.stars * 50;
    }

    while (s.nextPlatY > s.cameraY - 120) {
      s.platforms.push(makePlatform(s.nextPlatY));
      if (Math.random() < 0.11) s.enemies.push(makeEnemy(s.nextPlatY - 30));
      if (Math.random() < 0.33) s.bonuses.push(makeBonus(s.nextPlatY - 50));
      s.nextPlatY -= PLAT_GAP + Math.random() * 15;
    }
    const cutoff = s.cameraY + CANVAS_H + 250;
    s.platforms = s.platforms.filter(p => p.y < cutoff);
    s.enemies   = s.enemies.filter(e => e.y < cutoff);
    s.bonuses   = s.bonuses.filter(b => b.y < cutoff);

    s.enemies.forEach(e => {
      e.x += e.dir * e.speed;
      if (e.x < 0) { e.x = 0; e.dir = 1; }
      if (e.x + e.w > CANVAS_W) { e.x = CANVAS_W - e.w; e.dir = -1; }
    });

    if (s.magnetTimer > 0) {
      s.bonuses.forEach(b => {
        if (b.collected) return;
        const dx = (s.playerX + PLAYER_W/2) - (b.x + 14);
        const dy = (s.playerY + PLAYER_H/2) - (b.y + 14);
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 180) { b.x += dx * 0.07; b.y += dy * 0.07; }
      });
    }

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

    s.enemies.forEach(e => {
      const margin = s.shrinkTimer > 0 ? 10 : 5;
      const overlapX = s.playerX + PLAYER_W - margin > e.x && s.playerX + margin < e.x + e.w;
      const overlapY = s.playerY + PLAYER_H - margin > e.y && s.playerY + margin < e.y + e.h;
      if (!overlapX || !overlapY) return;

      const stompedFromAbove = s.velY > 0 && (s.playerY + PLAYER_H - s.velY) <= e.y + e.h * 0.55;
      if (stompedFromAbove) {
        spawnParticles(s.particles, e.x + e.w/2, e.y, "#FFD93D", 14);
        s.floatTexts.push({
          x: s.playerX + PLAYER_W / 2,
          y: s.playerY - 10,
          text: "💀 +100",
          color: "#FFD93D",
          life: 55, maxLife: 55,
        });
        e.y = 99999;
        s.score += 100;
        s.velY = JUMP_FORCE * 0.7;
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

    s.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
    });
    s.particles = s.particles.filter(p => p.life > 0);

    s.floatTexts.forEach(ft => {
      ft.y -= 1.2;
      ft.life--;
    });
    s.floatTexts = s.floatTexts.filter(ft => ft.life > 0);

    if (s.playerY - s.cameraY > CANVAS_H + 100) {
      s.alive = false;
      setGameRunning(false);
      onGameOver(s.score);
    }

    drawGame();
    animRef.current = requestAnimationFrame(gameLoop);
  }, [drawGame, flashEffect, onGameOver]);

  const startGame = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    gameRef.current = initGame();
    setActiveEffect("");
    setGameRunning(true);
  }, []);

  useEffect(() => {
    startGame();
  }, [startGame]);

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
    const tilt = (e: DeviceOrientationEvent) => {
      const g = e.gamma || 0;
      keysRef.current.left  = g < -8;
      keysRef.current.right = g > 8;
    };
    window.addEventListener("deviceorientation", tilt);
    return () => window.removeEventListener("deviceorientation", tilt);
  }, []);

  const tL = (v: boolean) => { keysRef.current.left  = v; };
  const tR = (v: boolean) => { keysRef.current.right = v; };

  return (
    <div className="flex flex-col items-center gap-3 py-4 w-full">
      {activeEffect && (
        <div
          className="fixed top-20 left-1/2 z-50 px-5 py-2 rounded-2xl font-black text-lg text-white pointer-events-none"
          style={{ transform: "translateX(-50%)", background: "rgba(0,0,0,0.7)", animation: "fade-in-out 1.8s ease forwards" }}
        >
          {activeEffect}
        </div>
      )}

      <div className="relative" style={{ borderRadius: 20, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.3),0 0 0 4px #FFD93D", maxWidth: "100vw" }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ display: "block", maxWidth: "100vw", maxHeight: "70vh" }}
        />

        {!gameRunning && finalScore > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}>
            <p className="text-5xl font-black" style={{ fontFamily: "'Pacifico', cursive", color: "#FFD93D" }}>Упс! 😵</p>
            <p className="text-white text-2xl font-bold">Счёт: <span style={{ color: "#FFD93D" }}>{finalScore}</span></p>
            {records[0] === finalScore && <p className="text-green-300 font-bold text-lg">🎉 Новый рекорд!</p>}
            <button onClick={startGame} className="mt-1 text-xl font-black py-3 px-10 rounded-2xl"
              style={{ background: "var(--color-accent)", color: "#fff", boxShadow: "0 5px 0 #c9510c" }}>🔄 Ещё раз!</button>
            <button onClick={onGoHome} className="text-base font-bold py-2 px-6 rounded-xl"
              style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>🏠 Главная</button>
          </div>
        )}
      </div>

      <div className="flex gap-8 mt-1">
        {([["◀", tL], ["▶", tR]] as [string, (v: boolean) => void][]).map(([label, fn]) => (
          <button key={label}
            onPointerDown={() => fn(true)}
            onPointerUp={() => fn(false)}
            onPointerLeave={() => fn(false)}
            className="w-16 h-16 rounded-2xl text-2xl font-black flex items-center justify-center shadow-lg select-none"
            style={{ background: "var(--color-accent)", color: "#fff", boxShadow: "0 4px 0 #c9510c" }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
