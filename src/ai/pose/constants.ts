import { KeypointName } from './types';

/**
 * Standard COCO 17 keypoint names in MoveNet order.
 */
export const MOVENET_KEYPOINT_NAMES: readonly KeypointName[] = [
  'nose',
  'left_eye',
  'right_eye',
  'left_ear',
  'right_ear',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
] as const;

/**
 * Minimal confidence threshold for overall pose acceptance.
 * If average confidence < POSE_CONFIDENCE_THRESHOLD, status is LOW_CONFIDENCE.
 */
export const POSE_CONFIDENCE_THRESHOLD = 0.40;

/**
 * Minimal individual landmark confidence threshold.
 */
export const KEYPOINT_CONFIDENCE_THRESHOLD = 0.30;

/**
 * Minimum number of keypoints that must exceed KEYPOINT_CONFIDENCE_THRESHOLD
 * to declare PERSON_DETECTED.
 */
export const MIN_REQUIRED_LANDMARKS = 6;

/**
 * Target keypoints critical for push-up biomechanics tracking.
 */
export const PUSHUP_CRITICAL_KEYPOINTS: readonly KeypointName[] = [
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
] as const;

/**
 * Adaptive inference intervals (in milliseconds) based on device performance mode.
 * - lite: ~350ms (~2.8 FPS) to prevent thermal throttling / memory strain on lower-end SoCs.
 * - standard: ~150ms (~6.7 FPS) balanced for mid-range SoCs.
 * - high: ~80ms (~12.5 FPS) for flagship SoCs.
 */
export const ADAPTIVE_INFERENCE_INTERVAL_MS = {
  lite: 350,
  standard: 150,
  high: 80,
} as const;
