import {
  ALIGNMENT_MIN_ANGLE,
  CONFIDENCE_THRESHOLD,
  DEPTH_THRESHOLD,
  MIN_OVERALL_POSE_CONFIDENCE,
} from './config';
import {
  InvalidRepReason,
  PushupAngles,
  RepCycleStats,
  RepValidationResult,
} from './types';

/**
 * Checks whether the input is full cycle stats or single frame angles.
 */
function isCycleStats(
  input: RepCycleStats | PushupAngles
): input is RepCycleStats {
  return 'minElbowAngle' in input && 'completedFullCycle' in input;
}

/**
 * Heuristic calculator for push-up form quality score [0..100].
 * Factors evaluated:
 * 1. Depth (elbow flexion at bottom)
 * 2. Hip / spine alignment (straightness throughout repetition)
 * 3. Pose tracking confidence
 */
function computeFormScore(
  minElbowAngle: number,
  averageHipAngle: number | null,
  averageConfidence: number,
  hipSaggingDetected: boolean,
  hipPikingDetected: boolean
): number {
  let score = 100;

  // 1. Depth Penalty (up to 35 points)
  if (minElbowAngle > 75) {
    const depthExcess = minElbowAngle - 75;
    const depthPenalty = Math.min(35, Math.round(depthExcess * 1.4));
    score -= depthPenalty;
  }

  // 2. Alignment Penalty (up to 35 points)
  if (averageHipAngle !== null) {
    if (averageHipAngle < 170) {
      const alignmentDeviation = 170 - averageHipAngle;
      const alignmentPenalty = Math.min(35, Math.round(alignmentDeviation * 1.4));
      score -= alignmentPenalty;
    }
  }

  if (hipSaggingDetected || hipPikingDetected) {
    score -= 15;
  }

  // 3. Tracking Confidence Penalty (up to 20 points)
  if (averageConfidence < 0.75) {
    const confDeficit = 0.75 - averageConfidence;
    const confPenalty = Math.min(20, Math.round(confDeficit * 35));
    score -= confPenalty;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Validates a push-up repetition against biomechanical and confidence criteria.
 * Supports both full repetition cycle stats (preferred) and single-frame PushupAngles.
 */
export function validatePushupRep(
  input: RepCycleStats | PushupAngles
): RepValidationResult {
  const reasons: InvalidRepReason[] = [];

  if (isCycleStats(input)) {
    const {
      minElbowAngle,
      averageHipAngle,
      averageConfidence,
      minConfidence,
      reachedBottom,
      completedFullCycle,
      durationMs,
      hipSaggingDetected,
      hipPikingDetected,
    } = input;

    // A. Depth Validation
    if (minElbowAngle > DEPTH_THRESHOLD || !reachedBottom) {
      reasons.push('NOT_DEEP_ENOUGH');
    }

    // B. Body Alignment Validation
    if (
      hipSaggingDetected ||
      hipPikingDetected ||
      (averageHipAngle !== null && averageHipAngle < ALIGNMENT_MIN_ANGLE)
    ) {
      reasons.push('BAD_BODY_ALIGNMENT');
    }

    // C. Confidence Validation
    if (
      minConfidence < CONFIDENCE_THRESHOLD ||
      averageConfidence < MIN_OVERALL_POSE_CONFIDENCE
    ) {
      reasons.push('LOW_CONFIDENCE');
    }

    // D. Completion Validation
    if (!completedFullCycle) {
      reasons.push('INCOMPLETE_REP');
    }

    // Depth percentage metric: 160° is 0%, 75° is 100%
    const depthPercentage = Math.min(
      100,
      Math.max(0, Math.round(((160 - minElbowAngle) / (160 - 75)) * 100))
    );

    const formScore = computeFormScore(
      minElbowAngle,
      averageHipAngle,
      averageConfidence,
      hipSaggingDetected,
      hipPikingDetected
    );

    return {
      isValid: reasons.length === 0,
      reasons,
      depthPercentage,
      formScore,
      minElbowAngle,
      averageHipAngle,
      durationMs,
    };
  }

  // Fallback for single-frame PushupAngles
  const elbowAngle = input.effectiveElbowAngle ?? 160;
  const hipAngle = input.effectiveHipAngle;

  if (elbowAngle > DEPTH_THRESHOLD) {
    reasons.push('NOT_DEEP_ENOUGH');
  }

  if (
    input.hipSagging ||
    input.hipPiking ||
    (hipAngle !== null && hipAngle < ALIGNMENT_MIN_ANGLE)
  ) {
    reasons.push('BAD_BODY_ALIGNMENT');
  }

  if (input.confidence < CONFIDENCE_THRESHOLD) {
    reasons.push('LOW_CONFIDENCE');
  }

  const depthPercentage = Math.min(
    100,
    Math.max(0, Math.round(((160 - elbowAngle) / (160 - 75)) * 100))
  );

  const formScore = computeFormScore(
    elbowAngle,
    hipAngle,
    input.confidence,
    input.hipSagging,
    input.hipPiking
  );

  return {
    isValid: reasons.length === 0,
    reasons,
    depthPercentage,
    formScore,
    minElbowAngle: elbowAngle,
    averageHipAngle: hipAngle,
    durationMs: 0,
  };
}
