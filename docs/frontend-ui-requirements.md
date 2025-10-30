# Front-End UI/UX Requirements

This document outlines every page/screen the new dashboard application must cover. Share this with design so
the UI team can produce layouts that match the existing back-end capabilities.

## 1. Public Onboarding Flow

### 1.1 Landing / Sign-Up

- **Goal**: Capture business info and create a tenant account.
- **Content & Inputs**
  - Business name, industry, timezone, primary email, password, confirm password.
  - Checkbox confirming Square account (link to setup guide if unchecked).
  - CTA: “Continue to Voice Preferences”.
- **States**: Validation errors, duplicate email warning, success toast leading to next step.

### 1.2 Voice Preferences

- **Goal**: Let user select from curated 11Labs voices and adjust sliders.
- **Content**
  - Voice cards (name, gender, accent tags, 5-sec preview audio).
  - Controls: Temperature slider, Speaking speed slider, Language dropdown, Background ambience.
  - Default voice preselected (11labs-Hailey).
- **Interactions**: Play/pause preview, save & continue, back to previous step.

### 1.3 Square OAuth Status

- **Goal**: Guide the user through Square OAuth and show progress.
- **Content**
  - Stepper (Pending Square OAuth → Authorizing… → Success/Failure).
  - CTA: “Connect with Square” (opens OAuth window).
  - Post-success message and next steps.
- **States**: Error state with retry, spinner while waiting for callback.

### 1.4 Phone Number Choice

- **Goal**: Decide between new Retell number or existing number.
- **Content**
  - Radio options: “Use new AI number” (with area code input) or “Keep existing number”.
  - Info card summarizing forwarding/porting instructions.
- **States**: Show follow-up instructions if existing number chosen.

### 1.5 Confirmation / QA Pending

- **Goal**: Final onboarding screen summarizing status.
- **Content**
  - Checklist (Voice saved, Square connected, Phone number assigned, QA pending).
  - Estimated activation time, contact info for support, link to dashboard login.

## 2. Tenant Dashboard (Authenticated)

### 2.1 Layout Shell

- **Global Elements**: Sidebar navigation, top bar (tenant name, alerts bell, profile menu), responsive
  design.
- **Firebase**: Optional dark/light mode toggle.

### 2.2 Overview / Home

- **Content**
  - Usage summary card (minutes used vs plan).
  - Latest calls list (5 most recent with status/sentiment).
  - Quick actions: “Purchase phone number”, “View analytics”, “Open support ticket”.

### 2.3 Call Logs & Call Detail

- **Call Logs Table**
  - Columns: Timestamp, Caller number/name, Duration, Outcome, Sentiment, Agent state.
  - Filters: Date range, sentiment, outcome, search by number/email.
  - Pagination with export CSV option.
- **Call Detail Drawer/Page**
  - Transcript with highlights (hallucination flags, escalation markers).
  - Booking info, sentiment gauge, link to support ticket if one exists.
  - Buttons: Replay recording (if available), mark as reviewed.

### 2.4 Usage & Billing

- **Usage Metrics**: Plan allowance, minutes used, overage projection, usage by day chart.
- **Billing**: Current plan, next invoice date, payment method card, upgrade/downgrade CTAs.
- **Integration**: Link to Stripe customer portal.

### 2.5 Analytics (Week 6 deliverables)

- **Charts**
  - Peak Call Times bar chart (24-hour buckets).
  - Booking Conversion trend line (daily).
  - Language Breakdown pie/donut chart.
  - Outcome Distribution stacked bar.
- **Filters**: Date range (7/30/90 days), tier gating (Mid/Premium only).
- **Alert Module** (Premium roadmap): configure thresholds for negative sentiment spikes.

### 2.6 Customer Memory Management (Week 9)

- **Profile List**
  - Card/table with caller name, phone, last call date, total calls/bookings.
  - Search by phone/email/name.
- **Profile Detail**
  - Overview: contact info, total calls, preferred language, favorite staff/services.
  - Conversation context entries: key, value, confidence, source, edit/delete icons.
  - Change log timeline (who changed what, when).
  - Open issues list (from `open_issues`).
- **Editing UX**
  - Modal or inline form to add/update context entry (value type switcher for text/boolean/json).
  - Delete confirmation dialog.

### 2.7 Phone Number Management (Week 8)

- **Numbers List**
  - Table: Phone number, status (active/releasing/ported), assignment type, linked agent, forwarding number.
  - Buttons: “Purchase new number”, “Update forwarding”, “Request port”.
- **Purchase Flow**
  - Modal collecting area code, voice provider, confirmation.
- **Forwarding/Porting**
  - Form for forwarding number + instructions.
  - Porting status tracker with checklist (documents, carrier contact, estimated completion).

### 2.8 Support Tickets

- **Ticket List**
  - Filters: Status, severity, issue category.
  - Columns: Created date, call summary, severity badge, status, assignee.
- **Ticket Detail**
  - Diagnostic summary (AI-generated), transcript snippet, root cause, recommendation, prevention.
  - Action buttons: mark resolved, acknowledge, add internal note.
  - Link to associated call and customer profile.
- **Create Ticket Form** (Manual): subject, description, attach call ID, severity, channel (email/SMS).

### 2.9 Settings & Notifications

- **Account Settings**: profile info, password change, time zone, API keys.
- **Notification Settings**
  - Sentiment alerts, issue-detection alerts, billing alerts.
  - Multi-recipient SMS/email configuration (Premium only).
- **Integrations**: Square re-auth, Retell voice toggles (read-only preview/audit).

## 3. Admin Console

### 3.1 QA Dashboard

- **Content**: Pending agents list (tenant, business name, created date), test call CTA, approve/return
  buttons.
- **Detail Panel**: Onboarding data, voice selection, phone status, QA checklist notes.

### 3.2 Support Ticket Monitor

- **Cross-tenant view**: Show all open tickets, severity, assigned staff, tenant info.
- **Filters**: Tenant, severity, age, AI vs manual.
- **Actions**: Reassign, update status/notes, view associated call transcript.

### 3.3 Phone Numbers Admin View

- **Table**: Tenant, phone number, status, forwarding number, porting state, notes.
- **Actions**: Edit status/notes, trigger release, view purchase metadata.

### 3.4 Analytics Overview (Cross-tenant)

- **Metrics**: Active tenants, total minutes, issue rate, overall sentiment trend.
- **Charts**: Top tenants by usage, ticket volume, success rate.

## 4. Public Help & Support (Future Week 10 scope)

- **Help Center**: Article list (getting started, forwarding, porting, billing, troubleshooting).
- **AI Support Widget**: Chat/IVR interface for FAQs.
- **Status Page**: Component health, uptime, incident history.

## 5. General UX Notes

- Responsive design for desktop/tablet; mobile views prioritized for summary dashboards.
- Consistent design system: typography, spacing, voice iconography; integrate brand colors.
- Accessibility: WCAG AA contrast, keyboard nav for tables/forms.
- Toasts/snackbars for success/failure messages; inline validation for forms.
- Provide skeleton loaders/spinners while data fetches (call logs, analytics, memory detail).

This list reflects current back-end capability. Designers can use it to produce high-fidelity mocks for the
new `dashboard/` app.
