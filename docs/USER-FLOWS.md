# PushUp AI — User Flows

## 1. Main Navigation

```text
Home
├── Start Workout
├── Today's Statistics
├── Recent Workouts
└── Profile / Settings
```

## 2. Start Workout Flow

```text
Home
  ↓
Tap "Start Workout"
  ↓
Check Camera Permission
  ├── Granted → Calibration
  └── Denied → Permission Help
  ↓
Camera Calibration
  ↓
Body Detected?
  ├── No → Move / Reposition Feedback
  └── Yes
       ↓
3...2...1...GO
       ↓
Workout
```

## 3. Calibration Flow

Tujuan calibration adalah memastikan tubuh terlihat dengan baik sebelum counting dimulai.

```text
Camera
  ↓
Detect Body
  ↓
Check Visibility
  ↓
Check Position
  ↓
Ready
```

Feedback:

- Move backward;
- Move closer;
- Full body must be visible;
- Body detected;
- Ready.

## 4. Workout Flow

```text
Workout Start
   ↓
Pose Frame
   ↓
Extract Keypoints
   ↓
Calculate Features
   ↓
Determine State
   ↓
Validate Movement
   ↓
Rep?
 ┌─┴──────────┐
 No           Yes
 ↓             ↓
Continue     Valid/Invalid
                ↓
             Counter
                ↓
             Feedback
```

## 5. Push-Up State Flow

```text
READY
  ↓
UP
  ↓
DOWN
  ↓
UP
  ↓
VALID REP + 1
  ↓
Continue
```

Invalid example:

```text
UP
 ↓
DOWN but depth insufficient
 ↓
INVALID
 ↓
Feedback: "Go lower"
```

## 6. Finish Workout

```text
Workout
  ↓
Tap Finish
  ↓
Confirm?
 ├── No → Resume
 └── Yes
      ↓
Calculate Result
      ↓
Save Local
      ↓
Workout Result
```

## 7. Workout Result Flow

Result contains:

- valid reps;
- invalid reps;
- total attempts;
- duration;
- form score;
- date/time.

```text
Workout Result
├── Summary
├── Form Score
├── Rep Breakdown
└── Back to Home
```

## 8. Daily Statistics Flow

```text
Home
  ↓
Today's Stats
  ↓
Daily Summary
  ├── Valid Reps
  ├── Sessions
  ├── Invalid Reps
  ├── Average Form
  └── Streak
```

## 9. Offline Flow

```text
Workout
  ↓
No Internet
  ↓
Run Normally
  ↓
Save Local
  ↓
Connection Available
  ↓
Sync Queue
  ↓
Backend
```

## 10. Future Competition Flow

```text
Home
 ↓
Competition
 ↓
Select Friend
 ↓
Select Challenge
 ├── Target Reps
 ├── Timed Battle
 └── Daily Total
 ↓
Accept Challenge
 ↓
Workout
 ↓
Submit Valid Reps
 ↓
Server Validation
 ↓
Leaderboard
```

## 11. Error Flows

### Body Not Detected

```text
Workout
 ↓
No body
 ↓
Show feedback
 ↓
Pause counting
 ↓
Body detected
 ↓
Resume
```

### Low Confidence

```text
Pose Confidence Low
 ↓
Do not count
 ↓
Show "Move into view"
```

### Camera Permission Denied

```text
Permission Denied
 ↓
Explain why camera is needed
 ↓
Open Settings
```
