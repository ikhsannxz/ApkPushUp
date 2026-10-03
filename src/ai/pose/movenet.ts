import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as poseDetection from '@tensorflow-models/pose-detection';
import * as jpeg from 'jpeg-js';
import * as base64js from 'base64-js';

import {
  ADAPTIVE_INFERENCE_INTERVAL_MS,
  KEYPOINT_CONFIDENCE_THRESHOLD,
  MIN_REQUIRED_LANDMARKS,
  MOVENET_KEYPOINT_NAMES,
  POSE_CONFIDENCE_THRESHOLD,
} from './constants';
import {
  BodyDetectionStatus,
  CameraFrame,
  PoseDetector,
  PoseDetectorConfig,
  PoseEstimationResult,
  PoseKeypoint,
  PosePerformanceMetrics,
} from './types';

/**
 * MoveNet SinglePose Lightning implementation of PoseDetector.
 * - On-device inference
 * - 17 COCO keypoints with normalized coordinates [0..1]
 * - Non-blocking frame pipeline with zero-queue dropping
 * - Adaptive scheduling for lite/standard/high hardware modes
 * - Robust error containment (never crashes camera UI)
 */
export class MoveNetPoseDetector implements PoseDetector {
  readonly id = 'movenet-lightning';
  readonly name = 'MoveNet SinglePose Lightning';

  private _isReady = false;
  private _status: BodyDetectionStatus = 'INITIALIZING';
  private detector: poseDetection.PoseDetector | null = null;
  private isProcessing = false;
  private lastInferenceTime = 0;
  private inferenceIntervalMs: number = ADAPTIVE_INFERENCE_INTERVAL_MS.standard;
  private minConfidence: number = POSE_CONFIDENCE_THRESHOLD;
  private consecutiveEmptyFrames = 0;

  // Performance metrics tracking
  private metrics: PosePerformanceMetrics = {
    fps: 0,
    latencyMs: 0,
    framesSkipped: 0,
    averageConfidence: 0,
    totalFramesProcessed: 0,
  };
  private lastFpsTimestamp = 0;
  private framesSinceLastFps = 0;

  get isReady(): boolean {
    return this._isReady;
  }

  getStatus(): BodyDetectionStatus {
    return this._status;
  }

  getMetrics(): PosePerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Initializes the MoveNet SinglePose Lightning model.
   */
  async initialize(config?: PoseDetectorConfig): Promise<void> {
    if (this._isReady) return;

    this._status = 'INITIALIZING';
    if (config?.mode) {
      this.inferenceIntervalMs =
        ADAPTIVE_INFERENCE_INTERVAL_MS[config.mode] ??
        ADAPTIVE_INFERENCE_INTERVAL_MS.standard;
    }
    if (config?.minConfidence !== undefined) {
      this.minConfidence = config.minConfidence;
    }

    try {
      // 1. Ensure TensorFlow CPU backend is ready
      await tf.setBackend('cpu');
      await tf.ready();

      // 2. Instantiate MoveNet SinglePose Lightning detector
      // Use 0.15 internally so MoveNet does not prematurely discard horizontal push-up poses
      this.detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          minPoseScore: 0.15,
          enableSmoothing: true,
        }
      );

