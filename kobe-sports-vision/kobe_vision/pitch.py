"""Pixel -> pitch coordinate mapping via a 4-point homography.

Camera pixels are perspective-distorted; we calibrate four known pitch
references (e.g. the pitch corners) once and transform every detection into
KobeSports pitch-normalised coordinates: x in [0,100] (0 = left goal line,
100 = right goal line), y in [0,100] (0 = top touchline, 100 = bottom).

Pure Python (stdlib only) so calibration + transform work offline and are
unit-testable without numpy/OpenCV. At runtime OpenCV can be used instead for
speed, but this is the source of truth for the contract.
"""
from __future__ import annotations
from typing import List, Sequence, Tuple

Point = Tuple[float, float]


def _solve(a: List[List[float]], b: List[float]) -> List[float]:
    """Solve a square linear system a·x = b by Gaussian elimination w/ pivoting."""
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(m[r][col]))
        if abs(m[piv][col]) < 1e-12:
            raise ValueError("degenerate calibration points (singular matrix)")
        m[col], m[piv] = m[piv], m[col]
        pivot = m[col][col]
        for j in range(col, n + 1):
            m[col][j] /= pivot
        for r in range(n):
            if r == col:
                continue
            factor = m[r][col]
            if factor:
                for j in range(col, n + 1):
                    m[r][j] -= factor * m[col][j]
    return [m[i][n] for i in range(n)]


def compute_homography(src: Sequence[Point], dst: Sequence[Point]) -> List[List[float]]:
    """3x3 homography mapping the 4 src pixel points to the 4 dst pitch points."""
    if len(src) != 4 or len(dst) != 4:
        raise ValueError("need exactly 4 point correspondences")
    a: List[List[float]] = []
    b: List[float] = []
    for (x, y), (X, Y) in zip(src, dst):
        a.append([x, y, 1, 0, 0, 0, -x * X, -y * X])
        b.append(X)
        a.append([0, 0, 0, x, y, 1, -x * Y, -y * Y])
        b.append(Y)
    h = _solve(a, b)  # 8 unknowns, h33 fixed to 1
    return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1.0]]


def apply_homography(h: Sequence[Sequence[float]], pt: Point) -> Point:
    """Map a single pixel point through the homography to pitch coordinates."""
    x, y = pt
    denom = h[2][0] * x + h[2][1] * y + h[2][2]
    if abs(denom) < 1e-12:
        denom = 1e-12
    X = (h[0][0] * x + h[0][1] * y + h[0][2]) / denom
    Y = (h[1][0] * x + h[1][1] * y + h[1][2]) / denom
    return (X, Y)


class PitchMapper:
    """Holds a calibrated homography and maps a detection's ground point.

    The ground point is the bottom-centre of the bounding box (where the player
    meets the pitch), which is the correct anchor for a floor-plane homography.
    """

    def __init__(self, homography: List[List[float]], clamp: bool = True):
        self.h = homography
        self.clamp = clamp

    @classmethod
    def calibrate(cls, pixel_corners: Sequence[Point], pitch_corners: Sequence[Point]) -> "PitchMapper":
        return cls(compute_homography(pixel_corners, pitch_corners))

    def map_bbox(self, bbox: Sequence[float]) -> Point:
        x1, y1, x2, y2 = bbox
        ground = ((x1 + x2) / 2.0, y2)  # bottom-centre
        X, Y = apply_homography(self.h, ground)
        if self.clamp:
            X = min(100.0, max(0.0, X))
            Y = min(100.0, max(0.0, Y))
        return (round(X, 3), round(Y, 3))
