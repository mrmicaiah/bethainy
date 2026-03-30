-- Seed data from my-life repo
-- User ID: 741bbc18-b5e1-4d19-b010-cd87cdfefbc4 (Micaiah)

-- Body Composition: March 29, 2026 baseline
INSERT INTO entries (user_id, mode, type, track_id, date, data) VALUES (
  '741bbc18-b5e1-4d19-b010-cd87cdfefbc4',
  'fitness',
  'body_composition',
  NULL,
  '2026-03-29',
  '{
    "source": "Fitdays",
    "weight_lb": 227.9,
    "bmi": 30.9,
    "body_fat_pct": 31.9,
    "muscle_rate_pct": 63.9,
    "fat_free_mass_lb": 155.2,
    "subcutaneous_fat_pct": 20.9,
    "visceral_fat": 13.4,
    "body_water_pct": 48.3,
    "skeletal_muscle_pct": 46.8,
    "muscle_mass_lb": 145.7,
    "bone_mass_lb": 7.9,
    "protein_pct": 16.3,
    "bmr_kcal": 2035,
    "body_age": 41,
    "status_flags": {
      "weight": "too_high",
      "bmi": "too_high",
      "body_fat": "too_high",
      "subcutaneous_fat": "high",
      "visceral_fat": "high",
      "body_water": "low",
      "skeletal_muscle": "standard",
      "muscle_mass": "standard",
      "bone_mass": "excellent",
      "protein": "standard"
    },
    "notes": "Starting baseline. Beginning PPL program with clean eating protocol."
  }'
);

-- Workout: March 29, 2026 - Push Day 1
INSERT INTO entries (user_id, mode, type, track_id, date, data) VALUES (
  '741bbc18-b5e1-4d19-b010-cd87cdfefbc4',
  'fitness',
  'workout',
  NULL,
  '2026-03-29',
  '{
    "day_type": "Push",
    "duration_minutes": 90,
    "exercises": [
      {
        "name": "Chest Press Machine",
        "sets": [
          {"reps": 10, "weight": 110},
          {"reps": 10, "weight": 100},
          {"reps": 10, "weight": 100},
          {"reps": 8, "weight": 100}
        ],
        "notes": "Dropped weight after first set"
      },
      {
        "name": "MTS Chest Press",
        "sets": [
          {"reps": 10, "weight": 35},
          {"reps": 10, "weight": 35},
          {"reps": 10, "weight": 35},
          {"reps": 5, "weight": 35}
        ],
        "notes": "Fatigued on last set"
      },
      {
        "name": "Pec Deck",
        "sets": [
          {"reps": 10, "weight": 100},
          {"reps": 10, "weight": 100},
          {"reps": 10, "weight": 100},
          {"reps": 10, "weight": 100}
        ],
        "notes": "Strong throughout"
      },
      {
        "name": "Shoulder Press Machine",
        "sets": [
          {"reps": 10, "weight": 35},
          {"reps": 10, "weight": 35},
          {"reps": 10, "weight": 35},
          {"reps": 10, "weight": 30}
        ],
        "notes": "Dropped to 30 on last set"
      },
      {
        "name": "Lateral Raise Machine",
        "sets": [
          {"reps": 11, "weight": 40},
          {"reps": 11, "weight": 40},
          {"reps": 11, "weight": 40},
          {"reps": 11, "weight": 40}
        ],
        "notes": null
      },
      {
        "name": "Tricep Press Machine",
        "sets": [
          {"reps": 12, "weight": 105},
          {"reps": 12, "weight": 105},
          {"reps": 12, "weight": 105},
          {"reps": 12, "weight": 105}
        ],
        "notes": "Strong"
      },
      {
        "name": "Cable Pushdowns",
        "sets": [
          {"reps": 9, "weight": 40},
          {"reps": 9, "weight": 40},
          {"reps": 9, "weight": 40},
          {"reps": 9, "weight": 40}
        ],
        "notes": "Triceps fatigued from earlier"
      },
      {
        "name": "Push-Ups",
        "sets": [],
        "notes": "Skipped - triceps completely exhausted"
      },
      {
        "name": "Treadmill (Cardio Finisher)",
        "duration_minutes": 20,
        "incline": "10-12%",
        "speed": "3.5",
        "notes": null
      }
    ],
    "notes": "Day 1. First push workout. Found working weights. Good session."
  }'
);

-- Meals: March 29, 2026 - Rest Day (4 meals)
INSERT INTO entries (user_id, mode, type, track_id, date, data) VALUES (
  '741bbc18-b5e1-4d19-b010-cd87cdfefbc4',
  'fitness',
  'meal',
  NULL,
  '2026-03-29',
  '{
    "meal_number": 1,
    "meal_time": "morning",
    "foods": ["2 eggs", "black coffee"],
    "protein_g": 12,
    "carbs_g": 0,
    "fat_g": 10,
    "on_plan": 0,
    "notes": "Light start - first day"
  }'
);

INSERT INTO entries (user_id, mode, type, track_id, date, data) VALUES (
  '741bbc18-b5e1-4d19-b010-cd87cdfefbc4',
  'fitness',
  'meal',
  NULL,
  '2026-03-29',
  '{
    "meal_number": 2,
    "meal_time": "lunch",
    "foods": ["8 oz ground beef", "salad", "olive oil dressing"],
    "protein_g": 48,
    "carbs_g": 10,
    "fat_g": 25,
    "on_plan": 1,
    "notes": null
  }'
);

INSERT INTO entries (user_id, mode, type, track_id, date, data) VALUES (
  '741bbc18-b5e1-4d19-b010-cd87cdfefbc4',
  'fitness',
  'meal',
  NULL,
  '2026-03-29',
  '{
    "meal_number": 3,
    "meal_time": "afternoon",
    "foods": ["5 oz steak", "bell pepper", "olive oil"],
    "protein_g": 35,
    "carbs_g": 5,
    "fat_g": 15,
    "on_plan": 1,
    "notes": "Needed more food before gym"
  }'
);

INSERT INTO entries (user_id, mode, type, track_id, date, data) VALUES (
  '741bbc18-b5e1-4d19-b010-cd87cdfefbc4',
  'fitness',
  'meal',
  NULL,
  '2026-03-29',
  '{
    "meal_number": 4,
    "meal_time": "dinner",
    "foods": ["chicken breast", "1 cup rice", "broccoli", "greens", "half tomato", "half cucumber", "4 blackberries", "olive oil"],
    "protein_g": 50,
    "carbs_g": 60,
    "fat_g": 15,
    "on_plan": 1,
    "notes": "Post-workout"
  }'
);

-- Daily summary for March 29
INSERT INTO entries (user_id, mode, type, track_id, date, data) VALUES (
  '741bbc18-b5e1-4d19-b010-cd87cdfefbc4',
  'fitness',
  'daily_summary',
  NULL,
  '2026-03-29',
  '{
    "day_type": "Rest",
    "target": {
      "calories": 2100,
      "protein": 220,
      "carbs": 120,
      "fat": 80
    },
    "totals": {
      "protein": 145,
      "carbs": 75,
      "fat": 65,
      "calories": 1445
    },
    "notes": "Day 1. Ate light, appetite adjusting. Short on protein goal by 75g."
  }'
);