      this._isReady = true;
      this._status = 'NO_PERSON';
    } catch {
      // Graceful error containment
      this._isReady = false;
      this._status = 'MODEL_UNAVAILABLE';
      // Do not rethrow: application camera continues running safely
    }
  }

  /**
   * Processes a camera frame through the MoveNet model.
   * Drops frame immediately if another inference is in-flight (zero queue backlog).
   */
  async estimatePose(frame: unknown): Promise<PoseEstimationResult | null> {
    const now = Date.now();

    // 1. Throttling check based on device capability interval
    if (now - this.lastInferenceTime < this.inferenceIntervalMs) {
      this.metrics.framesSkipped++;
      return null;
    }

    // 2. Concurrency guard (drop frame if previous inference is still active)
    if (this.isProcessing) {
      this.metrics.framesSkipped++;
      return null;
    }

    const cameraFrame = frame as CameraFrame | undefined;
    if (!cameraFrame || (!cameraFrame.base64 && !cameraFrame.element)) {
      return null;
    }

    this.isProcessing = true;
    this.lastInferenceTime = now;
    const startTime = Date.now();

    let imageTensor: tf.Tensor3D | null = null;

    try {
      let width = cameraFrame.width;
      let height = cameraFrame.height;
      let poses: poseDetection.Pose[] = [];

      // A. Web platform: direct HTMLVideoElement / HTMLCanvasElement inference (fast & zero decode error)
      if (cameraFrame.element && typeof document !== 'undefined' && this.detector) {
        const videoEl = cameraFrame.element as HTMLVideoElement;
        width = videoEl.videoWidth || cameraFrame.width || 640;
        height = videoEl.videoHeight || cameraFrame.height || 480;
        poses = await this.detector.estimatePoses(videoEl);
      } else if (cameraFrame.base64 && this.detector) {
        // B. Native platform: decode JPEG Base64 into raw RGBA pixels
        let cleanBase64 = cameraFrame.base64;
        const commaIdx = cleanBase64.indexOf(',');
        if (commaIdx !== -1) {
          cleanBase64 = cleanBase64.slice(commaIdx + 1);
        }
        cleanBase64 = cleanBase64.trim().replace(/[\r\n]/g, '');

        const rawBytes = base64js.toByteArray(cleanBase64);
        const decodedJpeg = jpeg.decode(rawBytes, { useTArray: true });
        width = decodedJpeg.width;
        height = decodedJpeg.height;
        const data = decodedJpeg.data;

        if (!width || !height || !data || data.length === 0) {
          return null;
        }

        const numPixels = width * height;
        const rgbValues = new Int32Array(numPixels * 3);
        for (let i = 0; i < numPixels; i++) {
          rgbValues[i * 3] = data[i * 4]; // R
          rgbValues[i * 3 + 1] = data[i * 4 + 1]; // G
          rgbValues[i * 3 + 2] = data[i * 4 + 2]; // B
        }

        imageTensor = tf.tensor3d(rgbValues, [height, width, 3], 'int32');
        poses = await this.detector.estimatePoses(imageTensor);
      }

      // 5. Run inference with MoveNet detector
      let normalizedKeypoints: PoseKeypoint[] = [];
      let overallScore = 0;

      if (poses && poses.length > 0) {
        const firstPose = poses[0];
        overallScore = firstPose.score ?? 0;

        // Normalize each keypoint to standard format [0..1]
        normalizedKeypoints = firstPose.keypoints.map((kp) => ({
          name: kp.name ?? 'unknown',
          x: Math.max(0, Math.min(1, kp.x / width)),
          y: Math.max(0, Math.min(1, kp.y / height)),
          confidence: kp.score ?? 0,
        }));
      }

      // If no pose was detected by the detector, create empty landmark set
      if (normalizedKeypoints.length === 0) {
        normalizedKeypoints = MOVENET_KEYPOINT_NAMES.map((name) => ({
          name,
          x: 0.5,
          y: 0.5,
          confidence: 0,
        }));
      }

      // 6. Determine BodyDetectionStatus with temporal hysteresis
      const validLandmarksCount = normalizedKeypoints.filter(
        (kp) => kp.confidence >= KEYPOINT_CONFIDENCE_THRESHOLD
      ).length;

      let status: BodyDetectionStatus = this._status;
      if (validLandmarksCount >= MIN_REQUIRED_LANDMARKS) {
        this.consecutiveEmptyFrames = 0;
        status =
          overallScore >= this.minConfidence
            ? 'PERSON_DETECTED'
            : 'LOW_CONFIDENCE';
      } else {
        this.consecutiveEmptyFrames++;
        // Apply 3-frame hysteresis before dropping from PERSON_DETECTED to NO_PERSON
        if (
          this.consecutiveEmptyFrames >= 3 ||
          this._status === 'NO_PERSON' ||
          this._status === 'INITIALIZING'
        ) {
          status = 'NO_PERSON';
        } else {
          // If we recently had a person detected, report LOW_CONFIDENCE instead of jarring flip
          status = 'LOW_CONFIDENCE';
        }
      }
      this._status = status;

      // 7. Calculate performance metrics
      const latencyMs = Date.now() - startTime;
      this.metrics.latencyMs = latencyMs;
      this.metrics.totalFramesProcessed++;
      this.metrics.frameWidth = width;
      this.metrics.frameHeight = height;
      this.metrics.validKeypointsCount = validLandmarksCount;

      // Rolling FPS calculation
      this.framesSinceLastFps++;
      if (now - this.lastFpsTimestamp >= 1000) {
        this.metrics.fps = Math.round(
          (this.framesSinceLastFps * 1000) / (now - this.lastFpsTimestamp)
        );
        this.framesSinceLastFps = 0;
        this.lastFpsTimestamp = now;
      }

      // Average keypoint confidence
      const avgConfidence =
        normalizedKeypoints.reduce((acc, kp) => acc + kp.confidence, 0) /
        normalizedKeypoints.length;
      this.metrics.averageConfidence = Math.round(avgConfidence * 100) / 100;

      return {
        keypoints: normalizedKeypoints,
        score: overallScore,
        timestamp: now,
        status,
        metrics: { ...this.metrics },
      };
    } catch {
      // Return null without throwing to keep camera active and UI responsive
      this._status = 'LOW_CONFIDENCE';
      return null;
    } finally {
      // 8. CRITICAL: Clean up image tensor immediately to prevent memory leak
      if (imageTensor) {
        imageTensor.dispose();
      }
      this.isProcessing = false;
    }
  }

  /**
   * Safely disposes model weights and releases memory.
   */
  async dispose(): Promise<void> {
    this._isReady = false;
    this.isProcessing = false;
    this._status = 'NO_PERSON';
    this.consecutiveEmptyFrames = 0;

    if (this.detector) {
      try {
        this.detector.dispose();
      } catch {
        // Ignore disposal errors
      }
      this.detector = null;
    }
  }
}
