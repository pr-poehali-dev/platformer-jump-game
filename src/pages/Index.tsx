import { useState, useEffect, useRef, useCallback } from "react";

const FROG_IMG = "https://cdn.poehali.dev/projects/673a75ca-1f06-45ec-8ca9-0d98d8ce6ab3/files/fac49202-3917-4701-94d4-064553f04ae1.jpg";

const CANVAS_W = 400;
const CANVAS_H = 560;
const GRAVITY = 0.45;
const JUMP_FORCE = -11;
const BOOST_FORCE = -18;
const PLAYER_W = 44;
const PLAYER_H = 44;
// Дистанция между платформами по Y (в мировых координатах)
const PLAT_GAP = 80;
const PLAT_POOL = 20; // сколько платформ держим в памяти

interface Platform {
  x: number;
  y: number; // мировые координаты (растут вверх: меньше = выше)
  w: number;
  boost: boolean;
  color: string;
}

interface GameState {
  // Позиция игрока в мировых координатах (Y растёт вниз, 0 = верхняя точка мира)
  playerX: number;
  playerY: number;
  velY: number;
  velX: number;
  platforms: Platform[];
  score: number;
  // cameraY = мировая Y-координата верхнего края экрана
  cameraY: number;
  alive: boolean;
  facingLeft: boolean;
  highestY: number; // наивысшая Y-координата игрока (минимальная = самая высокая)
  nextPlatY: number; // Y следующей платформы для генерации
}

const PLATFORM_COLORS = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#FF6FD8", "#FF922B"];
const BOOST_COLOR = "#FFD700";

function makePlatform(y: number, forceNormal = false): Platform {
  const boost = !forceNormal && Math.random() < 0.22;
  return {
    x: Math.random() * (CANVAS_W - 90) + 5,
    y,
    w: boost ? 58 : 75 + Math.random() * 45,
    boost,
    color: boost ? BOOST_COLOR : PLATFORM_COLORS[Math.floor(Math.random() * PLATFORM_COLORS.length)],
  };
}

