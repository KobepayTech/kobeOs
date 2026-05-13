import { useState, useCallback } from 'react';
import { ArrowLeftRight, Trash2 } from 'lucide-react';

type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
type Color = 'w' | 'b';
interface Piece {
  type: PieceType;
  color: Color;
}
interface Square {
  row: number;
  col: number;
}
interface Move {
  from: Square;
  to: Square;
  piece: Piece;
  captured: Piece | null;
  notation: string;
  promotion?: PieceType;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const PIECES: Record<Color, Record<PieceType, string>> = {
  w: { k: '\u2654', q: '\u2655', r: '\u2656', b: '\u2657', n: '\u2658', p: '\u2659' },
  b: { k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F' },
};

function createInitialBoard(): (Piece | null)[][] {
  const backRank: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  const board: (Piece | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: backRank[c], color: 'b' };
    board[1][c] = { type: 'p', color: 'b' };
    board[6][c] = { type: 'p', color: 'w' };
    board[7][c] = { type: backRank[c], color: 'w' };
  }
  return board;
}

function inBounds(r: number, c: number) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function squareToAlg(row: number, col: number): string {
  return FILES[col] + RANKS[row];
}

function cloneBoard(board: (Piece | null)[][]): (Piece | null)[][] {
  return board.map((row) => [...row]);
}

function getMoves(board: (Piece | null)[][], row: number, col: number, checkValidation = true): Square[] {
  const piece = board[row][col];
  if (!piece) return [];
  const moves: Square[] = [];
  const color = piece.color;
  const enemy = color === 'w' ? 'b' : 'w';

  const add = (r: number, c: number) => {
    if (!inBounds(r, c)) return false;
    const target = board[r][c];
    if (!target) { moves.push({ row: r, col: c }); return true; }
    if (target.color === enemy) { moves.push({ row: r, col: c }); }
    return false;
  };

  const slide = (dr: number, dc: number) => {
    let r = row + dr, c = col + dc;
    while (inBounds(r, c)) {
      const target = board[r][c];
      if (!target) { moves.push({ row: r, col: c }); }
      else { if (target.color === enemy) moves.push({ row: r, col: c }); break; }
      r += dr; c += dc;
    }
  };

  switch (piece.type) {
    case 'p': {
      const dir = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;
      // Forward
      if (inBounds(row + dir, col) && !board[row + dir][col]) {
        moves.push({ row: row + dir, col });
        if (row === startRow && !board[row + dir * 2][col]) {
          moves.push({ row: row + dir * 2, col });
        }
      }
      // Captures
      for (const dc of [-1, 1]) {
        if (inBounds(row + dir, col + dc)) {
          const target = board[row + dir][col + dc];
          if (target && target.color === enemy) {
            moves.push({ row: row + dir, col: col + dc });
          }
        }
      }
      break;
    }
    case 'r':
      slide(-1, 0); slide(1, 0); slide(0, -1); slide(0, 1);
      break;
    case 'b':
      slide(-1, -1); slide(-1, 1); slide(1, -1); slide(1, 1);
      break;
    case 'q':
      slide(-1, 0); slide(1, 0); slide(0, -1); slide(0, 1);
      slide(-1, -1); slide(-1, 1); slide(1, -1); slide(1, 1);
      break;
    case 'n': {
      const deltas = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for (const [dr, dc] of deltas) add(row + dr, col + dc);
      break;
    }
    case 'k': {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          add(row + dr, col + dc);
        }
      }
      break;
    }
  }

  if (checkValidation) {
    return moves.filter((m) => {
      const testBoard = cloneBoard(board);
      testBoard[m.row][m.col] = testBoard[row][col];
      testBoard[row][col] = null;
      return !isInCheck(testBoard, color);
    });
  }
  return moves;
}

function findKing(board: (Piece | null)[][], color: Color): Square | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === 'k' && p.color === color) return { row: r, col: c };
    }
  }
  return null;
}

function isInCheck(board: (Piece | null)[][], color: Color): boolean {
  const king = findKing(board, color);
  if (!king) return false;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color !== color) {
        const attacks = getMoves(board, r, c, false);
        if (attacks.some((m) => m.row === king.row && m.col === king.col)) return true;
      }
    }
  }
  return false;
}

function isCheckmate(board: (Piece | null)[][], color: Color): boolean {
  if (!isInCheck(board, color)) return false;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color) {
        const moves = getMoves(board, r, c, true);
        if (moves.length > 0) return false;
      }
    }
  }
  return true;
}

