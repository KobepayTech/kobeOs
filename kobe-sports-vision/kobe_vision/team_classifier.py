"""Split generic `player` detections into home / away by jersey colour.

RF-DETR's COCO base only gives `person`, so every player arrives as the generic
class "player". This classifier samples each player's jersey colour, clusters
the players into two teams, and rewrites the class to "player_home" /
"player_away" — which is what the possession/passes engine keys on.

Design:
 - colour is reduced to *chromaticity* (r,g proportions) so it's largely
   lighting-invariant;
 - the two team centroids are (re)fit by a deterministic 2-means over the
   current players every few frames;
 - team labels are pinned deterministically by ordering the centroids, so
   "home" and "away" stay stable frame to frame;
 - each track's final label is a majority vote over its recent assignments,
   so one noisy frame can't flip a player's team.

The colour maths is pure stdlib (unit-tested). `sample_jersey_color` (numpy)
is the only part that needs the frame pixels and is lazy-imported.
"""
from __future__ import annotations
from collections import deque
from typing import Deque, Dict, List, Optional, Sequence, Tuple

RGB = Tuple[float, float, float]
Feat = Tuple[float, float]


def chromaticity(rgb: RGB) -> Feat:
    """(r,g,b) -> (r/(r+g+b), g/(r+g+b)); brightness-normalised colour."""
    r, g, b = rgb
    s = r + g + b
    if s <= 0:
        return (1 / 3, 1 / 3)
    return (r / s, g / s)


def _dist2(a: Feat, b: Feat) -> float:
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2


def kmeans_2(points: Sequence[Feat], iters: int = 12) -> Tuple[Feat, Feat, List[int]]:
    """Deterministic 2-means. Seeds with the farthest-apart pair (no randomness,
    so results are reproducible and testable). Returns (c0, c1, assignments)."""
    n = len(points)
    if n == 0:
        return ((1 / 3, 1 / 3), (1 / 3, 1 / 3), [])
    if n == 1:
        return (points[0], points[0], [0])
    # Farthest-pair seed.
    best = (0, 1, -1.0)
    for i in range(n):
        for j in range(i + 1, n):
            d = _dist2(points[i], points[j])
            if d > best[2]:
                best = (i, j, d)
    c0, c1 = points[best[0]], points[best[1]]
    assign = [0] * n
    for _ in range(iters):
        for k, p in enumerate(points):
            assign[k] = 0 if _dist2(p, c0) <= _dist2(p, c1) else 1
        s0 = [p for p, a in zip(points, assign) if a == 0]
        s1 = [p for p, a in zip(points, assign) if a == 1]
        if s0:
            c0 = (sum(p[0] for p in s0) / len(s0), sum(p[1] for p in s0) / len(s0))
        if s1:
            c1 = (sum(p[0] for p in s1) / len(s1), sum(p[1] for p in s1) / len(s1))
    return (c0, c1, assign)


class TeamClassifier:
    def __init__(self, refit_every: int = 15, vote_window: int = 15, min_players: int = 4):
        self.refit_every = refit_every
        self.min_players = min_players
        self.centroids: Optional[Tuple[Feat, Feat]] = None
        self._frame = 0
        self._recent: Dict[int, Deque[str]] = {}
        self._vote_window = vote_window

    def _pin_labels(self, c0: Feat, c1: Feat) -> Tuple[Feat, Feat]:
        """Order centroids deterministically so 'home' == index 0 stays stable.
        Higher red-chromaticity (then greener) is 'home'."""
        return (c0, c1) if (c0[0], c0[1]) >= (c1[0], c1[1]) else (c1, c0)

    def update_and_assign(self, samples: Sequence[Tuple[int, RGB]]) -> Dict[int, str]:
        """samples: [(trackId, jersey_rgb)]. Returns {trackId: 'home'|'away'}."""
        self._frame += 1
        feats = [(tid, chromaticity(rgb)) for tid, rgb in samples]

        # (Re)fit team centroids periodically once enough players are visible.
        if feats and (self.centroids is None or self._frame % self.refit_every == 0):
            if len(feats) >= min(self.min_players, len(feats)):
                c0, c1, _ = kmeans_2([f for _, f in feats])
                self.centroids = self._pin_labels(c0, c1)

        out: Dict[int, str] = {}
        for tid, f in feats:
            if self.centroids is None:
                team = "home"  # provisional until first fit
            else:
                team = "home" if _dist2(f, self.centroids[0]) <= _dist2(f, self.centroids[1]) else "away"
            dq = self._recent.setdefault(tid, deque(maxlen=self._vote_window))
            dq.append(team)
            out[tid] = "home" if dq.count("home") >= dq.count("away") else "away"
        return out


def sample_jersey_color(frame, bbox: Sequence[float]) -> RGB:
    """Median colour of the torso patch (upper-central bbox). Needs numpy/opencv
    frame (BGR ndarray). Lazy so the classifier's maths stays import-light."""
    import numpy as np  # noqa: WPS433
    x1, y1, x2, y2 = (int(v) for v in bbox)
    h = max(1, y2 - y1)
    w = max(1, x2 - x1)
    # Torso: 20%..55% down, central 50% across — avoids head, shorts, grass.
    ty1 = y1 + int(0.20 * h)
    ty2 = y1 + int(0.55 * h)
    tx1 = x1 + int(0.25 * w)
    tx2 = x1 + int(0.75 * w)
    patch = frame[max(0, ty1):max(ty1 + 1, ty2), max(0, tx1):max(tx1 + 1, tx2)]
    if patch.size == 0:
        return (128.0, 128.0, 128.0)
    b, g, r = (float(np.median(patch[:, :, i])) for i in range(3))  # frame is BGR
    return (r, g, b)
