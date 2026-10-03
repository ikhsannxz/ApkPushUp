import {
  DOWN_ENTER_THRESHOLD,
  DOWN_EXIT_THRESHOLD,
  MAX_REP_DURATION_MS,
  MIN_CONSECUTIVE_FRAMES,
  MIN_REP_DURATION_MS,
  MIN_STATE_DURATION_MS,
  REP_COOLDOWN_MS,
  UP_ENTER_THRESHOLD,
  UP_EXIT_THRESHOLD,
} from './config';
import {
  PushupAngles,
  PushupState,
  RepCycleStats,
  RepValidationResult,
  StateMachineDebugInfo,
} from './types';
import { validatePushupRep } from './validator';

export interface StateMachineSnapshot {
  state: PushupState;
  repCount: number;
  validReps: number;
  invalidReps: number;
}

export interface StateMachineUpdateResult {
  state: PushupState;
  completedRep: RepValidationResult | null;
  totalReps: number;
  validReps: number;
  invalidReps: number;
}

/**
 * Robust finite state machine managing push-up repetition cycles with
 * hysteresis, temporal debounce, frame confirmation, and duplicate prevention.
 *
 * State flow:
 * READY -> UP -> GOING_DOWN -> BOTTOM -> GOING_UP -> UP (Rep completion)
 */
export class PushupStateMachine {
  private state: PushupState = 'idle';
  private totalReps = 0;
  private validReps = 0;
  private invalidReps = 0;

  // Timestamps
  private stateEnteredTime = 0;
  private repStartTime = 0;
  private lastRepCompletedTime = 0;

  // Hysteresis & consecutive frames confirmation
  private candidateState: PushupState | null = null;
  private consecutiveCandidateFrames = 0;

  // Rep cycle data collection
  private minElbowInCycle = 180;
  private maxElbowInCycle = 0;
  private hipAnglesInCycle: number[] = [];
  private confidencesInCycle: number[] = [];
  private reachedBottomInCycle = false;
  private hipSaggingDetected = false;
  private hipPikingDetected = false;

  private onRepCompletedListener: ((result: RepValidationResult) => void) | null = null;

  // Debug info
  private lastRejectReason = 'Waiting for pose';
  private transitionTrace = 'IDLE';

  getDebugInfo(currentTime: number = Date.now()): StateMachineDebugInfo {
    return {
      state: this.state,
      candidateState: this.candidateState,
      consecutiveFrames: this.consecutiveCandidateFrames,
      minElbowInCycle: this.minElbowInCycle === 180 ? 0 : this.minElbowInCycle,
      maxElbowInCycle: this.maxElbowInCycle,
      reachedBottom: this.reachedBottomInCycle,
      repDurationMs: this.repStartTime > 0 ? currentTime - this.repStartTime : 0,
      transitionTrace: this.transitionTrace,
      lastRejectReason: this.lastRejectReason,
    };
  }

  getState(): PushupState {
    return this.state;
  }

  getTotalReps(): number {
    return this.totalReps;
  }

  getValidReps(): number {
    return this.validReps;
  }

  getInvalidReps(): number {
    return this.invalidReps;
  }

  // Alias for backward compatibility
  getRepCount(): number {
    return this.totalReps;
  }

  setOnRepCompleted(listener: (result: RepValidationResult) => void): void {
    this.onRepCompletedListener = listener;
  }

  reset(): void {
    this.state = 'idle';
    this.totalReps = 0;
    this.validReps = 0;
    this.invalidReps = 0;
    this.stateEnteredTime = 0;
    this.repStartTime = 0;
    this.lastRepCompletedTime = 0;
    this.candidateState = null;
    this.consecutiveCandidateFrames = 0;
    this.lastRejectReason = 'Waiting for pose';
    this.transitionTrace = 'IDLE';
    this.resetCycleStats();
  }

  private resetCycleStats(): void {
    this.minElbowInCycle = 180;
    this.maxElbowInCycle = 0;
    this.hipAnglesInCycle = [];
    this.confidencesInCycle = [];
    this.reachedBottomInCycle = false;
    this.hipSaggingDetected = false;
    this.hipPikingDetected = false;
  }

