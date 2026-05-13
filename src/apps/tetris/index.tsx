import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Trophy } from 'lucide-react';

const COLS = 10;
const ROWS = 20;
const CELL = 24;
const CANVAS_W = COLS * CELL;
const CANVAS_H = ROWS * CELL;
const PREVIEW_CELL = 18;

const COLORS: Record<string, string> = {
  I: '#22d3ee',
  O: '#facc15',
  T: '#a855f7',
  S: '#4ade80',
  Z: '#f87171',
  J: '#3b82f6',
  L: '#fb923c',
};

const SHAPES: Record<string, number[][][]> = {
  I: [
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]],
    [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]],
    [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
  ],
  O: [
    [[1, 1], [1, 1]],
    [[1, 1], [1, 1]],
    [[1, 1], [1, 1]],
    [[1, 1], [1, 1]],
  ],
  T: [
    [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 0], [0, 1, 1], [0, 1, 0]],
    [[0, 0, 0], [1, 1, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 1, 0], [0, 1, 0]],
  ],
  S: [
    [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    [[0, 1, 0], [0, 1, 1], [0, 0, 1]],
    [[0, 0, 0], [0, 1, 1], [1, 1, 0]],
    [[1, 0, 0], [1, 1, 0], [0, 1, 0]],
  ],
  Z: [
    [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    [[0, 0, 1], [0, 1, 1], [0, 1, 0]],
    [[0, 0, 0], [1, 1, 0], [0, 1, 1]],
    [[0, 1, 0], [1, 1, 0], [1, 0, 0]],
  ],
  J: [
    [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 1], [0, 1, 0], [0, 1, 0]],
    [[0, 0, 0], [1, 1, 1], [0, 0, 1]],
    [[0, 1, 0], [0, 1, 0], [1, 1, 0]],
  ],
  L: [
    [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 0], [0, 1, 0], [0, 1, 1]],
    [[0, 0, 0], [1, 1, 1], [1, 0, 0]],
    [[1, 1, 0], [0, 1, 0], [0, 1, 0]],
  ],
};

const PIECE_KEYS = Object.keys(SHAPES);

function randomPiece(): string {
  return PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
}

function useHighScore() {
  const key = 'tetris_highscore';
  const [high, setHigh] = useState(() => {
    try { return parseInt(localStorage.getItem(key) || '0', 10); } catch { return 0; }
  });
  const update = useCallback((score: number) => {
    setHigh((prev) => {
      const next = Math.max(prev, score);
      try { localStorage.setItem(key, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  return [high, update] as const;
}

function createEmptyBoard(): (string | null)[][] {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
}

function isValid(board: (string | null)[][], piece: string, rot: number, px: number, py: number): boolean {
  const shape = SHAPES[piece][rot];
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        const x = px + c;
        const y = py + r;
        if (x < 0 || x >= COLS || y >= ROWS) return false;
        if (y >= 0 && board[y][x]) return false;
      }
    }
  }
  return true;
}

function lockPiece(board: (string | null)[][], piece: string, rot: number, px: number, py: number): (string | null)[][] {
  const b = board.map((row) => [...row]);
  const shape = SHAPES[piece][rot];
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        const y = py + r;
        const x = px + c;
        if (y >= 0) b[y][x] = piece;
      }
    }
  }
  return b;
}

function clearLines(board: (string | null)[][]): { board: (string | null)[][]; lines: number } {
  const newBoard = board.filter((row) => row.some((c) => c === null));
  const cleared = ROWS - newBoard.length;
  while (newBoard.length < ROWS) {
    newBoard.unshift(Array.from({ length: COLS }, () => null));
  }
  return { board: newBoard, lines: cleared };
}

function getGhostY(board: (string | null)[][], piece: string, rot: number, px: number, py: number): number {
  let y = py;
  while (isValid(board, piece, rot, px, y + 1)) y++;
  return y;
}

