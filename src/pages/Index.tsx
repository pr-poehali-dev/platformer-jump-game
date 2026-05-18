import { useState, useEffect, useRef, useCallback } from "react";

const FROG_IMG = "https://cdn.poehali.dev/projects/673a75ca-1f06-45ec-8ca9-0d98d8ce6ab3/files/fac49202-3917-4701-94d4-064553f04ae1.jpg";

const CANVAS_W = 400;
const CANVAS_H = 560;
const GRAVITY = 0.4;
const JUMP_FORCE = -10;
const BOOST_FORCE = -17;
const PLATFORM_COUNT = 7;
const PLAYER_W = 44;
const PLAYER_H = 44;

interface Platform {
  x: number;
  y: number;
  w: number;
  boost: boolean;
  color: string;
}

interface GameState {
  playerX: number;
  playerY: number;
  velY: number;
  velX: number;
  platforms: Platform[];
  score: number;
  cameraY: number;
  alive: boolean;
  facingLeft: boolean;
}

const PLATFORM_COLORS = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#FF6FD8", "#FF922B"];
const BOOST_COLOR = "#FFD700";

function generatePlatforms(startY: number, count: number): Platform[] {
  const platforms: Platform[] = [];
  for (let i = 0; i < count; i++) {
    const boost = Math.random() < 0.25;
    platforms.push({
      x: Math.random() * (CANVAS_W - 80),
      y: startY - i * 85 - Math.random() * 30,
      w: boost ? 60 : 80 + Math.random() * 40,
      boost,
      color: boost ? BOOST_COLOR : PLATFORM_COLORS[Math.floor(Math.random() * PLATFORM_COLORS.length)],
    });
  }
  return platforms;
}

function initGame(): GameState {
  const platforms = generatePlatforms(CANVAS_H - 60, PLATFORM_COUNT);
  platforms[0] = { x: CANVAS_W / 2 - 50, y: CANVAS_H - 60, w: 100, boost: false, color: "#6BCB77" };
  return {
    playerX: CANVAS_W / 2 - PLAYER_W / 2,
    playerY: CANVAS_H - 60 - PLAYER_H,
    velY: 0,
    velX: 0,
    platforms,
    score: 0,
    cameraY: 0,
    alive: true,
    facingLeft: false,
  };
}

type Page = "home" | "game" | "rules" | "leaderboard";

