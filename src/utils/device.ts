import * as Device from 'expo-device';

export type DevicePerformanceMode = 'lite' | 'standard' | 'high';

export interface DeviceCapability {
  mode: DevicePerformanceMode;
  targetFps: number;
  inputResolution: {
    width: number;
    height: number;
  };
  totalMemoryMb: number | null;
  deviceModel: string | null;
  osVersion: string | null;
}

/**
 * Agnostic hardware capability evaluator.
 * Determines performance tier based on hardware metrics (e.g. RAM, platform)
 * rather than hardcoded device names.
 */
export async function getDeviceCapability(): Promise<DeviceCapability> {
  const totalMemory = Device.totalMemory;
  const totalMemoryMb = totalMemory ? Math.round(totalMemory / (1024 * 1024)) : null;
  const deviceModel = Device.modelName ?? null;
  const osVersion = Device.osVersion ?? null;

  // Agnostic heuristic:
  // RAM < 3500MB (~3GB or lower) -> 'lite' (target 15 FPS, smaller inference input)
  // RAM between 3500MB and 6000MB (~4GB - 6GB) -> 'standard' (target 24 FPS)
  // RAM > 6000MB or high-end flagships -> 'high' (target 30 FPS)
  if (totalMemoryMb !== null && totalMemoryMb < 3500) {
    return {
      mode: 'lite',
      targetFps: 15,
      inputResolution: { width: 256, height: 256 },
      totalMemoryMb,
      deviceModel,
      osVersion,
    };
  }

  if (totalMemoryMb !== null && totalMemoryMb <= 6000) {
    return {
      mode: 'standard',
      targetFps: 24,
      inputResolution: { width: 384, height: 384 },
      totalMemoryMb,
      deviceModel,
      osVersion,
    };
  }

  return {
    mode: 'high',
    targetFps: 30,
    inputResolution: { width: 512, height: 512 },
    totalMemoryMb,
    deviceModel,
    osVersion,
  };
}
