import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PushupStateMachine } from '../state-machine';
import { PushupAngles } from '../types';

function createMockAngles(
  elbowAngle: number | null,
  hipAngle: number | null = 175,
  isBodyAligned: boolean = true
): PushupAngles {
  return {
    leftElbowAngle: elbowAngle,
    rightElbowAngle: elbowAngle,
    effectiveElbowAngle: elbowAngle,
    leftHipAngle: hipAngle,
    rightHipAngle: hipAngle,
    effectiveHipAngle: hipAngle,
    backStraightnessScore: 95,
    isBodyAligned,
    hipSagging: false,
    hipPiking: false,
    confidence: 0.9,
  };
}

/**
 * Feeds an angle into the state machine for N consecutive frames with simulated time step.
 */
function feedFrames(
  sm: PushupStateMachine,
  angle: number,
  frameCount: number,
  startTime: number,
  stepMs: number = 80
): number {
  let time = startTime;
  for (let i = 0; i < frameCount; i++) {
    time += stepMs;
    sm.update(createMockAngles(angle), time);
  }
  return time;
}

describe('Push-up State Machine', () => {
  it('transitions from IDLE to READY to UP when arms reach full extension', () => {
    const sm = new PushupStateMachine();
    assert.equal(sm.getState(), 'idle');

    // Feed initial frame -> Transitions to READY
    let time = 1000;
    time = feedFrames(sm, 160, 2, time);
    assert.equal(sm.getState(), 'ready');

    // Arms locked out at 165 deg for 2+ frames -> Transitions to UP
    feedFrames(sm, 165, 3, time);
    assert.equal(sm.getState(), 'up');
    assert.equal(sm.getTotalReps(), 0);
  });

  it('completes full cycle: UP -> GOING_DOWN -> BOTTOM -> GOING_UP -> UP = 1 rep', () => {
    const sm = new PushupStateMachine();
    let time = 1000;

    // Reach UP
    time = feedFrames(sm, 165, 3, time); // -> ready
    time = feedFrames(sm, 165, 3, time); // -> up
    assert.equal(sm.getState(), 'up');

    // Descend below UP_EXIT_THRESHOLD (<= 140) -> GOING_DOWN
    time = feedFrames(sm, 130, 3, time);
    assert.equal(sm.getState(), 'going_down');

    // Reach bottom depth (<= 90) -> BOTTOM
    time = feedFrames(sm, 80, 3, time);
    assert.equal(sm.getState(), 'bottom');

    // Ascend above DOWN_EXIT_THRESHOLD (>= 105 due to hysteresis) -> GOING_UP
    time = feedFrames(sm, 115, 3, time);
    assert.equal(sm.getState(), 'going_up');

    // Reach top lockout (>= 155) -> UP (Rep completion!)
    feedFrames(sm, 165, 3, time);
    assert.equal(sm.getState(), 'up');

    // Repetition counter must equal 1!
    assert.equal(sm.getTotalReps(), 1);
    assert.equal(sm.getValidReps(), 1);
    assert.equal(sm.getInvalidReps(), 0);
  });

  it('does NOT count partial rep when user goes down but does not reach bottom', () => {
    const sm = new PushupStateMachine();
    let time = 1000;

    // Reach UP
    time = feedFrames(sm, 165, 3, time);
    time = feedFrames(sm, 165, 3, time);
    assert.equal(sm.getState(), 'up');

    // User dips down slightly to 125 deg (going_down), but never reaches <= 90 deg
    time = feedFrames(sm, 125, 3, time);
    assert.equal(sm.getState(), 'going_down');

    // User returns straight back up to 165 deg
    feedFrames(sm, 165, 3, time);
    assert.equal(sm.getState(), 'up');

    // NO repetition counted!
    assert.equal(sm.getTotalReps(), 0);
  });

  it('does NOT count rep when user descends to bottom and stays there (stopping/aborting)', () => {
    const sm = new PushupStateMachine();
    let time = 1000;

    // Reach UP -> GOING_DOWN -> BOTTOM
    time = feedFrames(sm, 165, 3, time);
    time = feedFrames(sm, 165, 3, time);
    time = feedFrames(sm, 130, 3, time);
    time = feedFrames(sm, 80, 3, time);
    assert.equal(sm.getState(), 'bottom');

    // User stays at bottom for 10 seconds
    feedFrames(sm, 80, 20, time, 500);

    // Repetition must NOT be counted
    assert.equal(sm.getTotalReps(), 0);
  });

  it('demonstrates hysteresis preventing jitter oscillation at bottom boundary', () => {
    const sm = new PushupStateMachine();
    let time = 1000;

    time = feedFrames(sm, 165, 3, time);
    time = feedFrames(sm, 165, 3, time);
    time = feedFrames(sm, 130, 3, time);

    // Enter BOTTOM at 88 deg
    time = feedFrames(sm, 88, 3, time);
    assert.equal(sm.getState(), 'bottom');

    // Angle oscillates between 92 and 98 deg (above DOWN_ENTER_THRESHOLD=90, but below DOWN_EXIT_THRESHOLD=105)
    time = feedFrames(sm, 95, 3, time);
    // Hysteresis ensures it STAYS in BOTTOM and does NOT prematurely flip to GOING_UP!
    assert.equal(sm.getState(), 'bottom');

    time = feedFrames(sm, 98, 3, time);
    assert.equal(sm.getState(), 'bottom');

    // Only when ascending >= 105 does it transition to GOING_UP
    feedFrames(sm, 110, 3, time);
    assert.equal(sm.getState(), 'going_up');
  });

  it('filters single-frame noise spikes via MIN_CONSECUTIVE_FRAMES', () => {
    const sm = new PushupStateMachine();
    let time = 1000;

    time = feedFrames(sm, 165, 3, time);
    time = feedFrames(sm, 165, 3, time);
    assert.equal(sm.getState(), 'up');

    // Single rogue noisy frame drops to 70 deg
    time += 80;
    sm.update(createMockAngles(70), time);
    // Must NOT jump to going_down or bottom because 2 consecutive frames are required!
    assert.equal(sm.getState(), 'up');

    // Next frame is back to normal 165 deg
    time += 80;
    sm.update(createMockAngles(165), time);
    assert.equal(sm.getState(), 'up');
    assert.equal(sm.getTotalReps(), 0);
  });

  it('prevents duplicate counting via temporal debounce and rep cooldown', () => {
    const sm = new PushupStateMachine();
    let time = 1000;

    // Complete Rep 1
    time = feedFrames(sm, 165, 3, time);
    time = feedFrames(sm, 165, 3, time);
    time = feedFrames(sm, 130, 3, time);
    time = feedFrames(sm, 80, 3, time);
    time = feedFrames(sm, 115, 3, time);
    time = feedFrames(sm, 165, 3, time);
    assert.equal(sm.getTotalReps(), 1);

    // Rapid jitter right at the lockout within cooldown window (e.g. 50ms later)
    time += 50;
    sm.update(createMockAngles(135), time);
    time += 50;
    sm.update(createMockAngles(165), time);

    // Rep count MUST remain 1 (no duplicate counted)
    assert.equal(sm.getTotalReps(), 1);
  });
});
