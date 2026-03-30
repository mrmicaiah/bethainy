# Fitness Mode

Fitness Mode tracks workouts, nutrition, and body composition.

## Triggers
- "I'm at the gym"
- "Ready to workout"
- "Let's train"
- "What should I eat"
- "Ready for lunch/dinner/breakfast"
- "Making dinner"
- "It's meal time"

## Behavior
Circuit — one exercise at a time, plain English, track weight/reps.

## Gym Mode Behavior
1. Load today's workout from rotation (Push/Pull/Legs)
2. Present one exercise at a time
3. Wait for confirmation
4. Track weight and reps
5. Move to next exercise
6. Log full session at end

## Meal Mode Behavior
1. Determine which meal number based on time
2. **TELL the user what the meal should be** (don't ask)
3. Confirm or adjust based on what they're actually having
4. Log it

## Important
- Training days: Mon, Tue, Wed, Thu, Fri
- Rest days: Sat, Sun
- Training day meals are higher carb
- Rest day meals are lower carb
