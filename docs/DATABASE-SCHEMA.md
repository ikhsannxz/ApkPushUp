# PushUp AI — Database Schema

Database: PostgreSQL

Backend ORM: Django ORM

## 1. profiles

Stores application user profile.

| Field | Type | Constraint |
|---|---|---|
| id | UUID | PK |
| username | VARCHAR(50) | UNIQUE |
| display_name | VARCHAR(100) | NOT NULL |
| avatar_url | TEXT | NULL |
| created_at | TIMESTAMP | NOT NULL |
| updated_at | TIMESTAMP | NOT NULL |

Authentication credentials should be managed by the chosen Django authentication strategy rather than duplicated in profile fields.

## 2. user_devices

Stores device information used by the application.

| Field | Type | Constraint |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK profiles |
| platform | VARCHAR(20) | NOT NULL |
| os_version | VARCHAR(50) | NULL |
| device_model | VARCHAR(100) | NULL |
| capability_mode | VARCHAR(20) | NOT NULL |
| app_version | VARCHAR(30) | NULL |
| model_version | VARCHAR(50) | NULL |
| created_at | TIMESTAMP | NOT NULL |
| last_seen_at | TIMESTAMP | NOT NULL |

`capability_mode`:

- lite;
- standard;
- high.

## 3. workout_sessions

Primary workout record.

| Field | Type | Constraint |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK profiles |
| device_id | UUID | FK user_devices |
| started_at | TIMESTAMP | NOT NULL |
| ended_at | TIMESTAMP | NULL |
| duration_seconds | INTEGER | NOT NULL |
| total_reps | INTEGER | NOT NULL |
| valid_reps | INTEGER | NOT NULL |
| invalid_reps | INTEGER | NOT NULL |
| form_score | DECIMAL(5,2) | NULL |
| model_version | VARCHAR(50) | NULL |
| sync_status | VARCHAR(20) | NOT NULL |
| created_at | TIMESTAMP | NOT NULL |

Recommended rule:

```text
total_reps = valid_reps + invalid_reps
```

depending on the exact definition of attempted repetitions.

## 4. repetitions

Stores repetition-level information.

| Field | Type | Constraint |
|---|---|---|
| id | UUID | PK |
| workout_id | UUID | FK workout_sessions |
| sequence_number | INTEGER | NOT NULL |
| status | VARCHAR(20) | NOT NULL |
| invalid_reason | VARCHAR(100) | NULL |
| started_at | TIMESTAMP | NULL |
| completed_at | TIMESTAMP | NULL |
| depth_score | DECIMAL(5,2) | NULL |
| form_score | DECIMAL(5,2) | NULL |
| confidence | DECIMAL(5,4) | NULL |

Status:

- valid;
- invalid.

Possible invalid reasons:

- not_deep_enough;
- low_confidence;
- body_not_visible;
- bad_alignment;
- incomplete_rep.

For privacy and storage efficiency, raw pose frames should not be stored here by default.

## 5. daily_statistics

Aggregated daily metrics.

| Field | Type | Constraint |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK profiles |
| date | DATE | NOT NULL |
| total_valid_reps | INTEGER | NOT NULL |
| total_invalid_reps | INTEGER | NOT NULL |
| sessions_count | INTEGER | NOT NULL |
| average_form_score | DECIMAL(5,2) | NULL |
| best_session_reps | INTEGER | NOT NULL |
| streak_day | INTEGER | NOT NULL |
| updated_at | TIMESTAMP | NOT NULL |

Unique:

```text
UNIQUE(user_id, date)
```

## 6. friend_relationships

| Field | Type | Constraint |
|---|---|---|
| id | UUID | PK |
| requester_id | UUID | FK profiles |
| addressee_id | UUID | FK profiles |
| status | VARCHAR(20) | NOT NULL |
| created_at | TIMESTAMP | NOT NULL |
| updated_at | TIMESTAMP | NOT NULL |

Status:

- pending;
- accepted;
- blocked;
- rejected.

A database constraint or application rule must prevent self-friendship.

## 7. competitions

| Field | Type | Constraint |
|---|---|---|
| id | UUID | PK |
| creator_id | UUID | FK profiles |
| type | VARCHAR(30) | NOT NULL |
| target_reps | INTEGER | NULL |
| duration_seconds | INTEGER | NULL |
| starts_at | TIMESTAMP | NULL |
| ends_at | TIMESTAMP | NULL |
| status | VARCHAR(20) | NOT NULL |
| created_at | TIMESTAMP | NOT NULL |

Types:

- target_reps;
- timed;
- daily_total.

## 8. competition_participants

| Field | Type | Constraint |
|---|---|---|
| id | UUID | PK |
| competition_id | UUID | FK competitions |
| user_id | UUID | FK profiles |
| valid_reps | INTEGER | NOT NULL |
| joined_at | TIMESTAMP | NOT NULL |
| completed_at | TIMESTAMP | NULL |

Unique:

```text
UNIQUE(competition_id, user_id)
```

Competition score must be derived from valid repetitions.

## 9. ml_models

Registry for deployed models.

| Field | Type | Constraint |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(100) | NOT NULL |
| version | VARCHAR(50) | UNIQUE |
| runtime | VARCHAR(30) | NOT NULL |
| model_path | TEXT | NULL |
| status | VARCHAR(20) | NOT NULL |
| notes | TEXT | NULL |
| created_at | TIMESTAMP | NOT NULL |

Runtime examples:

- onnx;
- pytorch;
- tflite.

## 10. Indexes

Recommended:

```text
workout_sessions(user_id, started_at)
repetitions(workout_id, sequence_number)
daily_statistics(user_id, date)
friend_relationships(requester_id, addressee_id)
competition_participants(competition_id)
competition_participants(user_id)
```

## 11. Database Rules

1. Use UUID primary keys.
2. Store timestamps in UTC.
3. Validate ownership at application level.
4. Do not trust client-submitted competition scores.
5. Daily statistics are derived data.
6. Raw video is not stored by default.
7. Use transactions when synchronizing workout data.
8. Prevent duplicate workout synchronization with an idempotency key if needed.

## 12. ML Dataset Storage

Training datasets should not be stored in the main PostgreSQL database.

Recommended:

```text
ml/
├── datasets/
├── annotations/
├── experiments/
└── models/
```

or object storage for larger datasets.
