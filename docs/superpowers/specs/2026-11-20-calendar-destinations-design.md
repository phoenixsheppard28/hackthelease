# Calendar destinations design

## Intent

Use a student's frequent Calendar places to improve house ranking.
Import Calendar events once after the student connects Google Calendar.

## Approach

Google Calendar expands recurring events into instances for the next 120 days.
The import follows page tokens and groups instances by recurring event and location.
Only groups with at least 20 timed occurrences and a physical location qualify.
AI classifies the 20 most frequent titles and locations into useful physical destinations.
The student reviews additional places manually.
The student reviews each proposed destination, corrects its address, or excludes it.
The student can save up to four Calendar destinations to keep route requests within the current budget.
The app saves approved destinations and occurrence counts in the student's profile.
House ranking requests walking routes to those addresses and weights them by frequency.
The three manually selected campus destinations remain available.

## Alternatives

- Map events to the seven fixed campus hubs. This is simpler but misses other places.
- Use raw Calendar location text directly in routing. This avoids AI but ambiguous room names can route incorrectly.
- Classify locations with AI, then require student review. This supports more places and prevents silent ranking errors. Use this approach.

## Limits

Read the primary Google Calendar only. Do not run a background sync.
Do not save full event descriptions or attendee data.
Do not include locations without a usable street address in ranking.
If Calendar or AI fails, keep manual destinations and existing ranking available.
Do not change budget, home fit, or lifestyle scores.

## Acceptance

- A recurring event with 19 occurrences does not appear for review. One with 20 does.
- The import handles multiple Calendar pages within the 120-day window.
- Students can approve, correct, or exclude each proposed place.
- An approved frequent place affects the Location score for houses with walking routes.
- Reconnecting Calendar does not silently replace saved destinations.
