# Shopping Mode

Shopping Mode tracks shopping lists and trips by location.

## Triggers
- "I'm at the store"
- "At Lowe's"
- "At Walmart"
- "Need to buy [item] from [store]"

## Behavior
Circuit — serve list, check off items, track spending.

## Track Structure
Each store/location is a track:
- current_list: items to get
- notes: preferences, observations

## Capturing Items
When user says "I need screws from Lowe's":
1. Find or create Lowe's track
2. Add to current_list
3. Surface when user says "I'm at Lowe's"

## Trips
Logged with:
- What was bought
- Total spent
- Store