import { KEYPOINT_CONFIDENCE_THRESHOLD } from '../ai/pose/constants';
import { PoseKeypoint } from '../ai/pose/types';

export type CameraDistanceStatus =
  | 'OPTIMAL'
  | 'TOO_CLOSE'
  | 'TOO_FAR'
  | 'CLIPPED'
  | 'UNKNOWN';

export interface CameraDistanceFeedback {
  status: CameraDistanceStatus;
  message: string;
  bodySpanHeight: number; // 0..1 percentage of frame
  bodySpanWidth: number; // 0..1 percentage of frame
  isWellPositioned: boolean;
}

/**
 * Evaluates user's distance from the camera based on detected pose keypoint spans.
 * Provides real-time guidance so users know whether to step back or move closer.
 */
export function evaluateCameraDistance(
  keypoints?: PoseKeypoint[]
): CameraDistanceFeedback {
  if (!keypoints || keypoints.length === 0) {
    return {
      status: 'UNKNOWN',
      message: 'Posisikan Diri di Depan Kamera',
      bodySpanHeight: 0,
      bodySpanWidth: 0,
      isWellPositioned: false,
    };
  }

  // Filter confident landmarks
  const confidentKeypoints = keypoints.filter(
    (kp) => kp.confidence >= KEYPOINT_CONFIDENCE_THRESHOLD
  );

  // If fewer than 4 keypoints are confident, person is not clearly framed
  if (confidentKeypoints.length < 4) {
    return {
      status: 'UNKNOWN',
      message: 'Posisikan Diri di Depan Kamera',
      bodySpanHeight: 0,
      bodySpanWidth: 0,
      isWellPositioned: false,
    };
  }

  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;

  for (const kp of confidentKeypoints) {
    if (kp.x < minX) minX = kp.x;
    if (kp.x > maxX) maxX = kp.x;
    if (kp.y < minY) minY = kp.y;
    if (kp.y > maxY) maxY = kp.y;
  }

  const bodySpanHeight = Math.max(0, maxY - minY);
  const bodySpanWidth = Math.max(0, maxX - minX);

  // Check if body is clipped by screen edges (< 4% margin from frame boundaries)
  const isClippedTopOrBottom = minY < 0.04 || maxY > 0.96;
  const isClippedLeftOrRight = minX < 0.04 || maxX > 0.96;

  // Case 1: Too close (body fills > 78% of height or > 80% of width, or touches edges)
  if (bodySpanHeight > 0.78 || bodySpanWidth > 0.80 || (isClippedTopOrBottom && bodySpanHeight > 0.65)) {
    return {
      status: 'TOO_CLOSE',
      message: 'Terlalu Dekat — Mundur Sedikit',
      bodySpanHeight,
      bodySpanWidth,
      isWellPositioned: false,
    };
  }

  // Case 2: Body parts clipped near border
  if (isClippedLeftOrRight || isClippedTopOrBottom) {
    return {
      status: 'CLIPPED',
      message: 'Tubuh Terpotong — Geser ke Tengah',
      bodySpanHeight,
      bodySpanWidth,
      isWellPositioned: false,
    };
  }

  // Case 3: Too far (body occupies < 22% of frame height)
  if (bodySpanHeight < 0.22 && bodySpanWidth < 0.22) {
    return {
      status: 'TOO_FAR',
      message: 'Terlalu Jauh — Maju Sedikit',
      bodySpanHeight,
      bodySpanWidth,
      isWellPositioned: false,
    };
  }

  // Case 4: Optimal distance (25% - 75% of frame, well centered)
  return {
    status: 'OPTIMAL',
    message: 'Jarak Ideal ✓',
    bodySpanHeight,
    bodySpanWidth,
    isWellPositioned: true,
  };
}
