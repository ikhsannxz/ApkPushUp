# PushUp AI — Product Requirements Document (PRD)

## 1. Ringkasan Produk

**PushUp AI** adalah aplikasi mobile berbasis computer vision untuk menghitung push-up secara otomatis melalui kamera smartphone.

Aplikasi tidak hanya menghitung jumlah gerakan, tetapi membedakan repetisi yang valid dan tidak valid, memberikan feedback dasar mengenai form, menyimpan riwayat latihan, dan menampilkan statistik harian.

Tahap lanjutan memungkinkan pengguna berkompetisi dengan teman berdasarkan jumlah push-up yang valid.

## 2. Problem Statement

Pengguna yang melakukan push-up secara mandiri sering mengalami beberapa masalah:

- sulit menghitung repetisi secara konsisten;
- tidak mengetahui apakah setiap repetisi dilakukan dengan benar;
- tidak memiliki riwayat latihan yang terstruktur;
- sulit membandingkan performa dengan teman;
- aplikasi penghitung sederhana biasanya hanya menggunakan input manual atau sensor perangkat.

PushUp AI menyelesaikan masalah tersebut menggunakan kamera dan pose estimation.

## 3. Product Vision

Membangun aplikasi push-up yang:

1. mudah digunakan;
2. dapat berjalan pada berbagai smartphone;
3. mampu melakukan counting secara real-time;
4. membedakan valid dan invalid repetition;
5. tetap berguna ketika offline;
6. menyimpan histori latihan;
7. dapat berkembang menjadi platform kompetisi fitness.

## 4. Target User

### Primary User

Orang yang ingin:

- latihan push-up;
- mengetahui jumlah push-up harian;
- meningkatkan konsistensi latihan;
- melihat perkembangan performa.

### Secondary User

Teman atau kelompok kecil yang ingin:

- membandingkan jumlah push-up;
- mengikuti challenge;
- melihat leaderboard.

## 5. Core Features

### 5.1 Camera Workout

Pengguna mengaktifkan kamera dan melakukan push-up di depan smartphone.

Sistem:

- mendeteksi tubuh;
- memperoleh keypoints;
- mendeteksi posisi UP/DOWN;
- menghitung repetisi;
- memvalidasi repetisi;
- memberikan feedback.

### 5.2 Rep Counter

Satu repetisi dihitung ketika state berubah:

`UP → DOWN → UP`

Repetisi parsial tidak dihitung sebagai valid repetition.

### 5.3 Valid / Invalid Rep

Sistem menyimpan:

- total repetitions;
- valid repetitions;
- invalid repetitions;
- alasan invalid.

Contoh alasan:

- tidak cukup turun;
- confidence terlalu rendah;
- tubuh tidak terlihat;
- alignment tubuh tidak sesuai;
- repetisi tidak selesai.

### 5.4 Form Feedback

Feedback dasar:

- Good;
- Go lower;
- Keep your hips aligned;
- Move into camera view;
- Body not detected.

### 5.5 Workout Result

Setelah workout:

- total reps;
- valid reps;
- invalid reps;
- durasi;
- form score;
- timestamp.

### 5.6 History

Pengguna dapat melihat sesi workout sebelumnya.

### 5.7 Daily Statistics

Statistik:

- total valid reps per hari;
- jumlah sesi;
- total invalid reps;
- average form score;
- best session;
- streak.

### 5.8 Competition

Fitur tahap berikutnya:

- friend challenge;
- target reps;
- timed battle;
- daily competition;
- leaderboard.

## 6. Non-Functional Requirements

### Performance

- inference harus berjalan secara real-time;
- UI tidak boleh freeze ketika camera aktif;
- inference rate dapat diturunkan pada perangkat low-end;
- model harus dapat dijalankan on-device.

### Compatibility

Aplikasi harus device-agnostic.

Mode inference:

- `lite`;
- `standard`;
- `high`.

Mode ditentukan berdasarkan kemampuan perangkat, bukan nama perangkat tertentu.

### Privacy

Raw video tidak dikirim ke server secara default.

Data utama yang dikirim:

- workout metadata;
- rep count;
- validity;
- timestamps;
- form score;
- model version.

### Offline

Workout dasar harus dapat berjalan tanpa internet.

Data workout disimpan secara lokal lalu disinkronkan ketika koneksi tersedia.

### Security

- authentication menggunakan backend;
- API menggunakan HTTPS;
- authorization dilakukan di server;
- user tidak boleh mengubah hasil kompetisi melalui client.

## 7. Product Principles

- Mobile-first.
- Clean UI.
- Minimal distraction saat workout.
- Camera adalah elemen utama workout screen.
- Valid repetition adalah source untuk statistik dan kompetisi.
- AI inference sebisa mungkin dilakukan di perangkat.
- Backend menjadi source of truth untuk data akun dan kompetisi.

## 8. Success Metrics

MVP:

- camera dapat digunakan;
- pose berhasil dideteksi;
- push-up dapat dihitung;
- invalid rep dapat ditolak;
- workout dapat disimpan;
- statistik harian tersedia;
- aplikasi dapat berjalan offline.

Tahap lanjutan:

- sinkronisasi berhasil;
- challenge teman berjalan;
- leaderboard real-time tersedia;
- model semakin akurat berdasarkan dataset dan evaluasi.

## 9. Out of Scope MVP

- social feed;
- chat;
- payment;
- AI conversational coach;
- live streaming;
- complex competition;
- advanced transformer model;
- automatic video upload;
- cloud video processing sebagai default.

## 10. Future Features

- sit-up detection;
- squat detection;
- plank timer;
- personal AI coach;
- personalized workout plans;
- friend groups;
- tournaments;
- badges;
- achievements;
- advanced analytics.
