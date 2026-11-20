# Reviewed landlord outreach

## Intent

Let a student ask a landlord about a missing listing detail. The student reviews every message before the app sends it. The student can read replies in the app.

## Approaches

1. **Email draft with `mailto:`:** The student's email app sends and receives messages. This is small, but it does not provide an in-app conversation.
2. **One AgentMail inbox with student-owned threads:** The app sends and reads mail through server routes. A thread record links each conversation to its student and listing. This is the selected approach.
3. **One AgentMail inbox per student with automatic replies:** Each student gets a separate mailbox. This adds account management and autonomous sending. It does not match the reviewed-message choice.

## Flow

1. The student selects **Email landlord** on a listing.
2. A dialog shows the listing, recipient, and a choice of missing detail. The student can enter another question.
3. The server generates a short, plain-text draft from the listing facts and the student's question. The student can edit the draft.
4. The dialog shows the exact recipient, subject, and message. The student selects **Send email** to approve that message.
5. A server route reads the recipient from the current listing, then sends through the shared AgentMail inbox. The route saves the AgentMail thread ID with the student and listing IDs.
6. The student's conversation view displays sent messages and landlord replies. A reply draft uses the same review and send flow. The app never sends an automatic reply.

## Ownership and access

Add student sign-in before enabling sends or the conversation view. Use Supabase Auth email magic links and `@supabase/ssr` for sessions. The student enters an email address and selects the link in the sign-in email. Verify the user ID on each server request. Save that user ID with each thread. A student can read or reply only to owned threads. The browser never receives the AgentMail key.

The current public profile route must stop exposing other students' profiles when sign-in is enabled. Keep existing records, but hide them from student accounts. Ask students to create new profiles after sign-in.

## Limits and checks

- Send only to the contact email on an active listing. Show when the contact came from a company fallback.
- Reject missing or invalid contact email addresses. Limit message length and send frequency.
- Do not include the student's schedule, budget, or private profile answers in a draft unless the student types them.
- Show a send result and keep a message ID so a failed request cannot appear successful.
- Require an AgentMail inbox and server API key. Use the existing OpenAI key for draft text.
- Configure email delivery for Supabase Auth before inviting students outside the project team.
- Keep the current `mailto:` action available until sign-in and AgentMail configuration are ready.

## Acceptance

A signed-in student can generate and edit an inquiry, inspect the recipient, approve the send, and read a landlord reply. Another student cannot read or send in that conversation.
