import { BodyDetectionStatus } from '../pose/types';
import { CameraDistanceStatus } from '../../utils/distance';
import { FEEDBACK_COOLDOWN_MS } from './config';
import { PushupAngles, PushupState, RepValidationResult } from './types';

export interface FeedbackContext {
  state: PushupState;
  angles: PushupAngles | null;
  detectionStatus: BodyDetectionStatus;
  distanceStatus?: CameraDistanceStatus;
  lastCompletedRep?: RepValidationResult | null;
}

/**
 * Manages real-time coach feedback messages with cooldown and priority hierarchies
 * to prevent flickering and excessive UI re-renders.
 */
export class PushupFeedbackManager {
  private currentFeedback = 'Ready';
  private lastFeedbackTime = 0;
  private priorityUntil = 0; // High priority lock timestamp (e.g. for rep completion result)

  getFeedback(context: FeedbackContext, currentTime: number = Date.now()): string {
    const { state, angles, detectionStatus, distanceStatus, lastCompletedRep } = context;

    // Check high priority lock (e.g. rep completion banner displayed for at least 1500ms)
    if (currentTime < this.priorityUntil) {
      return this.currentFeedback;
    }

    let newFeedback: string | null = null;
    let isHighPriority = false;

    // Priority 1: Tracking / Camera visibility issues
    if (detectionStatus === 'NO_PERSON') {
      newFeedback = 'Move into camera view';
    } else if (detectionStatus === 'LOW_CONFIDENCE') {
      newFeedback = 'Adjust room lighting';
    } else if (distanceStatus === 'TOO_FAR') {
      newFeedback = 'Move closer to camera';
    } else if (distanceStatus === 'TOO_CLOSE' || distanceStatus === 'CLIPPED') {
      newFeedback = 'Step back to show full body';
    }

    // Priority 2: Immediate rep completion result feedback
    if (!newFeedback && lastCompletedRep && currentTime - this.lastFeedbackTime < 1800) {
      if (lastCompletedRep.isValid) {
        newFeedback = 'Good rep!';
      } else if (lastCompletedRep.reasons.includes('NOT_DEEP_ENOUGH')) {
        newFeedback = 'Go lower — Not deep enough';
      } else if (lastCompletedRep.reasons.includes('BAD_BODY_ALIGNMENT')) {
        newFeedback = 'Keep your hips aligned';
      } else if (lastCompletedRep.reasons.includes('LOW_CONFIDENCE')) {
        newFeedback = 'Keypoints unclear — Hold position';
      } else {
        newFeedback = 'No rep — Complete full movement';
      }
      isHighPriority = true;
    }

    // Priority 3: Real-time form coaching during movement
    if (!newFeedback && angles) {
      if (angles.hipSagging || angles.hipPiking) {
        newFeedback = 'Keep your hips aligned';
      } else if (state === 'going_down') {
        const elbow = angles.effectiveElbowAngle ?? 120;
        if (elbow > 95) {
          newFeedback = 'Go lower';
        } else {
          newFeedback = 'Good depth!';
        }
      } else if (state === 'bottom') {
        newFeedback = 'Push up!';
      } else if (state === 'going_up') {
        newFeedback = 'Push to full lockout';
      } else if (state === 'up') {
        newFeedback = 'Go down';
      } else if (state === 'ready') {
        newFeedback = 'Ready — Lock your arms';
      }
    }

    // Fallback based on state
    if (!newFeedback) {
      switch (state) {
        case 'ready':
          newFeedback = 'Ready';
          break;
        case 'up':
          newFeedback = 'Go down';
          break;
        case 'going_down':
          newFeedback = 'Go lower';
          break;
        case 'bottom':
          newFeedback = 'Push up';
          break;
        case 'going_up':
          newFeedback = 'Push up';
          break;
        default:
          newFeedback = 'Get into push-up position';
          break;
      }
    }

    // Apply debounce / cooldown unless it's a high priority event
    if (isHighPriority) {
      this.currentFeedback = newFeedback;
      this.lastFeedbackTime = currentTime;
      this.priorityUntil = currentTime + 1600;
    } else if (
      newFeedback !== this.currentFeedback &&
      currentTime - this.lastFeedbackTime >= FEEDBACK_COOLDOWN_MS
    ) {
      this.currentFeedback = newFeedback;
      this.lastFeedbackTime = currentTime;
    }

    return this.currentFeedback;
  }

  setRepCompletionFeedback(result: RepValidationResult, currentTime: number = Date.now()): void {
    if (result.isValid) {
      this.currentFeedback = 'Good rep!';
    } else if (result.reasons.includes('NOT_DEEP_ENOUGH')) {
      this.currentFeedback = 'Go lower — Not deep enough';
    } else if (result.reasons.includes('BAD_BODY_ALIGNMENT')) {
      this.currentFeedback = 'Keep your hips aligned';
    } else {
      this.currentFeedback = 'No rep — Complete full movement';
    }
    this.lastFeedbackTime = currentTime;
    this.priorityUntil = currentTime + 1800;
  }

  reset(): void {
    this.currentFeedback = 'Ready';
    this.lastFeedbackTime = 0;
    this.priorityUntil = 0;
  }
}
