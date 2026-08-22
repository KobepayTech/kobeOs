"""Pitch zones and line crossings — mirrors Supervision's PolygonZone / LineZone
but on pitch-normalised coordinates and pure stdlib so it's unit-testable and
consistent whether or not the OpenCV/Supervision path is used at runtime.

Coordinates are pitch-normalised (0..100). A "zone" is a polygon (penalty area,
final third, wings). A "line" is a segment counting tracked objects that cross
it in each direction (final-third entries, touchline outs, offside-line events).
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

Point = Tuple[float, float]


def point_in_polygon(pt: Point, polygon: List[Point]) -> bool:
    """Ray-casting point-in-polygon test (even-odd rule)."""
    x, y = pt
    inside = False
    n = len(polygon)
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi):
            inside = not inside
        j = i
    return inside


class PolygonZone:
    """A named pitch region with a live occupant set and a running entry count."""

    def __init__(self, name: str, polygon: List[Point]):
        self.name = name
        self.polygon = polygon
        self.current: set[int] = set()
        self.entries = 0
        self.peak = 0

    def update(self, tracks: List[Tuple[int, Point]]) -> None:
        now = {tid for tid, pt in tracks if point_in_polygon(pt, self.polygon)}
        self.entries += len(now - self.current)  # new arrivals since last frame
        self.current = now
        self.peak = max(self.peak, len(now))

    def report(self) -> dict:
        return {"zone": self.name, "count": len(self.current), "entries": self.entries, "peak": self.peak}


def _side(a: Point, b: Point, p: Point) -> float:
    """>0 left of a→b, <0 right, 0 on the line."""
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])


@dataclass
class LineZone:
    """Counts tracked objects crossing a segment a→b, per direction."""
    name: str
    a: Point
    b: Point
    crossings_in: int = 0   # negative -> positive side (a→b's left)
    crossings_out: int = 0
    _prev: Dict[int, float] = field(default_factory=dict)

    def update(self, tracks: List[Tuple[int, Point]]) -> None:
        for tid, pt in tracks:
            s = _side(self.a, self.b, pt)
            prev = self._prev.get(tid)
            if prev is not None and prev != 0 and s != 0 and (prev > 0) != (s > 0):
                if s > 0:
                    self.crossings_in += 1
                else:
                    self.crossings_out += 1
            self._prev[tid] = s

    def report(self) -> dict:
        return {"line": self.name, "in": self.crossings_in, "out": self.crossings_out}


# ── Standard football zones (pitch-normalised 0..100) ──────────────────────────
def standard_football_zones() -> List[PolygonZone]:
    return [
        PolygonZone("penalty_area_left", [(0, 21), (16, 21), (16, 79), (0, 79)]),
        PolygonZone("penalty_area_right", [(84, 21), (100, 21), (100, 79), (84, 79)]),
        PolygonZone("final_third_left", [(0, 0), (33, 0), (33, 100), (0, 100)]),
        PolygonZone("final_third_right", [(67, 0), (100, 0), (100, 100), (67, 100)]),
        PolygonZone("left_wing", [(0, 0), (100, 0), (100, 21), (0, 21)]),
        PolygonZone("right_wing", [(0, 79), (100, 79), (100, 100), (0, 100)]),
    ]
