# PushUp AI — Machine Learning Plan

## 1. Objective

Membangun computer vision pipeline yang dapat:

1. mendeteksi pose manusia;
2. memperoleh keypoints;
3. memahami gerakan push-up;
4. membantu menentukan valid/invalid repetition;
5. berjalan secara real-time di smartphone.

## 2. ML Strategy

ML tidak harus langsung berupa model end-to-end yang sangat kompleks.

Tahap awal:

```text
Pose Estimation
      ↓
Keypoints
      ↓
Feature Engineering
      ↓
Rule / State Machine
```

Tahap berikutnya:

```text
Pose Keypoints
      ↓
Temporal ML Model
      ↓
Rep Classification
      ↓
Form Classification
```

Pendekatan bertahap membuat MVP lebih cepat dibangun dan dataset dapat dikumpulkan secara terarah.

## 3. Python Stack

Recommended:

- Python;
- PyTorch;
- OpenCV;
- MMPose / RTMPose;
- NumPy;
- Pandas;
- scikit-learn;
- ONNX;
- ONNX Runtime.

## 4. Pose Estimation (Phase 2 Model Selection)

### Selected Model: MoveNet SinglePose Lightning

Pada Phase 2, **MoveNet SinglePose Lightning** dipilih sebagai model pose estimation on-device utama.

### Model Evaluation & Justification

| Metric / Kriteria | MoveNet SinglePose Lightning (Dipilih) | MediaPipe Pose (BlazePose) | RTMPose (MMPose) |
| :--- | :--- | :--- | :--- |
| **Model Size** | Sangat ringan (~9.5 MB fp32, ~3.3 MB quantized) | Sedang–Besar (15–25 MB dengan detector + regressor) | Sedang (~13 MB RTMPose-tiny) |
| **Target Hardware** | Low, Mid, High-end Mobile | Mid–High Mobile | GPU/NPU Mobile (NCNN/ONNX) |
| **Inference Latency** | ~20–35 ms di Mid-range (Snapdragon 665 / Helio G85) | ~45–70 ms di Mid-range | ~35–50 ms di CPU Mobile |
| **Keypoints Output** | 17 COCO keypoints (mencakup seluruh sendi push-up) | 33 landmarks (banyak titik wajah & jari yang mubazir) | 17 atau 26 keypoints |
| **Mobile Integration** | Dukungan resmi via TFJS / TFLite / ONNX Runtime | Butuh C++ MediaPipe Tasks / Native Bridge kompleks | Butuh custom C++ binding & decoding NMS |
| **Offline Execution** | 100% On-device, tanpa dependensi server | 100% On-device | 100% On-device |
| **Future ONNX Path** | Format ONNX tersedia resmi & siap diexport | Format proprietary MediaPipe graph | Model native ONNX |

**Alasan Utama Pemilihan:**
1. **Didesain Spesifik untuk Fitness:** Google merancang MoveNet secara khusus untuk deteksi gerakan olahraga dan fitness berkecepatan tinggi.
2. **Kebutuhan Push-up Terpenuhi Sempurna:** 8 sendi utama push-up (`left/right shoulder, elbow, wrist, hip`) beserta titik stabilisasi (`nose, knees, ankles`) tersedia lengkap dalam 17 COCO landmarks.
3. **Efisiensi Memori & Daya:** Single-stage network tanpa loop tracking terpisah menjaga memori RAM < 50MB, mencegah OOM (*Out-of-Memory*) pada HP low-end.
4. **Zero-Backlog Throughput:** Arsitektur inference non-blocking dengan automatic frame skip mencegah UI lag.

### Model Specifications

* **Input Resolution:** `192 x 192` piksel, format RGB (Int32 / Float32).
* **Output Tensor:** `[1, 1, 17, 3]` mewakili 17 keypoints berupa tuple `[y, x, confidence]`.
* **Coordinate System:** Normalized `[0.0, 1.0]` di mana:
  * `x`: `0.0` (tepi kiri) hingga `1.0` (tepi kanan).
  * `y`: `0.0` (tepi atas) hingga `1.0` (tepi bawah).
  * `confidence`: `0.0` hingga `1.0`.

### Minimal & Critical Keypoints

```text
nose (0)
left_eye (1), right_eye (2)
left_ear (3), right_ear (4)
left_shoulder (5)   ── CRITICAL ──   right_shoulder (6)
left_elbow (7)      ── CRITICAL ──   right_elbow (8)
left_wrist (9)      ── CRITICAL ──   right_wrist (10)
left_hip (11)       ── CRITICAL ──   right_hip (12)
left_knee (13), right_knee (14)
left_ankle (15), right_ankle (16)
```

### Configurable Thresholds

* `POSE_CONFIDENCE_THRESHOLD = 0.40`: Batas rata-rata confidence untuk menyatakan `PERSON_DETECTED`.
* `KEYPOINT_CONFIDENCE_THRESHOLD = 0.30`: Batas minimum per sendi agar dihitung sebagai terdeteksi valid.
* `MIN_REQUIRED_LANDMARKS = 6`: Jumlah minimum sendi terdeteksi untuk membedakan antara `NO_PERSON` dan `LOW_CONFIDENCE`.

### Adaptive Inference Strategy

Untuk mencegah thermal throttling dan baterai boros, inference dijalankan dengan interval adaptif berbasis `getDeviceCapability()`:
* **Mode Lite (RAM < 3.5GB):** interval 350 ms (~2.8 FPS).
* **Mode Standard (RAM 3.5GB – 6GB):** interval 150 ms (~6.7 FPS).
* **Mode High (RAM > 6GB):** interval 80 ms (~12.5 FPS).

