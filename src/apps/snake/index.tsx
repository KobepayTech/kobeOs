import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Trophy } from 'lucide-react';

const CELL = 20;
const GRID_W = 20;
const GRID_H = 20;
const CANVAS_W = GRID_W * CELL;
const CANVAS_H = GRID_H * CELL;
const BASE_SPEED = 150;
const SPEED_INC = 10;
const MIN_SPEED = 60;

const DIR = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

function getInitialSnake() {
  return [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
}

function randomFood(snake: { x: number; y: number }[]) {
  let pos: { x: number; y: number };
  do {
    pos = { x: Math.floor(Math.random() * GRID_W), y: Math.floor(Math.random() * GRID_H) };
  } while (snake.some((s) => s.x === pos.x && s.y === pos.y));
  return pos;
}

function useHighScore() {
  const key = 'snake_highscore';
  const [high, setHigh] = useState(() => {
    try {
      return parseInt(localStorage.getItem(key) || '0', 10);
    } catch {
      return 0;
    }
  });
  const update = useCallback((score: number) => {
    setHigh((prev) => {
      const next = Math.max(prev, score);
      try {
        localStorage.setItem(key, String(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);
  return [high, update] as const;
}

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snake, setSnake] = useState(getInitialSnake);
  const [food, setFood] = useState(() => randomFood(getInitialSnake()));
  const [dir, setDir] = useState(DIR.RIGHT);
  const [nextDir, setNextDir] = useState(DIR.RIGHT);
  const [score, setScore] = useState(0);
  const [foodEaten, setFoodEaten] = useState(0);
  const [gameState, setGameState] = useState<'start' | 'playing' | 'paused' | 'over'>('start');
  const [highScore, setHighScore] = useHighScore();
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef(0);
  const dirRef = useRef(DIR.RIGHT);
  const stateRef = useRef('start');
  const snakeRef = useRef(snake);
  const foodRef = useRef(food);
  const scoreRef = useRef(0);
  const foodEatenRef = useRef(0);

  useEffect(() => {
    dirRef.current = dir;
  }, [dir]);
  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);
  useEffect(() => {
    snakeRef.current = snake;
  }, [snake]);
  useEffect(() => {
    foodRef.current = food;
  }, [food]);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    foodEatenRef.current = foodEaten;
  }, [foodEaten]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Subtle grid lines
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    for (let x = 0; x <= GRID_W; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, CANVAS_H);
      ctx.stroke();
    }
    for (let y = 0; y <= GRID_H; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(CANVAS_W, y * CELL);
      ctx.stroke();
    }

    // Food
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(
      foodRef.current.x * CELL + CELL / 2,
      foodRef.current.y * CELL + CELL / 2,
      CELL / 2 - 2,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Snake
    const s = snakeRef.current;
    s.forEach((seg, i) => {
      if (i === 0) {
        ctx.fillStyle = '#34d399';
      } else {
        ctx.fillStyle = '#10b981';
      }
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
      // Eyes on head
      if (i === 0) {
        ctx.fillStyle = '#064e3b';
        const hx = seg.x * CELL + CELL / 2;
        const hy = seg.y * CELL + CELL / 2;
        const d = dirRef.current;
        if (d === DIR.RIGHT || d === DIR.LEFT) {
          ctx.fillRect(hx + (d === DIR.RIGHT ? 3 : -5), hy - 4, 3, 3);
          ctx.fillRect(hx + (d === DIR.RIGHT ? 3 : -5), hy + 1, 3, 3);
        } else {
          ctx.fillRect(hx - 4, hy + (d === DIR.DOWN ? 3 : -5), 3, 3);
          ctx.fillRect(hx + 1, hy + (d === DIR.DOWN ? 3 : -5), 3, 3);
        }
      }
    });
  }, []);

  const tick = useCallback(() => {
    if (stateRef.current !== 'playing') return;
    const s = [...snakeRef.current];
    const d = dirRef.current;
    const head = { x: s[0].x + d.x, y: s[0].y + d.y };

    // Wall collision
    if (head.x < 0 || head.x >= GRID_W || head.y < 0 || head.y >= GRID_H) {
      setGameState('over');
      setHighScore(scoreRef.current);
      return;
    }

    // Self collision
    if (s.some((seg) => seg.x === head.x && seg.y === head.y)) {
      setGameState('over');
      setHighScore(scoreRef.current);
      return;
    }

    s.unshift(head);

    // Eat food?
    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      const newScore = scoreRef.current + 10;
      const newEaten = foodEatenRef.current + 1;
      setScore(newScore);
      setFoodEaten(newEaten);
      setFood(randomFood(s));
      setHighScore(newScore);
    } else {
      s.pop();
    }

    setSnake(s);
    setDir(nextDir);
    dirRef.current = nextDir;
  }, [nextDir, setHighScore]);

  useEffect(() => {
    const loop = (time: number) => {
      animRef.current = requestAnimationFrame(loop);
      if (stateRef.current !== 'playing') {
        draw();
        return;
      }
      const speed = Math.max(MIN_SPEED, BASE_SPEED - Math.floor(foodEatenRef.current / 5) * SPEED_INC);
      if (time - lastTimeRef.current >= speed) {
        lastTimeRef.current = time;
        tick();
      }
      draw();
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw, tick]);

  useEffect(() => {
    draw();
  }, [draw, gameState]);

  const resetGame = useCallback(() => {
    const s = getInitialSnake();
    setSnake(s);
    setFood(randomFood(s));
    setDir(DIR.RIGHT);
    setNextDir(DIR.RIGHT);
    dirRef.current = DIR.RIGHT;
    setScore(0);
    setFoodEaten(0);
    setGameState('playing');
    scoreRef.current = 0;
    foodEatenRef.current = 0;
    lastTimeRef.current = 0;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key;
      if (gameState === 'start') {
        if (key === ' ' || key === 'Enter') {
          setGameState('playing');
          return;
        }
      }
      if (gameState === 'over') {
        if (key === ' ' || key === 'Enter') {
          resetGame();
          return;
        }
      }
      if (key === ' ' || key === 'p' || key === 'P') {
        setGameState((gs) => (gs === 'playing' ? 'paused' : gs === 'paused' ? 'playing' : gs));
        return;
      }
      if (gameState !== 'playing') return;
      let nd = nextDir;
      if ((key === 'ArrowUp' || key === 'w' || key === 'W') && dirRef.current !== DIR.DOWN) {
        nd = DIR.UP;
      } else if ((key === 'ArrowDown' || key === 's' || key === 'S') && dirRef.current !== DIR.UP) {
        nd = DIR.DOWN;
      } else if ((key === 'ArrowLeft' || key === 'a' || key === 'A') && dirRef.current !== DIR.RIGHT) {
        nd = DIR.LEFT;
      } else if ((key === 'ArrowRight' || key === 'd' || key === 'D') && dirRef.current !== DIR.LEFT) {
        nd = DIR.RIGHT;
      }
      setNextDir(nd);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState, nextDir, resetGame]);

  return (
    <div className="flex flex-col items-center h-full bg-[#0f172a] text-os-text-primary select-none">
      {/* Header */}
      <div className="w-full flex items-center justify-between px-4 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-medium">High: {highScore}</span>
        </div>
        <div className="text-lg font-bold font-mono text-emerald-400">Score: {score}</div>
        <div className="flex items-center gap-1">
          {gameState === 'playing' && (
            <button
              className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 transition-colors"
              onClick={() => setGameState('paused')}
              title="Pause (Space)"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
          {gameState === 'paused' && (
            <button
              className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 transition-colors"
              onClick={() => setGameState('playing')}
              title="Resume (Space)"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          <button
            className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 transition-colors"
            onClick={resetGame}
            title="Restart"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="rounded-lg shadow-lg"
            style={{ imageRendering: 'pixelated', maxWidth: '100%', maxHeight: '100%' }}
          />

          {gameState === 'start' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-lg">
              <h2 className="text-2xl font-bold text-emerald-400 mb-2">Snake</h2>
              <p className="text-sm text-slate-300 mb-4">Arrow keys or WASD to move</p>
              <button
                className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors"
                onClick={() => setGameState('playing')}
              >
                Start Game
              </button>
            </div>
          )}

          {gameState === 'paused' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-lg">
              <h2 className="text-xl font-bold text-yellow-300 mb-2">Paused</h2>
              <p className="text-sm text-slate-300">Press Space to resume</p>
            </div>
          )}

          {gameState === 'over' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-lg">
              <h2 className="text-2xl font-bold text-red-400 mb-1">Game Over</h2>
              <p className="text-lg text-slate-200 mb-1">Score: {score}</p>
              {score >= highScore && score > 0 && (
                <p className="text-sm text-yellow-400 mb-3">New High Score!</p>
              )}
              <button
                className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors"
                onClick={resetGame}
              >
                Play Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