export default function TetrisGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [board, setBoard] = useState(createEmptyBoard);
  const [piece, setPiece] = useState(randomPiece);
  const [nextPiece, setNextPiece] = useState(randomPiece);
  const [holdPiece, setHoldPiece] = useState<string | null>(null);
  const [canHold, setCanHold] = useState(true);
  const [rot, setRot] = useState(0);
  const [px, setPx] = useState(3);
  const [py, setPy] = useState(0);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameState, setGameState] = useState<'start' | 'playing' | 'paused' | 'over'>('start');
  const [highScore, setHighScore] = useHighScore();

  const boardRef = useRef(board);
  const pieceRef = useRef(piece);
  const nextRef = useRef(nextPiece);
  const holdRef = useRef(holdPiece);
  const rotRef = useRef(rot);
  const pxRef = useRef(px);
  const pyRef = useRef(py);
  const scoreRef = useRef(score);
  const linesRef = useRef(lines);
  const levelRef = useRef(level);
  const canHoldRef = useRef(canHold);
  const stateRef = useRef(gameState);

  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { pieceRef.current = piece; }, [piece]);
  useEffect(() => { nextRef.current = nextPiece; }, [nextPiece]);
  useEffect(() => { holdRef.current = holdPiece; }, [holdPiece]);
  useEffect(() => { rotRef.current = rot; }, [rot]);
  useEffect(() => { pxRef.current = px; }, [px]);
  useEffect(() => { pyRef.current = py; }, [py]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { linesRef.current = lines; }, [lines]);
  useEffect(() => { levelRef.current = level; }, [level]);
  useEffect(() => { canHoldRef.current = canHold; }, [canHold]);
  useEffect(() => { stateRef.current = gameState; }, [gameState]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(CANVAS_W, y * CELL); ctx.stroke();
    }

    // Locked pieces
    boardRef.current.forEach((row, y) => {
      row.forEach((p, x) => {
        if (p) {
          ctx.fillStyle = COLORS[p];
          ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.strokeRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
        }
      });
    });

    if (stateRef.current === 'playing' || stateRef.current === 'paused') {
      const p = pieceRef.current;
      const r = rotRef.current;
      const gx = pxRef.current;
      const gy = getGhostY(boardRef.current, p, r, gx, pyRef.current);
      const shape = SHAPES[p][r];

      // Ghost
      ctx.globalAlpha = 0.25;
      for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
          if (shape[row][col]) {
            ctx.fillStyle = COLORS[p];
            ctx.fillRect((gx + col) * CELL + 1, (gy + row) * CELL + 1, CELL - 2, CELL - 2);
          }
        }
      }
      ctx.globalAlpha = 1;

      // Active piece
      for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
          if (shape[row][col]) {
            const x = (gx + col) * CELL;
            const y = (pyRef.current + row) * CELL;
            ctx.fillStyle = COLORS[p];
            ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
          }
        }
      }
    }
  }, []);

  const spawnPiece = useCallback((nextP?: string) => {
    const newPiece = nextP ?? nextRef.current;
    const newNext = randomPiece();
    setPiece(newPiece);
    setNextPiece(newNext);
    setRot(0);
    setPx(3);
    setPy(0);
    rotRef.current = 0;
    pxRef.current = 3;
    pyRef.current = 0;
    if (!isValid(boardRef.current, newPiece, 0, 3, 0)) {
      setGameState('over');
      setHighScore(scoreRef.current);
    }
  }, [setHighScore]);

  const tick = useCallback(() => {
    if (stateRef.current !== 'playing') return;
    const nextY = pyRef.current + 1;
    if (isValid(boardRef.current, pieceRef.current, rotRef.current, pxRef.current, nextY)) {
      setPy(nextY);
      pyRef.current = nextY;
    } else {
      const newBoard = lockPiece(boardRef.current, pieceRef.current, rotRef.current, pxRef.current, pyRef.current);
      const { board: clearedBoard, lines: cleared } = clearLines(newBoard);
      const newLines = linesRef.current + cleared;
      const lineScore = cleared === 1 ? 100 : cleared === 2 ? 300 : cleared === 3 ? 500 : cleared === 4 ? 800 : 0;
      const newScore = scoreRef.current + lineScore * levelRef.current;
      const newLevel = Math.floor(newLines / 10) + 1;
      setBoard(clearedBoard);
      setLines(newLines);
      setScore(newScore);
      setLevel(newLevel);
      setCanHold(true);
      canHoldRef.current = true;
      spawnPiece();
      setHighScore(newScore);
    }
  }, [spawnPiece, setHighScore]);

  useEffect(() => {
    let last = 0;
    const dropInterval = () => Math.max(100, 1000 - (levelRef.current - 1) * 80);
    const loop = (time: number) => {
      const id = requestAnimationFrame(loop);
      animRef.current = id;
      if (stateRef.current === 'playing') {
        if (time - last >= dropInterval()) {
          last = time;
          tick();
        }
      }
      draw();
      return id;
    };
    const animRef = { current: 0 };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw, tick]);

  useEffect(() => {
    draw();
  }, [draw, gameState, nextPiece, holdPiece]);

  const hardDrop = useCallback(() => {
    if (stateRef.current !== 'playing') return;
    let y = pyRef.current;
    while (isValid(boardRef.current, pieceRef.current, rotRef.current, pxRef.current, y + 1)) y++;
    const dropDistance = y - pyRef.current;
    const newBoard = lockPiece(boardRef.current, pieceRef.current, rotRef.current, pxRef.current, y);
    const { board: clearedBoard, lines: cleared } = clearLines(newBoard);
    const newLines = linesRef.current + cleared;
    const lineScore = cleared === 1 ? 100 : cleared === 2 ? 300 : cleared === 3 ? 500 : cleared === 4 ? 800 : 0;
    const newScore = scoreRef.current + lineScore * levelRef.current + dropDistance * 2;
    const newLevel = Math.floor(newLines / 10) + 1;
    setPy(y);
    setBoard(clearedBoard);
    setLines(newLines);
    setScore(newScore);
    setLevel(newLevel);
    setCanHold(true);
    canHoldRef.current = true;
    spawnPiece();
    setHighScore(newScore);
  }, [spawnPiece, setHighScore]);

  const rotate = useCallback(() => {
    if (stateRef.current !== 'playing') return;
    const newRot = (rotRef.current + 1) % 4;
    // Wall kicks: try original, then offsets
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      if (isValid(boardRef.current, pieceRef.current, newRot, pxRef.current + k, pyRef.current)) {
        setRot(newRot);
        setPx(pxRef.current + k);
        rotRef.current = newRot;
        pxRef.current = pxRef.current + k;
        return;
      }
    }
  }, []);

  const move = useCallback((dx: number, dy: number) => {
    if (stateRef.current !== 'playing') return;
    const newX = pxRef.current + dx;
    const newY = pyRef.current + dy;
    if (isValid(boardRef.current, pieceRef.current, rotRef.current, newX, newY)) {
      setPx(newX);
      setPy(newY);
      pxRef.current = newX;
      pyRef.current = newY;
    }
  }, []);

  const hold = useCallback(() => {
    if (stateRef.current !== 'playing' || !canHoldRef.current) return;
    const current = pieceRef.current;
    const held = holdRef.current;
    if (held) {
      setPiece(held);
      pieceRef.current = held;
      setHoldPiece(current);
      holdRef.current = current;
    } else {
      setHoldPiece(current);
      holdRef.current = current;
      const np = nextRef.current;
      setPiece(np);
      pieceRef.current = np;
      setNextPiece(randomPiece());
    }
    setRot(0);
    setPx(3);
    setPy(0);
    rotRef.current = 0;
    pxRef.current = 3;
    pyRef.current = 0;
    setCanHold(false);
    canHoldRef.current = false;
    if (!isValid(boardRef.current, pieceRef.current, 0, 3, 0)) {
      setGameState('over');
      setHighScore(scoreRef.current);
    }
  }, [setHighScore]);

  const resetGame = useCallback(() => {
    setBoard(createEmptyBoard());
    setPiece(randomPiece());
    setNextPiece(randomPiece());
    setHoldPiece(null);
    setCanHold(true);
    setRot(0);
    setPx(3);
    setPy(0);
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameState('playing');
    boardRef.current = createEmptyBoard();
    pieceRef.current = randomPiece();
    nextRef.current = randomPiece();
    holdRef.current = null;
    canHoldRef.current = true;
    rotRef.current = 0;
    pxRef.current = 3;
    pyRef.current = 0;
    scoreRef.current = 0;
    linesRef.current = 0;
    levelRef.current = 1;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key;
      if (key === 'p' || key === 'P') {
        setGameState((gs) => gs === 'playing' ? 'paused' : gs === 'paused' ? 'playing' : gs);
        return;
      }
      if (gameState === 'start') {
        if (key === ' ' || key === 'Enter') { setGameState('playing'); return; }
      }
      if (gameState === 'over') {
        if (key === ' ' || key === 'Enter') { resetGame(); return; }
      }
      if (stateRef.current !== 'playing') return;
      if (key === 'ArrowLeft') { e.preventDefault(); move(-1, 0); }
      else if (key === 'ArrowRight') { e.preventDefault(); move(1, 0); }
      else if (key === 'ArrowDown') { e.preventDefault(); move(0, 1); }
      else if (key === 'ArrowUp') { e.preventDefault(); rotate(); }
      else if (key === ' ') { e.preventDefault(); hardDrop(); }
      else if (key === 'c' || key === 'C') { hold(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState, move, rotate, hardDrop, hold, resetGame]);

  const drawPreview = (pieceKey: string | null, canvasId: string) => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas || !pieceKey) {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); }
      }
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const shape = SHAPES[pieceKey][0];
    const color = COLORS[pieceKey];
    const w = shape[0].length * PREVIEW_CELL;
    const h = shape.length * PREVIEW_CELL;
    const offX = (canvas.width - w) / 2;
    const offY = (canvas.height - h) / 2;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          ctx.fillStyle = color;
          ctx.fillRect(offX + c * PREVIEW_CELL + 1, offY + r * PREVIEW_CELL + 1, PREVIEW_CELL - 2, PREVIEW_CELL - 2);
        }
      }
    }
  };

  useEffect(() => {
    drawPreview(nextPiece, 'next-canvas');
  }, [nextPiece]);
  useEffect(() => {
    drawPreview(holdPiece, 'hold-canvas');
  }, [holdPiece]);

  return (
    <div className="flex h-full bg-[#0f172a] text-os-text-primary select-none">
      {/* Sidebar */}
      <div className="w-36 border-r border-white/10 flex flex-col p-3 gap-3">
        <div className="text-center">
          <div className="text-xs text-os-text-muted uppercase mb-1">Score</div>
          <div className="text-lg font-bold font-mono">{score}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-os-text-muted uppercase mb-1">Level</div>
          <div className="text-lg font-bold font-mono">{level}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-os-text-muted uppercase mb-1">Lines</div>
          <div className="text-lg font-bold font-mono">{lines}</div>
        </div>
        <div className="border-t border-white/10 pt-2">
          <div className="text-xs text-os-text-muted uppercase mb-1 text-center">Next</div>
          <canvas id="next-canvas" width={80} height={80} className="mx-auto" />
        </div>
        <div className="border-t border-white/10 pt-2">
          <div className="text-xs text-os-text-muted uppercase mb-1 text-center">Hold (C)</div>
          <canvas id="hold-canvas" width={80} height={80} className="mx-auto" />
        </div>
        <div className="border-t border-white/10 pt-2">
          <div className="flex items-center justify-center gap-1 text-xs text-os-text-muted">
            <Trophy className="w-3 h-3 text-yellow-400" />
            <span>{highScore}</span>
          </div>
        </div>
        <div className="mt-auto flex flex-col gap-1">
          <button
            className="px-2 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs transition-colors flex items-center justify-center gap-1"
            onClick={() => setGameState((gs) => gs === 'playing' ? 'paused' : gs === 'paused' ? 'playing' : gs)}
          >
            {gameState === 'paused' ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            {gameState === 'paused' ? 'Resume' : 'Pause'}
          </button>
          <button
            className="px-2 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs transition-colors flex items-center justify-center gap-1"
            onClick={resetGame}
          >
            <RotateCcw className="w-3 h-3" /> Restart
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center p-2 relative">
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
              <h2 className="text-2xl font-bold text-cyan-400 mb-2">Tetris</h2>
              <p className="text-xs text-slate-300 mb-1">Arrows: Move / Rotate</p>
              <p className="text-xs text-slate-300 mb-1">Space: Hard Drop</p>
              <p className="text-xs text-slate-300 mb-1">C: Hold</p>
              <p className="text-xs text-slate-300 mb-3">P: Pause</p>
              <button
                className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-medium transition-colors"
                onClick={() => setGameState('playing')}
              >
                Start Game
              </button>
            </div>
          )}
          {gameState === 'paused' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-lg">
              <h2 className="text-xl font-bold text-yellow-300 mb-2">Paused</h2>
              <p className="text-sm text-slate-300">Press P to resume</p>
            </div>
          )}
          {gameState === 'over' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-lg">
              <h2 className="text-2xl font-bold text-red-400 mb-1">Game Over</h2>
              <p className="text-lg text-slate-200 mb-1">Score: {score}</p>
              <p className="text-sm text-slate-300 mb-1">Lines: {lines} | Level: {level}</p>
              {score >= highScore && score > 0 && (
                <p className="text-sm text-yellow-400 mb-3">New High Score!</p>
              )}
              <button
                className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-medium transition-colors"
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
