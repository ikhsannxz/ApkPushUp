import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { PoseKeypoint } from '../ai/pose/types';
import { CameraDistanceStatus } from '../utils/distance';

export interface PoseOverlayProps {
  keypoints?: PoseKeypoint[];
  showGuideFrame?: boolean;
  distanceStatus?: CameraDistanceStatus;
  distanceMessage?: string;
  isMirrored?: boolean;
  showSkeleton?: boolean;
}

const SKELETON_CONNECTIONS: readonly [string, string][] = [
  // Left arm
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  // Right arm
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  // Shoulders & Torso
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  // Legs
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
];

const DISPLAY_KEYPOINTS: readonly string[] = [
  'nose',
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
];

/**
 * Overlay component for rendering real-time MoveNet skeleton, keypoint dots,
 * framing guides, and distance advice.
 */
export function PoseOverlay({
  keypoints,
  showGuideFrame = true,
  distanceStatus = 'UNKNOWN',
  distanceMessage,
  isMirrored = false,
  showSkeleton = true,
}: PoseOverlayProps): React.JSX.Element {
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setLayout({ width, height });
    }
  };

  const getCornerColor = () => {
    switch (distanceStatus) {
      case 'OPTIMAL':
        return '#10B981'; // Green
      case 'TOO_CLOSE':
      case 'CLIPPED':
        return '#F59E0B'; // Amber
      case 'TOO_FAR':
        return '#3B82F6'; // Blue
      default:
        return 'rgba(255, 255, 255, 0.4)';
    }
  };

  const getKeypointColor = (conf: number) => {
    if (conf >= 0.4) return '#10B981'; // Green
    if (conf >= 0.25) return '#F59E0B'; // Amber
    return '#EF4444'; // Red
  };

  const getPointCoords = (kp: PoseKeypoint) => {
    const x = isMirrored ? (1 - kp.x) * layout.width : kp.x * layout.width;
    const y = kp.y * layout.height;
    return { x, y };
  };

  const renderBones = () => {
    if (!keypoints || !showSkeleton || layout.width === 0 || layout.height === 0) return null;

    return SKELETON_CONNECTIONS.map(([startName, endName]) => {
      const p1 = keypoints.find((k) => k.name === startName);
      const p2 = keypoints.find((k) => k.name === endName);
      if (!p1 || !p2 || p1.confidence < 0.2 || p2.confidence < 0.2) return null;

      const c1 = getPointCoords(p1);
      const c2 = getPointCoords(p2);

      const dx = c2.x - c1.x;
      const dy = c2.y - c1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 2) return null;

      const angle = Math.atan2(dy, dx);
      const mx = (c1.x + c2.x) / 2;
      const my = (c1.y + c2.y) / 2;

      const isHighConf = p1.confidence >= 0.35 && p2.confidence >= 0.35;
      const boneColor = isHighConf ? '#38BDF8' : '#F59E0B';

      return (
        <View
          key={`bone-${startName}-${endName}`}
          style={[
            styles.boneLine,
            {
              left: mx - length / 2,
              top: my - 1.5,
              width: length,
              height: 3,
              backgroundColor: boneColor,
              transform: [{ rotate: `${angle}rad` }],
              opacity: isHighConf ? 0.85 : 0.5,
            },
          ]}
        />
      );
    });
  };

  const renderKeypoints = () => {
    if (!keypoints || !showSkeleton || layout.width === 0 || layout.height === 0) return null;

    return DISPLAY_KEYPOINTS.map((name) => {
      const kp = keypoints.find((k) => k.name === name);
      if (!kp || kp.confidence < 0.15) return null;

      const { x, y } = getPointCoords(kp);
      const isCritical =
        name.includes('shoulder') ||
        name.includes('elbow') ||
        name.includes('wrist');
      const size = isCritical ? 14 : 9;
      const dotColor = getKeypointColor(kp.confidence);

      return (
        <View
          key={`kp-${name}`}
          style={[
            styles.keypointDot,
            {
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: dotColor,
              borderColor: '#FFFFFF',
              borderWidth: isCritical ? 2 : 1.5,
            },
          ]}
        />
      );
    });
  };

  const cornerColor = getCornerColor();

  return (
    <View style={StyleSheet.absoluteFill} onLayout={handleLayout} pointerEvents="none">
      {/* 1. Real-time Skeleton Bones */}
      {renderBones()}

      {/* 2. Real-time Keypoint Dots */}
      {renderKeypoints()}

      {/* 3. Guide Framing Bounds & Distance Guidance */}
      {showGuideFrame && (
        <View style={styles.guideContainer}>
          <View style={styles.guideBox}>
            {/* Corners */}
            <View
              style={[
                styles.corner,
                styles.topLeft,
                { borderColor: cornerColor },
              ]}
            />
            <View
              style={[
                styles.corner,
                styles.topRight,
                { borderColor: cornerColor },
              ]}
            />
            <View
              style={[
                styles.corner,
                styles.bottomLeft,
                { borderColor: cornerColor },
              ]}
            />
            <View
              style={[
                styles.corner,
                styles.bottomRight,
                { borderColor: cornerColor },
              ]}
            />

            {/* Distance Advice Banner at Bottom of Framing Box */}
            {distanceMessage && distanceStatus !== 'UNKNOWN' && (
              <View
                style={[
                  styles.distanceAdviceBanner,
                  distanceStatus === 'OPTIMAL'
                    ? styles.bannerOptimal
                    : distanceStatus === 'TOO_CLOSE' || distanceStatus === 'CLIPPED'
                    ? styles.bannerWarning
                    : styles.bannerInfo,
                ]}
              >
                <Text style={styles.distanceAdviceText}>
                  {distanceMessage}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  boneLine: {
    position: 'absolute',
    borderRadius: 1.5,
  },
  keypointDot: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 3,
  },
  guideContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  guideBox: {
    width: '100%',
    height: '75%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    position: 'relative',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
  },
  topLeft: {
    top: -1,
    left: -1,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: -1,
    right: -1,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 16,
  },
  distanceAdviceBanner: {
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  bannerOptimal: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderColor: '#10B981',
  },
  bannerWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.3)',
    borderColor: '#F59E0B',
  },
  bannerInfo: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    borderColor: '#3B82F6',
  },
  distanceAdviceText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
