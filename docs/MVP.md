# PushUp AI — MVP Specification

## 1. Tujuan MVP

MVP bertujuan membuktikan bahwa smartphone dapat digunakan untuk:

1. mengambil video dari kamera;
2. mendeteksi pose tubuh;
3. menghitung push-up secara real-time;
4. membedakan valid dan invalid repetition;
5. menyimpan hasil workout;
6. menampilkan statistik dasar.

## 2. MVP Scope

### Included

- onboarding sederhana;
- camera permission;
- camera preview;
- body/pose detection;
- skeleton overlay;
- push-up state machine;
- repetition counter;
- valid/invalid detection;
- basic form feedback;
- timer;
- workout result;
- local workout history;
- daily statistics;
- device capability detection;
- offline-first local storage.

### Excluded

- friend system;
- competition;
- leaderboard;
- WebSocket;
- chat;
- social feed;
- payment;
- AI coach;
- cloud video storage;
- advanced ML sequence model.

## 3. User Flow MVP

```text
Open App
   ↓
Home
   ↓
Start Workout
   ↓
Camera Permission
   ↓
Camera Calibration
   ↓
3...2...1...GO
   ↓
Pose Detection
   ↓
Push-Up Detection
   ↓
Count + Validation + Feedback
   ↓
Finish Workout
   ↓
Workout Result
   ↓
Save Locally
   ↓
Daily Statistics
```

## 4. Functional Requirements

### FR-01 Camera Permission

System meminta permission kamera.

Acceptance criteria:

- permission request muncul;
- jika denied, user mendapat instruksi;
- aplikasi tidak crash.

### FR-02 Pose Detection

System memperoleh keypoints minimal:

- shoulder;
- elbow;
- wrist;
- hip.

### FR-03 Skeleton

Keypoints dapat divisualisasikan pada camera preview untuk debugging.

### FR-04 Push-Up State

Minimal state:

```text
READY
UP
DOWN
INVALID
```

### FR-05 Rep Counting

Valid repetition:

```text
UP → DOWN → UP
```

Sistem tidak boleh menghitung:

- setengah gerakan;
- gerakan terlalu cepat tanpa valid transition;
- noise keypoint;
- satu gerakan lebih dari satu kali.

### FR-06 Validation

Validation mempertimbangkan:

- elbow angle;
- movement depth;
- keypoint confidence;
- body visibility;
- body alignment;
- movement completion.

### FR-07 Feedback

Feedback ditampilkan secara real-time.

### FR-08 Timer

Workout memiliki timer.

### FR-09 Result

Result minimal:

- total reps;
- valid reps;
- invalid reps;
- duration;
- form score.

### FR-10 Local Storage

Workout dapat disimpan tanpa internet.

### FR-11 Daily Statistics

Sistem menghitung:

- valid reps hari ini;
- total sessions;
- invalid reps;
- average form score;
- streak.

## 5. Device Adaptation

Aplikasi tidak dibuat khusus untuk satu smartphone.

Contoh:

```text
Device Capability
        ↓
┌───────────────┐
│ Lite          │
│ Standard      │
│ High          │
└───────────────┘
```

Capability dapat mempertimbangkan:

- RAM;
- CPU/GPU capability;
- camera capability;
- available FPS;
- inference latency.

## 6. MVP Acceptance Criteria

### Camera

- camera preview berjalan;
- permission handling berjalan;
- full-body positioning dapat dilakukan.

### Pose

- body dapat dideteksi;
- keypoints tersedia;
- confidence tersedia;
- skeleton dapat ditampilkan.

### Counting

- UP terdeteksi;
- DOWN terdeteksi;
- UP → DOWN → UP menghasilkan satu valid rep;
- partial rep tidak dihitung;
- duplicate count dicegah.

### Validation

- invalid rep dapat ditandai;
- alasan invalid dapat ditentukan;
- feedback tampil.

### Workout

- timer berjalan;
- workout dapat dihentikan;
- result dapat ditampilkan;
- result tersimpan.

### Offline

- workout dapat dilakukan tanpa internet;
- data tersimpan lokal;
- data tidak hilang ketika app ditutup.

## 7. MVP Technical Architecture

```text
Camera
  ↓
Pose Model
  ↓
Keypoints
  ↓
PushUp Engine
  ├── State Machine
  ├── Validation
  └── Feedback
  ↓
Workout Result
  ↓
Local Storage
```

Backend belum menjadi dependency wajib untuk workout dasar.

## 8. MVP Testing Devices

Minimal:

1. low-end Android;
2. mid-range Android;
3. flagship Android.

Target awal dapat menggunakan Android terlebih dahulu sebelum memperluas ke iOS.

## 9. Definition of Done

MVP dianggap selesai ketika semua acceptance criteria terpenuhi dan aplikasi berhasil diuji pada minimal tiga kelas perangkat.
