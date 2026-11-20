# Google sign-in design

## Intent

Students sign in with Google. Existing students keep their profiles and groups when Google confirms the same email address.

## Approaches

- Use Supabase Google OAuth. Supabase links a verified Google email to an existing account. Chosen because the app already uses Supabase sessions.
- Build a separate Google session system. Rejected because it duplicates Supabase Auth and account linking.

## Design

Replace the password form with a Google sign-in link. Start OAuth on the server and exchange its code in a callback route. Preserve the current Supabase session cookies and sign-out route. Remove password API routes and their tests. Keep Google Calendar permission optional in onboarding. Configure the Google provider and callback URLs in Supabase before deployment. Do not delete accounts or stored data.
