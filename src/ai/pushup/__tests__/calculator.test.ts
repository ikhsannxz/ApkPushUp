import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRawPushupAngles,
  PushupAngleCalculator,
} from '../calculator';
import { PoseKeypoint } from '../../pose/types';

function createKeypoint(
  name: string,
  x: number,
  y: number,
  confidence: number
): PoseKeypoint {
  return { name, x, y, confidence };
}

describe('Push-up Angle Calculator', () => {
  it('calculates valid left elbow angle with shoulder, elbow, wrist', () => {
    // Left arm in straight lockout horizontal: shoulder(0.2, 0.5), elbow(0.4, 0.5), wrist(0.6, 0.5)
    // Angle at elbow is 180 degrees
    const keypoints: PoseKeypoint[] = [
      createKeypoint('left_shoulder', 0.2, 0.5, 0.9),
      createKeypoint('left_elbow', 0.4, 0.5, 0.9),
      createKeypoint('left_wrist', 0.6, 0.5, 0.9),
    ];

    const angles = calculateRawPushupAngles(keypoints);
    assert.notEqual(angles.leftElbowAngle, null);
    assert.equal(angles.leftElbowAngle, 180);
    assert.equal(angles.rightElbowAngle, null);
    assert.equal(angles.effectiveElbowAngle, 180);
  });

  it('calculates valid right elbow angle with 90 degree flexion', () => {
    // Right arm bent at 90 deg: shoulder(0.5, 0.2), elbow(0.5, 0.5), wrist(0.8, 0.5)
    const keypoints: PoseKeypoint[] = [
      createKeypoint('right_shoulder', 0.5, 0.2, 0.85),
      createKeypoint('right_elbow', 0.5, 0.5, 0.85),
      createKeypoint('right_wrist', 0.8, 0.5, 0.85),
    ];

    const angles = calculateRawPushupAngles(keypoints);
    assert.notEqual(angles.rightElbowAngle, null);
    assert.equal(angles.rightElbowAngle, 90);
    assert.equal(angles.leftElbowAngle, null);
    assert.equal(angles.effectiveElbowAngle, 90);
  });

  it('calculates average when both left and right sides are valid', () => {
    // Left: 180 deg, Right: 90 deg -> Average: 135 deg
    const keypoints: PoseKeypoint[] = [
      createKeypoint('left_shoulder', 0.2, 0.5, 0.9),
      createKeypoint('left_elbow', 0.4, 0.5, 0.9),
      createKeypoint('left_wrist', 0.6, 0.5, 0.9),
      createKeypoint('right_shoulder', 0.5, 0.2, 0.9),
      createKeypoint('right_elbow', 0.5, 0.5, 0.9),
      createKeypoint('right_wrist', 0.8, 0.5, 0.9),
    ];

    const angles = calculateRawPushupAngles(keypoints);
    assert.equal(angles.leftElbowAngle, 180);
    assert.equal(angles.rightElbowAngle, 90);
    assert.equal(angles.effectiveElbowAngle, 135);
  });

  it('uses only left side when right side keypoints are missing', () => {
    const keypoints: PoseKeypoint[] = [
      createKeypoint('left_shoulder', 0.2, 0.5, 0.8),
      createKeypoint('left_elbow', 0.4, 0.5, 0.8),
      createKeypoint('left_wrist', 0.6, 0.5, 0.8),
    ];

    const angles = calculateRawPushupAngles(keypoints);
    assert.equal(angles.leftElbowAngle, 180);
    assert.equal(angles.rightElbowAngle, null);
    assert.equal(angles.effectiveElbowAngle, 180);
  });

  it('uses only right side when left side confidence is too low', () => {
    const keypoints: PoseKeypoint[] = [
      // Left elbow confidence below threshold (0.2 < 0.35)
      createKeypoint('left_shoulder', 0.2, 0.5, 0.9),
      createKeypoint('left_elbow', 0.4, 0.5, 0.2),
      createKeypoint('left_wrist', 0.6, 0.5, 0.9),
      // Right arm fully valid
      createKeypoint('right_shoulder', 0.5, 0.2, 0.9),
      createKeypoint('right_elbow', 0.5, 0.5, 0.9),
      createKeypoint('right_wrist', 0.8, 0.5, 0.9),
    ];

    const angles = calculateRawPushupAngles(keypoints);
    assert.equal(angles.leftElbowAngle, null);
    assert.equal(angles.rightElbowAngle, 90);
    assert.equal(angles.effectiveElbowAngle, 90);
  });

  it('returns null for effective angle when both sides are invalid', () => {
    const keypoints: PoseKeypoint[] = [
      createKeypoint('left_shoulder', 0.2, 0.5, 0.1),
      createKeypoint('left_elbow', 0.4, 0.5, 0.1),
      createKeypoint('right_shoulder', 0.5, 0.2, 0.1),
    ];

    const angles = calculateRawPushupAngles(keypoints);
    assert.equal(angles.leftElbowAngle, null);
    assert.equal(angles.rightElbowAngle, null);
    assert.equal(angles.effectiveElbowAngle, null);
  });

  it('rejects low confidence keypoints even if coordinates exist', () => {
    const keypoints: PoseKeypoint[] = [
      createKeypoint('left_shoulder', 0.2, 0.5, 0.34), // < 0.35 threshold
      createKeypoint('left_elbow', 0.4, 0.5, 0.34),
      createKeypoint('left_wrist', 0.6, 0.5, 0.34),
    ];

    const angles = calculateRawPushupAngles(keypoints);
    assert.equal(angles.leftElbowAngle, null);
    assert.equal(angles.effectiveElbowAngle, null);
  });

  it('never outputs NaN or Infinity on coincident or degenerate points', () => {
    // All keypoints at the exact same location (0, 0)
    const degenerateKeypoints: PoseKeypoint[] = [
      createKeypoint('left_shoulder', 0, 0, 0.9),
      createKeypoint('left_elbow', 0, 0, 0.9),
      createKeypoint('left_wrist', 0, 0, 0.9),
      createKeypoint('right_shoulder', 0, 0, 0.9),
      createKeypoint('right_elbow', 0, 0, 0.9),
      createKeypoint('right_wrist', 0, 0, 0.9),
      createKeypoint('left_hip', 0, 0, 0.9),
      createKeypoint('left_knee', 0, 0, 0.9),
    ];

    const angles = calculateRawPushupAngles(degenerateKeypoints);
    if (angles.leftElbowAngle !== null) {
      assert.equal(isNaN(angles.leftElbowAngle), false);
      assert.equal(isFinite(angles.leftElbowAngle), true);
    }
    if (angles.effectiveElbowAngle !== null) {
      assert.equal(isNaN(angles.effectiveElbowAngle), false);
      assert.equal(isFinite(angles.effectiveElbowAngle), true);
    }
    if (angles.effectiveHipAngle !== null) {
      assert.equal(isNaN(angles.effectiveHipAngle), false);
      assert.equal(isFinite(angles.effectiveHipAngle), true);
    }
  });

  it('evaluates body alignment and detects sagging hips', () => {
    // Prone plank position: shoulder(0.2, 0.4), hip(0.5, 0.55), knee(0.8, 0.4)
    // Here hip y (0.55) is significantly lower than shoulder-knee line (0.4) -> sagging!
    const keypoints: PoseKeypoint[] = [
      createKeypoint('left_shoulder', 0.2, 0.4, 0.9),
      createKeypoint('left_hip', 0.5, 0.55, 0.9),
      createKeypoint('left_knee', 0.8, 0.4, 0.9),
    ];

    const angles = calculateRawPushupAngles(keypoints);
    assert.equal(angles.hipSagging, true);
    assert.equal(angles.isBodyAligned, false);
  });

  it('smooths consecutive angle observations with EMA in PushupAngleCalculator', () => {
    const calc = new PushupAngleCalculator();

    // Frame 1: 180 degrees
    const frame1: PoseKeypoint[] = [
      createKeypoint('left_shoulder', 0.2, 0.5, 0.9),
      createKeypoint('left_elbow', 0.4, 0.5, 0.9),
      createKeypoint('left_wrist', 0.6, 0.5, 0.9),
    ];
    const res1 = calc.calculate(frame1);
    assert.equal(res1.effectiveElbowAngle, 180);

    // Frame 2: Angle suddenly drops to 90 degrees
    const frame2: PoseKeypoint[] = [
      createKeypoint('left_shoulder', 0.5, 0.2, 0.9),
      createKeypoint('left_elbow', 0.5, 0.5, 0.9),
      createKeypoint('left_wrist', 0.8, 0.5, 0.9),
    ];
    const res2 = calc.calculate(frame2);
    // EMA with alpha=0.45: 0.45*90 + 0.55*180 = 40.5 + 99 = 139.5
    assert.notEqual(res2.effectiveElbowAngle, 90);
    assert.ok(res2.effectiveElbowAngle! < 180 && res2.effectiveElbowAngle! > 90);
  });
});
