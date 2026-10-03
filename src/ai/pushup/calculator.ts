import { calculateAngle, Point2D } from '../../utils/angle';
import { PoseKeypoint } from '../pose/types';
import {
  ALIGNMENT_MIN_ANGLE,
  ALIGNMENT_PIKE_OFFSET,
  ALIGNMENT_SAG_OFFSET,
  CONFIDENCE_THRESHOLD,
  SMOOTHING_FACTOR,
} from './config';
import { PushupAngles } from './types';

/**
 * Finds a keypoint by name from the keypoint list.
 */
function findKeypoint(
  keypoints: readonly PoseKeypoint[],
  name: string
): PoseKeypoint | undefined {
  return keypoints.find((kp) => kp.name === name);
}

/**
 * Validates that a keypoint exists, meets confidence requirements, and has finite coordinates.
 */
function isKeypointValid(
  kp: PoseKeypoint | undefined,
  minConfidence: number = CONFIDENCE_THRESHOLD
): kp is PoseKeypoint {
  if (!kp) return false;
  if (typeof kp.confidence !== 'number' || kp.confidence < minConfidence) {
    return false;
  }
  if (
    typeof kp.x !== 'number' ||
    typeof kp.y !== 'number' ||
    isNaN(kp.x) ||
    isNaN(kp.y) ||
    !isFinite(kp.x) ||
    !isFinite(kp.y)
  ) {
    return false;
  }
  return true;
}

/**
 * Safely computes an angle using calculateAngle and verifies that the output is a valid number.
 */
function safeAngle(a: Point2D, b: Point2D, c: Point2D): number | null {
  try {
    const angle = calculateAngle(a, b, c);
    if (typeof angle !== 'number' || isNaN(angle) || !isFinite(angle)) {
      return null;
    }
    return Math.max(0, Math.min(180, Math.round(angle * 10) / 10));
  } catch {
    return null;
  }
}

/**
 * Applies lightweight Exponential Moving Average (EMA) smoothing between successive frames.
 */
function applyEma(
  current: number | null,
  previous: number | null,
  alpha: number = SMOOTHING_FACTOR
): number | null {
  if (current === null) return null;
  if (previous === null) return current;
  const smoothed = alpha * current + (1 - alpha) * previous;
  if (isNaN(smoothed) || !isFinite(smoothed)) return current;
  return Math.round(smoothed * 10) / 10;
}

/**
 * Evaluates whether hips are sagging toward floor or piked toward ceiling relative
 * to the straight line formed between shoulder and knee/ankle.
 * In normalized image coordinates, y=0 is top, y=1 is bottom (floor).
 */
function evaluateHipSagPike(
  shoulder: PoseKeypoint,
  hip: PoseKeypoint,
  lower: PoseKeypoint
): { hipSagging: boolean; hipPiking: boolean } {
  const dx = lower.x - shoulder.x;
  // If user is oriented roughly horizontally or diagonally
  if (Math.abs(dx) > 0.05) {
    const t = (hip.x - shoulder.x) / dx;
    const expectedHipY = shoulder.y + t * (lower.y - shoulder.y);
    const deltaY = hip.y - expectedHipY;

    return {
      hipSagging: deltaY > ALIGNMENT_SAG_OFFSET,
      hipPiking: deltaY < ALIGNMENT_PIKE_OFFSET,
    };
  }

  // Fallback if coordinates are vertical
  const dy = lower.y - shoulder.y;
  if (Math.abs(dy) > 0.05) {
    const t = (hip.y - shoulder.y) / dy;
    const expectedHipX = shoulder.x + t * (lower.x - shoulder.x);
    const deltaX = hip.x - expectedHipX;
    return {
      hipSagging: Math.abs(deltaX) > ALIGNMENT_SAG_OFFSET,
      hipPiking: false,
    };
  }

  return { hipSagging: false, hipPiking: false };
}

/**
 * Calculates raw push-up angles from MoveNet keypoints without smoothing.
 */
