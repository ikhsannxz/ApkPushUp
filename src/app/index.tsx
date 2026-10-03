import React, { useEffect, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import { DeviceCapability, getDeviceCapability } from '../utils/device';
import { useWorkoutStore } from '../store/workout-store';

export default function HomeScreen(): React.JSX.Element {
  const [deviceCap, setDeviceCap] = useState<DeviceCapability | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const { startWorkout } = useWorkoutStore();

  useEffect(() => {
    let isMounted = true;
    getDeviceCapability().then((cap) => {
      if (isMounted) setDeviceCap(cap);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleStart = () => {
    startWorkout();
    router.push('/workout');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* App Title & Header */}
        <View style={styles.header}>
          <Text style={styles.brandTitle}>PushUp AI</Text>
          <Text style={styles.brandSubtitle}>
            Computer Vision Push-up Counter
          </Text>
        </View>

        {/* Device Capability Badge */}
        {deviceCap && (
          <View style={styles.capabilityBadge}>
            <View style={styles.dotIndicator} />
            <Text style={styles.capabilityText}>
              Engine Mode: {deviceCap.mode.toUpperCase()} ({deviceCap.targetFps} FPS Target
              {deviceCap.totalMemoryMb ? ` • ${deviceCap.totalMemoryMb} MB RAM` : ''})
            </Text>
          </View>
        )}

        {/* Camera Status Card */}
        <View style={styles.previewCard}>
          <View style={styles.previewIconBox}>
            <View style={styles.lensCircle} />
          </View>
          <Text style={styles.previewCardTitle}>Camera Ready</Text>
          <Text style={styles.previewCardDesc}>
            {permission?.granted
              ? 'Camera permission is granted. Tap below to begin real-time detection.'
              : 'Camera permission is required to detect body keypoints and count repetitions.'}
          </Text>

          {!permission?.granted && (
            <Pressable
              style={({ pressed }) => [
                styles.permissionBtn,
                pressed && styles.pressed,
              ]}
              onPress={requestPermission}
              accessibilityRole="button"
              accessibilityLabel="Grant camera access"
            >
              <Text style={styles.permissionBtnText}>Allow Camera Access</Text>
            </Pressable>
          )}
        </View>

        {/* Workout Setup Guidelines */}
        <View style={styles.setupGuide}>
          <Text style={styles.guideTitle}>Setup Guidelines</Text>
          <View style={styles.guideItem}>
            <Text style={styles.guideIndex}>1</Text>
            <Text style={styles.guideText}>
              Place your phone against a wall or bottle, 1.5–2 meters away.
            </Text>
          </View>
          <View style={styles.guideItem}>
            <Text style={styles.guideIndex}>2</Text>
            <Text style={styles.guideText}>
              Ensure your full body (head to toes) is visible in the frame.
            </Text>
          </View>
          <View style={styles.guideItem}>
            <Text style={styles.guideIndex}>3</Text>
            <Text style={styles.guideText}>
              Maintain good room lighting for accurate landmark tracking.
            </Text>
          </View>
        </View>

        {/* Primary Start Workout Action */}
        <View style={styles.bottomCta}>
          <Pressable
            style={({ pressed }) => [
              styles.startBtn,
              pressed && styles.pressed,
            ]}
            onPress={handleStart}
            accessibilityRole="button"
            accessibilityLabel="Start push-up workout"
          >
            <Text style={styles.startBtnText}>START WORKOUT</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0E17',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 36,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  capabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131A29',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 24,
    alignSelf: 'center',
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  capabilityText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  previewCard: {
    backgroundColor: '#131A29',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 24,
  },
  previewIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  lensCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#3B82F6',
  },
  previewCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  previewCardDesc: {
    fontSize: 13,
    lineHeight: 18,
    color: '#94A3B8',
    textAlign: 'center',
  },
  permissionBtn: {
    marginTop: 16,
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  setupGuide: {
    backgroundColor: '#131A29',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 28,
  },
  guideTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 14,
  },
  guideItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  guideIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1E293B',
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
    marginRight: 12,
  },
  guideText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#CBD5E1',
  },
  bottomCta: {
    marginTop: 'auto',
  },
  startBtn: {
    height: 56,
    backgroundColor: '#2563EB',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  pressed: {
    opacity: 0.8,
  },
});
