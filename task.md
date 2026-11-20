# Hack the Lease: Product and Implementation Plan

## Goal

Build a refreshable index of Ann Arbor housing listings. Rank listings against a student's requirements, preferences, and schedule. Show the trade-offs in a day simulation.

Use Firecrawl to collect listings from selected housing companies. Use structured data for firm requirements and measurable preferences. Use embeddings for lifestyle preferences.

## Product flow

1. The student enters housing requirements and a schedule.
2. The student ranks three priorities.
3. The app shows a ranked shortlist with reasons and missing details.
4. The student compares two listings in the same day simulation.
5. The student can draft an inquiry about a missing detail.

## Housing sources and refresh

Seed each source with its public inventory URL, approved domains, and listing URL patterns. Start with Oxford's RENTCafe inventory and Cabrio's ShowMojo inventory. These sources provide two listing formats.

The **Refresh listings** action starts a background job and returns a run ID. The UI shows progress for each source while students browse.

Each source follows four steps:

1. **Discover:** Collect listing URLs from the inventory page. Use a scoped Firecrawl crawl when listing paths are predictable.
2. **Extract:** Use structured JSON extraction for address, unit, lease dates, rent, beds, fees, amenities, and contact details. Save the source URL, fetch time, and supporting text for important fields.
3. **Reconcile:** Match listings by normalized address and unit when both are known. Keep distinct units and floor plans separate. Preserve each source's record when prices disagree.
4. **Publish:** Report new listings, rent changes, and failures. Update an embedding when searchable text changes. Update structured fields directly when only rent changes.

Keep the last successful inventory when a source fails. Show the age of that inventory. If a known listing pattern returns no results, inspect the approved inventory page for another pattern. Report a failed recovery in the run summary.

## Data and ranking

Use Supabase Postgres with pgvector. Start with `sources`, `crawl_runs`, `listings`, and `listing_observations`. Store an embedding on each canonical listing. Store individual scrape results as observations for traceability.

At hackathon scale, filter eligible listings in SQL and score the remaining rows directly.

| Input | Evaluation |
| --- | --- |
| Firm requirements: budget, beds, move-in date, accessibility | Check structured fields. Mark unknown details **Needs verification**. A starting price or unknown rent basis cannot confirm a budget match. |
| Measurable preferences: commute, bus access, monthly cost | Calculate scores from travel estimates, the confirmed schedule, rent, and fees. |
| Lifestyle preferences: kitchen, roommates, dining | Compare a preference embedding with listing text built from extracted features. Show the features behind the match. |

Let the student rank three priorities. Assign weights such as 50%, 30%, and 20%. Calculate a separate score for each priority, then combine the scores with those weights. Update the ranking when the student changes the priority order.

Use the same embedding model for listings and preference text. Keep raw calendar events out of embedding input.

## Day simulation

Compare listings against the same fixed day. Show departure, arrival, and buffer times for each trip. Run a second scenario with a modeled delay.

For example, compare a $980 listing with better kitchen features and a $1,100 listing with a more reliable trip to North Campus. One route could leave six minutes before lab; the other could leave 18 minutes. Apply a modeled ten-minute bus delay to show the effect of that difference.

If a missing listing detail could change the decision, let the student draft an AgentMail inquiry. Show the recipient and message for review before sending.

## Technical work sections

### 1. Database and shared types

- Set up Supabase Postgres and pgvector.
- Define `sources`, `crawl_runs`, `listings`, and `listing_observations`.
- Agree on `Listing`, `HousingProfile`, `MatchResult`, and `DaySimulation` types.
- Seed sample listings and one student schedule.

**Done when:** The frontend, worker, and scoring code can use the same fixture data.

### 2. Firecrawl ingestion worker

- Seed two Ann Arbor property managers.
- Build a background job to discover listing URLs, extract fields, validate data, and update listings.
- Deduplicate by address and unit when known. Preserve source URLs, timestamps, and changes for each run.
- Keep the last successful data when a source fails.

**Done when:** Refresh shows progress and counts for new, updated, and failed records.

### 3. Student onboarding and calendar