export function calculateRawPushupAngles(
  keypoints: readonly PoseKeypoint[],
  minConfidence: number = CONFIDENCE_THRESHOLD
): PushupAngles {
  // 1. Arm Keypoints
  const leftShoulder = findKeypoint(keypoints, 'left_shoulder');
  const leftElbow = findKeypoint(keypoints, 'left_elbow');
  const leftWrist = findKeypoint(keypoints, 'left_wrist');

  const rightShoulder = findKeypoint(keypoints, 'right_shoulder');
  const rightElbow = findKeypoint(keypoints, 'right_elbow');
  const rightWrist = findKeypoint(keypoints, 'right_wrist');

  // 2. Hip / Body Alignment Keypoints
  const leftHip = findKeypoint(keypoints, 'left_hip');
  const rightHip = findKeypoint(keypoints, 'right_hip');
  const leftKnee = findKeypoint(keypoints, 'left_knee');
  const rightKnee = findKeypoint(keypoints, 'right_knee');
  const leftAnkle = findKeypoint(keypoints, 'left_ankle');
  const rightAnkle = findKeypoint(keypoints, 'right_ankle');

  // Compute Left Elbow Angle (Shoulder -> Elbow -> Wrist)
  // When shoulder and elbow are reliably detected (>= minConfidence), allow wrist down to 0.25
  // because wrists pressed flat against floor in push-ups naturally have slightly lower MoveNet scores.
  const wristMinConfidence = Math.min(minConfidence, 0.25);

  let rawLeftElbow: number | null = null;
  if (
    isKeypointValid(leftShoulder, minConfidence) &&
    isKeypointValid(leftElbow, minConfidence) &&
    isKeypointValid(leftWrist, wristMinConfidence)
  ) {
    rawLeftElbow = safeAngle(
      { x: leftShoulder.x, y: leftShoulder.y },
      { x: leftElbow.x, y: leftElbow.y },
      { x: leftWrist.x, y: leftWrist.y }
    );
  }

  // Compute Right Elbow Angle (Shoulder -> Elbow -> Wrist)
  let rawRightElbow: number | null = null;
  if (
    isKeypointValid(rightShoulder, minConfidence) &&
    isKeypointValid(rightElbow, minConfidence) &&
    isKeypointValid(rightWrist, wristMinConfidence)
  ) {
    rawRightElbow = safeAngle(
      { x: rightShoulder.x, y: rightShoulder.y },
      { x: rightElbow.x, y: rightElbow.y },
      { x: rightWrist.x, y: rightWrist.y }
    );
  }

  // Determine Effective Elbow Angle:
  // - If both sides valid: average of both
  // - If only left valid: left
  // - If only right valid: right
  // - If neither valid: null
  let effectiveElbowAngle: number | null = null;
  if (rawLeftElbow !== null && rawRightElbow !== null) {
    effectiveElbowAngle =
      Math.round(((rawLeftElbow + rawRightElbow) / 2) * 10) / 10;
  } else if (rawLeftElbow !== null) {
    effectiveElbowAngle = rawLeftElbow;
  } else if (rawRightElbow !== null) {
    effectiveElbowAngle = rawRightElbow;
  }

  // Compute Left Hip Angle (Shoulder -> Hip -> Knee or Ankle)
  let rawLeftHip: number | null = null;
  let leftSagging = false;
  let leftPiking = false;

  const leftLower = isKeypointValid(leftKnee, minConfidence)
    ? leftKnee
    : isKeypointValid(leftAnkle, minConfidence)
    ? leftAnkle
    : undefined;

  if (
    isKeypointValid(leftShoulder, minConfidence) &&
    isKeypointValid(leftHip, minConfidence) &&
    leftLower
  ) {
    rawLeftHip = safeAngle(
      { x: leftShoulder.x, y: leftShoulder.y },
      { x: leftHip.x, y: leftHip.y },
      { x: leftLower.x, y: leftLower.y }
    );
    const sagPike = evaluateHipSagPike(leftShoulder, leftHip, leftLower);
    leftSagging = sagPike.hipSagging;
    leftPiking = sagPike.hipPiking;
  }

  // Compute Right Hip Angle (Shoulder -> Hip -> Knee or Ankle)
  let rawRightHip: number | null = null;
  let rightSagging = false;
  let rightPiking = false;

  const rightLower = isKeypointValid(rightKnee, minConfidence)
    ? rightKnee
    : isKeypointValid(rightAnkle, minConfidence)
    ? rightAnkle
    : undefined;

  if (
    isKeypointValid(rightShoulder, minConfidence) &&
    isKeypointValid(rightHip, minConfidence) &&
    rightLower
  ) {
    rawRightHip = safeAngle(
      { x: rightShoulder.x, y: rightShoulder.y },
      { x: rightHip.x, y: rightHip.y },
      { x: rightLower.x, y: rightLower.y }
    );
    const sagPike = evaluateHipSagPike(rightShoulder, rightHip, rightLower);
    rightSagging = sagPike.hipSagging;
    rightPiking = sagPike.hipPiking;
  }

  // Effective Hip Angle
  let effectiveHipAngle: number | null = null;
  if (rawLeftHip !== null && rawRightHip !== null) {
    effectiveHipAngle = Math.round(((rawLeftHip + rawRightHip) / 2) * 10) / 10;
  } else if (rawLeftHip !== null) {
    effectiveHipAngle = rawLeftHip;
  } else if (rawRightHip !== null) {
    effectiveHipAngle = rawRightHip;
  }

  const hipSagging = leftSagging || rightSagging;
  const hipPiking = leftPiking || rightPiking;

  // Body alignment evaluation
  let isBodyAligned = true;
  let backStraightnessScore: number | null = null;

  if (effectiveHipAngle !== null) {
    // In a plank/push-up, 160°-180° is straight
    isBodyAligned = effectiveHipAngle >= ALIGNMENT_MIN_ANGLE && !hipSagging && !hipPiking;

    // Heuristic back straightness score: 100 for 170°-180°, drops as angle deviates
    const deviation = Math.abs(175 - effectiveHipAngle);
    const calculatedScore = Math.max(0, Math.min(100, Math.round(100 - deviation * 2.8)));
    backStraightnessScore = calculatedScore;
  }

  // Aggregate keypoint confidence across critical landmarks
  const critical = [
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftWrist,
    rightWrist,
    leftHip,
    rightHip,
  ].filter((kp): kp is PoseKeypoint => kp !== undefined);

  const averageConfidence =
    critical.length > 0
      ? critical.reduce((acc, kp) => acc + kp.confidence, 0) / critical.length
      : 0;

  const keypointConfidences = {
    leftShoulder: Math.round((leftShoulder?.confidence ?? 0) * 100) / 100,
    rightShoulder: Math.round((rightShoulder?.confidence ?? 0) * 100) / 100,
    leftElbow: Math.round((leftElbow?.confidence ?? 0) * 100) / 100,
    rightElbow: Math.round((rightElbow?.confidence ?? 0) * 100) / 100,
    leftWrist: Math.round((leftWrist?.confidence ?? 0) * 100) / 100,
    rightWrist: Math.round((rightWrist?.confidence ?? 0) * 100) / 100,
    leftHip: Math.round((leftHip?.confidence ?? 0) * 100) / 100,
    rightHip: Math.round((rightHip?.confidence ?? 0) * 100) / 100,
    leftKnee: leftKnee ? Math.round(leftKnee.confidence * 100) / 100 : undefined,
    rightKnee: rightKnee ? Math.round(rightKnee.confidence * 100) / 100 : undefined,
  };

  return {
    leftElbowAngle: rawLeftElbow,
    rightElbowAngle: rawRightElbow,
    effectiveElbowAngle,
    leftHipAngle: rawLeftHip,
    rightHipAngle: rawRightHip,
    effectiveHipAngle,
    backStraightnessScore,
    isBodyAligned,
    hipSagging,
    hipPiking,
    confidence: Math.round(averageConfidence * 100) / 100,
    keypointConfidences,
    rawAngles: {
      leftElbow: rawLeftElbow,
      rightElbow: rawRightElbow,
    },
  };
}

