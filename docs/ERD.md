# PushUp AI — Entity Relationship Diagram

## 1. Core Entities

- profiles
- user_devices
- workout_sessions
- repetitions
- daily_statistics
- friend_relationships
- competitions
- competition_participants
- ml_models

## 2. ERD

```text
PROFILES
---------
id PK
username
display_name
created_at
updated_at
      │
      ├──────────────< USER_DEVICES
      │
      ├──────────────< WORKOUT_SESSIONS
      │                    │
      │                    └──────< REPETITIONS
      │
      ├──────────────< DAILY_STATISTICS
      │
      ├──────────────< FRIEND_RELATIONSHIPS
      │
      └──────────────< COMPETITION_PARTICIPANTS
                                  │
                                  >──────── COMPETITIONS


ML_MODELS
---------
id PK
name
version
runtime
status
created_at
```

## 3. Relationships

### Profiles → User Devices

One user can use multiple devices.

```text
profiles 1:N user_devices
```

### Profiles → Workout Sessions

One user can have many workout sessions.

```text
profiles 1:N workout_sessions
```

### Workout Sessions → Repetitions

One workout can contain many repetition records.

```text
workout_sessions 1:N repetitions
```

### Profiles → Daily Statistics

One user has one aggregated record per date.

```text
profiles 1:N daily_statistics
UNIQUE(user_id, date)
```

### Profiles → Friend Relationships

Many-to-many relationship through a relationship table.

```text
profiles N:N profiles
```

### Competitions → Participants

One competition has multiple participants.

```text
competitions 1:N competition_participants
```

### Profiles → Competition Participants

A user can participate in multiple competitions.

```text
profiles 1:N competition_participants
```

### ML Models

ML model registry is independent from workout ownership.

Workout sessions may store the model version used for inference without requiring a foreign key to the active model registry in every implementation.

## 4. Data Ownership

### Source of Truth

`workout_sessions` and `repetitions` are the primary workout records.

### Derived Data

`daily_statistics` is an aggregation/cache.

It should be reproducible from workout data.

### Competition Data

Competition results should use valid repetitions only.

## 5. Future Expansion

Possible entities:

- achievements;
- badges;
- notifications;
- workout_programs;
- exercise_types;
- leaderboard_snapshots.
