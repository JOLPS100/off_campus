# JolpsCrush

A single-service app: nearby matching by age range and distance, a 500 MWK/day
subscription to unlock texting, and a 500 MWK charge (with user consent) when
someone tries to send a phone number in chat. Payments run through PayChangu
(Airtel Money, TNM Mpamba, cards).

## What's actually here vs. what's simulated

This is real, runnable code — not a mockup. But "runnable" and "ready to take
real people's money" are different bars. Specifically:

- **Backend, matching, chat, and payment gating logic are real** and will
  work as soon as you run it.
- **Payments will not work until you add real PayChangu credentials.** Without
  them, `/api/payments/initiate` returns a clear error instead of pretending
  to succeed.
- **The database is a JSON file** (`data.json`), fine for testing, not safe
  for concurrent real users — see `lib/db.js` for the upgrade note.
- **Age verification is a self-reported date of birth**, not real identity
  verification. See "Before you take this live" below — this is the single
  biggest legal/safety gap given the product connects strangers to meet up.

## Setup

```bash
npm install
cp .env.example .env
# edit .env: set JWT_SECRET to a real random string,
# and PAYCHANGU_SECRET_KEY / PAYCHANGU_PUBLIC_KEY once you have a merchant account
npm start
```

Then open `http://localhost:4000`.

To get real PayChangu keys: register a business account at paychangu.com,
verify it, and pull the keys from your merchant dashboard. Their webhook
(`PAYCHANGU_CALLBACK_URL`) needs a public HTTPS URL to reach you — `localhost`
won't work until you deploy, or use a tunnel like ngrok for local testing.

## Deploying somewhere real

This is a plain Node.js app, so it runs on any standard host — Render,
Railway, a VPS with PM2, etc. You'll need:
1. A domain with HTTPS (required for PayChangu's webhook and for browser
   geolocation to work on most browsers).
2. Real environment variables set on the host (never commit `.env`).
3. A real database before you have concurrent users — swap `lib/db.js` for
   Postgres or similar; the JSON file will corrupt under simultaneous writes.

## Before you take this live: things beyond code

These aren't optional extras — they're the difference between a legal
business and a liability:

- **Business registration.** PayChangu (and any payment processor) will
  require a registered business to hold a merchant account and receive payouts.
- **Real age assurance.** A self-reported birthdate is trivial to fake. Given
  this product arranges in-person meetings between adults, consider a real ID
  check (many African-market KYC providers support Malawi) before launch, not
  after an incident.
- **Terms of service and a privacy policy**, written in plain language,
  disclosing exactly what's charged and when — especially the phone-number
  fee, since undisclosed or unclear charges are the kind of thing that draws
  regulatory and payment-processor scrutiny.
- **Data protection compliance.** You're storing precise location and payment
  history for people — check Malawi's data protection obligations, and make
  deletion/export actually work, not just in theory.
- **A safety/reporting flow.** Any app connecting strangers for in-person
  meetings needs a block/report mechanism and a way for you to act on reports
  quickly. This codebase doesn't include one yet — worth prioritizing before
  real users show up.
- **Content moderation.** Someone will eventually send something abusive,
  illegal, or dangerous. Decide your moderation approach before launch, not
  during a crisis.

## Project structure

```
server.js              - entry point
lib/db.js               - JSON file storage (swap for Postgres before real launch)
lib/distance.js          - haversine distance for "nearby"
lib/paychangu.js         - PayChangu payment gateway wrapper
middleware/auth.js       - JWT session check
routes/auth.js           - signup (18+ enforced) / login
routes/users.js          - location, preferences, nearby search
routes/messages.js       - chat, subscription gate, phone-number payment gate
routes/payments.js       - initiate payment, PayChangu webhook, status polling
public/index.html        - frontend
public/payment-complete.html - handles the redirect back from PayChangu checkout
```
