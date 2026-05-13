import { useState, useCallback, useEffect, useRef } from 'react';
import { RotateCcw, Timer, Undo2 } from 'lucide-react';

type Suit = 'hearts' | 'diamonds' | 'spades' | 'clubs';
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

interface Card {
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
  id: string;
}

const SUITS: Suit[] = ['hearts', 'diamonds', 'spades', 'clubs'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_SYMBOLS: Record<Suit, string> = { hearts: '\u2665', diamonds: '\u2666', spades: '\u2660', clubs: '\u2663' };
const SUIT_COLORS: Record<Suit, string> = { hearts: '#dc2626', diamonds: '#dc2626', spades: '#171717', clubs: '#171717' };
const RANK_ORDER: Record<Rank, number> = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 };

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, faceUp: false, id: `${suit}-${rank}` });
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function isRed(suit: Suit) {
  return suit === 'hearts' || suit === 'diamonds';
}

function canPlaceOnTableau(bottom: Card | null, card: Card): boolean {
  if (!bottom) return card.rank === 'K';
  const bottomOrder = RANK_ORDER[bottom.rank];
  const cardOrder = RANK_ORDER[card.rank];
  return cardOrder === bottomOrder - 1 && isRed(bottom.suit) !== isRed(card.suit);
}

function canPlaceOnFoundation(top: Card | null, card: Card): boolean {
  if (!top) return card.rank === 'A';
  return card.suit === top.suit && RANK_ORDER[card.rank] === RANK_ORDER[top.rank] + 1;
}

type PileType = 'stock' | 'waste' | 'foundation' | 'tableau';

interface GameState {
  stock: Card[];
  waste: Card[];
  foundations: Card[][];
  tableaus: Card[][];
  score: number;
  time: number;
  moves: number;
}