  /**
   * Processes a new frame of biomechanical angles.
   */
  update(angles: PushupAngles, currentTime: number = Date.now()): StateMachineUpdateResult {
    let completedRep: RepValidationResult | null = null;
    const elbowAngle = angles.effectiveElbowAngle;

    // If no elbow angle could be detected, do not advance state
    if (elbowAngle === null) {
      this.lastRejectReason = 'Elbow angle is null (wrists/shoulders low conf)';
      return {
        state: this.state,
        completedRep: null,
        totalReps: this.totalReps,
        validReps: this.validReps,
        invalidReps: this.invalidReps,
      };
    }

    // Accumulate cycle statistics whenever in an active repetition cycle
    if (
      this.state === 'going_down' ||
      this.state === 'bottom' ||
      this.state === 'going_up'
    ) {
      this.minElbowInCycle = Math.min(this.minElbowInCycle, elbowAngle);
      this.maxElbowInCycle = Math.max(this.maxElbowInCycle, elbowAngle);

      if (angles.effectiveHipAngle !== null) {
        this.hipAnglesInCycle.push(angles.effectiveHipAngle);
      }
      this.confidencesInCycle.push(angles.confidence);

      if (angles.hipSagging) this.hipSaggingDetected = true;
      if (angles.hipPiking) this.hipPikingDetected = true;

      // Rep timeout protection: if user stays stuck in cycle for > MAX_REP_DURATION_MS
      if (this.repStartTime > 0 && currentTime - this.repStartTime > MAX_REP_DURATION_MS) {
        this.resetCycleStats();
        this.transitionTrace = `${this.state.toUpperCase()} -> READY (TIMEOUT)`;
        this.lastRejectReason = `Rep timed out (> ${MAX_REP_DURATION_MS}ms)`;
        this.transitionTo('ready', currentTime);
        return {
          state: this.state,
          completedRep: null,
          totalReps: this.totalReps,
          validReps: this.validReps,
          invalidReps: this.invalidReps,
        };
      }
    }

    // Determine target state based on current state and elbow angle
    let desiredTarget: PushupState | null = null;

    switch (this.state) {
      case 'idle':
        desiredTarget = 'ready';
        break;

      case 'ready':
        // User reaches top plank lockout
        if (elbowAngle >= UP_ENTER_THRESHOLD) {
          desiredTarget = 'up';
        } else {
          this.lastRejectReason = `Ready: Elbow ${elbowAngle}° < ${UP_ENTER_THRESHOLD}° (lock out arms)`;
        }
        break;

      case 'up':
        // Rep cooldown check
        if (currentTime - this.lastRepCompletedTime < REP_COOLDOWN_MS) {
          this.lastRejectReason = `Rep cooldown active (${REP_COOLDOWN_MS - (currentTime - this.lastRepCompletedTime)}ms)`;
          break;
        }

        // Elbow bends below exit threshold -> Start descent
        if (elbowAngle <= UP_EXIT_THRESHOLD) {
          desiredTarget = 'going_down';
        } else {
          this.lastRejectReason = `Up: Elbow ${elbowAngle}° > ${UP_EXIT_THRESHOLD}° (bend arms to start)`;
        }
        break;

      case 'going_down':
        // Reached bottom threshold (elbow <= 90°)
        if (elbowAngle <= DOWN_ENTER_THRESHOLD) {
          desiredTarget = 'bottom';
        } else if (elbowAngle >= UP_ENTER_THRESHOLD) {
          // Aborted / partial descent: user started down but immediately went back up
          // without reaching bottom. Reset back to 'up' without counting a rep.
          this.resetCycleStats();
          desiredTarget = 'up';
          this.lastRejectReason = `Descent aborted: Elbow returned to ${elbowAngle}°`;
        } else {
          this.lastRejectReason = `Going down: Elbow ${elbowAngle}° > ${DOWN_ENTER_THRESHOLD}° (reach ${DOWN_ENTER_THRESHOLD}°)`;
        }
        break;

      case 'bottom':
        this.reachedBottomInCycle = true;
        // Ascending out of bottom (elbow >= 105° due to hysteresis gap)
        if (elbowAngle >= DOWN_EXIT_THRESHOLD) {
          desiredTarget = 'going_up';
        } else {
          this.lastRejectReason = `Bottom: Elbow ${elbowAngle}° < ${DOWN_EXIT_THRESHOLD}° (push back up)`;
        }
        break;

      case 'going_up':
        // Ascending back to full lockout (elbow >= 155°) -> Repetition completed!
        if (elbowAngle >= UP_ENTER_THRESHOLD) {
          desiredTarget = 'up';
        } else if (elbowAngle <= DOWN_ENTER_THRESHOLD) {
          // Re-descending back down without completing top lockout
          desiredTarget = 'bottom';
          this.lastRejectReason = `Going up: re-descended to ${elbowAngle}°`;
        } else {
          this.lastRejectReason = `Going up: Elbow ${elbowAngle}° < ${UP_ENTER_THRESHOLD}° (lock out at ${UP_ENTER_THRESHOLD}°)`;
        }
        break;

      case 'completed':
        desiredTarget = 'up';
        break;
    }

    // Process state transition candidate with temporal debounce & consecutive frame confirmation
    if (desiredTarget !== null && desiredTarget !== this.state) {
      if (this.candidateState === desiredTarget) {
        this.consecutiveCandidateFrames++;
      } else {
        this.candidateState = desiredTarget;
        this.consecutiveCandidateFrames = 1;
      }

      const stateDuration = currentTime - this.stateEnteredTime;
      const isConfirmed =
        this.consecutiveCandidateFrames >= MIN_CONSECUTIVE_FRAMES &&
        stateDuration >= MIN_STATE_DURATION_MS;

      if (isConfirmed) {
        // Special case: Transitioning from 'going_up' to 'up' marks rep completion!
        if (this.state === 'going_up' && desiredTarget === 'up') {
          const repDuration = currentTime - this.repStartTime;

          // Rep duration validation (must exceed MIN_REP_DURATION_MS to reject noise)
          if (repDuration >= MIN_REP_DURATION_MS) {
            completedRep = this.handleRepCompletion(currentTime, repDuration);
          } else {
            this.resetCycleStats();
          }
        }

        // Special case: Transitioning into 'going_down' from 'up' initializes a new rep
        if (this.state === 'up' && desiredTarget === 'going_down') {
          this.repStartTime = currentTime;
          this.resetCycleStats();
          this.minElbowInCycle = elbowAngle;
          this.maxElbowInCycle = elbowAngle;
        }

        this.transitionTrace = `${this.state.toUpperCase()} -> ${desiredTarget.toUpperCase()}`;
        this.lastRejectReason = `Confirmed -> ${desiredTarget.toUpperCase()}`;
        this.transitionTo(desiredTarget, currentTime);
      } else {
        this.lastRejectReason = `Debounce: -> ${desiredTarget} (frame ${this.consecutiveCandidateFrames}/${MIN_CONSECUTIVE_FRAMES})`;
      }
    } else {
      this.candidateState = null;
      this.consecutiveCandidateFrames = 0;
    }

    return {
      state: this.state,
      completedRep,
      totalReps: this.totalReps,
      validReps: this.validReps,
      invalidReps: this.invalidReps,
    };
  }