- Collect budget, move-in window, housing type, roommate and bedroom needs, accessibility, car access, and bus-stop tolerance.
- Collect cooking, dining, and nightlife preferences. Let students rank three priorities.
- Support manual schedule entry. Add optional Google Calendar import with location confirmation.

**Done when:** Onboarding creates a `HousingProfile` with firm requirements, ranked preferences, and confirmed times and places.

### 4. Matching and embeddings

- Apply firm checks for budget, beds, move-in date, and required features.
- Score cost and travel preferences from structured data.
- Compare lifestyle preferences with listing features through embeddings.
- Combine three priority scores with explicit weights. Explain each result.

**Done when:** Changing priority order can change the ranking, and unknown firm requirements show **Needs verification**.

### 5. Routing and hardest-day simulation

- Build one travel-time function for matching and simulation.
- Use Google Routes API on the server for distance and estimated travel time from each listing to confirmed destinations.
- Request walking, cycling, transit, or driving routes for the student's available modes and departure time.
- Show route distance, estimated duration, travel mode, and Google Maps attribution beside each result.
- Hold one schedule day fixed across all listings.
- Calculate departure, arrival, and buffer times. Rerun the day with a modeled delay.
- Keep modeled delays separate from Google route estimates.
- Use a documented travel-time matrix if API access or latency blocks the demo.

**Done when:** A student can compare two apartments and see which trips become tight or late after a delay.

### 6. Results and comparison UI

- Connect onboarding to a ranked shortlist, side-by-side comparison, and day timeline.
- Show score details, rent basis, source, listing age, and simulation assumptions.
- Add a small refresh status view for the ingestion demo.

**Done when:** A judge can change a priority, see the ranking update, and understand the trade-off.

### 7. AgentMail outreach

- Attach the leasing contact to each listing.
- Draft an inquiry about a specific missing detail, such as parking.
- Show the recipient and message for student approval before sending.

**Done when:** A student can draft an inquiry from the comparison screen.

## Shared interfaces

| Interface | Result |
| --- | --- |
| `refreshListings(sourceIds) → runId` | Starts ingestion and gives the UI a run to track. |
| `rankListings(profile, listings) → MatchResult[]` | Returns scores, reasons, and fields that need verification. |
| `estimateTravel(from, to, departureTime, modes) → TravelEstimate` | Gives matching and simulation the same travel assumptions. |
| `simulateDay(profile, listing, day, scenario) → DaySimulation` | Returns trip details, arrival times, and late commitments. |

## Team ownership

| Team | Scope |
| --- | --- |
| Data | Database, Firecrawl worker, deduplication, and refresh status. |
| Recommendations | Firm checks, embeddings, priority weights, and match explanations. |
| Simulation | Travel estimates and the hardest-day timeline. |
| Product UI | Onboarding, shortlist, and comparison. |

## 24-hour build order

1. Build manual profile entry, ranking, and a two-apartment simulation with fixtures.
2. Build Firecrawl ingestion in parallel, then connect its listings to the working flow.
3. Demonstrate a live refresh and a recommendation change after a priority change.
4. Add Google Calendar and AgentMail when the core flow works.

Gather user data:
Gcal
How they eat
House or apar
Accessibility requirements
Dining plan or cooking
Do they have a car
Bus stop distance
What year
Major? Where are classes,
Night life
Proximity to campus
Who rooming with
Add choose top 3 priorities

Ask preferences for what of these we can't collect automatically

Scrape houses:
Across housing company websites, other aggregators, dedupe and put in database

Match users to house,
Simulate house

Email with agentmail housing landlords or companies or whatever are assigned to that property if we have something associated with it, we can have an agentmail that emails on behalf of the person

Agent framework for long running work, no chatbot for now

Run simulation that picks worse day in ann arbor

Hack the Lease
Find the Apartment That Fits You
01 The premise
An apartment can look perfect on a listing and still be wrong for the life a student actually lives. A student commuting between Central and North Campus may evaluate housing differently from someone who studies late at the UGLi, works in Kerrytown, lives with roommates, or has a strict monthly budget.