function createInitialState(): GameState {
  const deck = createDeck();
  const tableaus: Card[][] = [];
  let idx = 0;
  for (let i = 0; i < 7; i++) {
    const pile: Card[] = [];
    for (let j = 0; j <= i; j++) {
      pile.push({ ...deck[idx], faceUp: j === i });
      idx++;
    }
    tableaus.push(pile);
  }
  return {
    stock: deck.slice(idx),
    waste: [],
    foundations: [[], [], [], []],
    tableaus,
    score: 0,
    time: 0,
    moves: 0,
  };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SolitaireGame() {
  const [game, setGame] = useState<GameState>(createInitialState);
  const [selected, setSelected] = useState<{ type: PileType; pileIndex: number; cardIndex: number } | null>(null);
  const [history, setHistory] = useState<GameState[]>([]);
  const [won, setWon] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameRef = useRef(game);
  gameRef.current = game;

  // Timer
  useEffect(() => {
    if (!won) {
      timerRef.current = setInterval(() => {
        setGame((g) => ({ ...g, time: g.time + 1 }));
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [won]);

  const saveState = useCallback((current: GameState) => {
    setHistory((h) => [...h, { ...current, stock: [...current.stock], waste: [...current.waste], foundations: current.foundations.map(f => [...f]), tableaus: current.tableaus.map(t => [...t]) }]);
  }, []);

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setGame(last);
      setWon(false);
      return prev.slice(0, -1);
    });
  }, []);

  const checkWin = useCallback((foundations: Card[][]) => {
    return foundations.every((f) => f.length === 13);
  }, []);

  const newGame = useCallback(() => {
    setGame(createInitialState());
    setHistory([]);
    setSelected(null);
    setWon(false);
  }, []);

  const drawStock = useCallback(() => {
    const current = gameRef.current;
    saveState(current);
    if (current.stock.length === 0) {
      // Recycle waste back to stock
      const recycled = current.waste.map((c) => ({ ...c, faceUp: false })).reverse();
      setGame({ ...current, stock: recycled, waste: [] });
    } else {
      const drawCount = Math.min(3, current.stock.length);
      const drawn = current.stock.slice(0, drawCount).map((c) => ({ ...c, faceUp: true }));
      const remaining = current.stock.slice(drawCount);
      setGame({ ...current, stock: remaining, waste: [...current.waste, ...drawn] });
    }
  }, [saveState]);

  const autoMoveToFoundation = useCallback((card: Card, fromType: PileType, fromIndex: number) => {
    const current = gameRef.current;
    for (let f = 0; f < 4; f++) {
      const top = current.foundations[f].length > 0 ? current.foundations[f][current.foundations[f].length - 1] : null;
      if (canPlaceOnFoundation(top, card)) {
        saveState(current);
        const newFoundations = current.foundations.map((pile, i) => {
          if (i === f) return [...pile, { ...card, faceUp: true }];
          return pile;
        });
        const newScore = current.score + 10;

        if (fromType === 'waste') {
          const newWaste = current.waste.slice(0, -1);
          const newGame = { ...current, waste: newWaste, foundations: newFoundations, score: newScore, moves: current.moves + 1 };
          setGame(newGame);
          if (checkWin(newFoundations)) setWon(true);
        } else if (fromType === 'tableau') {
          const newTableaus = current.tableaus.map((pile, i) => {
            if (i === fromIndex) {
              const newPile = pile.slice(0, -1);
              if (newPile.length > 0 && !newPile[newPile.length - 1].faceUp) {
                newPile[newPile.length - 1] = { ...newPile[newPile.length - 1], faceUp: true };
              }
              return newPile;
            }
            return pile;
          });
          const newGame = { ...current, tableaus: newTableaus, foundations: newFoundations, score: newScore + 5, moves: current.moves + 1 };
          setGame(newGame);
          if (checkWin(newFoundations)) setWon(true);
        }
        return true;
      }
    }
    return false;
  }, [saveState, checkWin]);

  const handleWasteClick = useCallback(() => {
    const current = gameRef.current;
    if (current.waste.length === 0) {
      drawStock();
      return;
    }
    const topCard = current.waste[current.waste.length - 1];
    if (selected && selected.type === 'waste') {
      // Try auto-move
      autoMoveToFoundation(topCard, 'waste', 0);
      setSelected(null);
      return;
    }
    setSelected({ type: 'waste', pileIndex: 0, cardIndex: current.waste.length - 1 });
  }, [selected, drawStock, autoMoveToFoundation]);

  const handleFoundationClick = useCallback((foundationIndex: number) => {
    if (!selected) return;
    const current = gameRef.current;
    const src = getSelectedCards(current, selected);
    if (!src || src.length !== 1) { setSelected(null); return; }
    const card = src[0];
    const top = current.foundations[foundationIndex].length > 0 ? current.foundations[foundationIndex][current.foundations[foundationIndex].length - 1] : null;
    if (!canPlaceOnFoundation(top, card)) { setSelected(null); return; }

    saveState(current);
    const newFoundations = [...current.foundations];
    newFoundations[foundationIndex] = [...newFoundations[foundationIndex], { ...card, faceUp: true }];
    const newScore = current.score + 10;

    let newGame: GameState;
    if (selected.type === 'waste') {
      const newWaste = current.waste.slice(0, -1);
      newGame = { ...current, waste: newWaste, foundations: newFoundations, score: newScore, moves: current.moves + 1 };
    } else if (selected.type === 'tableau') {
      const newTableaus = current.tableaus.map((pile, i) => {
        if (i === selected.pileIndex) {
          const newPile = pile.slice(0, selected.cardIndex);
          if (newPile.length > 0 && !newPile[newPile.length - 1].faceUp) {
            newPile[newPile.length - 1] = { ...newPile[newPile.length - 1], faceUp: true };
          }
          return newPile;
        }
        return pile;
      });
      newGame = { ...current, tableaus: newTableaus, foundations: newFoundations, score: newScore + 5, moves: current.moves + 1 };
    } else {
      setSelected(null); return;
    }

    setGame(newGame);
    setSelected(null);
    if (checkWin(newFoundations)) setWon(true);
  }, [selected, saveState, checkWin]);

  const handleTableauClick = useCallback((pileIndex: number, cardIndex: number) => {
    const current = gameRef.current;
    const pile = current.tableaus[pileIndex];
    const card = pile[cardIndex];

    if (!card.faceUp) {
      setSelected(null);
      return;
    }

    // If clicking same selected card, try auto-move to foundation
    if (selected && selected.type === 'tableau' && selected.pileIndex === pileIndex && selected.cardIndex === cardIndex) {
      autoMoveToFoundation(card, 'tableau', pileIndex);
      setSelected(null);
      return;
    }

    // If we have a selection, try to place
    if (selected) {
      const srcCards = getSelectedCards(current, selected);
      if (!srcCards) { setSelected(null); return; }
      const bottom = pile.length > 0 ? pile[pile.length - 1] : null;
      if (!canPlaceOnTableau(bottom, srcCards[0])) {
        // Try selecting this instead
        setSelected({ type: 'tableau', pileIndex, cardIndex });
        return;
      }

      saveState(current);
      const newTableaus = current.tableaus.map((p, i) => {
        if (i === pileIndex) return [...p, ...srcCards];
        if (selected.type === 'tableau' && i === selected.pileIndex) {
          const newPile = p.slice(0, selected.cardIndex);
          if (newPile.length > 0 && !newPile[newPile.length - 1].faceUp) {
            newPile[newPile.length - 1] = { ...newPile[newPile.length - 1], faceUp: true };
          }
          return newPile;
        }
        return p;
      });

      let newWaste = current.waste;
      if (selected.type === 'waste') {
        newWaste = current.waste.slice(0, -1);
      }

      setGame({ ...current, tableaus: newTableaus, waste: newWaste, moves: current.moves + 1 });
      setSelected(null);
      return;
    }

    // Select this card and all face-up cards above it
    const faceUpStart = pile.findIndex((c) => c.faceUp);
    if (cardIndex < faceUpStart) {
      setSelected(null);
      return;
    }
    setSelected({ type: 'tableau', pileIndex, cardIndex });
  }, [selected, saveState, autoMoveToFoundation]);

  const handleStockClick = useCallback(() => {
    drawStock();
    setSelected(null);
  }, [drawStock]);

  function getSelectedCards(g: GameState, sel: { type: PileType; pileIndex: number; cardIndex: number }): Card[] | null {
    if (sel.type === 'waste') {
      return g.waste.length > 0 ? [g.waste[g.waste.length - 1]] : null;
    }
    if (sel.type === 'tableau') {
      return g.tableaus[sel.pileIndex].slice(sel.cardIndex);
    }
    return null;
  }

  const renderCard = (card: Card, isSelected = false, size: 'sm' | 'md' = 'md') => {
    const w = size === 'sm' ? 'w-9' : 'w-14';
    const h = size === 'sm' ? 'h-12' : 'h-20';
    const textSize = size === 'sm' ? 'text-[10px]' : 'text-sm';
    const suitSize = size === 'sm' ? 'text-xs' : 'text-lg';
    return (
      <div
        className={`${w} ${h} rounded-md border flex flex-col items-center justify-center shadow-sm ${isSelected ? 'ring-2 ring-yellow-400' : ''}`}
        style={{
          backgroundColor: '#f8fafc',
          borderColor: '#cbd5e1',
          color: SUIT_COLORS[card.suit],
        }}
      >
        <div className={`font-bold ${textSize}`}>{card.rank}</div>
        <div className={`${suitSize}`}>{SUIT_SYMBOLS[card.suit]}</div>
      </div>
    );
  };

  const renderBack = (size: 'sm' | 'md' = 'md') => {
    const w = size === 'sm' ? 'w-9' : 'w-14';
    const h = size === 'sm' ? 'h-12' : 'h-20';
    return (
      <div className={`${w} ${h} rounded-md border border-slate-400 flex items-center justify-center shadow-sm`} style={{ background: 'repeating-linear-gradient(45deg, #1e40af, #1e40af 4px, #1d4ed8 4px, #1d4ed8 8px)' }}>
        <div className="text-[8px] text-blue-200 font-bold">KOBE</div>
      </div>
    );
  };

  const renderEmpty = (size: 'sm' | 'md' = 'md') => {
    const w = size === 'sm' ? 'w-9' : 'w-14';
    const h = size === 'sm' ? 'h-12' : 'h-20';
    return (
      <div className={`${w} ${h} rounded-md border border-dashed border-white/20 flex items-center justify-center`} />
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-os-text-primary select-none overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-sm">
            <Timer className="w-4 h-4 text-os-text-muted" />
            <span className="font-mono">{formatTime(game.time)}</span>
          </div>
          <div className="text-sm">Score: <span className="font-mono font-bold">{game.score}</span></div>
          <div className="text-sm text-os-text-muted">Moves: {game.moves}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 transition-colors"
            onClick={undo}
            disabled={history.length === 0}
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 transition-colors"
            onClick={newGame}
            title="New Game"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Game Area */}
      <div className="flex-1 p-3 flex flex-col items-center min-h-0">
        <div className="flex gap-6 mb-3">
          {/* Stock & Waste */}
          <div className="flex gap-2">
            <div className="cursor-pointer" onClick={handleStockClick}>
              {game.stock.length > 0 ? renderBack() : renderEmpty()}
            </div>
            <div className="cursor-pointer" onClick={handleWasteClick}>
              {game.waste.length > 0
                ? renderCard(game.waste[game.waste.length - 1], selected?.type === 'waste')
                : renderEmpty()
              }
            </div>
          </div>

          {/* Foundations */}
          <div className="flex gap-2">
            {game.foundations.map((pile, i) => (
              <div
                key={i}
                className="cursor-pointer"
                onClick={() => handleFoundationClick(i)}
              >
                {pile.length > 0
                  ? renderCard(pile[pile.length - 1])
                  : renderEmpty()
                }
              </div>
            ))}
          </div>
        </div>

        {/* Tableaus */}
        <div className="flex gap-1.5">
          {game.tableaus.map((pile, pileIndex) => (
            <div key={pileIndex} className="flex flex-col items-center">
              {pile.length === 0 ? (
                <div className="cursor-pointer" onClick={() => handleTableauClick(pileIndex, 0)}>
                  {renderEmpty()}
                </div>
              ) : (
                pile.map((card, cardIndex) => {
                  const isSel = selected?.type === 'tableau' && selected.pileIndex === pileIndex && selected.cardIndex === cardIndex;
                  return (
                    <div
                      key={card.id}
                      className="cursor-pointer"
                      style={{ marginTop: cardIndex === 0 ? 0 : -52 }}
                      onClick={() => handleTableauClick(pileIndex, cardIndex)}
                    >
                      {card.faceUp
                        ? renderCard(card, isSel)
                        : renderBack()
                      }
                    </div>
                  );
                })
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Win overlay */}
      {won && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-10">
          <h2 className="text-3xl font-bold text-yellow-400 mb-2">You Win!</h2>
          <p className="text-lg text-slate-200 mb-1">Score: {game.score}</p>
          <p className="text-sm text-slate-300 mb-4">Time: {formatTime(game.time)}</p>
          <button
            className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors"
            onClick={newGame}
          >
            New Game
          </button>
        </div>
      )}
    </div>
  );
}