export default function Index() {
  const [page, setPage] = useState<Page>("home");
  const [records, setRecords] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("jumpRecords") || "[]"); } catch { return []; }
  });
  const [finalScore, setFinalScore] = useState(0);
  const [gameRunning, setGameRunning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const animRef = useRef<number>(0);
  const keysRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
  const frogImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = FROG_IMG;
    img.onload = () => { frogImgRef.current = img; };
  }, []);

  const saveRecord = useCallback((score: number) => {
    setRecords(prev => {
      const updated = [...prev, score].sort((a, b) => b - a).slice(0, 10);
      localStorage.setItem("jumpRecords", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const state = gameRef.current;
    if (!ctx || !state) return;

    const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    skyGrad.addColorStop(0, "#87CEEB");
    skyGrad.addColorStop(1, "#E0F7FF");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    [[60, 80], [200, 40], [320, 120], [130, 200], [280, 280]].forEach(([cx, cy]) => {
      const cloudY = ((cy - state.cameraY * 0.3) % CANVAS_H + CANVAS_H) % CANVAS_H;
      ctx.beginPath();
      ctx.arc(cx, cloudY, 22, 0, Math.PI * 2);
      ctx.arc(cx + 22, cloudY - 8, 16, 0, Math.PI * 2);
      ctx.arc(cx + 40, cloudY, 18, 0, Math.PI * 2);
      ctx.fill();
    });

    const offsetY = -state.cameraY;

    state.platforms.forEach(p => {
      const py = p.y + offsetY;
      if (py < -30 || py > CANVAS_H + 10) return;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.15)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(p.x, py, p.w, 16, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.roundRect(p.x + 6, py + 2, p.w - 12, 5, 4);
      ctx.fill();
      if (p.boost) {
        ctx.fillStyle = "#FF6B00";
        ctx.font = "bold 14px Nunito, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("⚡", p.x + p.w / 2, py - 4);
      }
      ctx.restore();
    });

    const px = state.playerX;
    const py = state.playerY + offsetY;
    if (frogImgRef.current) {
      ctx.save();
      if (state.facingLeft) {
        ctx.translate(px + PLAYER_W, py);
        ctx.scale(-1, 1);
        ctx.drawImage(frogImgRef.current, 0, 0, PLAYER_W, PLAYER_H);
      } else {
        ctx.drawImage(frogImgRef.current, px, py, PLAYER_W, PLAYER_H);
      }
      ctx.restore();
    } else {
      ctx.font = `${PLAYER_W}px serif`;
      ctx.textAlign = "center";
      ctx.fillText("🐸", px + PLAYER_W / 2, py + PLAYER_H);
    }

    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 130, 38, 12);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px Nunito, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`⭐ ${state.score}`, 22, 34);

    ctx.fillStyle = "rgba(0,0,0,0.13)";
    ctx.font = "12px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("← → или наклон телефона", CANVAS_W / 2, CANVAS_H - 8);
  }, []);

  const gameLoop = useCallback(() => {
    const state = gameRef.current;
    if (!state || !state.alive) return;

    const speed = 4;
    if (keysRef.current.left) { state.velX = -speed; state.facingLeft = true; }
    else if (keysRef.current.right) { state.velX = speed; state.facingLeft = false; }
    else state.velX *= 0.8;

    state.velY += GRAVITY;
    state.playerX += state.velX;
    state.playerY += state.velY;

    if (state.playerX > CANVAS_W) state.playerX = -PLAYER_W;
    if (state.playerX + PLAYER_W < 0) state.playerX = CANVAS_W;

    if (state.velY > 0) {
      state.platforms.forEach(p => {
        const relY = state.playerY + PLAYER_H - p.y;
        if (
          relY >= 0 && relY <= 14 &&
          state.playerX + PLAYER_W > p.x + 4 &&
          state.playerX < p.x + p.w - 4
        ) {
          state.velY = p.boost ? BOOST_FORCE : JUMP_FORCE;
        }
      });
    }

    const threshold = CANVAS_H * 0.4;
    if (state.playerY + state.cameraY < threshold) {
      const diff = threshold - (state.playerY + state.cameraY);
      state.cameraY += diff;
      state.score = Math.max(state.score, Math.floor(state.cameraY / 10));

      state.platforms.forEach((p, i) => {
        if (p.y + state.cameraY > CANVAS_H + 50) {
          const topY = Math.min(...state.platforms.map(p2 => p2.y));
          const boost = Math.random() < 0.25;
          state.platforms[i] = {
            x: Math.random() * (CANVAS_W - 80),
            y: topY - 80 - Math.random() * 30,
            w: boost ? 60 : 80 + Math.random() * 40,
            boost,
            color: boost ? BOOST_COLOR : PLATFORM_COLORS[Math.floor(Math.random() * PLATFORM_COLORS.length)],
          };
        }
      });
    }

    if (state.playerY + state.cameraY > CANVAS_H + 100) {
      state.alive = false;
      setGameRunning(false);
      setFinalScore(state.score);
      saveRecord(state.score);
    }

    drawGame();
    animRef.current = requestAnimationFrame(gameLoop);
  }, [drawGame, saveRecord]);

  const startGame = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    gameRef.current = initGame();
    setFinalScore(0);
    setGameRunning(true);
    setPage("game");
  }, []);

  useEffect(() => {
    if (gameRunning) {
      animRef.current = requestAnimationFrame(gameLoop);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [gameRunning, gameLoop]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") keysRef.current.left = true;
      if (e.key === "ArrowRight" || e.key === "d") keysRef.current.right = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") keysRef.current.left = false;
      if (e.key === "ArrowRight" || e.key === "d") keysRef.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  useEffect(() => {
    if (page !== "game") return;
    const handleTilt = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma || 0;
      keysRef.current.left = gamma < -8;
      keysRef.current.right = gamma > 8;
    };
    window.addEventListener("deviceorientation", handleTilt);
    return () => window.removeEventListener("deviceorientation", handleTilt);
  }, [page]);

  const touchLeft = (val: boolean) => { keysRef.current.left = val; };
  const touchRight = (val: boolean) => { keysRef.current.right = val; };

  const navLabel = (p: Page) => p === "home" ? "🏠 Главная" : p === "rules" ? "📖 Правила" : "🏆 Рекорды";

  return (
    <div className="min-h-screen flex flex-col items-center" style={{ background: "var(--bg-main)", fontFamily: "'Nunito', sans-serif", color: "var(--color-text)" }}>

      <nav className="w-full flex items-center justify-between px-5 py-3 shadow-md sticky top-0 z-50" style={{ background: "var(--nav-bg)" }}>
        <span
          className="text-xl cursor-pointer select-none"
          style={{ fontFamily: "'Pacifico', cursive", color: "var(--color-accent)" }}
          onClick={() => { cancelAnimationFrame(animRef.current); setGameRunning(false); setPage("home"); }}
        >
          🐸 ПрыгУн!
        </span>
        <div className="flex gap-1">
          {(["home", "rules", "leaderboard"] as Page[]).map(p => (
            <button
              key={p}
              onClick={() => { cancelAnimationFrame(animRef.current); setGameRunning(false); setPage(p); }}
              className="px-3 py-1 rounded-xl text-sm font-bold transition-all"
              style={{
                background: page === p ? "var(--color-accent)" : "var(--btn-secondary)",
                color: page === p ? "#fff" : "var(--color-text)",
              }}
            >
              {navLabel(p)}
            </button>
          ))}
        </div>
      </nav>

      {page === "home" && (
        <div className="flex flex-col items-center justify-center flex-1 gap-8 py-12 px-4 text-center w-full">
          <div>
            <h1
              className="text-6xl md:text-7xl mb-2"
              style={{
                fontFamily: "'Pacifico', cursive",
                color: "var(--color-accent)",
                textShadow: "4px 4px 0 #FF922B, 7px 7px 0 rgba(0,0,0,0.08)"
              }}
            >
              ПрыгУн!
            </h1>
            <p className="text-xl font-bold mt-2">Прыгай выше, бей рекорды!</p>
          </div>

          <img
            src={FROG_IMG}
            alt="Лягушонок"
            className="w-40 h-40 rounded-3xl shadow-2xl border-4 border-white object-cover"
            style={{ animation: "float 3s ease-in-out infinite" }}
          />

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={startGame}
              className="text-xl font-black py-4 px-10 rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95"
              style={{
                background: "var(--color-accent)",
                color: "#fff",
                boxShadow: "0 6px 0 #c9510c, 0 10px 20px rgba(0,0,0,0.15)"
              }}
            >
              🎮 ИГРАТЬ!
            </button>
            <button
              onClick={() => setPage("rules")}
              className="text-lg font-bold py-3 px-8 rounded-2xl transition-all hover:scale-105"
              style={{ background: "var(--btn-secondary)", color: "var(--color-text)", boxShadow: "0 4px 0 rgba(0,0,0,0.1)" }}
            >
              📖 Правила
            </button>
            <button
              onClick={() => setPage("leaderboard")}
              className="text-lg font-bold py-3 px-8 rounded-2xl transition-all hover:scale-105"
              style={{ background: "#FFD93D", color: "#7a4100", boxShadow: "0 4px 0 #c9a200" }}
            >
              🏆 Рекорды {records.length > 0 && `· лучший: ${records[0]}`}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
            {[
              ["🟩", "Обычная", "Стандартный прыжок"],
              ["⚡", "Ускоритель", "Мега-прыжок!"],
              ["⭐", "Очки", "Лети выше"],
            ].map(([icon, title, desc]) => (
              <div key={title} className="rounded-2xl p-3 text-center shadow" style={{ background: "var(--card-bg)" }}>
                <div className="text-2xl mb-1">{icon}</div>
                <div className="font-black text-sm" style={{ color: "var(--color-accent)" }}>{title}</div>
                <div className="text-xs mt-1 opacity-60">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {page === "game" && (
        <div className="flex flex-col items-center gap-3 py-4 w-full">
          <div
            className="relative"
            style={{
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 8px 40px rgba(0,0,0,0.3), 0 0 0 4px #FFD93D",
              maxWidth: "100vw",
            }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              style={{ display: "block", maxWidth: "100vw", maxHeight: "70vh" }}
            />

            {!gameRunning && finalScore > 0 && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
              >
                <p className="text-5xl font-black" style={{ fontFamily: "'Pacifico', cursive", color: "#FFD93D" }}>
                  Упс! 😵
                </p>
                <p className="text-white text-2xl font-bold">
                  Счёт: <span style={{ color: "#FFD93D" }}>{finalScore}</span>
                </p>
                {records[0] === finalScore && (
                  <p className="text-green-300 font-bold text-lg">🎉 Новый рекорд!</p>
                )}
                <button
                  onClick={startGame}
                  className="mt-2 text-xl font-black py-3 px-10 rounded-2xl"
                  style={{ background: "var(--color-accent)", color: "#fff", boxShadow: "0 5px 0 #c9510c" }}
                >
                  🔄 Ещё раз!
                </button>
                <button
                  onClick={() => { setPage("home"); setFinalScore(0); }}
                  className="text-base font-bold py-2 px-6 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}
                >
                  🏠 Главная
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-8 mt-1">
            <button
              onPointerDown={() => touchLeft(true)}
              onPointerUp={() => touchLeft(false)}
              onPointerLeave={() => touchLeft(false)}
              className="w-16 h-16 rounded-2xl text-2xl font-black flex items-center justify-center shadow-lg select-none"
              style={{ background: "var(--color-accent)", color: "#fff", boxShadow: "0 4px 0 #c9510c" }}
            >
              ◀
            </button>
            <button
              onPointerDown={() => touchRight(true)}
              onPointerUp={() => touchRight(false)}
              onPointerLeave={() => touchRight(false)}
              className="w-16 h-16 rounded-2xl text-2xl font-black flex items-center justify-center shadow-lg select-none"
              style={{ background: "var(--color-accent)", color: "#fff", boxShadow: "0 4px 0 #c9510c" }}
            >
              ▶
            </button>
          </div>
        </div>
      )}

      {page === "rules" && (
        <div className="flex flex-col items-center gap-6 py-10 px-4 w-full max-w-lg">
          <h2 className="text-4xl font-black" style={{ fontFamily: "'Pacifico', cursive", color: "var(--color-accent)" }}>
            📖 Правила
          </h2>
          <div className="w-full flex flex-col gap-4">
            {[
              { icon: "🎯", title: "Цель игры", text: "Прыгай как можно выше по платформам и набирай очки. Чем выше — тем круче рекорд!" },
              { icon: "🕹️", title: "Управление", text: "Стрелки ← → на клавиатуре или кнопки ◀▶ на экране. На телефоне — наклоняй устройство влево и вправо!" },
              { icon: "🟩", title: "Обычная платформа", text: "Стандартный прыжок. Лягушонок отпрыгивает на среднюю высоту." },
              { icon: "⚡", title: "Золотая платформа", text: "Платформа-ускоритель! Лягушонок взлетает в 1.7 раза выше обычного. Ищи их!" },
              { icon: "💀", title: "Конец игры", text: "Если лягушонок упадёт ниже экрана — игра заканчивается. Не зевай!" },
            ].map(({ icon, title, text }) => (
              <div key={title} className="flex gap-4 items-start p-4 rounded-2xl shadow" style={{ background: "var(--card-bg)" }}>
                <span className="text-3xl flex-shrink-0">{icon}</span>
                <div>
                  <p className="font-black text-base" style={{ color: "var(--color-accent)" }}>{title}</p>
                  <p className="text-sm mt-1 opacity-80">{text}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={startGame}
            className="mt-2 text-xl font-black py-4 px-12 rounded-2xl shadow-lg"
            style={{ background: "var(--color-accent)", color: "#fff", boxShadow: "0 6px 0 #c9510c" }}
          >
            🎮 Начать игру!
          </button>
        </div>
      )}

      {page === "leaderboard" && (
        <div className="flex flex-col items-center gap-6 py-10 px-4 w-full max-w-lg">
          <h2 className="text-4xl font-black" style={{ fontFamily: "'Pacifico', cursive", color: "var(--color-accent)" }}>
            🏆 Рекорды
          </h2>
          {records.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-6xl mb-4">🎮</p>
              <p className="text-xl font-bold opacity-60">Ещё нет рекордов!</p>
              <p className="text-sm mt-2 opacity-40">Сыграй первую игру</p>
            </div>
          ) : (
            <div className="w-full flex flex-col gap-3">
              {records.map((score, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-5 py-3 rounded-2xl shadow"
                  style={{
                    background: i === 0 ? "linear-gradient(135deg, #FFD93D, #FF922B)" : "var(--card-bg)",
                    transform: i === 0 ? "scale(1.03)" : "scale(1)",
                    transition: "transform 0.2s",
                  }}
                >
                  <span className="text-3xl w-10 text-center">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                  </span>
                  <span className="font-black text-xl flex-1" style={{ color: i === 0 ? "#7a3000" : "var(--color-accent)" }}>
                    {score} очков
                  </span>
                  {i === 0 && <span className="text-sm font-bold" style={{ color: "#7a3000" }}>Лучший!</span>}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3 flex-wrap justify-center">
            <button
              onClick={startGame}
              className="text-xl font-black py-3 px-10 rounded-2xl shadow-lg"
              style={{ background: "var(--color-accent)", color: "#fff", boxShadow: "0 5px 0 #c9510c" }}
            >
              🎮 Играть!
            </button>
            {records.length > 0 && (
              <button
                onClick={() => { setRecords([]); localStorage.removeItem("jumpRecords"); }}
                className="text-base font-bold py-3 px-6 rounded-2xl"
                style={{ background: "#FF6B6B", color: "#fff", boxShadow: "0 4px 0 #c0392b" }}
              >
                🗑️ Сбросить
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
