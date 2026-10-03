import React from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useWorkoutStore } from '../store/workout-store';

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export default function ResultScreen(): React.JSX.Element {
  const {
    totalReps,
    validReps,
    invalidReps,
    durationSeconds,
    formScore,
    resetWorkout,
    startWorkout,
  } = useWorkoutStore();

  const accuracy =
    totalReps > 0 ? Math.round((validReps / totalReps) * 100) : 0;

  const handleStartAgain = () => {
    resetWorkout();
    startWorkout();
    router.replace('/workout');
  };

  const handleDone = () => {
    resetWorkout();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Workout Summary</Text>
          <Text style={styles.subtitle}>Session completed</Text>
        </View>

        {/* Primary Reps Metric Card */}
        <View style={styles.primaryMetricCard}>
          <Text style={styles.repsNumber}>{validReps}</Text>
          <Text style={styles.repsLabel}>VALID PUSH-UPS</Text>
        </View>

        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{totalReps}</Text>
            <Text style={styles.metricLabel}>Total Attempts</Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, styles.invalidColor]}>
              {invalidReps}
            </Text>
            <Text style={styles.metricLabel}>No Reps</Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, styles.accentColor]}>
              {accuracy}%
            </Text>
            <Text style={styles.metricLabel}>Accuracy</Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, styles.formScoreColor]}>
              {formScore}%
            </Text>
            <Text style={styles.metricLabel}>Avg Form Score</Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>
              {formatDuration(durationSeconds)}
            </Text>
            <Text style={styles.metricLabel}>Duration</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.pressed,
            ]}
            onPress={handleStartAgain}
            accessibilityRole="button"
            accessibilityLabel="Start another workout session"
          >
            <Text style={styles.primaryBtnText}>Start Another Session</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && styles.pressed,
            ]}
            onPress={handleDone}
            accessibilityRole="button"
            accessibilityLabel="Return to home dashboard"
          >
            <Text style={styles.secondaryBtnText}>Back to Dashboard</Text>
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
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  primaryMetricCard: {
    backgroundColor: '#131A29',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginVertical: 16,
  },
  repsNumber: {
    fontSize: 72,
    fontWeight: '900',
    color: '#10B981',
    lineHeight: 80,
  },
  repsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1.5,
    marginTop: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginVertical: 12,
  },
  metricItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#131A29',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  accentColor: {
    color: '#3B82F6',
  },
  formScoreColor: {
    color: '#38BDF8',
  },
  invalidColor: {
    color: '#EF4444',
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 8,
  },
  primaryBtn: {
    height: 52,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    height: 52,
    backgroundColor: '#131A29',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
});
