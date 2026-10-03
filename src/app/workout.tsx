import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CameraRatio, CameraType } from 'expo-camera';
import { CameraView, CameraViewHandle } from '../components/CameraView';
import { PoseOverlay } from '../components/PoseOverlay';
import { RepCounter } from '../components/RepCounter';
import { WorkoutTimer } from '../components/WorkoutTimer';
import { useWorkoutStore } from '../store/workout-store';
import { DeviceCapability, getDeviceCapability } from '../utils/device';
import { getActivePoseDetector } from '../ai/pose/detector';
import { BodyDetectionStatus, PoseEstimationResult } from '../ai/pose/types';
import {
  KEYPOINT_CONFIDENCE_THRESHOLD,
  PUSHUP_CRITICAL_KEYPOINTS,
} from '../ai/pose/constants';
import { evaluateCameraDistance } from '../utils/distance';
import { PushupAngleCalculator } from '../ai/pushup/calculator';
import { PushupStateMachine } from '../ai/pushup/state-machine';
import { PushupFeedbackManager } from '../ai/pushup/feedback';
import { PushupAngles, StateMachineDebugInfo } from '../ai/pushup/types';

export default function WorkoutScreen(): React.JSX.Element {
  const [facing, setFacing] = useState<CameraType>('front');
  const [ratio, setRatio] = useState<CameraRatio>('16:9');
  const [zoom] = useState<number>(0);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [deviceCapability, setDeviceCapability] = useState<DeviceCapability | null>(null);

  // Phase 2: Pose Detection State
  const [detectionStatus, setDetectionStatus] = useState<BodyDetectionStatus>('INITIALIZING');
  const [lastPoseResult, setLastPoseResult] = useState<PoseEstimationResult | null>(null);
  const [showDebugHUD, setShowDebugHUD] = useState<boolean>(true);
  const [isMirrored, setIsMirrored] = useState<boolean>(false);
  const [showSkeleton, setShowSkeleton] = useState<boolean>(true);

  // Phase 3: Push-Up Engine State
  const [currentAngles, setCurrentAngles] = useState<PushupAngles | null>(null);
  const [smDebugInfo, setSmDebugInfo] = useState<StateMachineDebugInfo | null>(null);

  const cameraRef = useRef<CameraViewHandle | null>(null);
  const isLoopActiveRef = useRef<boolean>(false);

  // Phase 3: Engine Instances
  const calculatorRef = useRef<PushupAngleCalculator>(new PushupAngleCalculator());
  const stateMachineRef = useRef<PushupStateMachine>(new PushupStateMachine());
  const feedbackManagerRef = useRef<PushupFeedbackManager>(new PushupFeedbackManager());

  const {
    status,
    isCameraActive,
    totalReps,
    validReps,
    invalidReps,
    durationSeconds,
    currentState,
    currentFeedback,
    formScore,
    startWorkout,
    pauseWorkout,
    resumeWorkout,
    finishWorkout,
    toggleCameraActive,
    tickTimer,
    setCurrentState,
    setFeedback,
    recordRep,
  } = useWorkoutStore();

  // Attach recordRep listener to the state machine
  useEffect(() => {
    stateMachineRef.current.setOnRepCompleted((val) => {
      recordRep(val);
      feedbackManagerRef.current.setRepCompletionFeedback(val);
    });
  }, [recordRep]);

  // Real-time camera distance evaluation from pose keypoints
  const distanceFeedback = evaluateCameraDistance(lastPoseResult?.keypoints);

  // Screen focus lifecycle: ensure camera hardware & detector stop immediately on unfocus
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      isLoopActiveRef.current = true;
      return () => {
        setIsScreenFocused(false);
        isLoopActiveRef.current = false;
      };
    }, [])
  );

  // Fetch device capability profile
  useEffect(() => {
    let isMounted = true;
    getDeviceCapability().then((cap) => {
      if (isMounted) setDeviceCapability(cap);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Timer ticker
  useEffect(() => {
    if (status !== 'active') return;
    const interval = setInterval(() => {
      tickTimer();
    }, 1000);
    return () => clearInterval(interval);
  }, [status, tickTimer]);

  // Phase 2 & 3: Pose Detection & Push-Up Engine Pipeline Loop
  useEffect(() => {
    const detector = getActivePoseDetector();
    let isMounted = true;

    async function initAndRunPipeline() {
      try {
        await detector.initialize({
          mode: deviceCapability?.mode ?? 'standard',
          minConfidence: 0.35,
        });

        if (isMounted) {
          setDetectionStatus(detector.getStatus?.() ?? 'NO_PERSON');
        }
      } catch {
        if (isMounted) {
          setDetectionStatus('MODEL_UNAVAILABLE');
        }
        return;
      }

      // Continuous non-blocking adaptive inference loop
      while (isMounted && isLoopActiveRef.current && isCameraActive) {
        try {
          if (cameraRef.current) {
            const frame = await cameraRef.current.captureFrame();
            if (frame && isMounted && isLoopActiveRef.current) {
              const result = await detector.estimatePose(frame);
              if (result && isMounted) {
                setLastPoseResult(result);
                if (result.status) {
                  setDetectionStatus(result.status);
                }

                // Phase 3: Push-Up Engine execution
                const angles = calculatorRef.current.calculate(result.keypoints);
                setCurrentAngles(angles);

                const activeStatus = useWorkoutStore.getState().status;
                if (activeStatus === 'active') {
                  const smResult = stateMachineRef.current.update(angles, Date.now());
                  setCurrentState(smResult.state);
                  setSmDebugInfo(stateMachineRef.current.getDebugInfo());

                  const msg = feedbackManagerRef.current.getFeedback({
                    state: smResult.state,
                    angles,
                    detectionStatus: result.status ?? 'PERSON_DETECTED',
                    distanceStatus: distanceFeedback.status,
                    lastCompletedRep: smResult.completedRep,
                  });
                  setFeedback(msg);
                } else {
                  setSmDebugInfo(stateMachineRef.current.getDebugInfo());
                  const msg = feedbackManagerRef.current.getFeedback({
                    state: 'idle',
                    angles,
                    detectionStatus: result.status ?? 'PERSON_DETECTED',
                    distanceStatus: distanceFeedback.status,
                  });
                  setFeedback(msg);
                }
              }
            }
          }
        } catch {
          // Gracefully continue loop without crashing
        }

        // Adaptive yield to prevent thread starvation
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    }

    if (isScreenFocused && isCameraActive) {
      initAndRunPipeline();
    }

    return () => {
      isMounted = false;
      detector.dispose().catch(() => {});
    };
  }, [isScreenFocused, isCameraActive, deviceCapability, distanceFeedback.status, setCurrentState, setFeedback]);

  const handleStartStopWorkout = () => {
    if (status === 'idle') {
      calculatorRef.current.reset();
      stateMachineRef.current.reset();
      feedbackManagerRef.current.reset();
      startWorkout();
    } else if (status === 'active') {
      pauseWorkout();
    } else if (status === 'paused') {
      resumeWorkout();
    }
  };

  const handleFinish = () => {
    stateMachineRef.current.reset();
    calculatorRef.current.reset();
    finishWorkout();
    router.replace('/result');
  };

  const handleBack = () => {
    router.back();
  };

  const toggleRatio = () => {
    setRatio((prev) => (prev === '16:9' ? '4:3' : '16:9'));
  };

  const isCameraLive = isScreenFocused && isCameraActive;

  // Render pose status badge styling
  const getStatusBadgeStyle = () => {
    switch (detectionStatus) {
      case 'PERSON_DETECTED':
        return styles.badgeSuccess;
      case 'LOW_CONFIDENCE':
        return styles.badgeWarning;
      case 'NO_PERSON':
        return styles.badgeNeutral;
      case 'INITIALIZING':
        return styles.badgeInfo;
      case 'MODEL_UNAVAILABLE':
      default:
        return styles.badgeDanger;
    }
  };

  const getStatusText = () => {
    switch (detectionStatus) {
      case 'PERSON_DETECTED':
        return 'PERSON DETECTED';
      case 'LOW_CONFIDENCE':
        return 'LOW CONFIDENCE';
      case 'NO_PERSON':
        return 'NO PERSON IN FRAME';
      case 'INITIALIZING':
        return 'INITIALIZING AI...';
      case 'MODEL_UNAVAILABLE':
        return 'AI UNAVAILABLE';
      default:
        return 'READY';
    }
  };

  // Distance badge styling
  const getDistanceBadgeStyle = () => {
    switch (distanceFeedback.status) {
      case 'OPTIMAL':
        return styles.distOptimal;
      case 'TOO_CLOSE':
      case 'CLIPPED':
        return styles.distWarning;
      case 'TOO_FAR':
        return styles.distInfo;
      default:
        return styles.distNeutral;
    }
  };

  // Critical landmark detection check for debugging
  const criticalLandmarksDetected = lastPoseResult
    ? PUSHUP_CRITICAL_KEYPOINTS.filter((name) => {
        const kp = lastPoseResult.keypoints.find((k) => k.name === name);
        return kp && kp.confidence >= KEYPOINT_CONFIDENCE_THRESHOLD;
      }).length
    : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header Bar */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
        >
          <Text style={styles.navButtonText}>Exit</Text>
        </Pressable>

        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>PushUp AI</Text>
          {deviceCapability && (
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>
                {deviceCapability.mode.toUpperCase()} • {deviceCapability.targetFps} FPS TARGET
              </Text>
            </View>
          )}
        </View>

        <View style={styles.headerRightActions}>
          {/* Field of View / Aspect Ratio Switch */}
          <Pressable
            style={({ pressed }) => [styles.ratioButton, pressed && styles.pressed]}
            onPress={toggleRatio}
            accessibilityRole="button"
            accessibilityLabel="Toggle Camera Aspect Ratio"
          >
            <Text style={styles.ratioButtonText}>{ratio === '4:3' ? '4:3 Wide' : '16:9'}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
            onPress={() => setFacing((prev) => (prev === 'front' ? 'back' : 'front'))}
            accessibilityRole="button"
            accessibilityLabel="Switch Camera"
          >
            <Text style={styles.navButtonText}>
              {facing === 'front' ? 'Back' : 'Front'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Main Camera Viewport */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          isActive={isCameraLive}
          facing={facing}
          ratio={ratio}
          zoom={zoom}
          onFacingChange={setFacing}
        >
          {/* Skeleton & Alignment Guide Overlay */}
          <PoseOverlay
            keypoints={lastPoseResult?.keypoints}
            showGuideFrame={status !== 'idle'}
            distanceStatus={distanceFeedback.status}
            distanceMessage={distanceFeedback.message}
            isMirrored={isMirrored}
            showSkeleton={showSkeleton}
          />

          {/* Floating HUD: Reps, Timer, Feedback, and Pose Status */}
          <View style={styles.hudOverlay} pointerEvents="box-none">
            <View style={styles.topHud}>
              <WorkoutTimer
                durationSeconds={durationSeconds}
                isActive={status === 'active'}
              />

              {/* Dynamic Pose Detection Status Badge */}
              <View style={[styles.poseStatusBadge, getStatusBadgeStyle()]}>
                <View style={styles.badgeDot} />
                <Text style={styles.poseStatusText}>{getStatusText()}</Text>
              </View>

              {/* Real-time Distance Status Indicator */}
              {detectionStatus === 'PERSON_DETECTED' && (
                <View style={[styles.distancePill, getDistanceBadgeStyle()]}>
                  <Text style={styles.distancePillText}>
                    {distanceFeedback.status === 'OPTIMAL'
                      ? 'JARAK IDEAL'
                      : distanceFeedback.status === 'TOO_CLOSE'
                      ? 'MUNDUR'
                      : distanceFeedback.status === 'TOO_FAR'
                      ? 'MAJU'
                      : 'JARAK'}
                  </Text>
                </View>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.debugToggleBtn,
                  showDebugHUD && styles.debugToggleBtnActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => setShowDebugHUD((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel="Toggle Debug Info"
              >
                <Text style={styles.debugToggleText}>
                  {showDebugHUD ? 'Hide' : 'Debug'}
                </Text>
              </Pressable>
            </View>

            {/* Real-time Coach Feedback Banner */}
            {currentFeedback ? (
              <View style={styles.feedbackBannerContainer}>
                <View style={styles.feedbackBanner}>
                  <Text style={styles.feedbackText}>{currentFeedback}</Text>
                </View>
              </View>
            ) : null}

            {/* Real-time Comprehensive Calibration Debug HUD */}
            {showDebugHUD && (
              <View style={styles.debugContainer}>
                <ScrollView
                  style={styles.debugScroll}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.debugHeaderRow}>
                    <Text style={styles.debugSectionTitle}>PHASE 3.1 CALIBRATION HUD</Text>
                    <View style={styles.debugControlRow}>
                      <Pressable
                        style={[styles.debugSmallBtn, isMirrored && styles.debugSmallBtnActive]}
                        onPress={() => setIsMirrored((prev) => !prev)}
                        accessibilityRole="button"
                        accessibilityLabel="Toggle Mirror"
                      >
                        <Text style={styles.debugSmallBtnText}>
                          Mirror: {isMirrored ? 'ON' : 'OFF'}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.debugSmallBtn, showSkeleton && styles.debugSmallBtnActive]}
                        onPress={() => setShowSkeleton((prev) => !prev)}
                        accessibilityRole="button"
                        accessibilityLabel="Toggle Skeleton"
                      >
                        <Text style={styles.debugSmallBtnText}>
                          Skel: {showSkeleton ? 'ON' : 'OFF'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>POSE / CONF:</Text>
                    <Text style={styles.debugHighlight}>
                      {detectionStatus} ({(lastPoseResult?.score ?? 0).toFixed(2)})
                    </Text>
                  </View>

                  <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>L ARM (SH/EL/WR):</Text>
                    <Text style={styles.debugValue}>
                      {currentAngles?.keypointConfidences?.leftShoulder !== undefined
                        ? currentAngles.keypointConfidences.leftShoulder.toFixed(2)
                        : '—'}{' '}
                      /{' '}
                      {currentAngles?.keypointConfidences?.leftElbow !== undefined
                        ? currentAngles.keypointConfidences.leftElbow.toFixed(2)
                        : '—'}{' '}
                      /{' '}
                      {currentAngles?.keypointConfidences?.leftWrist !== undefined
                        ? currentAngles.keypointConfidences.leftWrist.toFixed(2)
                        : '—'}
                    </Text>
                  </View>

                  <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>R ARM (SH/EL/WR):</Text>
                    <Text style={styles.debugValue}>
                      {currentAngles?.keypointConfidences?.rightShoulder !== undefined
                        ? currentAngles.keypointConfidences.rightShoulder.toFixed(2)
                        : '—'}{' '}
                      /{' '}
                      {currentAngles?.keypointConfidences?.rightElbow !== undefined
                        ? currentAngles.keypointConfidences.rightElbow.toFixed(2)
                        : '—'}{' '}
                      /{' '}
                      {currentAngles?.keypointConfidences?.rightWrist !== undefined
                        ? currentAngles.keypointConfidences.rightWrist.toFixed(2)
                        : '—'}
                    </Text>
                  </View>

                  <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>HIPS CONF (L / R):</Text>
                    <Text style={styles.debugValue}>
                      {currentAngles?.keypointConfidences?.leftHip !== undefined
                        ? currentAngles.keypointConfidences.leftHip.toFixed(2)
                        : '—'}{' '}
                      /{' '}
                      {currentAngles?.keypointConfidences?.rightHip !== undefined
                        ? currentAngles.keypointConfidences.rightHip.toFixed(2)
                        : '—'}
                    </Text>
                  </View>

                  <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>ELBOW (L / R / EFF):</Text>
                    <Text style={styles.debugHighlight}>
                      {currentAngles?.leftElbowAngle ?? '—'}° /{' '}
                      {currentAngles?.rightElbowAngle ?? '—'}° /{' '}
                      <Text style={{ color: '#38BDF8' }}>
                        {currentAngles?.effectiveElbowAngle !== null &&
                        currentAngles?.effectiveElbowAngle !== undefined
                          ? `${currentAngles.effectiveElbowAngle}°`
                          : '—'}
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>HIP ALIGN / PLANK:</Text>
                    <Text
                      style={[
                        styles.debugValue,
                        !currentAngles?.isBodyAligned && styles.debugWarning,
                      ]}
                    >
                      {currentAngles?.effectiveHipAngle !== null &&
                      currentAngles?.effectiveHipAngle !== undefined
                        ? `${currentAngles.effectiveHipAngle}°`
                        : '—'}{' '}
                      •{' '}
                      {currentAngles?.isBodyAligned
                        ? 'GOOD'
                        : currentAngles?.hipSagging
                        ? 'SAG'
                        : currentAngles?.hipPiking
                        ? 'PIKE'
                        : 'POOR'}
                    </Text>
                  </View>

                  <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>STATE / BOTTOM:</Text>
                    <Text style={styles.debugHighlight}>
                      {currentState.toUpperCase()} • BTM:{' '}
                      {smDebugInfo?.reachedBottom ? 'TRUE' : 'FALSE'} (MIN:{' '}
                      {smDebugInfo?.minElbowInCycle ?? 0}°)
                    </Text>
                  </View>

                  <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>TRANSITION TRACE:</Text>
                    <Text style={styles.debugSuccess}>
                      {smDebugInfo?.transitionTrace ?? 'IDLE'}
                    </Text>
                  </View>

                  <View style={styles.debugRejectContainer}>
                    <Text style={styles.debugRejectLabel}>REJECT REASON:</Text>
                    <Text style={styles.debugRejectText}>
                      {smDebugInfo?.lastRejectReason ?? 'None'}
                    </Text>
                  </View>

                  <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>FRAME / MODEL:</Text>
                    <Text style={styles.debugSubtext}>
                      {lastPoseResult?.metrics?.frameWidth ?? 0}x
                      {lastPoseResult?.metrics?.frameHeight ?? 0} • MoveNet Lightning
                    </Text>
                  </View>

                  <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>PERF (LAT/FPS/KPS):</Text>
                    <Text style={styles.debugSubtext}>
                      {lastPoseResult?.metrics?.latencyMs ?? 0}ms •{' '}
                      {lastPoseResult?.metrics?.fps ?? 0} FPS •{' '}
                      {lastPoseResult?.metrics?.framesSkipped ?? 0} skip •{' '}
                      {lastPoseResult?.metrics?.validKeypointsCount ?? 0} kps ({criticalLandmarksDetected} crit)
                    </Text>
                  </View>
                </ScrollView>
              </View>
            )}

            <View style={styles.centerHud}>
              <RepCounter
                totalReps={totalReps}
                validReps={validReps}
                invalidReps={invalidReps}
                formScore={formScore}
                currentState={currentState}
              />
            </View>
          </View>
        </CameraView>
      </View>

      {/* Bottom Action Controls */}
      <View style={styles.footerControls}>
        <View style={styles.primaryActionsRow}>
          {/* Camera Stream Toggle */}
          <Pressable
            style={({ pressed }) => [
              styles.secondaryActionBtn,
              pressed && styles.pressed,
            ]}
            onPress={toggleCameraActive}
            accessibilityRole="button"
            accessibilityLabel={isCameraActive ? 'Turn off camera' : 'Turn on camera'}
          >
            <Text style={styles.secondaryActionText}>
              {isCameraActive ? 'Stop Cam' : 'Start Cam'}
            </Text>
          </Pressable>

          {/* Primary Workout Action */}
          <Pressable
            style={({ pressed }) => [
              styles.primaryActionBtn,
              status === 'active' && styles.actionBtnActive,
              pressed && styles.pressed,
            ]}
            onPress={handleStartStopWorkout}
            accessibilityRole="button"
            accessibilityLabel="Start or Pause Workout"
          >
            <Text style={styles.primaryActionText}>
              {status === 'idle'
                ? 'START WORKOUT'
                : status === 'active'
                ? 'PAUSE'
                : 'RESUME'}
            </Text>
          </Pressable>

          {/* Finish Session */}
          <Pressable
            style={({ pressed }) => [
              styles.secondaryActionBtn,
              pressed && styles.pressed,
            ]}
            onPress={handleFinish}
            accessibilityRole="button"
            accessibilityLabel="Finish workout session"
          >
            <Text style={styles.secondaryActionText}>Finish</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0E17',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0A0E17',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleContainer: {
    alignItems: 'center',
  },
  titleText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  modeBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60A5FA',
    letterSpacing: 0.5,
  },
  navButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#131A29',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  navButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  ratioButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  ratioButtonText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '700',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#05070B',
    position: 'relative',
  },
  hudOverlay: {
    ...StyleSheet.absoluteFill,
    padding: 16,
    justifyContent: 'space-between',
  },
  topHud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  poseStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  badgeWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#F59E0B',
  },
  badgeNeutral: {
    backgroundColor: 'rgba(71, 85, 105, 0.3)',
    borderColor: '#64748B',
  },
  badgeInfo: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3B82F6',
  },
  badgeDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  poseStatusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  distancePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  distOptimal: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  distWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: '#F59E0B',
  },
  distInfo: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3B82F6',
  },
  distNeutral: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    borderColor: '#64748B',
  },
  distancePillText: {
    color: '#F8FAFC',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  debugToggleBtn: {
    backgroundColor: '#131A29',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  debugToggleBtnActive: {
    backgroundColor: '#1E293B',
    borderColor: '#3B82F6',
  },
  debugToggleText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  feedbackBannerContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  feedbackBanner: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  feedbackText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  debugContainer: {
    backgroundColor: 'rgba(10, 14, 23, 0.94)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    maxHeight: 280,
    width: '96%',
    alignSelf: 'center',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  debugScroll: {
    maxHeight: 260,
  },
  debugHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 4,
    marginBottom: 4,
  },
  debugSectionTitle: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  debugControlRow: {
    flexDirection: 'row',
    gap: 6,
  },
  debugSmallBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  debugSmallBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  debugSmallBtnText: {
    color: '#F8FAFC',
    fontSize: 9,
    fontWeight: '700',
  },
  debugRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1.5,
    gap: 8,
  },
  debugLabel: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '600',
  },
  debugValue: {
    color: '#F8FAFC',
    fontSize: 9.5,
    fontWeight: '700',
  },
  debugHighlight: {
    color: '#38BDF8',
    fontSize: 9.5,
    fontWeight: '700',
  },
  debugSuccess: {
    color: '#10B981',
    fontSize: 9.5,
    fontWeight: '700',
  },
  debugSubtext: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '500',
  },
  debugWarning: {
    color: '#F59E0B',
  },
  debugRejectContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    marginVertical: 3,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  debugRejectLabel: {
    color: '#F59E0B',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  debugRejectText: {
    color: '#F1F5F9',
    fontSize: 9.5,
    fontWeight: '600',
  },
  centerHud: {
    alignItems: 'center',
    marginBottom: 8,
  },
  footerControls: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0A0E17',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  primaryActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryActionBtn: {
    flex: 2,
    height: 52,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnActive: {
    backgroundColor: '#F59E0B',
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryActionBtn: {
    flex: 1,
    height: 52,
    backgroundColor: '#131A29',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryActionText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
});
