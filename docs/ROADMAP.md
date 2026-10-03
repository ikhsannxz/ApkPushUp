# PushUp AI — Development Roadmap

## 1. Overall Roadmap

```text
Phase 0  → Documentation
Phase 1  → Mobile Foundation
Phase 2  → Pose Detection
Phase 3  → Push-Up Engine
Phase 4  → Workout & Offline
Phase 5  → Django Backend
Phase 6  → ML Dataset & Training
Phase 7  → Model Deployment
Phase 8  → Competition
Phase 9  → Production
```

## 2. Phase 0 — Documentation

Deliverables:

- PRD.md;
- MVP.md;
- USER-FLOWS.md;
- SYSTEM-ARCHITECTURE.md;
- ERD.md;
- DATABASE-SCHEMA.md;
- ML-PLAN.md;
- ROADMAP.md.

Status:

`Foundation`

## 3. Phase 1 — Mobile Foundation

Stack:

- React Native;
- Expo;
- TypeScript.

Tasks:

- initialize project;
- navigation;
- camera permission;
- camera preview;
- basic UI;
- device capability abstraction.

Output:

Camera dapat digunakan di Android.

## 4. Phase 2 — Pose Detection

Tasks:

- integrate pose model;
- process camera frames;
- obtain keypoints;
- skeleton overlay;
- confidence handling;
- performance benchmark.

Output:

Body pose terlihat secara real-time.

## 5. Phase 3 — Push-Up Engine

Tasks:

- calculate elbow angle;
- calculate body alignment;
- define configurable thresholds;
- implement state machine;
- implement debounce/hysteresis;
- count valid reps;
- detect invalid reps;
- feedback.

Output:

Push-up counter bekerja.

## 6. Phase 4 — Workout & Offline

Tasks:

- workout timer;
- workout result;
- local database;
- history;
- daily statistics;
- streak;
- offline-first flow;
- sync queue foundation.

Output:

User dapat latihan dan melihat riwayat tanpa internet.

## 7. Phase 5 — Django Backend

Stack:

- Django;
- Django REST Framework;
- PostgreSQL.

Tasks:

- authentication;
- profiles;
- devices;
- workouts API;
- repetitions API;
- statistics API;
- sync endpoint;
- idempotency;
- authorization.

Output:

Mobile dapat sync dengan backend.

## 8. Phase 6 — ML Dataset & Training

Tasks:

- collect/prepare permitted dataset;
- annotation;
- preprocessing;
- feature extraction;
- baseline evaluation;
- classification experiments;
- error analysis.

Output:

Dataset version + baseline model.

## 9. Phase 7 — Model Deployment

Tasks:

- export model;
- ONNX validation;
- mobile inference;
- benchmark;
- model versioning;
- adaptive model/device mode.

Output:

ML model dapat digunakan on-device.

## 10. Phase 8 — Competition

Tasks:

- friends;
- friend requests;
- challenges;
- competition creation;
- valid rep submission;
- leaderboard;
- Django Channels;
- Redis;
- WebSocket.

Competition modes:

### Target

First to target valid reps.

### Timed

Most valid reps within a fixed duration.

### Daily

Most valid reps during a day.

## 11. Phase 9 — Production

Tasks:

- crash monitoring;
- performance monitoring;
- security audit;
- API rate limiting;
- database optimization;
- privacy review;
- release build;
- Play Store preparation;
- iOS preparation.

## 12. Suggested Development Order

Prioritas:

```text
1. Camera
2. Pose
3. Keypoints
4. Push-up counting
5. Validation
6. Workout result
7. Local storage
8. Daily stats
9. Django API
10. ML improvement
11. Competition
```

Jangan membangun competition sebelum counting dan validation stabil.

## 13. Milestones

### Milestone A — Camera Demo

Camera bekerja.

### Milestone B — Pose Demo

Skeleton real-time.

### Milestone C — Push-Up Counter

Valid repetition dihitung.

### Milestone D — Personal Tracker

Workout dan history tersedia.

### Milestone E — Connected App

Django + PostgreSQL sync.

### Milestone F — ML Version

Model yang dilatih dengan dataset mulai digunakan.

### Milestone G — Competition

Teman dapat berkompetisi menggunakan valid reps.

## 14. Definition of Production Readiness

Sebelum production:

- counting diuji pada banyak pengguna;
- berbagai kondisi cahaya diuji;
- berbagai posisi kamera diuji;
- low/mid/high-end devices diuji;
- offline sync diuji;
- duplicate sync diuji;
- authentication diuji;
- competition score divalidasi server;
- privacy requirements terdokumentasi;
- model version tercatat.

## 15. Guiding Principle

Bangun dari:

```text
Reliable Core
     ↓
Useful Product
     ↓
Better ML
     ↓
Competition
     ↓
Scale
```

Jangan memulai dari model ML yang kompleks sebelum masalah dasar counting, validation, performance, dan UX terbukti.
