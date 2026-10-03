/**
 * PushUp AI — Central Push-Up Engine Configuration
 *
 * Centralizes all biomechanical thresholds, confidence requirements,
 * state machine hysteresis boundaries, and timing parameters for Phase 3.
 */

// ---------------------------------------------------------------------------
// Biomechanical Angle Thresholds (Degrees)
// ---------------------------------------------------------------------------

/**
 * Minimum elbow angle to confirm entering the UP (lockout) state.
 * Typical push-up full lockout is ~160° - 180°.
 */
export const UP_ENTER_THRESHOLD = 155;

/**
 * Elbow angle threshold to transition from UP to GOING_DOWN.
 * Provides a 15° hysteresis gap below UP_ENTER_THRESHOLD to prevent jitter.
 */
export const UP_EXIT_THRESHOLD = 140;

/**
 * Maximum elbow angle required to confirm entering the BOTTOM state.
 * Represents standard push-up depth requirement (arms at or below 90°).
 */
export const DOWN_ENTER_THRESHOLD = 90;

/**
 * Elbow angle threshold to transition from BOTTOM to GOING_UP.
 * Provides a 15° hysteresis gap above DOWN_ENTER_THRESHOLD.
 */
export const DOWN_EXIT_THRESHOLD = 105;

/**
 * Target elbow angle for valid push-up depth validation.
 * Reps with minElbowAngle > DEPTH_THRESHOLD are marked NOT_DEEP_ENOUGH.
 */
export const DEPTH_THRESHOLD = 90;

/**
 * Minimum hip angle (Shoulder - Hip - Knee/Ankle) for good body alignment.
 * In a straight plank, angle is ~160° - 180°.
 * Angles below 145° indicate noticeable hip sagging or piking.
 */
export const ALIGNMENT_MIN_ANGLE = 145;

/**
 * Hip sag normalized vertical threshold relative to shoulder-knee line.
 * In normalized coords (y down), positive offset means hips are sagging toward floor.
 */
export const ALIGNMENT_SAG_OFFSET = 0.05;

/**
 * Hip pike normalized vertical threshold relative to shoulder-knee line.
 * Negative offset means hips are piked upward toward ceiling.
 */
export const ALIGNMENT_PIKE_OFFSET = -0.05;

// ---------------------------------------------------------------------------
// Confidence Thresholds
// ---------------------------------------------------------------------------

/**
 * Minimum confidence required for individual critical keypoints (shoulder, elbow, wrist).
 */
export const CONFIDENCE_THRESHOLD = 0.35;

/**
 * Minimum overall pose confidence score required to process push-up repetition.
 */
export const MIN_OVERALL_POSE_CONFIDENCE = 0.40;

// ---------------------------------------------------------------------------
// Temporal, Debounce & Stability Parameters
// ---------------------------------------------------------------------------

/**
 * Minimum consecutive matching frames required to trigger a state transition.
 * Filters out single-frame keypoint misdetections.
 */
export const MIN_CONSECUTIVE_FRAMES = 2;

/**
 * Minimum duration (ms) a state must be maintained before transitioning.
 */
export const MIN_STATE_DURATION_MS = 80;

/**
 * Minimum duration (ms) for a full valid repetition cycle (UP -> DOWN -> UP).
 * A repetition executed under 400ms is physically unrealistic and considered noise.
 */
export const MIN_REP_DURATION_MS = 400;

/**
 * Maximum duration (ms) for a single repetition cycle before timing out / incomplete.
 */
export const MAX_REP_DURATION_MS = 8000;

/**
 * Cooldown duration (ms) after rep completion to prevent accidental double-counting.
 */
export const REP_COOLDOWN_MS = 300;

/**
 * Exponential Moving Average (EMA) smoothing alpha [0..1] for angles.
 * 0.45 provides instant responsiveness (~1-2 frames latency) while filtering high-frequency noise.
 */
export const SMOOTHING_FACTOR = 0.45;

/**
 * Cooldown duration (ms) for real-time coach feedback text to prevent UI flashing.
 */
export const FEEDBACK_COOLDOWN_MS = 1200;