Traditional housing searches make it easy to filter by rent, bedrooms, and amenities. They are less effective at helping students understand what those options mean for their own schedules, preferences, and trade-offs.
02 Your mission
Build a working technical solution that helps university students identify, compare, or make better-informed housing decisions based on their identity.

What student identity means here: A student's self-described needs, circumstances, and way of life as they relate to choosing a home. Teams decide which factors matter to the housing decision they are solving; demographic profiling is outside the challenge.

The University of Michigan and Ann Arbor are the initial pilot setting. Solutions may extend to other campuses or housing markets.
03 The field of play
We are evaluating both the quality of the housing problem your team defines and the quality of the technical solution you build to address it. The challenge is intentionally open-ended, but every submission must meaningfully support the decision of where a student should live.

Within the challenge: Apartment fit, comparison, selection, and housing trade-offs grounded in student needs. Related costs, transportation, schedules, and roommate preferences are relevant when they inform housing decisions.

Outside the challenge: A social media, maintenance, or general campus-life app that does not help students choose where to live. A deck, static concept, or business pitch without a functioning technical artifact that supports the decision.

Scope and ambition: Both focused and ambitious solutions can excel. A narrow tool that solves an important decision exceptionally well may outperform a broad but incomplete product; equally, a broader solution that delivers more meaningful capability without sacrificing execution should receive credit for that achievement.
04 Example solutions
These are illustrations, not project tracks. Teams may combine, adapt, or disregard them entirely. AI is optional, and the technical approach is yours to choose.
Example approach What it could enable
Apartment-fit explorer Compare housing options against student priorities, including location, and explain the relevant trade-offs.
Day-in-the-life and cost simulator Model how a potential apartment affects commutes, routines, free time, and total living costs.
Shared housing decision planner Help prospective roommates weigh competing needs, budgets, and preferences when selecting a home.

05 Data
Independent data and APIs: Allowed. Cite the source, relevant date or recency, and important assumptions or limitations of consequential inputs.

Synthetic or fictional scenarios: Allowed for student profiles, apartment listings, and demonstrations. Label clearly and do not present simulations as observed facts.

Personal information: Minimize collection. Use consent-based inputs and avoid unnecessary sensitive information or demographic inference.
06 Final showcase
Presentation: 5 minutes. Present the problem and demonstrate your working technical solution by screen sharing onto the projector.

Judge Q&A: 5 minutes. Answer judges' questions about the implementation, product choices, evidence, and limitations.

You may use slides to provide context, but the demonstration should focus on working functionality - not a proposed future product.
07 What your team must demonstrate
A production-ready product is not expected in 24 hours. However, every project must demonstrate substantive technical work and a meaningful apartment-choice outcome. A presentation alone is not sufficient.

1. Define the housing decision. Explain the problem you chose, the student needs it addresses, and why those needs matter in choosing where to live. The solution does not have to serve only one student archetype.

2. Demonstrate a working artifact. Show a functioning application, model, simulation, analytical workflow, or other technical solution that produces a meaningful housing comparison, insight, or recommendation.

3. Demonstrate decision sensitivity. Change at least one meaningful input, constraint, or assumption and show how the outcome changes - or explain why it stays the same.

4. Explain the implementation. Identify what the team built, major product and technical choices, and the external tools, libraries, APIs, or models used.

5. Defend the result. Explain the logic behind important outputs, their supporting data and assumptions, and any consequential limitations or uncertainty.
   08 Judging rubric
   Judges will evaluate what your team demonstrates, not projected features. The rubric rewards technical substance, thoughtful product strategy, credible decision support, and effective design.
   Dimension Weight What judges evaluate
   Technical execution 35% Does the solution work? Is there substantive engineering or analytical implementation? Are the technical methods appropriate and explainable?
   Student value & product strategy 30% How well does the team define the apartment-decision problem, address meaningful student needs, and make deliberate choices about scope, features, and trade-offs? No single student archetype is required.
   Decision quality & evidence 20% Can the team explain how outcomes are produced, support important claims with appropriate data or explicit assumptions, and acknowledge uncertainty?
   Product experience & creativity 15% Can a student understand and use the solution? Is the experience coherent, thoughtful, and inventive in ways that serve the housing decision?