function isStalemate(board: (Piece | null)[][], color: Color): boolean {
  if (isInCheck(board, color)) return false;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color) {
        const moves = getMoves(board, r, c, true);
        if (moves.length > 0) return false;
      }
    }
  }
  return true;
}

function moveNotation(piece: Piece, from: Square, to: Square, captured: boolean): string {
  let notation = '';
  if (piece.type !== 'p') notation += piece.type.toUpperCase();
  else if (captured) notation += FILES[from.col];
  if (captured) notation += 'x';
  notation += squareToAlg(to.row, to.col);
  // Simple disambiguation could be added here
  return notation;
}

export default function ChessGame() {
  const [board, setBoard] = useState(createInitialBoard);
  const [turn, setTurn] = useState<Color>('w');
  const [selected, setSelected] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Square[]>([]);
  const [history, setHistory] = useState<Move[]>([]);
  const [status, setStatus] = useState<string>('White to move');
  const [gameOver, setGameOver] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);

  const resetGame = useCallback(() => {
    setBoard(createInitialBoard());
    setTurn('w');
    setSelected(null);
    setValidMoves([]);
    setHistory([]);
    setStatus('White to move');
    setGameOver(false);
    setLastMove(null);
  }, []);

  const undoMove = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const newBoard = cloneBoard(board);
      newBoard[last.from.row][last.from.col] = last.piece;
      newBoard[last.to.row][last.to.col] = last.captured;
      setBoard(newBoard);
      setTurn((t) => (t === 'w' ? 'b' : 'w'));
      setSelected(null);
      setValidMoves([]);
      setLastMove(prev.length > 1 ? { from: prev[prev.length - 2].from, to: prev[prev.length - 2].to } : null);
      setGameOver(false);
      setStatus((prev.length > 1 ? (prev[prev.length - 2].piece.color === 'w' ? 'White to move' : 'Black to move') : 'White to move'));
      return prev.slice(0, -1);
    });
  }, [board]);

  const handleSquareClick = useCallback((row: number, col: number) => {
    if (gameOver) return;
    const piece = board[row][col];

    // If a piece of current turn is selected and we click another piece of same color, change selection
    if (piece && piece.color === turn) {
      setSelected({ row, col });
      setValidMoves(getMoves(board, row, col, true));
      return;
    }

    // If we have a selected piece and click a valid move square
    if (selected) {
      const isValid = validMoves.some((m) => m.row === row && m.col === col);
      if (isValid) {
        const movingPiece = board[selected.row][selected.col]!;
        const captured = board[row][col];
        const notation = moveNotation(movingPiece, selected, { row, col }, !!captured);
        const newBoard = cloneBoard(board);
        newBoard[row][col] = movingPiece;
        newBoard[selected.row][selected.col] = null;

        // Pawn promotion
        if (movingPiece.type === 'p' && (row === 0 || row === 7)) {
          newBoard[row][col] = { type: 'q', color: movingPiece.color };
        }

        const move: Move = {
          from: selected,
          to: { row, col },
          piece: movingPiece,
          captured,
          notation: notation + ((movingPiece.type === 'p' && (row === 0 || row === 7)) ? '=Q' : ''),
        };

        const nextTurn = turn === 'w' ? 'b' : 'w';
        setBoard(newBoard);
        setTurn(nextTurn);
        setSelected(null);
        setValidMoves([]);
        setLastMove({ from: selected, to: { row, col } });
        setHistory((h) => [...h, move]);

        // Check game state
        if (isCheckmate(newBoard, nextTurn)) {
          setStatus(`${turn === 'w' ? 'White' : 'Black'} wins by checkmate!`);
          setGameOver(true);
        } else if (isStalemate(newBoard, nextTurn)) {
          setStatus('Stalemate - Draw!');
          setGameOver(true);
        } else if (isInCheck(newBoard, nextTurn)) {
          setStatus(`${nextTurn === 'w' ? 'White' : 'Black'} is in check!`);
        } else {
          setStatus(`${nextTurn === 'w' ? 'White' : 'Black'} to move`);
        }
        return;
      }
    }

    // Deselect if clicking empty or invalid square
    setSelected(null);
    setValidMoves([]);
  }, [board, selected, validMoves, turn, gameOver]);

  const getSquareColor = (row: number, col: number) => {
    const isDark = (row + col) % 2 === 1;
    const isSelected = selected && selected.row === row && selected.col === col;
    const isLastFrom = lastMove && lastMove.from.row === row && lastMove.from.col === col;
    const isLastTo = lastMove && lastMove.to.row === row && lastMove.to.col === col;
    const isValidMove = validMoves.some((m) => m.row === row && m.col === col);

    let bg = isDark ? '#769656' : '#eeeed2';
    if (isSelected) bg = '#f7ec5f';
    else if (isLastFrom || isLastTo) bg = isDark ? '#b9ca43' : '#f7ec5f';

    return { bg, isValidMove, isDark };
  };

  return (
    <div className="flex h-full bg-[#0f172a] text-os-text-primary select-none">
      {/* Board */}
      <div className="flex-1 flex flex-col items-center justify-center p-3">
        <div className="flex items-center justify-between w-full max-w-md mb-2">
          <div className="text-sm font-semibold">
            {turn === 'w' ? 'White to move' : 'Black to move'}
          </div>
          <div className="text-xs text-os-text-muted">{status}</div>
        </div>
        <div className="relative">
          {/* File labels top */}
          <div className="flex ml-6">
            {FILES.map((f) => (
              <div key={f + 't'} className="w-10 h-5 flex items-center justify-center text-[10px] text-os-text-muted">
                {f}
              </div>
            ))}
          </div>
          <div className="flex">
            {/* Rank labels left */}
            <div className="flex flex-col w-6">
              {RANKS.map((r) => (
                <div key={r + 'l'} className="h-10 flex items-center justify-center text-[10px] text-os-text-muted">
                  {r}
                </div>
              ))}
            </div>
            {/* Chess board */}
            <div className="grid grid-cols-8 border border-[#769656]">
              {board.map((row, r) =>
                row.map((piece, c) => {
                  const { bg, isValidMove } = getSquareColor(r, c);
                  return (
                    <div
                      key={`${r}-${c}`}
                      className="w-10 h-10 flex items-center justify-center cursor-pointer relative"
                      style={{ backgroundColor: bg }}
                      onClick={() => handleSquareClick(r, c)}
                    >
                      {piece && (
                        <span
                          className={`text-2xl leading-none ${piece.color === 'w' ? 'text-white drop-shadow-sm' : 'text-black'}`}
                          style={{ fontFamily: 'serif' }}
                        >
                          {PIECES[piece.color][piece.type]}
                        </span>
                      )}
                      {isValidMove && !piece && (
                        <div className="w-3 h-3 rounded-full bg-black/20 absolute" />
                      )}
                      {isValidMove && piece && (
                        <div className="absolute inset-0 border-2 border-black/20 rounded-none" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
            {/* Rank labels right */}
            <div className="flex flex-col w-6">
              {RANKS.map((r) => (
                <div key={r + 'r'} className="h-10 flex items-center justify-center text-[10px] text-os-text-muted">
                  {r}
                </div>
              ))}
            </div>
          </div>
          {/* File labels bottom */}
          <div className="flex ml-6">
            {FILES.map((f) => (
              <div key={f + 'b'} className="w-10 h-5 flex items-center justify-center text-[10px] text-os-text-muted">
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex gap-2 mt-3">
          <button
            className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs transition-colors flex items-center gap-1"
            onClick={resetGame}
          >
            <Trash2 className="w-3 h-3" /> New Game
          </button>
          <button
            className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs transition-colors flex items-center gap-1"
            onClick={undoMove}
            disabled={history.length === 0}
          >
            <ArrowLeftRight className="w-3 h-3" /> Undo
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-44 border-l border-white/10 flex flex-col">
        <div className="px-3 py-2 text-xs font-semibold text-os-text-muted uppercase border-b border-white/10">
          Move History
        </div>
        <div className="flex-1 overflow-auto px-2 py-2">
          {history.length === 0 && (
            <div className="text-xs text-os-text-muted text-center py-4">No moves yet</div>
          )}
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
            {history.map((move, i) => (
              <div key={i} className={`${i % 2 === 0 ? 'text-slate-300' : 'text-os-text-muted'}`}>
                {i % 2 === 0 && <span className="text-os-text-muted mr-1">{Math.floor(i / 2) + 1}.</span>}
                {move.notation}
              </div>
            ))}
          </div>
        </div>
        {gameOver && (
          <div className="p-3 border-t border-white/10">
            <div className="text-sm font-bold text-center text-yellow-400">{status}</div>
          </div>
        )}
        <div className="p-3 border-t border-white/10">
          <div className="text-[10px] text-os-text-muted">
            Click piece, then valid square to move
          </div>
        </div>
      </div>
    </div>
  );
}
