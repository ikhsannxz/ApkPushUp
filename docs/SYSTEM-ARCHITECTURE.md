# PushUp AI — System Architecture

## 1. Architecture Overview

PushUp AI menggunakan arsitektur mobile-first dengan on-device computer vision.

```text
┌─────────────────────────────────────────────────────────┐
│                       MOBILE APP                        │
│                React Native + Expo + TS                 │
│                                                         │
│  Camera Preview (Expo Camera)                           │
│        ↓                                                │
│  Frame Sampler (Adaptive rate: Lite/Standard/High)      │
│        ↓                                                │
│  MoveNet SinglePose Lightning (On-Device Inference)     │
│        ↓                                                │
│  17 Normalized Keypoints [0..1]                         │
│        ↓                                                │
│  Push-Up Engine (Phase 4–5) → Workout Result            │
│        ↓                                                │
│  Local Storage (Offline-First)                          │
└────────────────────────────┬────────────────────────────┘
                      │
                 HTTPS / REST
                      │
┌─────────────────────▼────────────────────────┐
│                 DJANGO                       │
│          Django + Django REST Framework      │
│                                              │
│ Accounts | Workouts | Statistics             │
│ Devices  | Competitions | API                │
└─────────────────────┬────────────────────────┘
                      │
                 Django ORM
                      │
┌─────────────────────▼────────────────────────┐
│                PostgreSQL                    │
└──────────────────────────────────────────────┘
```

## 2. ML Architecture

```text
Training Dataset
      ↓
Python
      ↓
OpenCV
      ↓
Pose Extraction
      ↓
Feature Engineering
      ↓
PyTorch
      ↓
Training / Evaluation
      ↓
ONNX Export
      ↓
Mobile Inference
```

## 3. Repository Architecture

```text
pushup-ai/
├── mobile/
├── backend/
├── ml/
├── docs/
├── docker-compose.yml
└── README.md
```

## 4. Mobile Architecture

```text
mobile/
├── app/
├── src/
│   ├── ai/
│   ├── camera/
│   ├── workout/
│   ├── components/
│   ├── store/
│   ├── storage/
│   ├── api/
│   └── utils/
└── package.json
```

Responsibilities:

### Camera

Mengambil camera frames.

### AI

Menjalankan pose inference.

### Workout

Mengolah keypoints menjadi:

- state;
- repetition;
- validity;
- feedback.

### Storage

Menyimpan workout offline.

### API

Melakukan synchronization ke backend.

## 5. Backend Architecture

```text
backend/
├── config/
├── accounts/
├── workouts/
├── statistics/
├── devices/
├── competitions/
└── api/
```

### accounts

- user;
- authentication;
- profile.

### workouts

- workout sessions;
- repetitions.

### statistics

- daily aggregation;
- streak.

### devices

- device registration;
- model version;
- capability mode.

### competitions

Tahap lanjutan:

- challenges;
- participants;
- leaderboard.

## 6. Backend Responsibilities

Backend menjadi source of truth untuk:

- account;
- workout records setelah sync;
- competition;
- leaderboard;
- server-side authorization.

Backend tidak perlu menerima raw camera video untuk workout normal.

## 7. Offline-First

Workout dapat berjalan tanpa internet.

```text
Workout
  ↓
Local Database
  ↓
Sync Queue
  ↓
Internet Available
  ↓
Django API
  ↓
PostgreSQL
```

Jika sync gagal:

- data tetap lokal;
- retry dilakukan kemudian;
- tidak membuat duplicate workout.

## 8. Realtime Competition

Tahap future:

```text
Mobile
  ↕
WebSocket
  ↕
Django Channels
  ↕
Redis
  ↕
Competition State
```

WebSocket digunakan untuk update leaderboard dan competition state.

## 9. ML Deployment

Model:

```text
PyTorch
   ↓
ONNX
   ↓
ONNX Runtime
   ↓
Mobile
```

Setiap model memiliki:

- model version;
- input specification;
- output specification;
- supported device mode;
- validation metrics.

## 10. Security

Prinsip:

- HTTPS;
- token authentication;
- server-side authorization;
- rate limiting;
- validation;
- no trust in client-submitted competition score;
- model version recorded.

## 11. Privacy

Default:

- raw video tidak disimpan;
- raw video tidak dikirim;
- keypoints hanya digunakan untuk inference;
- workout metadata disimpan.

Jika dataset training membutuhkan video pengguna, harus ada mekanisme consent terpisah.

## 12. Scalability

MVP:

```text
Mobile → Django → PostgreSQL
```

Scale-up:

```text
Mobile
 ↓
Load Balancer
 ↓
Django instances
 ↓
Redis
 ↓
PostgreSQL
```

Object storage dapat ditambahkan jika suatu saat diperlukan untuk dataset atau media yang memang diizinkan.
