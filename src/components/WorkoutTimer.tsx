import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface WorkoutTimerProps {
  durationSeconds: number;
  isActive?: boolean;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Clean timer component displaying workout duration.
 */
export function WorkoutTimer({
  durationSeconds,
  isActive = false,
}: WorkoutTimerProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.statusDot,
          isActive ? styles.statusDotActive : styles.statusDotPaused,
        ]}
      />
      <Text style={styles.timerText}>{formatDuration(durationSeconds)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 14, 23, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusDotPaused: {
    backgroundColor: '#F59E0B',
  },
  timerText: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
