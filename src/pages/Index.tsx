import { useState, useCallback } from "react";
import { Page, BONUS_META, BonusKind } from "@/game/gameTypes";
import GameCanvas from "@/game/GameCanvas";

export default function Index() {
  const [page, setPage] = useState<Page>("home");
  const [records, setRecords] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("jumpRecords") || "[]"); } catch { return []; }
  });
  const [finalScore, setFinalScore] = useState(0);

  const saveRecord = useCallback((score: number) => {
    setRecords(prev => {
      const updated = [...prev, score].sort((a, b) => b - a).slice(0, 10);
      localStorage.setItem("jumpRecords", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleGameOver = useCallback((score: number) => {
    setFinalScore(score);
    saveRecord(score);
  }, [saveRecord]);

  const startGame = () => setPage("game");

  const navLabel = (p: Page) =>
    p === "home" ? "🏠 Главная" : p === "rules" ? "📖 Правила" : "🏆 Рекорды";

  const goPage = (p: Page) => { setPage(p); };

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
        <GameCanvas
          onGameOver={handleGameOver}
          onGoHome={() => { setPage("home"); setFinalScore(0); }}
          finalScore={finalScore}
          records={records}
        />
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
              { icon: "🦀👾🐛🕷️", title: "Враги", text: "Касание сбоку = −100 очков. Прыжок сверху = +100 очков и враг погибает!" },
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