  private transitionTo(newState: PushupState, currentTime: number): void {
    this.state = newState;
    this.stateEnteredTime = currentTime;
    this.candidateState = null;
    this.consecutiveCandidateFrames = 0;
  }

  private handleRepCompletion(
    currentTime: number,
    repDuration: number
  ): RepValidationResult {
    const avgHip =
      this.hipAnglesInCycle.length > 0
        ? this.hipAnglesInCycle.reduce((a, b) => a + b, 0) /
          this.hipAnglesInCycle.length
        : null;

    const minHip =
      this.hipAnglesInCycle.length > 0
        ? Math.min(...this.hipAnglesInCycle)
        : null;

    const avgConf =
      this.confidencesInCycle.length > 0
        ? this.confidencesInCycle.reduce((a, b) => a + b, 0) /
          this.confidencesInCycle.length
        : 1.0;

    const minConf =
      this.confidencesInCycle.length > 0
        ? Math.min(...this.confidencesInCycle)
        : 1.0;

    const cycleStats: RepCycleStats = {
      minElbowAngle: Math.round(this.minElbowInCycle * 10) / 10,
      maxElbowAngle: Math.round(this.maxElbowInCycle * 10) / 10,
      hipAngles: this.hipAnglesInCycle,
      averageHipAngle: avgHip !== null ? Math.round(avgHip * 10) / 10 : null,
      minHipAngle: minHip !== null ? Math.round(minHip * 10) / 10 : null,
      confidences: this.confidencesInCycle,
      averageConfidence: Math.round(avgConf * 100) / 100,
      minConfidence: Math.round(minConf * 100) / 100,
      backStraightnessScore: null,
      reachedBottom: this.reachedBottomInCycle,
      completedFullCycle: true,
      durationMs: repDuration,
      hipSaggingDetected: this.hipSaggingDetected,
      hipPikingDetected: this.hipPikingDetected,
    };

    const validation = validatePushupRep(cycleStats);

    this.totalReps++;
    if (validation.isValid) {
      this.validReps++;
    } else {
      this.invalidReps++;
    }

    this.lastRepCompletedTime = currentTime;
    this.resetCycleStats();

    if (this.onRepCompletedListener) {
      this.onRepCompletedListener(validation);
    }

    return validation;
  }
}