HACK THE LEASE / CASE STUDY — November 19–20, 2026

read this case study as well as

our intiial ideas, synthesize this

…
Hack the Lease · Find the apartment that fits your week
Build a housing shortlist that answers a question listing sites leave open: “If I lived here, what would my hardest school day look like?” A student enters their routine, chooses their three biggest housing priorities, and compares apartments by rent, commute, and how much time they’d have between commitments. The recommendation should show the trade-off in plain language, such as “This apartment saves you $150 a month, but leaves you with a six-minute buffer before your North Campus lab.”

The product flow
Step What the student does What the app does

1. Build a housing profile Optionally connects Google Calendar, confirms event locations, and fills in missing preferences. Uses relevant event times and confirmed locations to build a weekly schedule. Offers manual entry for students who keep their schedules elsewhere.
2. Set requirements and priorities Sets a rent limit, housing type, roommate and bedroom needs, accessibility requirements, and available travel modes. Then ranks their top three priorities. Separates hard requirements from preferences so a short commute can’t compensate for exceeding a firm budget or failing an accessibility requirement.
3. Compare a shortlist Opens two or three ranked listings and sees why each placed where it did. Scores eligible listings on the chosen priorities. Shows per-person rent, available cost details, travel time, and the source and freshness of each listing. Flags important missing details for verification.
4. Simulate the hardest day Compares the same day across apartments and toggles a scenario like snow or a missed bus. Shows a timeline from leaving home through classes, meals, work or evening plans, and getting back. Highlights the tightest connection and any projected late arrival.
   Ask the student about things the calendar can’t reliably tell you. Do they cook, use a dining plan, or mix both? Do they have a car they can use every day? How far are they willing to walk to a bus stop? Do they already have roommates? Is nightlife access important? Ask where they actually need to be during the week. Year and major can help prompt manual entry when the schedule is incomplete, but confirmed locations are more useful for the housing decision.

Make the simulation the centerpiece
Pick one day from the student’s schedule and use it for every listing. For the MVP, define the hardest day as the one with the most scheduled travel between locations, breaking ties by the smallest gap between consecutive commitments. Hold the day and commitments fixed while changing the apartment. Then let the student apply a clearly labeled delay assumption and see which plan still works.

That gives you two distinct decisions to demonstrate:

Change a priority. With affordability ranked first, the cheaper apartment leads. Move commute reliability to first, and the apartment with more time before class takes the lead.
Change a condition. In an illustrative scenario, Apartment A leaves six minutes before a lab and Apartment B leaves 18. Apply a modeled ten-minute bus delay and A arrives four minutes late while B still has eight minutes. The student can see what the higher rent buys them.
Show the underlying route and timing assumptions beside the output. Keep listing facts, estimated travel times, and simulated delays visibly distinct.

What to build in 24 hours
Create a small, credible listing dataset. Import listings from a couple of housing company sites or aggregators where access is permitted. Normalize address, unit, beds, rent, availability, and source URL. Deduplicate by address and unit where available, keeping source records when details conflict. A seeded snapshot gives the live demo a stable dataset.
Build the ranker and simulator first. Filter on hard requirements, score the top three priorities with explicit weights, and reuse the same travel estimates in the ranking explanation and the day timeline. Start with a small set of campus destinations and documented travel estimates if live routing would put the demo at risk.
Make the comparison usable end to end. Ship manual schedule entry, top-three selection, and a side-by-side comparison. Add read-only Google Calendar import once the same flow works with manual inputs.
Use background jobs where they earn their place. Listing refresh is a natural first job. AgentMail can turn a listing’s verified contact and missing details into a draft inquiry. Show the recipient and draft for the student to approve before sending. Keep that flow attached to the listing, with no chatbot needed.
For the five-minute showcase, follow one student who has commitments on Central and North Campus and is choosing between two plausible apartments. Show the initial winner, run the hardest day, then change one priority and let the judges watch the ranking flip. Close by showing where the listing data came from and how the simulator calculated the timing. That single flow demonstrates the housing decision, the working artifact, sensitivity to student preferences, and the reasoning behind the result.
