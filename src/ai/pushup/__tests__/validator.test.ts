import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePushupRep } from '../validator';
import { RepCycleStats } from '../types';

function createMockCycleStats(overrides: Partial<RepCycleStats> = {}): RepCycleStats {
  return {
    minElbowAngle: 75,
    maxElbowAngle: 165,
    hipAngles: [175, 172, 174, 175],
    averageHipAngle: 174,
    minHipAngle: 172,
    confidences: [0.92, 0.9, 0.94],
    averageConfidence: 0.92,
    minConfidence: 0.9,
    backStraightnessScore: 98,
    reachedBottom: true,
    completedFullCycle: true,
    durationMs: 1200,
    hipSaggingDetected: false,
    hipPikingDetected: false,
    ...overrides,
  };
}

describe('Push-up Repetition Validator', () => {
  it('validates a complete, deep push-up with good alignment as valid', () => {
    const stats = createMockCycleStats({
      minElbowAngle: 72,
      averageHipAngle: 175,
      reachedBottom: true,
      completedFullCycle: true,
    });

    const result = validatePushupRep(stats);
    assert.equal(result.isValid, true);
    assert.equal(result.reasons.length, 0);
    assert.ok(result.depthPercentage >= 95);
    assert.ok(result.formScore >= 90);
  });

  it('rejects a shallow push-up where depth threshold was not reached', () => {
    const stats = createMockCycleStats({
      minElbowAngle: 110, // > 90 DEPTH_THRESHOLD
      reachedBottom: false,
    });

    const result = validatePushupRep(stats);
    assert.equal(result.isValid, false);
    assert.ok(result.reasons.includes('NOT_DEEP_ENOUGH'));
    assert.ok(result.depthPercentage < 60);
  });

  it('rejects push-up with bad body alignment (hip sagging detected)', () => {
    const stats = createMockCycleStats({
      minElbowAngle: 75,
      hipSaggingDetected: true,
      averageHipAngle: 138, // < 145 ALIGNMENT_MIN_ANGLE
    });

    const result = validatePushupRep(stats);
    assert.equal(result.isValid, false);
    assert.ok(result.reasons.includes('BAD_BODY_ALIGNMENT'));
    assert.ok(result.formScore < 70);
  });

  it('rejects push-up with low tracking confidence', () => {
    const stats = createMockCycleStats({
      minConfidence: 0.22, // < 0.35 CONFIDENCE_THRESHOLD
      averageConfidence: 0.32, // < 0.40 MIN_OVERALL_POSE_CONFIDENCE
    });

    const result = validatePushupRep(stats);
    assert.equal(result.isValid, false);
    assert.ok(result.reasons.includes('LOW_CONFIDENCE'));
  });

  it('rejects incomplete push-up if completedFullCycle is false', () => {
    const stats = createMockCycleStats({
      completedFullCycle: false,
    });

    const result = validatePushupRep(stats);
    assert.equal(result.isValid, false);
    assert.ok(result.reasons.includes('INCOMPLETE_REP'));
  });

  it('accumulates multiple failure reasons if multiple criteria fail', () => {
    const stats = createMockCycleStats({
      minElbowAngle: 115, // Shallow
      hipSaggingDetected: true, // Bad alignment
      minConfidence: 0.2, // Low confidence
    });

    const result = validatePushupRep(stats);
    assert.equal(result.isValid, false);
    assert.ok(result.reasons.includes('NOT_DEEP_ENOUGH'));
    assert.ok(result.reasons.includes('BAD_BODY_ALIGNMENT'));
    assert.ok(result.reasons.includes('LOW_CONFIDENCE'));
  });
});
