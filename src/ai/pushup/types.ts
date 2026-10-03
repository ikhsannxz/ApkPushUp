/**
 * PushUp AI — Push-Up Engine Types
 */

export type PushupState =
  | 'idle'
  | 'ready'
  | 'up'
  | 'going_down'
  | 'bottom'
  | 'going_up'
  | 'completed';

export type InvalidRepReason =
  | 'NOT_DEEP_ENOUGH'
  | 'BAD_BODY_ALIGNMENT'
  | 'LOW_CONFIDENCE'
  | 'INCOMPLETE_REP'
  | 'BODY_NOT_DETECTED';

export interface KeypointConfidenceMap {
  leftShoulder: number;
  rightShoulder: number;
  leftElbow: number;
  rightElbow: number;
  leftWrist: number;
  rightWrist: number;
  leftHip: number;
  rightHip: number;
  leftKnee?: number;
  rightKnee?: number;
}

export interface StateMachineDebugInfo {
  state: PushupState;
  candidateState: PushupState | null;
  consecutiveFrames: number;
  minElbowInCycle: number;
  maxElbowInCycle: number;
  reachedBottom: boolean;
  repDurationMs: number;
  transitionTrace: string;
  lastRejectReason: string;
}

export interface PushupAngles {
  leftElbowAngle: number | null;
  rightElbowAngle: number | null;
  effectiveElbowAngle: number | null;
  leftHipAngle: number | null;
  rightHipAngle: number | null;
  effectiveHipAngle: number | null;
  backStraightnessScore: number | null;
  isBodyAligned: boolean;
  hipSagging: boolean;
  hipPiking: boolean;
  confidence: number;
  keypointConfidences?: KeypointConfidenceMap;
  rawAngles?: {
    leftElbow: number | null;
    rightElbow: number | null;
  };
}

export interface RepCycleStats {
  minElbowAngle: number;
  maxElbowAngle: number;
  hipAngles: number[];
  averageHipAngle: number | null;
  minHipAngle: number | null;
  confidences: number[];
  averageConfidence: number;
  minConfidence: number;
  backStraightnessScore: number | null;
  reachedBottom: boolean;
  completedFullCycle: boolean;
  durationMs: number;
  hipSaggingDetected: boolean;
  hipPikingDetected: boolean;
}

export interface RepValidationResult {
  isValid: boolean;
  reasons: (InvalidRepReason | string)[];
  depthPercentage: number;
  formScore: number;
  minElbowAngle: number;
  averageHipAngle: number | null;
  durationMs: number;
}

export interface PushupWorkoutSummary {
  totalReps: number;
  validReps: number;
  invalidReps: number;
  durationSeconds: number;
  accuracyRate: number;
  averageFormScore: number;
}
