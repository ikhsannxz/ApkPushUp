import { create } from 'zustand';
import { PushupState, RepValidationResult } from '../ai/pushup/types';

export type WorkoutStatus = 'idle' | 'active' | 'paused' | 'finished';

export interface WorkoutState {
  status: WorkoutStatus;
  isCameraActive: boolean;
  totalReps: number;
  validReps: number;
  invalidReps: number;
  durationSeconds: number;
  currentState: PushupState;
  currentFeedback: string;
  formScore: number;
  lastRepValidation: RepValidationResult | null;

  // Actions
  startWorkout: () => void;
  pauseWorkout: () => void;
  resumeWorkout: () => void;
  finishWorkout: () => void;
  resetWorkout: () => void;
  setCameraActive: (active: boolean) => void;
  toggleCameraActive: () => void;
  setCurrentState: (state: PushupState) => void;
  setFeedback: (feedback: string) => void;
  recordRep: (validation: RepValidationResult) => void;
  incrementRep: (isValid: boolean) => void;
  setDurationSeconds: (seconds: number) => void;
  tickTimer: () => void;
}

export const useWorkoutStore = create<WorkoutState>((set) => ({
  status: 'idle',
  isCameraActive: true,
  totalReps: 0,
  validReps: 0,
  invalidReps: 0,
  durationSeconds: 0,
  currentState: 'idle',
  currentFeedback: 'Ready',
  formScore: 100,
  lastRepValidation: null,

  startWorkout: () =>
    set({
      status: 'active',
      isCameraActive: true,
      totalReps: 0,
      validReps: 0,
      invalidReps: 0,
      durationSeconds: 0,
      currentState: 'ready',
      currentFeedback: 'Ready — Get into push-up position',
      formScore: 100,
      lastRepValidation: null,
    }),

  pauseWorkout: () => set({ status: 'paused' }),

  resumeWorkout: () => set({ status: 'active' }),

  finishWorkout: () =>
    set({
      status: 'finished',
      isCameraActive: false,
    }),

  resetWorkout: () =>
    set({
      status: 'idle',
      isCameraActive: false,
      totalReps: 0,
      validReps: 0,
      invalidReps: 0,
      durationSeconds: 0,
      currentState: 'idle',
      currentFeedback: 'Ready',
      formScore: 100,
      lastRepValidation: null,
    }),

  setCameraActive: (active: boolean) => set({ isCameraActive: active }),

  toggleCameraActive: () =>
    set((state) => ({ isCameraActive: !state.isCameraActive })),

  setCurrentState: (currentState: PushupState) => set({ currentState }),

  setFeedback: (currentFeedback: string) => set({ currentFeedback }),

  recordRep: (validation: RepValidationResult) =>
    set((state) => {
      const nextTotal = state.totalReps + 1;
      const nextValid = validation.isValid
        ? state.validReps + 1
        : state.validReps;
      const nextInvalid = !validation.isValid
        ? state.invalidReps + 1
        : state.invalidReps;

      // Running average form score calculation
      const prevTotalScore = state.formScore * state.totalReps;
      const nextAvgScore = Math.round(
        (prevTotalScore + validation.formScore) / nextTotal
      );

      return {
        totalReps: nextTotal,
        validReps: nextValid,
        invalidReps: nextInvalid,
        formScore: nextAvgScore,
        lastRepValidation: validation,
      };
    }),

  incrementRep: (isValid: boolean) =>
    set((state) => ({
      totalReps: state.totalReps + 1,
      validReps: isValid ? state.validReps + 1 : state.validReps,
      invalidReps: !isValid ? state.invalidReps + 1 : state.invalidReps,
    })),

  setDurationSeconds: (seconds: number) => set({ durationSeconds: seconds }),

  tickTimer: () =>
    set((state) => {
      if (state.status !== 'active') return state;
      return { durationSeconds: state.durationSeconds + 1 };
    }),
}));