/**
 * Calculates biomechanical angles from pose keypoints with optional EMA smoothing.
 */
export function calculatePushupAngles(
  keypoints: readonly PoseKeypoint[],
  previousAngles?: PushupAngles | null
): PushupAngles {
  const raw = calculateRawPushupAngles(keypoints);
  if (!previousAngles) {
    return raw;
  }

  // Apply EMA smoothing to prevent angle jitter
  const smoothedLeft = applyEma(raw.leftElbowAngle, previousAngles.leftElbowAngle);
  const smoothedRight = applyEma(raw.rightElbowAngle, previousAngles.rightElbowAngle);
  const smoothedEffective = applyEma(
    raw.effectiveElbowAngle,
    previousAngles.effectiveElbowAngle
  );
  const smoothedHip = applyEma(
    raw.effectiveHipAngle,
    previousAngles.effectiveHipAngle
  );

  return {
    ...raw,
    leftElbowAngle: smoothedLeft,
    rightElbowAngle: smoothedRight,
    effectiveElbowAngle: smoothedEffective,
    effectiveHipAngle: smoothedHip,
  };
}

/**
 * Stateful push-up angle calculator that maintains frame-to-frame EMA smoothing state.
 */
export class PushupAngleCalculator {
  private lastAngles: PushupAngles | null = null;

  calculate(keypoints: readonly PoseKeypoint[]): PushupAngles {
    const angles = calculatePushupAngles(keypoints, this.lastAngles);
    this.lastAngles = angles;
    return angles;
  }

  getLastAngles(): PushupAngles | null {
    return this.lastAngles;
  }

  reset(): void {
    this.lastAngles = null;
  }
}
