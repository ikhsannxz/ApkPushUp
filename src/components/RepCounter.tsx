import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PushupState } from '../ai/pushup/types';

export interface RepCounterProps {
  totalReps: number;
  validReps: number;
  invalidReps: number;
  formScore?: number;
  currentState?: PushupState;
}

function formatStateLabel(state?: PushupState): string {
  switch (state) {
    case 'ready':
      return 'READY';
    case 'up':
      return 'TOP (UP)';
    case 'going_down':
      return 'GOING DOWN';
    case 'bottom':
      return 'BOTTOM';
    case 'going_up':
      return 'PUSHING UP';
    case 'completed':
      return 'REP!';
    default:
      return 'IDLE';
  }
}

/**
 * Clean HUD component displaying rep counts, state indicator, and form score.
 */
export function RepCounter({
  totalReps,
  validReps,
  invalidReps,
  formScore,
  currentState,
}: RepCounterProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.primaryMetric}>
        <Text style={styles.repsCount}>{validReps}</Text>
        <Text style={styles.repsLabel}>VALID REPS</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.subMetrics}>
        <View style={styles.subMetricItem}>
          <Text style={styles.totalText}>{totalReps}</Text>
          <Text style={styles.subMetricLabel}>TOTAL</Text>
        </View>

        <View style={styles.subMetricItem}>
          <Text style={styles.invalidText}>{invalidReps}</Text>
          <Text style={styles.subMetricLabel}>NO REP</Text>
        </View>

        {formScore !== undefined && (
          <View style={styles.subMetricItem}>
            <Text style={styles.scoreText}>{formScore}%</Text>
            <Text style={styles.subMetricLabel}>FORM</Text>
          </View>
        )}
      </View>

      {currentState && currentState !== 'idle' && (
        <>
          <View style={styles.divider} />
          <View style={styles.stateTag}>
            <View style={styles.stateDot} />
            <Text style={styles.stateText}>{formatStateLabel(currentState)}</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 14, 23, 0.88)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  primaryMetric: {
    alignItems: 'center',
    paddingRight: 14,
  },
  repsCount: {
    color: '#10B981',
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 38,
  },
  repsLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 12,
  },
  subMetrics: {
    flexDirection: 'row',
    gap: 14,
  },
  subMetricItem: {
    alignItems: 'center',
  },
  totalText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  invalidText: {
    color: '#EF4444',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  scoreText: {
    color: '#38BDF8',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  subMetricLabel: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  stateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stateDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#38BDF8',
    marginRight: 6,
  },
  stateText: {
    color: '#E2E8F0',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