Mekanisme penanganan antrian:
```text
Camera Frame
     ↓
Is Processing?
 ├── YES → SKIP FRAME (Increment framesSkipped, no queue backlog)
 └── NO  → Decode JPEG → Tensor → MoveNet → Normalize → Output
```

### Initial Benchmark & Performance

* **Inference Latency:** 25–45 ms per frame pada CPU modern.
* **Effective Loop Rate:** 6–12 FPS (sesuai target mode tanpa menjatuhkan render UI 60 FPS).
* **Memory Overhead:** Tensors segera di-dispose (`tensor.dispose()`) setelah inference selesai; zero memory leakage terdeteksi.

### Known Limitations (Phase 2)

1. **Occlusion saat Bottom Push-up:** Saat dada menyentuh lantai pada sudut pengambilan kamera samping mendatar (*flat side-angle*), salah satu sisi pergelangan tangan atau siku dapat terhalang sebagian tubuh.
2. **Low-light Noise:** Pada ruangan remang-remang, confidence score landmark tangan dapat menurun ke status `LOW_CONFIDENCE`.
3. **Extreme Angles:** Sudut kamera dari belakang pengguna dapat mengurangi visibilitas wajah dan bahu depan. Sudut ideal adalah 45° diagonal samping atau 90° samping penuh.


## 5. Feature Engineering

Contoh feature:

### Elbow Angle

Angle dibentuk dari:

```text
Shoulder → Elbow → Wrist
```

### Body Alignment

Hubungan shoulder dan hip digunakan untuk mendeteksi alignment.

### Depth

Perubahan elbow angle dan body position digunakan untuk mengukur seberapa dalam user turun.

### Velocity

Perubahan posisi keypoint antar-frame.

### Confidence

Confidence score pose digunakan untuk menentukan apakah frame cukup reliable.

## 6. Initial State Machine

```text
UP
 ↓
DOWN
 ↓
UP
 ↓
VALID REP
```

State transition harus menggunakan hysteresis agar noise tidak menghasilkan duplicate count.

Threshold harus configurable dan dikalibrasi menggunakan dataset nyata.

## 7. Dataset

Dataset harus mencakup variasi:

### User

- gender;
- body shape;
- height;
- fitness level.

Data tersebut digunakan sebagai variasi dataset, bukan untuk menyimpulkan atribut sensitif dari pengguna.

### Environment

- indoor;
- outdoor;
- bright;
- low light;
- different backgrounds.

### Camera

- different camera resolutions;
- different FPS;
- different angles;
- different smartphone classes.

### Form

- valid push-up;
- shallow push-up;
- incomplete push-up;
- bad hip alignment;
- body partially out of frame.

## 8. Data Collection

Awal pengembangan dapat menggunakan video yang memang memiliki izin penggunaan.

Untuk data pengguna aplikasi, diperlukan consent yang jelas jika video atau keypoints akan digunakan untuk training.

Raw video tidak diperlukan untuk operasi normal aplikasi.

## 9. Annotation

Annotation minimal:

```text
frame_id
person_id
pose_keypoints
confidence
movement_state
rep_start
rep_end
rep_status
invalid_reason
```

## 10. Training Phases

### Phase 1 — Baseline

Pose model + state machine.

Tujuan:

- membuktikan counting;
- menentukan threshold;
- menemukan edge cases.

### Phase 2 — Feature Classifier

Gunakan keypoint sequences untuk klasifikasi:

- valid;
- invalid.

Model kandidat:

- Random Forest;
- XGBoost;
- MLP.

### Phase 3 — Temporal Model

Jika dataset cukup:

- LSTM;
- GRU;
- Temporal CNN;
- ST-GCN.

Model dipilih berdasarkan hasil eksperimen, bukan kompleksitas.

## 11. Evaluation

Metrics:

### Rep Counting

- precision;
- recall;
- F1;
- counting error;
- mean absolute counting error.

### Valid/Invalid Classification

- accuracy;
- precision;
- recall;
- F1;
- confusion matrix.

### Runtime

- inference latency;
- FPS;
- CPU usage;
- memory usage;
- battery impact.

## 12. Device Evaluation

Model diuji pada:

- low-end;
- mid-range;
- high-end.

Target bukan hanya accuracy tetapi juga usability.

## 13. Model Export

```text
PyTorch
 ↓
Export
 ↓
ONNX
 ↓
ONNX Runtime Mobile
```

Model artifact harus memiliki version:

```text
pushup_pose_v001.onnx
pushup_form_v001.onnx
```

## 14. Model Versioning

Setiap workout menyimpan model version.

Contoh:

```text
model_version = pushup-form-v1.2
```

Hal ini penting untuk:

- reproducibility;
- debugging;
- comparison antar model.

## 15. ML Experiment Tracking

Setiap eksperimen mencatat:

- experiment ID;
- dataset version;
- features;
- model;
- hyperparameters;
- metrics;
- device benchmark;
- conclusion.

## 16. ML Success Criteria

Baseline:

- stable real-time pose;
- valid rep dapat dihitung;
- invalid movement tidak mudah dihitung sebagai valid;
- inference cukup cepat untuk target devices.

Advanced:

- improvement terhadap baseline pada held-out test set;
- performa konsisten lintas device dan environment;
- latency sesuai target mobile.
