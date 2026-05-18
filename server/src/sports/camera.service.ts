/**
 * CameraService
 *
 * Manages the physical camera setup for the AI vision pipeline.
 *
 * Responsibilities:
 *   - Register / update cameras (label, role, stream URL)
 *   - Receive heartbeats from the Python pipeline (fps, resolution, status)
 *   - Store homography matrices (pixel → pitch coordinate calibration)
 *   - Assign cameras to matches
 *   - Detect offline cameras (no heartbeat for >30s)
 *   - Provide camera status to the frontend dashboard
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { CameraSession } from './sports.entity';
import type { CameraRole } from './sports.entity';

export interface RegisterCameraDto {
  label: string;
  role: CameraRole;
  streamUrl: string;
  resolution?: string;
}

export interface CameraHeartbeat {
  cameraId: string;
  fps: number;
  resolution?: string;
  status?: 'ONLINE' | 'ERROR';
  errorMessage?: string;
  /** Updated homography matrix if recalibrated */
  homography?: number[][];
}

@Injectable()
export class CameraService {
  private readonly logger = new Logger(CameraService.name);

  constructor(
    @InjectRepository(CameraSession)
    private readonly repo: Repository<CameraSession>,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async register(dto: RegisterCameraDto): Promise<CameraSession> {
    const cam = this.repo.create({
      label: dto.label,
      role: dto.role,
      streamUrl: dto.streamUrl,
      resolution: dto.resolution,
      status: 'STANDBY',
      calibrated: false,
      fps: 0,
    });
    await this.repo.save(cam);
    this.logger.log(`Camera registered: ${dto.label} (${dto.role})`);
    return cam;
  }

  async list(): Promise<CameraSession[]> {
    return this.repo.find({ order: { createdAt: 'ASC' } });
  }

  async get(id: string): Promise<CameraSession> {
    const cam = await this.repo.findOne({ where: { id } });
    if (!cam) throw new NotFoundException('Camera not found');
    return cam;
  }

  async update(id: string, partial: Partial<CameraSession>): Promise<CameraSession> {
    await this.repo.update(id, partial);
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  // ── Heartbeat ─────────────────────────────────────────────────────────────

  /**
   * Called by the Python pipeline every second to report camera health.
   * Updates fps, resolution, status, and optionally the homography matrix.
   */
  async heartbeat(hb: CameraHeartbeat): Promise<{ ok: boolean; trackingActive: boolean }> {
    const cam = await this.repo.findOne({ where: { id: hb.cameraId } });
    if (!cam) return { ok: false, trackingActive: false };

    cam.fps = hb.fps;
    cam.lastHeartbeat = new Date();
    cam.status = hb.status ?? 'ONLINE';
    if (hb.resolution) cam.resolution = hb.resolution;
    if (hb.errorMessage) cam.errorMessage = hb.errorMessage;
    if (hb.homography) {
      cam.homography = hb.homography;
      cam.calibrated = true;
    }

    await this.repo.save(cam);
    return { ok: true, trackingActive: cam.activeMatchId != null };
  }

  // ── Calibration ───────────────────────────────────────────────────────────

  /**
   * Store the homography matrix for a camera.
   * The Python pipeline computes this from known pitch corner coordinates.
   */
  async setHomography(id: string, matrix: number[][]): Promise<CameraSession> {
    if (matrix.length !== 3 || matrix.some((r) => r.length !== 3)) {
      throw new Error('Homography must be a 3×3 matrix');
    }
    await this.repo.update(id, { homography: matrix, calibrated: true });
    this.logger.log(`Camera ${id} calibrated with homography matrix`);
    return this.get(id);
  }

  // ── Match assignment ──────────────────────────────────────────────────────

  async assignToMatch(cameraId: string, matchId: string): Promise<CameraSession> {
    await this.repo.update(cameraId, { activeMatchId: matchId });
    return this.get(cameraId);
  }

  async releaseFromMatch(cameraId: string): Promise<CameraSession> {
    await this.repo.update(cameraId, { activeMatchId: null, status: 'STANDBY' });
    return this.get(cameraId);
  }

  async getCamerasForMatch(matchId: string): Promise<CameraSession[]> {
    return this.repo.find({ where: { activeMatchId: matchId } });
  }

  // ── Health monitoring ─────────────────────────────────────────────────────

  /** Mark cameras offline if no heartbeat for >30 seconds */
  @Cron('*/15 * * * * *') // every 15s
  async checkOfflineCameras(): Promise<void> {
    const threshold = new Date(Date.now() - 30_000);
    const cameras = await this.repo.find({ where: { status: 'ONLINE' } });
    for (const cam of cameras) {
      if (!cam.lastHeartbeat || cam.lastHeartbeat < threshold) {
        cam.status = 'OFFLINE';
        await this.repo.save(cam);
        this.logger.warn(`Camera ${cam.label} went offline`);
      }
    }
  }

  async getSystemStatus(): Promise<{
    total: number;
    online: number;
    offline: number;
    error: number;
    uncalibrated: number;
    cameras: CameraSession[];
  }> {
    const cameras = await this.list();
    return {
      total: cameras.length,
      online: cameras.filter((c) => c.status === 'ONLINE').length,
      offline: cameras.filter((c) => c.status === 'OFFLINE').length,
      error: cameras.filter((c) => c.status === 'ERROR').length,
      uncalibrated: cameras.filter((c) => !c.calibrated).length,
      cameras,
    };
  }
}
