import {
  PoseDetector,
  PoseDetectorConfig,
  PoseEstimationResult,
} from './types';
import { MoveNetPoseDetector } from './movenet';

/**
 * Fallback stub pose detector.
 */
export class StubPoseDetector implements PoseDetector {
  readonly id = 'stub-detector';
  readonly name = 'Stub Pose Detector';
  private _isReady = false;

  get isReady(): boolean {
    return this._isReady;
  }

  async initialize(_config?: PoseDetectorConfig): Promise<void> {
    this._isReady = true;
  }

  async estimatePose(_frame: unknown): Promise<PoseEstimationResult | null> {
    if (!this._isReady) {
      return null;
    }
    return null;
  }

  async dispose(): Promise<void> {
    this._isReady = false;
  }
}

// Default detector initialized to MoveNet SinglePose Lightning
let activeDetector: PoseDetector = new MoveNetPoseDetector();

export function getActivePoseDetector(): PoseDetector {
  return activeDetector;
}

export function setActivePoseDetector(detector: PoseDetector): void {
  activeDetector = detector;
}
