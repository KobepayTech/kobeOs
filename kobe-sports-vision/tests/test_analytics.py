"""Pure-stdlib tests for the KobeSports analytics layer (no torch/cv2/supervision).

Run: python -m pytest tests/  — or  python tests/test_analytics.py
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from kobe_vision.pitch import PitchMapper, compute_homography, apply_homography
from kobe_vision.kinematics import KinematicsEngine, SPRINT_KMH
from kobe_vision.possession import PossessionEngine
from kobe_vision.zones import PolygonZone, LineZone, point_in_polygon
from kobe_vision.ingest import build_frame, build_tracked_object


class TestPitch(unittest.TestCase):
    def test_identity_like_calibration_maps_corners(self):
        # Pixel quad -> full pitch (0..100). Corners must land on pitch corners.
        px = [(100, 50), (900, 50), (900, 550), (100, 550)]
        pitch = [(0, 0), (100, 0), (100, 100), (0, 100)]
        m = PitchMapper.calibrate(px, pitch)
        # bbox whose bottom-centre is the top-left pixel corner -> pitch (0,0)
        self.assertEqual(m.map_bbox((100, 40, 100, 50)), (0.0, 0.0))
        # bottom-right pixel corner -> (100,100)
        self.assertEqual(m.map_bbox((900, 540, 900, 550)), (100.0, 100.0))

    def test_perspective_centre(self):
        # A trapezoid (perspective) still maps its centre near pitch centre.
        px = [(200, 100), (1000, 100), (1200, 700), (0, 700)]
        pitch = [(0, 0), (100, 0), (100, 100), (0, 100)]
        H = compute_homography(px, pitch)
        cx = (200 + 1000 + 1200 + 0) / 4
        cy = (100 + 100 + 700 + 700) / 4
        X, Y = apply_homography(H, (cx, cy))
        self.assertTrue(40 < X < 60 and 40 < Y < 60, f"centre mapped to {X:.1f},{Y:.1f}")


class TestKinematics(unittest.TestCase):
    def test_speed_distance_and_sprint(self):
        eng = KinematicsEngine()
        # Move 10m down the pitch length in 1s -> 36 km/h (a sprint).
        eng.update(7, 0.0, 50.0, 0.0)
        speed = eng.update(7, 10.0 / 105.0 * 100.0, 50.0, 1.0)  # 10m in x
        self.assertAlmostEqual(speed, 36.0, delta=0.5)
        s = eng.summary(7)
        self.assertAlmostEqual(s["distanceM"], 10.0, delta=0.2)
        self.assertGreaterEqual(s["topSpeedKmh"], SPRINT_KMH)
        self.assertEqual(s["sprints"], 1)

    def test_teleport_rejected(self):
        eng = KinematicsEngine()
        eng.update(1, 0.0, 0.0, 0.0)
        eng.update(1, 100.0, 100.0, 0.01)  # absurd jump = ID switch, must be ignored
        self.assertEqual(eng.summary(1)["distanceM"], 0.0)


class TestPossession(unittest.TestCase):
    def test_pass_then_interception(self):
        pe = PossessionEngine(control_frames=2, radius=3.0)
        # home #1 holds the ball (2 frames to confirm)
        for f in range(2):
            pe.update(f, (50, 50), [(1, "player_home", 50, 50), (2, "player_home", 60, 50), (3, "player_away", 40, 50)])
        # ball moves to home #2 -> PASS after control_frames
        ev = None
        for f in range(2, 4):
            ev = pe.update(f, (60, 50), [(1, "player_home", 50, 50), (2, "player_home", 60, 50), (3, "player_away", 40, 50)]) or ev
        self.assertIsNotNone(ev)
        self.assertEqual(ev.type, "PASS")
        # away #3 wins it -> INTERCEPTION
        ev2 = None
        for f in range(4, 6):
            ev2 = pe.update(f, (40, 50), [(1, "player_home", 50, 50), (2, "player_home", 60, 50), (3, "player_away", 40, 50)]) or ev2
        self.assertEqual(ev2.type, "INTERCEPTION")
        summ = pe.summary()
        self.assertEqual(summ["passes"]["home"], 1)
        self.assertEqual(summ["interceptions"], 1)
        self.assertTrue(0 <= summ["possession"]["home"] <= 100)


class TestZones(unittest.TestCase):
    def test_polygon_entry_count(self):
        z = PolygonZone("box", [(0, 21), (16, 21), (16, 79), (0, 79)])
        self.assertTrue(point_in_polygon((8, 50), z.polygon))
        self.assertFalse(point_in_polygon((50, 50), z.polygon))
        z.update([(1, (8, 50))])          # enters
        z.update([(1, (8, 50)), (2, (5, 40))])  # 2 enters
        z.update([(2, (5, 40))])          # 1 left, no new entry
        r = z.report()
        self.assertEqual(r["entries"], 2)
        self.assertEqual(r["count"], 1)

    def test_line_crossing_direction(self):
        ln = LineZone("halfway", (50, 0), (50, 100))  # vertical line at x=50
        ln.update([(1, (40, 50))])   # left side
        ln.update([(1, (60, 50))])   # crossed to right
        ln.update([(1, (40, 50))])   # crossed back
        r = ln.report()
        self.assertEqual(r["in"] + r["out"], 2)


class TestTeamClassifier(unittest.TestCase):
    def test_splits_red_vs_blue_and_is_stable(self):
        from kobe_vision.team_classifier import TeamClassifier, chromaticity, kmeans_2
        # Two teams: reddish vs bluish jerseys (RGB).
        red = [(200, 40, 40), (210, 50, 30), (190, 30, 45)]
        blue = [(40, 50, 200), (30, 60, 210), (45, 40, 190)]
        c0, c1, assign = kmeans_2([chromaticity(c) for c in red + blue])
        # First three (red) share a cluster; last three (blue) share the other.
        self.assertEqual(len(set(assign[:3])), 1)
        self.assertEqual(len(set(assign[3:])), 1)
        self.assertNotEqual(assign[0], assign[3])

        clf = TeamClassifier(refit_every=1, min_players=2)
        samples = [(1, red[0]), (2, red[1]), (3, blue[0]), (4, blue[1])]
        out = None
        for _ in range(5):
            out = clf.update_and_assign(samples)
        # Reds land on one team, blues on the other (label name is arbitrary but consistent).
        self.assertEqual(out[1], out[2])
        self.assertEqual(out[3], out[4])
        self.assertNotEqual(out[1], out[3])

    def test_majority_vote_absorbs_one_noisy_frame(self):
        from kobe_vision.team_classifier import TeamClassifier
        clf = TeamClassifier(refit_every=100, min_players=2)
        red, blue = (200, 40, 40), (40, 50, 200)
        for _ in range(8):
            clf.update_and_assign([(1, red), (2, blue)])
        stable = clf.update_and_assign([(1, red), (2, blue)])[1]
        # One frame where player 1's colour is misread as blue must NOT flip the team.
        flipped = clf.update_and_assign([(1, blue), (2, blue)])[1]
        self.assertEqual(stable, flipped)


class TestIngestContract(unittest.TestCase):
    def test_frame_shape_matches_dto(self):
        obj = build_tracked_object(5, "player_home", 72.1, 31.4, 0.91, speed=24.3, bbox=[1, 2, 3, 4])
        self.assertEqual(set(obj) >= {"trackId", "class", "x", "y", "confidence"}, True)
        self.assertEqual(obj["trackId"], 5)
        self.assertEqual(obj["metadata"], [1.0, 2.0, 3.0, 4.0])
        frame = build_frame(10, 12.5, 1, [obj], event={"type": "PASS", "fromTrackId": 5, "toTrackId": 12})
        self.assertEqual(frame["frameNumber"], 10)
        self.assertEqual(frame["half"], 1)
        self.assertEqual(frame["objects"][0]["class"], "player_home")
        self.assertEqual(frame["event"]["type"], "PASS")


if __name__ == "__main__":
    unittest.main(verbosity=2)
