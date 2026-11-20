# Student accounts and housing groups

## Intent

Give each student a private housing profile. Let students join one housing group and build a shared ranking and saved-home list.

The shared inbox and landlord outreach remain later work. A group ID will provide an owner for that inbox.

## Approaches

1. **Shareable group link:** This needs no invitation email, but anyone with the link can join. The user chose email-specific invitations instead.
2. **Supabase Auth with email-specific group invitations:** Supabase stores student accounts. The app stores group membership and pending invitations. This is the selected approach.
3. **Custom accounts and passwords:** This adds password storage and session work. It does not improve the group flow.

## Student sign-in

Use Supabase Auth email and password with `@supabase/ssr` for sessions. The server creates confirmed accounts without sending email. Verify the Supabase user ID on every private server request. Provide sign-out.

Keep listing browse available to signed-out visitors through the existing preview profile. Require sign-in to save a profile or join a group.

## Housing groups

An authenticated student can create one named group. A group has a stable ID and a member list. Any member can invite another student by email. The invitation belongs to that email address and expires after seven days.

The server records the pending invitation. The group shows the pending address. Students tell invitees to create an account with that address. After sign-in, the invited student sees the invitation and can accept it. The server compares the account email with the invitation email before it adds membership. A student can belong to one group in this version.

Each student keeps one active profile and budget. A new profile becomes the active profile. Older profiles remain stored but do not appear in search. Group members see the same ranking and saved-home list. Each saved home records the member who saved it. The existing local saved list remains for visitors without a group.

Rank the live catalog for every member with a completed profile. Exclude a home when it clearly fails any member's firm requirements. Average the available member scores with equal weight. Show how many members contributed a score. Mark unknown checks for verification. Use the accepted member count for bedroom and household cost calculations. Recalculate the group ranking when membership or a member profile changes.

## Data and access

Add an owner ID to new housing profiles. Keep existing profiles in the database, but stop serving them publicly. Ask students to create a new profile after sign-in. Do not delete existing records.

Add tables for groups, members, invitations, and shared saved homes. Server routes verify identity and group membership before each read or write. The browser never receives the Supabase secret key.

## Limits and checks

- Reject duplicate invitations and group membership. Limit invitation requests per member.
- Do not allow a group member to read another member's private profile. Show only the group score and shared verification reasons.
- Keep group names and member email addresses visible only to members and invited students.
- Account email addresses are unverified. A person who registers an invited address first can accept that invitation.
- Preserve individual ranking for visitors. Add a group ranking route for members.

## Acceptance

Two students can sign in and join one group through an email-specific invitation. Both see the same ranked homes and saved homes. A confirmed failure for either student removes a home. A third student cannot read that group's data.