function initGame(): GameState {
  // Стартовые платформы: снизу вверх
  const platforms: Platform[] = [];
  for (let i = 0; i < PLAT_POOL; i++) {
    const y = CANVAS_H - 60 - i * PLAT_GAP;
    platforms.push(makePlatform(y, i === 0));
  }
  // Гарантируем стартовую платформу по центру под лягушонком
  platforms[0] = { x: CANVAS_W / 2 - 50, y: CANVAS_H - 60, w: 100, boost: false, color: "#6BCB77" };

  const topPlatY = Math.min(...platforms.map(p => p.y));

  return {
    playerX: CANVAS_W / 2 - PLAYER_W / 2,
    playerY: CANVAS_H - 60 - PLAYER_H,
    velY: 0,
    velX: 0,
    platforms,
    score: 0,
    cameraY: 0, // верхний край экрана = мировая Y=0
    alive: true,
    facingLeft: false,
    highestY: CANVAS_H - 60 - PLAYER_H,
    nextPlatY: topPlatY - PLAT_GAP,
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
    const s = gameRef.current;
    if (!ctx || !s) return;

    // Фон — небо
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    skyGrad.addColorStop(0, "#5BBFE8");
    skyGrad.addColorStop(1, "#D0EEFF");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Облака (параллакс — движутся медленнее)
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    const cloudSeed = [[60, 80], [200, 180], [320, 60], [130, 300], [270, 420]];
    cloudSeed.forEach(([cx, cyBase]) => {
      // Смещаем облака на 30% от скролла камеры
      const cy = ((cyBase - s.cameraY * 0.3) % (CANVAS_H + 100) + (CANVAS_H + 100)) % (CANVAS_H + 100) - 50;
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.arc(cx + 22, cy - 8, 15, 0, Math.PI * 2);
      ctx.arc(cx + 40, cy, 18, 0, Math.PI * 2);
      ctx.fill();
    });

    // Платформы — переводим мировые → экранные координаты
    s.platforms.forEach(p => {
      // screenY = мировой Y - cameraY (cameraY = мировая Y верхнего края)
      const screenY = p.y - s.cameraY;
      if (screenY < -20 || screenY > CANVAS_H + 10) return;

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.18)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(p.x, screenY, p.w, 16, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.roundRect(p.x + 6, screenY + 2, p.w - 12, 5, 3);
      ctx.fill();
      if (p.boost) {
        ctx.font = "14px serif";
        ctx.textAlign = "center";
        ctx.fillText("⚡", p.x + p.w / 2, screenY - 4);
      }
      ctx.restore();
    });

    // Игрок
    const screenPX = s.playerX;
    const screenPY = s.playerY - s.cameraY;
    if (frogImgRef.current) {
      ctx.save();
      if (s.facingLeft) {
        ctx.translate(screenPX + PLAYER_W, screenPY);
        ctx.scale(-1, 1);
        ctx.drawImage(frogImgRef.current, 0, 0, PLAYER_W, PLAYER_H);
      } else {
        ctx.drawImage(frogImgRef.current, screenPX, screenPY, PLAYER_W, PLAYER_H);
      }
      ctx.restore();
    } else {
      ctx.font = `${PLAYER_W}px serif`;
      ctx.textAlign = "center";
      ctx.fillText("🐸", screenPX + PLAYER_W / 2, screenPY + PLAYER_H);
    }

    // HUD счёт
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 130, 38, 12);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px Nunito, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`⭐ ${s.score}`, 22, 34);

    // Подсказка управления
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.font = "11px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("← → или кнопки ниже", CANVAS_W / 2, CANVAS_H - 8);
  }, []);

  const gameLoop = useCallback(() => {
    const s = gameRef.current;
    if (!s || !s.alive) return;

    // Управление
    const speed = 4.5;
    if (keysRef.current.left) { s.velX = -speed; s.facingLeft = true; }
    else if (keysRef.current.right) { s.velX = speed; s.facingLeft = false; }
    else s.velX *= 0.78;

    // Физика
    s.velY += GRAVITY;
    s.playerX += s.velX;
    s.playerY += s.velY;

    // Горизонтальный wrap
    if (s.playerX > CANVAS_W) s.playerX = -PLAYER_W;
    if (s.playerX + PLAYER_W < 0) s.playerX = CANVAS_W;

    // Коллизия с платформами — только при падении вниз
    if (s.velY > 0) {
      for (const p of s.platforms) {
        const prevBottom = s.playerY + PLAYER_H - s.velY;
        const currBottom = s.playerY + PLAYER_H;
        if (
          prevBottom <= p.y &&
          currBottom >= p.y &&
          s.playerX + PLAYER_W - 6 > p.x &&
          s.playerX + 6 < p.x + p.w
        ) {
          s.playerY = p.y - PLAYER_H;
          s.velY = p.boost ? BOOST_FORCE : JUMP_FORCE;
          break;
        }
      }
    }

    // Обновляем камеру: следуем за игроком когда он выше верхней трети
    const screenPY = s.playerY - s.cameraY;
    const scrollThreshold = CANVAS_H * 0.38;
    if (screenPY < scrollThreshold) {
      s.cameraY -= scrollThreshold - screenPY;
    }

    // Обновляем рекордную высоту и счёт
    if (s.playerY < s.highestY) {
      s.highestY = s.playerY;
      s.score = Math.floor((CANVAS_H - s.highestY) / 10);
    }

    // Генерируем новые платформы выше по мере подъёма
    while (s.nextPlatY > s.cameraY - 100) {
      s.platforms.push(makePlatform(s.nextPlatY));
      s.nextPlatY -= PLAT_GAP + Math.random() * 20;
      // Удаляем платформы далеко внизу
      const cutoff = s.cameraY + CANVAS_H + 200;
      s.platforms = s.platforms.filter(p => p.y < cutoff);
    }

    // Смерть — лягушонок упал ниже экрана
    if (s.playerY - s.cameraY > CANVAS_H + 80) {
      s.alive = false;
      setGameRunning(false);
      setFinalScore(s.score);
      saveRecord(s.score);
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

  const navLabel = (p: Page) =>
    p === "home" ? "🏠 Главная" : p === "rules" ? "📖 Правила" : "🏆 Рекорды";

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
          <div className="animate-bounce-in">
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
              { icon: "⚡", title: "Золотая платформа", text: "Платформа-ускоритель! Лягушонок взлетает в 1.6 раза выше обычного. Ищи их!" },
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
