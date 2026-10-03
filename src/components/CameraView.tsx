import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CameraRatio,
  CameraType,
  CameraView as ExpoCameraView,
  useCameraPermissions,
} from 'expo-camera';
import { CameraFrame } from '../ai/pose/types';

export interface CameraViewProps {
  isActive?: boolean;
  facing?: CameraType;
  zoom?: number;
  ratio?: CameraRatio;
  onFacingChange?: (facing: CameraType) => void;
  onCameraReady?: () => void;
  children?: React.ReactNode;
}

export interface CameraViewHandle {
  captureFrame: () => Promise<CameraFrame | null>;
}

export const CameraView = forwardRef<CameraViewHandle, CameraViewProps>(
  function CameraView(
    {
      isActive = true,
      facing = 'front',
      zoom = 0,
      ratio = '16:9',
      onFacingChange,
      onCameraReady,
      children,
    },
    ref
  ): React.JSX.Element {
    const [permission, requestPermission] = useCameraPermissions();
    const [appState, setAppState] = useState<AppStateStatus>(
      AppState.currentState
    );
    const cameraRef = useRef<ExpoCameraView | null>(null);

    // Monitor AppState to safely release hardware camera in background
    useEffect(() => {
      const subscription = AppState.addEventListener('change', (nextState) => {
        setAppState(nextState);
      });
      return () => {
        subscription.remove();
      };
    }, []);

    const shouldRenderCamera = isActive && appState === 'active';

    // Expose captureFrame to allow the pose inference pipeline to sample frames
    useImperativeHandle(
      ref,
      () => ({
        async captureFrame(): Promise<CameraFrame | null> {
          if (!shouldRenderCamera) {
            return null;
          }

          // On Web, extract HTMLVideoElement directly for zero-latency pose estimation
          if (Platform.OS === 'web' && typeof document !== 'undefined') {
            const video = document.querySelector('video');
            if (video && video.readyState >= 2 && video.videoWidth > 0) {
              return {
                width: video.videoWidth,
                height: video.videoHeight,
                timestamp: Date.now(),
                element: video,
              };
            }
          }

          if (!cameraRef.current) {
            return null;
          }
          try {
            const photo = await cameraRef.current.takePictureAsync({
              shutterSound: false,
              quality: 0.3, // Low quality for rapid decoding and minimal memory usage
              skipProcessing: true, // Skip post-processing pipeline for maximum throughput
              base64: true,
            });
            const rawBase64 =
              photo.base64 ||
              (photo.uri?.startsWith('data:')
                ? photo.uri.split(',')[1]
                : photo.uri);

            return {
              base64: rawBase64,
              uri: photo.uri,
              width: photo.width,
              height: photo.height,
              timestamp: Date.now(),
            };
          } catch {
            return null;
          }
        },
      }),
      [shouldRenderCamera]
    );

    // 1. Loading permission state
    if (!permission) {
      return (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.statusText}>Checking camera permission...</Text>
        </View>
      );
    }

    // 2. Permission denied permanently (requires opening settings)
    if (!permission.granted && !permission.canAskAgain) {
      return (
        <View style={styles.centeredContainer}>
          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>Camera access is disabled.</Text>
            <Text style={styles.permissionDescription}>
              PushUp AI needs access to your camera to detect your body and count push-ups.
              Please enable camera access in your system settings.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => Linking.openSettings()}
              accessibilityRole="button"
              accessibilityLabel="Open Settings"
            >
              <Text style={styles.primaryButtonText}>Open Settings</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    // 3. Permission not granted yet (can request)
    if (!permission.granted) {
      return (
        <View style={styles.centeredContainer}>
          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>Camera permission is required</Text>
            <Text style={styles.permissionDescription}>
              Camera permission is required to detect your push-ups.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={requestPermission}
              accessibilityRole="button"
              accessibilityLabel="Allow Camera"
            >
              <Text style={styles.primaryButtonText}>Allow Camera</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    // 4. Camera preview (or paused state when screen leaves or app is backgrounded)
    return (
      <View style={styles.cameraWrapper}>
        {shouldRenderCamera ? (
          <ExpoCameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            zoom={zoom}
            ratio={ratio}
            onCameraReady={onCameraReady}
          >
            {children}
          </ExpoCameraView>
        ) : (
          <View style={styles.inactivePlaceholder}>
            <Text style={styles.inactiveText}>Camera is paused</Text>
            <Text style={styles.inactiveSubtext}>
              Preview will resume automatically when screen is active
            </Text>
          </View>
        )}

        {/* Camera flip toggle button */}
        {onFacingChange && shouldRenderCamera && (
          <View style={styles.flipButtonContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() =>
                onFacingChange(facing === 'front' ? 'back' : 'front')
              }
              accessibilityRole="button"
              accessibilityLabel="Flip camera"
            >
              <Text style={styles.secondaryButtonText}>
                Flip to {facing === 'front' ? 'Back' : 'Front'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  cameraWrapper: {
    flex: 1,
    backgroundColor: '#05070B',
    position: 'relative',
    overflow: 'hidden',
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: '#0A0E17',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  permissionCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#131A29',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F9FAFB',
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  statusText: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 14,
  },
  inactivePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0E17',
    padding: 24,
  },
  inactiveText: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  inactiveSubtext: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
  flipButtonContainer: {
    position: 'absolute',
    top: 56,
    right: 16,
    zIndex: 20,
  },
  secondaryButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '600',
  },
});
