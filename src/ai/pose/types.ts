export type KeypointName =
  | 'nose'
  | 'left_eye'
  | 'right_eye'
  | 'left_ear'
  | 'right_ear'
  | 'left_shoulder'
  | 'right_shoulder'
  | 'left_elbow'
  | 'right_elbow'
  | 'left_wrist'
  | 'right_wrist'
  | 'left_hip'
  | 'right_hip'
  | 'left_knee'
  | 'right_knee'
  | 'left_ankle'
  | 'right_ankle';

export interface PoseKeypoint {
  name: KeypointName | string;
  x: number; // Normalized coordinate [0..1]
  y: number; // Normalized coordinate [0..1]
  confidence: number; // [0..1]
}

export type BodyDetectionStatus =
  | 'INITIALIZING'
  | 'NO_PERSON'
  | 'PERSON_DETECTED'
  | 'LOW_CONFIDENCE'
  | 'MODEL_UNAVAILABLE';

export interface CameraFrame {
  uri?: string;
  base64?: string;
  width: number;
  height: number;
  timestamp: number;
  element?: unknown;
}

export interface PoseEstimationResult {
  keypoints: PoseKeypoint[];
  score: number;
  timestamp: number;
  status?: BodyDetectionStatus;
  metrics?: PosePerformanceMetrics;
}

export interface PosePerformanceMetrics {
  fps: number;
  latencyMs: number;
  framesSkipped: number;
  averageConfidence: number;
  totalFramesProcessed: number;
  frameWidth?: number;
  frameHeight?: number;
  validKeypointsCount?: number;
}

export interface PoseDetectorConfig {
  minConfidence: number;
  mode?: 'lite' | 'standard' | 'high';
}

/**
 * Universal PoseDetector contract.
 * Decouples model provider (MoveNet, MediaPipe, BlazePose, etc.) from the application.
 */
export interface PoseDetector {
  readonly id: string;
  readonly name: string;
  readonly isReady: boolean;
  initialize(config?: PoseDetectorConfig): Promise<void>;
  estimatePose(frame: unknown): Promise<PoseEstimationResult | null>;
  dispose(): Promise<void>;
  getStatus?(): BodyDetectionStatus;
  getMetrics?(): PosePerformanceMetrics;
}
