# 🚀 AI Receptionist SaaS Platform - Master Plan & Roadmap

**Project**: Square Middleware → Full SaaS Platform Transformation  
**Date Created**: October 29, 2025  
**Status**: Planning Phase  
**Owner**: Nicolas dos Santos

---

## 📋 Table of Contents

1. [Strategic Questions & Decisions](#strategic-questions--decisions)
2. [Technical Architecture](#technical-architecture)
3. [Implementation Roadmap](#implementation-roadmap)
4. [Timeline & Milestones](#timeline--milestones)
5. [Risk Assessment](#risk-assessment)

---

## 🎯 Strategic Questions & Decisions

### **Question 1: Square Account Requirement**

**Q: Should customers be required to have an existing Square account, or should we help them create one?**

**Your Answer**: ✅ Require existing Square accounts initially (pragmatic launch strategy)

**Decision Rationale**:

- Square doesn't provide API for account creation
- Manual Square account creation is straightforward for business owners
- Reduces our operational burden during MVP phase
- We can provide a clear guide for Square account setup

**Implementation Impact**:

- Signup form includes checkbox: "I have a Square account with online booking enabled"
- If NO → Show link to Square signup guide + set status to `pending_square_account`
- If YES → Proceed directly to OAuth authorization
- Follow-up automation: Email reminder after 3 days if still pending Square account

---

### **Question 2: Automation Level - Customer Onboarding**

**Q: How automated should the customer onboarding process be?**

**Your Answer**: ✅ **Option B - Semi-Automated with QA Gate**

**Decision Rationale**:

- Quality control is critical for customer-facing AI agents
- Prevents broken agents from going live
- Allows us to catch hallucinations, configuration errors, API issues
- Manual QA gates are temporary - can automate later with confidence

**Onboarding Flow**:

```
Customer Signs Up
  ↓
Fill Voice Preferences
  ↓
Authorize Square OAuth (automatic token storage)
  ↓
AUTO: Retell Agent Created (via API)
  ↓
Status: "pending_qa"
  ↓
MANUAL: Admin Tests Agent (2-3 test calls)
  ↓
Admin Approves → Status: "active"
  ↓
Customer Receives Welcome Email + Phone Number
```

**Implementation Impact**:

- Need admin QA dashboard with test call functionality
- Need pending_activations table to track QA queue
- Need email notifications to admin when new agent created
- Estimated QA time: 10-15 minutes per customer

---

### **Question 3: Voice Customization Options**

**Q: How much voice customization should customers have?**

**Your Answer**: ✅ **Option 2+ (Enhanced Voice Selection with Language Support)**

**Customization Options Offered**:

1. **Voice Selection** (7-8 curated options):

   - 11labs-Cimo (Male, Warm & Professional) ⭐ Default
   - 11labs-Matilda (Female, Friendly & Calm)
   - 11labs-Jessica (Female, Energetic & Upbeat)
   - 11labs-Daniel (Male, Clear & Authoritative)
   - 11labs-Lily (Female, Soft & Reassuring)
   - openai-Alloy (Neutral & Versatile)
   - deepgram-Angus (Male, Deep & Confident)

2. **Voice Temperature** (slider):

   - Range: 0.8 to 1.3
   - Default: 1.05
   - Label: "Voice Stability" (Lower = consistent, Higher = expressive)

3. **Voice Speed** (slider):

   - Range: 0.8 to 1.3
   - Default: 1.08
   - Label: "Speaking Speed"

4. **Language** (dropdown):

   - Multi-language (English, Spanish, Portuguese) ⭐ Default
   - English (US)
   - Spanish (Latin America)
   - Portuguese (Brazil)
   - French (Canada)
   - Chinese (Mandarin)
   - Russian

5. **Background Ambience** (dropdown):
   - Professional Office (call-center) ⭐ Default
   - No Background Sound
   - Casual Cafe (coffee-shop)
   - Minimal Static

**Business Hours**: ✅ **Automatically fetched from Square API** (location business hours)

**Implementation Impact**:

- Voice preferences stored in `voice_preferences` table
- Each tenant can have custom voice configuration
- Preview audio URLs fetched from Retell API for voice selection
- Language setting affects Retell agent `language` parameter

---

### **Question 4: Database Storage Strategy**

**Q: Where should we store customer tokens and configuration data?**

**Your Answer**: ✅ **Option A - PostgreSQL with pgcrypto encryption**

**Decision Rationale**:

- Eliminates app restarts for new customers (critical for scaling)
- Enables true multi-tenancy without manual configuration updates
- Row-level encryption using pgcrypto extension provides good security
- Lower infrastructure cost than Azure KeyVault during MVP phase
- Simpler architecture with fewer moving parts
- Can upgrade to KeyVault hybrid approach later when revenue justifies it

**Technical Implementation**:

```sql
-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Example encrypted token storage
INSERT INTO square_credentials
  (tenant_id, square_access_token, square_refresh_token)
VALUES
  ($1,
   pgp_sym_encrypt($2, $3),  -- $3 = encryption key from env var
   pgp_sym_encrypt($4, $3));

-- Decrypt when needed
SELECT
  pgp_sym_decrypt(square_access_token::bytea, $1) as access_token
FROM square_credentials
WHERE tenant_id = $2;
```

**Security Measures**:

- Encryption key stored in Azure App Service environment variable (DB_ENCRYPTION_KEY)
- Regular key rotation policy (every 90 days)
- Audit logging for all token access
- Database backups encrypted at rest
- TLS/SSL for all database connections

**Implementation Impact**:

- Need to provision Azure Database for PostgreSQL Flexible Server
- Migration script to move from AGENT_CONFIGS to PostgreSQL
- Update all services to read from database instead of environment variables
- No more app restarts for new customer onboarding
- Supports horizontal scaling (multiple app instances can share database)

---

### **Question 5: Retell LLM Template Strategy**

**Q: Should we clone your existing Elite Barbershop LLM for each customer, or create a master template LLM?**

**Your Answer**: ✅ **Option D - Master Template Per Industry + Manual Customization**

**Decision Rationale**:

- You will create and maintain master LLM templates for each industry (Barbershop, Hair Salon, Spa, etc.)
- System auto-fills customer-specific details into the template (business name, location, staff names,
  services)
- You will manually meet with each customer to fine-tune their agent after creation
- Balances automation (quick initial setup) with personalization (custom tweaks per business)

**Implementation Approach**:

**Phase 1: Onboarding Automation**

```javascript
// When customer signs up → Auto-create agent from industry template
const industryTemplates = {
  barbershop: 'llm_a2ffdaa701d30ccfd5215ddb639f', // Elite Barbershop LLM
  hair_salon: 'llm_xyz_hair_salon_template',
  spa: 'llm_xyz_spa_template',
  beauty_salon: 'llm_xyz_beauty_salon_template',
  wellness_center: 'llm_xyz_wellness_template'
};

// Auto-populate template variables:
// - {{business_name}} → "Joe's Barbershop"
// - {{location_address}} → "123 Main St, City"
// - {{available_staff}} → from Square API
// - {{available_services}} → from Square API
// - {{business_hours}} → from Square API
```

**Phase 2: Manual Customization Flow**

```
Customer Signs Up → Agent Auto-Created → Status: "pending_customization"
  ↓
You Schedule Meeting with Customer
  ↓
Customer Call: Discuss tone, special instructions, edge cases
  ↓
You Manually Edit Agent Prompt in Retell Dashboard
  ↓
Status: "pending_qa" → You Test Agent
  ↓
Status: "active" → Customer Goes Live
```

**Template Variables to Auto-Fill**:

- Business name, location, timezone
- Staff names and IDs (from Square)
- Service catalog (from Square)
- Business hours (from Square)
- Customer's preferred language
- Industry-specific terminology

**Manual Customization Examples**:

- "Don't book kids under 5 years old"
- "Always upsell beard trim after haircut"
- "Mention our loyalty program on every call"
- "Transfer complex requests to owner's cell"
- Tone adjustments (more formal, more casual, bilingual phrases)

**Implementation Impact**:

- Database needs `llm_template_id` field per tenant (links to industry template)
- System auto-fetches Square data (staff, services, hours) and populates template
- Admin dashboard needs "Customize Agent" button → opens Retell dashboard
- Status tracking: `pending_customization` → `pending_qa` → `active`
- You maintain master templates, not per-customer LLMs
- Customers can request re-customization meetings anytime

**Workflow Timeline Per Customer**:

1. **Day 0**: Customer signs up, auto-agent created (5 min automated)
2. **Day 1**: You schedule customization call with customer
3. **Day 2-3**: 30-minute customer call, you edit agent prompt
4. **Day 3**: You QA test agent (10-15 min)
5. **Day 3-4**: Customer goes live

---

### **Question 6: Phone Number Management**

**Q: How should phone numbers be assigned to customers?**

**Your Answer**: ✅ **Offer All Three Options - Customer Chooses**

**Decision Rationale**:

- Different customers have different needs and technical comfort levels
- Flexibility increases conversion rate (more signup options = more customers)
- We handle the complexity, customer picks what works for them

**Three Phone Number Options**:

**Option 1: Dedicated Retell Number (Easiest)**

- ✅ **Best for**: New businesses or customers who want simplicity
- We purchase a new phone number via Retell API
- Customer receives the new number and starts using it immediately
- No setup required from customer
- They promote this new number to customers
- **Pricing**: Included in base subscription (number cost passed through or absorbed)

**Option 2: Call Forwarding (Most Common)**

- ✅ **Best for**: Established businesses with existing customer base
- We create a Retell phone number
- Customer keeps using their existing business number
- We provide step-by-step call forwarding setup instructions
- Customer forwards their existing number → Retell number
- AI answers, customers still dial familiar number
- **Pricing**: Included in base subscription (small forwarding fee absorbed)

**Option 3: Number Porting via Twilio/Telnyx (Advanced)**

- ✅ **Best for**: Businesses who want to fully own/control their number in Retell ecosystem
- Customer initiates number port from current carrier to Twilio/Telnyx
- We help coordinate the porting process (usually 7-14 days)
- Once ported, number connects directly to Retell
- Customer owns the number in Twilio/Telnyx account
- **Pricing**: Customer pays Twilio/Telnyx directly (~$1-2/month), we provide porting support

**Implementation Approach**:

**Signup Form - Phone Number Section**:

```javascript
{
  phoneNumberPreference: {
    type: 'radio',
    label: 'How would you like to handle your phone number?',
    options: [
      {
        value: 'new_retell_number',
        label: 'Get a new number from us (Recommended for new businesses)',
        description: 'We provide a new phone number. Start using it immediately.',
        setupTime: 'Instant',
        technicalDifficulty: 'Easy',
        cost: 'Included'
      },
      {
        value: 'call_forwarding',
        label: 'Keep my existing number (Recommended for established businesses)',
        description: 'Forward your current number to our system. We provide instructions.',
        setupTime: '5-10 minutes',
        technicalDifficulty: 'Medium',
        cost: 'Included'
      },
      {
        value: 'port_number',
        label: 'Port my existing number (Advanced)',
        description: 'Transfer ownership of your number to Twilio/Telnyx. Full control.',
        setupTime: '7-14 days',
        technicalDifficulty: 'Hard',
        cost: 'Extra (~$1-2/month via Twilio)'
      }
    ]
  },

  // If call_forwarding selected
  existingPhoneNumber: {
    type: 'tel',
    label: 'Your existing business phone number',
    showIf: "phoneNumberPreference === 'call_forwarding'"
  },

  // If port_number selected
  portingDetails: {
    currentCarrier: { type: 'text', label: 'Current phone carrier' },
    accountNumber: { type: 'text', label: 'Carrier account number' },
    portingNotes: { type: 'textarea', label: 'Any special requirements?' },
    showIf: "phoneNumberPreference === 'port_number'"
  }
}
```

**Onboarding Flow Per Option**:

**Flow 1: New Retell Number**

```
Customer Signs Up → Select "Get new number"
  ↓
System calls Retell API: POST /phone-numbers (purchase number)
  ↓
Number instantly provisioned (e.g., +1-555-BARBER-1)
  ↓
Link number to agent_id in Retell
  ↓
Status: "active" (ready immediately)
  ↓
Send email: "Your AI receptionist is live at (555) 227-2371"
```

**Flow 2: Call Forwarding**

```
Customer Signs Up → Select "Keep my existing number"
  ↓
System creates Retell number (forwarding destination)
  ↓
Generate custom forwarding instructions based on customer's carrier
  ↓
Send email with step-by-step guide:
  - AT&T: Dial *72 + (forwarding number)
  - Verizon: Dial *72 + (forwarding number)
  - T-Mobile: Settings > Call Forwarding
  - Google Voice: Settings > Forwarding
  ↓
Status: "pending_forwarding_setup"
  ↓
Customer completes setup (we provide test call to verify)
  ↓
Status: "active"
```

**Flow 3: Number Porting**

```
Customer Signs Up → Select "Port my existing number"
  ↓
System creates porting request ticket
  ↓
You coordinate with customer via email/call
  ↓
Customer initiates port with Twilio/Telnyx (we provide LOA template)
  ↓
Status: "pending_port" (7-14 days)
  ↓
Port completes → Twilio/Telnyx number connects to Retell
  ↓
Status: "active"
```

**Database Schema Updates**:

```sql
CREATE TABLE phone_numbers (
  phone_number_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(tenant_id),
  phone_number VARCHAR(20) NOT NULL,  -- E.164 format
  phone_number_type VARCHAR(50) NOT NULL,  -- 'retell_new', 'retell_forwarding', 'ported_twilio', 'ported_telnyx'
  retell_phone_number_id VARCHAR(255),  -- Retell's phone number ID
  forwarding_from VARCHAR(20),  -- Original number if using forwarding
  carrier_name VARCHAR(100),  -- Customer's original carrier
  porting_status VARCHAR(50),  -- 'completed', 'pending', 'failed' (for ports)
  porting_initiated_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Implementation Impact**:

- Need Retell phone number purchase API integration
- Need call forwarding instruction templates per carrier
- Need porting coordination workflow (manual process)
- Admin dashboard shows phone number status per customer
- Automated testing: system dials customer number to verify setup
- Support documentation for each option

**Recommendation for MVP**: Start with Options 1 & 2 (instant), add Option 3 (porting) in Phase 2 when
customers request it.

---

### **Question 7: Pricing Model**

**Q: What pricing structure should we use?**

**Your Answer**: ✅ **Early Adopter Pricing with Tiered Features**

**Decision Rationale**:

- Setup fee covers your manual customization time (30-60 min per customer)
- Early adopter discount incentivizes first 20 customers (market validation)
- Tiered features allow upselling as customers see value
- Trial period proves ROI before customer commits

**Pricing Structure**:

**Setup Fee (One-Time)**:

- First 20 customers: **$500** (includes agent customization meeting + QA testing)
- After 20 customers: **$1,000** (standard rate)
- What's included: Agent template customization, voice tuning, test calls, go-live support

**14-Day Free Trial**:

- Full access to chosen tier
- Up to 100 minutes of call time
- No credit card required to start
- After trial: Convert to paid or cancel

**Monthly Subscription Tiers**:

| Feature                 | Basic             | Mid-Tier                     | Premium                     |
| ----------------------- | ----------------- | ---------------------------- | --------------------------- |
| **Price (First 20)**    | $99/mo            | $199/mo                      | $399/mo                     |
| **Price (After 20)**    | $199/mo           | $399/mo                      | $699/mo                     |
| **Included Minutes**    | 500 min/mo        | 1,000 min/mo                 | Unlimited                   |
| **Overage Rate**        | $0.25/min         | $0.20/min                    | N/A                         |
| **Languages**           | 1 language        | Up to 3 languages            | Unlimited                   |
| **Customer Memory**     | ❌ No (stateless) | ✅ Yes (remembers customers) | ✅ Yes (advanced memory)    |
| **Dashboard Analytics** | ❌ Basic only     | ✅ Full analytics            | ✅ Advanced insights        |
| **SMS Notifications**   | ✅ SMS to owner   | ✅ SMS to owner              | ✅ SMS to owner + staff     |
| **Warm Handoff**        | ❌ No             | ✅ Yes (transfer to owner)   | ✅ Yes (transfer to anyone) |
| **Call Recordings**     | 30 days           | 90 days                      | 1 year                      |
| **Support**             | Email only        | Email + Chat                 | Priority phone support      |

**Feature Breakdown by Tier**:

**Basic Tier ($99/$199)**:

- ✅ AI receptionist answers calls
- ✅ Books/updates/cancels appointments via Square
- ✅ Answers basic questions (hours, location, services)
- ✅ Single language (e.g., English only)
- ✅ SMS notification to owner for important calls
- ✅ Call logs and recordings (30 days)
- ❌ Agent forgets customers between calls (no memory)
- ❌ No analytics dashboard
- ❌ No call transfers
- **Best for**: Solo practitioners, tight budgets, simple needs

**Mid-Tier ($199/$399)**:

- ✅ Everything in Basic
- ✅ **Customer Memory**: Remembers past conversations, preferences, favorite staff
- ✅ **Multi-Language**: Support up to 3 languages (e.g., English + Spanish + Portuguese)
- ✅ **Analytics Dashboard**: Call metrics, booking conversion, peak times
- ✅ **Warm Handoff**: Transfer complex calls to owner's phone
- ✅ SMS notifications to owner
- ✅ Call recordings (90 days)
- ✅ Live chat support
- **Best for**: Growing businesses, multi-cultural clientele, want insights

**Premium Tier ($399/$699)**:

- ✅ Everything in Mid-Tier
- ✅ **Unlimited Minutes**: No overage charges ever
- ✅ **Unlimited Languages**: Support any Retell-supported language
- ✅ **Advanced Memory**: AI learns business-specific context over time
- ✅ **Advanced Analytics**: Sentiment analysis, revenue impact, AI performance scoring
- ✅ **Multi-Person Handoff**: Transfer to owner, staff, or manager
- ✅ SMS to owner + staff members
- ✅ Call recordings (1 year retention)
- ✅ Priority phone support
- ✅ Quarterly optimization calls with you
- **Best for**: Multi-location businesses, high call volume, enterprise needs

**Implementation Impact**:

**Database Schema Updates**:

```sql
CREATE TABLE subscription_tiers (
  tier_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(tenant_id) UNIQUE,
  tier_name VARCHAR(50) NOT NULL,  -- 'basic', 'mid', 'premium'
  monthly_price DECIMAL(10,2) NOT NULL,
  setup_fee_paid DECIMAL(10,2),
  included_minutes INTEGER,  -- NULL for unlimited
  overage_rate DECIMAL(5,2),  -- NULL for unlimited
  languages_allowed INTEGER,  -- NULL for unlimited
  has_memory BOOLEAN DEFAULT false,
  has_dashboard BOOLEAN DEFAULT false,
  has_warm_handoff BOOLEAN DEFAULT false,
  recording_retention_days INTEGER DEFAULT 30,
  trial_ends_at TIMESTAMP,
  billing_cycle_start DATE,
  status VARCHAR(50) DEFAULT 'trial',  -- 'trial', 'active', 'suspended', 'cancelled'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE usage_tracking (
  usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(tenant_id),
  call_id VARCHAR(255),  -- Retell call_id
  call_date DATE NOT NULL,
  call_duration_seconds INTEGER,
  call_cost DECIMAL(10,4),  -- Calculated cost for overage
  billing_month VARCHAR(7),  -- '2025-10' format
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE invoices (
  invoice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(tenant_id),
  invoice_number VARCHAR(50) UNIQUE,
  billing_period_start DATE,
  billing_period_end DATE,
  base_subscription_fee DECIMAL(10,2),
  included_minutes INTEGER,
  used_minutes INTEGER,
  overage_minutes INTEGER,
  overage_charges DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'paid', 'overdue'
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Feature Flag System**:

```javascript
// src/utils/featureFlags.js
const getFeatureFlags = tier => {
  const features = {
    basic: {
      hasMemory: false,
      hasDashboard: false,
      hasWarmHandoff: false,
      maxLanguages: 1,
      recordingRetentionDays: 30,
      smsNotifications: ['owner'],
      supportLevel: 'email'
    },
    mid: {
      hasMemory: true,
      hasDashboard: true,
      hasWarmHandoff: true,
      maxLanguages: 3,
      recordingRetentionDays: 90,
      smsNotifications: ['owner'],
      supportLevel: 'email_chat'
    },
    premium: {
      hasMemory: true,
      hasDashboard: true,
      hasWarmHandoff: true,
      maxLanguages: null, // unlimited
      recordingRetentionDays: 365,
      smsNotifications: ['owner', 'staff'],
      supportLevel: 'priority_phone'
    }
  };
  return features[tier];
};
```

**Billing Implementation**:

- Stripe integration for subscription management
- Automatic monthly invoicing
- Usage tracking per call via Retell webhooks
- Overage calculation at end of billing cycle
- Email invoice to customer + auto-charge card on file
- Grace period: 7 days past due before suspension

**Trial-to-Paid Conversion Flow**:

```
Day 0: Customer signs up → 14-day trial starts
Day 7: Email reminder: "You've used X minutes, 7 days left"
Day 13: Email: "Trial ends tomorrow! Add payment method"
Day 14: Trial expires
  ↓
Payment method on file?
  → YES: Auto-convert to paid subscription
  → NO: Agent paused, email: "Add payment to reactivate"
```

**Early Adopter Incentives (First 20 Customers)**:

- 50% discount on setup fee ($500 vs $1,000)
- Lock in discounted monthly pricing forever (grandfathered)
- Free upgrade to next tier for 3 months
- Direct access to you for support
- Featured in case studies / testimonials

**Implementation Impact**:

- Need Stripe integration for payment processing
- Need usage tracking from Retell webhook (call duration)
- Need automated billing cycle calculation
- Need invoice generation and email delivery
- Need trial expiration monitoring + auto-conversion
- Admin dashboard to view MRR, churn rate, ARPU

---

### **Question 8: Customer Dashboard Features (Phase 1)** ⚠️ **[REVISIT]**

**Q: What features should the customer dashboard have initially?**

**Your Answer**: ✅ **Tiered Dashboard with MVP-First Approach** _(Subject to review)_

**Decision Rationale**:

- Start with essential features to validate product-market fit
- Tier-gate advanced features to incentivize upgrades
- Build analytics incrementally based on customer feedback
- Prioritize features that drive retention and reduce churn

**MVP Dashboard Features by Tier**:

**Basic Tier Dashboard (MVP Launch)**:

- ✅ **Usage Tracking**: Minutes used / remaining this month
- ✅ **Overage Alert**: Warning when approaching limit
- ✅ **Billing Info**: Current plan, next invoice date, payment method
- ✅ **Agent Status**: Pause/Resume agent toggle
- ✅ **Basic Call List**: Last 10 calls (date, time, duration only)
- ✅ **Download Invoice**: PDF invoice downloads
- ❌ No recordings, no transcripts, no analytics

**Mid-Tier Dashboard (MVP Launch)**:

- ✅ Everything in Basic
- ✅ **Full Call Logs**: Paginated list of all calls with search/filter
- ✅ **Call Recordings**: Click to play audio
- ✅ **Call Transcripts**: Read full conversation text
- ✅ **Booking Success Rate**: % of calls that resulted in bookings
- ✅ **Peak Call Times Chart**: When customers call most (bar chart)
- ✅ **Language Breakdown**: % of calls in each language (pie chart)
- ✅ **Common Questions**: Top 5 FAQ topics this month
- ✅ **Agent Settings**: Update business hours, voice preferences

**Premium Tier Dashboard (Phase 2 - Post-Launch)**:

- ✅ Everything in Mid-Tier
- ⏳ **Sentiment Analysis**: Happy/neutral/frustrated caller trends (Phase 2)
- ⏳ **AI Performance Score**: Hallucination detection, accuracy metrics (Phase 2)
- ⏳ **Revenue Impact**: Estimated booking value from AI calls (Phase 2)
- ⏳ **Customer Insights**: Repeat caller patterns, VIP detection (Phase 2)
- ⏳ **Monthly Business Report**: Auto-generated PDF with insights (Phase 2)

**Universal Features (All Tiers - MVP)**:

- ✅ **Account Settings**: Email, password, timezone, notification preferences
- ✅ **Support**: In-app support ticket submission
- ✅ **Documentation**: Help center links, video tutorials

**Implementation Priority**:

**Phase 1 (MVP - Week 1-4)**:

1. Basic authentication (email/password login)
2. Usage tracking dashboard (all tiers)
3. Pause/resume agent (all tiers)
4. Call logs with search (Mid/Premium only)
5. Call recordings playback (Mid/Premium only)
6. Billing page with invoice downloads (all tiers)

**Phase 2 (Post-Launch - Week 5-8)**:

1. Call transcripts display
2. Booking success rate analytics
3. Peak call times chart
4. Agent settings editor
5. Language breakdown chart

**Phase 3 (Future - Month 3+)**:

1. Sentiment analysis
2. AI performance scoring
3. Revenue impact calculator
4. Advanced customer insights
5. Auto-generated reports

**Technical Stack for Dashboard**:

- Frontend: React + Tailwind CSS
- Authentication: JWT tokens (httpOnly cookies)
- API: RESTful endpoints from existing Express app
- Charts: Chart.js or Recharts
- Audio Player: Wavesurfer.js for call recordings
- State Management: React Context API or Zustand

**Dashboard Data Sources**:

- Retell API: Call logs, recordings, transcripts
- PostgreSQL: Usage tracking, billing data, agent configs
- Square API: Booking success validation (match calls to appointments)

**⚠️ NOTE**: This feature set is subject to revision after customer interviews and validation.

---

### **Question 9: Security & Compliance** ⚠️ **[REVISIT]**

**Q: What security measures and compliance requirements are critical for launch?**

**Your Answer**: ✅ **Compliance-First Approach with MVP Requirements** _(Subject to legal review)_

**Decision Rationale**:

- Legal compliance protects business from lawsuits and fines
- Privacy-first approach builds customer trust
- Start with essential compliance, add certifications as needed
- Better to over-disclose than under-disclose

**Call Recording & Transcript Consent**: ⚠️ **IMPORTANT**: Even without audio recordings, **transcripts
require consent** in many jurisdictions.

**Consent Strategy**:

```javascript
// Agent greeting includes disclosure
"Thank you for calling [Business Name]. I'm your AI receptionist.
This call will be transcribed to assist with your booking. How can I help you today?"
```

**Legal Reasoning**:

- Transcripts contain same personal data as recordings (conversation content)
- Two-party consent states (CA, CT, FL, IL, MD, MA, MT, NH, PA, WA) require disclosure
- GDPR/CCPA treat transcripts as personal data
- Customer continuing call after disclosure = implied consent
- Explicit opt-in for recordings (Mid/Premium tiers)

**Compliance Requirements by Tier**:

**MVP Launch Requirements (All Tiers)**:

- ✅ **GDPR Compliance**: Privacy policy, terms of service, data subject rights (access, deletion,
  portability)
- ✅ **CCPA Compliance**: California privacy disclosures, do-not-sell policy
- ✅ **Call Disclosure**: AI agent announces transcription at call start
- ✅ **Data Encryption**: TLS 1.3 in transit, AES-256 at rest (PostgreSQL + pgcrypto)
- ✅ **Data Retention Policy**:
  - Basic: 30 days (transcripts only, no recordings)
  - Mid: 90 days (transcripts + recordings)
  - Premium: 365 days (transcripts + recordings)
- ✅ **Automatic Data Deletion**: Cron job deletes expired data
- ✅ **Access Controls**: Role-based access (tenant isolation)
- ✅ **Audit Logging**: Track who accessed what data when
- ✅ **Cookie Consent**: GDPR-compliant cookie banner on website/dashboard
- ✅ **Security Headers**: helmet.js (CSP, HSTS, X-Frame-Options)
- ✅ **Rate Limiting**: Prevent brute force attacks
- ✅ **SQL Injection Protection**: Parameterized queries only

**Phase 2 Requirements (Enterprise Growth)**:

- ⏳ **SOC 2 Type II**: Security audit (required for enterprise customers, ~6-12 months, $20k-50k)
- ⏳ **HIPAA Compliance**: If entering medical spa/healthcare market (BAA required)
- ⏳ **ISO 27001**: International security standard
- ⏳ **Penetration Testing**: Third-party security audit

**Not Required (Stripe Handles)**:

- ❌ **PCI DSS**: Stripe handles all payment data, we never see card numbers

**Legal Documentation Needed (MVP Launch)**:

**1. Privacy Policy** (Must include):

- What data we collect (call transcripts, phone numbers, booking info, Square data)
- How we use it (booking appointments, analytics, improving AI)
- Who we share with (Retell AI, Square, Stripe)
- Data retention periods (30/90/365 days by tier)
- User rights (access, delete, export data)
- Contact for privacy requests

**2. Terms of Service** (Must include):

- Service description (AI receptionist)
- User responsibilities (accurate business info, legal use)
- Our responsibilities (uptime SLA, data protection)
- Payment terms (billing cycles, refunds, cancellation)
- Liability limitations
- Dispute resolution (arbitration clause?)

**3. Call Recording Consent** (Must include):

- Disclosure that AI agent will transcribe calls
- Optional recording for Mid/Premium tiers
- How customers can opt-out (hang up or request human)
- How to request deletion of their data

**Data Subject Rights Implementation**:

**Customer Data Export** (GDPR Article 15):

```javascript
// API endpoint: GET /api/customer/data-export
// Returns JSON with all customer's data:
{
  personalInfo: { name, email, phone },
  callLogs: [ { date, duration, transcript, recording_url } ],
  bookings: [ { date, service, staff } ],
  preferences: { language, favoriteStaff }
}
```

**Customer Data Deletion** (GDPR Article 17 / CCPA):

```javascript
// API endpoint: POST /api/customer/delete-account
// Deletes:
- All call transcripts/recordings
- Customer profile data
- Anonymize booking history (keep for business analytics)
- Notify Retell to delete call data
- Keep billing records (legal requirement: 7 years)
```

**Security Implementation Checklist**:

**Application Security**:

- [x] ✅ Already implemented: `helmet.js` for security headers
- [x] ✅ Already implemented: Rate limiting via `express-rate-limit`
- [x] ✅ Already implemented: PII redaction in logs (`logRedactor.js`)
- [x] ✅ Already implemented: Timing-safe authentication comparison
- [ ] 🔲 TODO: JWT token authentication for dashboard
- [ ] 🔲 TODO: CSRF protection for dashboard forms
- [ ] 🔲 TODO: Input validation on all endpoints (express-validator)
- [ ] 🔲 TODO: Dependency vulnerability scanning (npm audit, Snyk)

**Database Security**:

- [ ] 🔲 TODO: Enable pgcrypto for token encryption
- [ ] 🔲 TODO: Row-level security (RLS) policies for tenant isolation
- [ ] 🔲 TODO: Automated backups (Azure DB backup enabled)
- [ ] 🔲 TODO: Read-only database user for analytics queries
- [ ] 🔲 TODO: IP whitelist for database access (Azure firewall rules)

**Incident Response Plan**:

```
1. Data Breach Detection → Alert admin immediately
2. Isolate affected systems → Pause affected tenants
3. Assess scope → Which customers affected?
4. Notify affected users within 72 hours (GDPR requirement)
5. Post-mortem → Document what happened, how to prevent
```

**Implementation Impact**:

- Need lawyer to draft Privacy Policy + Terms of Service (~$2k-5k)
- Need GDPR cookie consent banner on website (use CookieBot or similar)
- Need data export API endpoint for customer requests
- Need data deletion workflow with cascade rules
- Need automated data retention cleanup (cron job)
- Need audit logging table in PostgreSQL
- Need security incident response documentation

**Recommendation**:

- ✅ MVP: Implement all "MVP Launch Requirements" above
- ✅ Hire lawyer for legal docs (non-negotiable)
- ⏳ Phase 2: SOC 2 audit when first enterprise customer requests it
- ⏳ Phase 3: HIPAA if entering healthcare market

**⚠️ NOTE**: This is technical guidance, not legal advice. Consult attorney before launch.

---

### **Question 10: Error Handling & Support Strategy** ⚠️ **[REVISIT]**

**Q: How should we handle production issues and customer support?**

**Your Answer**: ✅ **Multi-Channel Support with AI-Powered Issue Detection** _(Subject to operational
refinement)_

**Decision Rationale**:

- Tiered support matches pricing structure and customer expectations
- AI agent + human wife creates responsive, scalable support model
- Automated issue detection reduces response time and catches problems proactively
- Self-service resources reduce support burden over time

**Support Model by Tier**:

**Basic Tier Support**:

- ✅ **Email**: support@yourdomain.com (24-48 hour response)
- ✅ **AI Phone Agent**: Answers common questions 24/7
- ✅ **AI Chat**: Website chat widget for instant answers
- ✅ **Help Center**: Self-service documentation, FAQs, video tutorials
- ✅ **Status Page**: Real-time system status (status.yourdomain.com)

**Mid-Tier Support**:

- ✅ Everything in Basic
- ✅ **Live Chat**: Human escalation during business hours (9am-5pm)
- ✅ **Priority Email**: 12-24 hour response time
- ✅ **Phone Callback**: Request callback for urgent issues

**Premium Tier Support**:

- ✅ Everything in Mid-Tier
- ✅ **Priority Phone**: Direct line, 4-hour response SLA
- ✅ **Dedicated Support Rep**: Your wife as primary contact
- ✅ **Quarterly Optimization Calls**: Proactive agent tuning

**Internal Support Team**:

- **AI Phone Agent**: First-line support for FAQs, account questions
- **AI Chat Bot**: Website chat for instant responses
- **Your Wife**: Human escalation, complex issues, premium customers
- **You**: Technical issues, agent customization, strategic accounts

---

### **🚨 AUTOMATED ISSUE DETECTION & TICKETING PIPELINE**

**System Overview**: AI-Powered Post-Call Analysis for Failed Calls

**Trigger Event**: Retell webhook sends post-call analysis → System detects unsuccessful call

**Pipeline Flow**:

```text
1. WEBHOOK RECEIVED (Retell Post-Call Analysis)
   ↓
2. DETECT FAILURE (booking_success = "failed" OR escalation_needed = true)
   ↓
3. AI DIAGNOSTIC ANALYSIS (OpenAI GPT-4 analyzes transcript)
   ↓
4. CREATE SUPPORT TICKET (Store in PostgreSQL)
   ↓
5. NOTIFY YOU (Email + SMS)
   ↓
6. APPEND TO POST-CALL EMAIL (Enhanced report)
```

**Detailed Implementation**:

**Step 1: Webhook Detection**

```javascript
// src/controllers/retellWebhookController.js - ENHANCED

async handleCallAnalyzed(req, res) {
  const { call_id, post_call_analysis_data, transcript } = req.body;

  // Existing: Send post-call email
  await retellEmailService.sendPostCallEmail(call_id);

  // NEW: Check for failures
  const bookingSuccess = post_call_analysis_data.find(d => d.name === 'booking_success')?.value;
  const escalationNeeded = post_call_analysis_data.find(d => d.name === 'escalation_needed')?.value;
  const hallucinationDetected = post_call_analysis_data.find(d => d.name === 'hallucination_detected')?.value;

  if (bookingSuccess === 'failed' || escalationNeeded === true || hallucinationDetected === true) {
    // Trigger AI diagnostic pipeline
    await issueDetectionService.analyzeAndCreateTicket({
      call_id,
      transcript,
      post_call_analysis_data,
      agent_id: req.headers['x-agent-id']
    });
  }

  res.sendStatus(200);
}
```

**Step 2: AI Diagnostic Analysis**

```javascript
// src/services/issueDetectionService.js - NEW FILE

const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class IssueDetectionService {
  async analyzeAndCreateTicket({ call_id, transcript, post_call_analysis_data, agent_id }) {
    // 1. Fetch agent configuration and context
    const agentConfig = await this.getAgentConfig(agent_id);
    const retellDocs = await this.getRetellDocumentation();
    const squareDocs = await this.getSquareDocumentation();

    // 2. Call OpenAI for diagnostic analysis
    const diagnosis = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: `You are an AI voice agent debugging expert. Analyze failed calls and diagnose root causes.
          
          You have access to:
          - Full call transcript
          - Post-call analysis data
          - Agent configuration (Retell LLM prompt, tools, states)
          - Retell API documentation
          - Square API documentation
          
          Provide:
          1. Root cause analysis (what went wrong)
          2. Category (hallucination, API error, prompt issue, user error, system failure)
          3. Severity (critical, high, medium, low)
          4. Proposed solution (specific fix with code/prompt changes if applicable)
          5. Prevention strategy (how to avoid in future)`
        },
        {
          role: 'user',
          content: JSON.stringify({
            call_id,
            transcript,
            post_call_analysis: post_call_analysis_data,
            agent_configuration: agentConfig,
            retell_documentation: retellDocs,
            square_documentation: squareDocs
          })
        }
      ],
      response_format: { type: 'json_object' }
    });

    const analysis = JSON.parse(diagnosis.choices[0].message.content);

    // 3. Create support ticket
    const ticket = await this.createTicket({
      call_id,
      agent_id,
      category: analysis.category,
      severity: analysis.severity,
      root_cause: analysis.root_cause,
      proposed_solution: analysis.proposed_solution,
      prevention_strategy: analysis.prevention_strategy,
      transcript_excerpt: this.extractRelevantExcerpt(transcript),
      status: 'open'
    });

    // 4. Send notifications
    await this.notifyAdmin(ticket, analysis);

    // 5. Append to post-call email
    await this.appendToPostCallEmail(call_id, analysis, ticket);

    return ticket;
  }

  async createTicket(data) {
    const result = await db.query(
      `INSERT INTO support_tickets 
       (call_id, agent_id, category, severity, root_cause, proposed_solution, prevention_strategy, transcript_excerpt, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING ticket_id, ticket_number`,
      [
        data.call_id,
        data.agent_id,
        data.category,
        data.severity,
        data.root_cause,
        data.proposed_solution,
        data.prevention_strategy,
        data.transcript_excerpt,
        data.status
      ]
    );
    return result.rows[0];
  }

  async notifyAdmin(ticket, analysis) {
    // Email notification
    await emailService.send({
      to: process.env.ADMIN_EMAIL,
      subject: `🚨 Issue Detected: ${analysis.category} - ${analysis.severity.toUpperCase()}`,
      html: `
        <h2>Call Issue Detected</h2>
        <p><strong>Ticket #:</strong> ${ticket.ticket_number}</p>
        <p><strong>Call ID:</strong> ${ticket.call_id}</p>
        <p><strong>Severity:</strong> <span style="color: ${this.getSeverityColor(analysis.severity)}">${analysis.severity.toUpperCase()}</span></p>
        
        <h3>Root Cause:</h3>
        <p>${analysis.root_cause}</p>
        
        <h3>Proposed Solution:</h3>
        <pre>${analysis.proposed_solution}</pre>
        
        <h3>Prevention:</h3>
        <p>${analysis.prevention_strategy}</p>
        
        <p><a href="${process.env.DASHBOARD_URL}/admin/tickets/${ticket.ticket_id}">View Ticket</a></p>
      `
    });

    // SMS notification via Twilio
    await smsService.send({
      to: process.env.ADMIN_PHONE,
      body: `🚨 Issue Ticket #${ticket.ticket_number}\nSeverity: ${analysis.severity.toUpperCase()}\nCategory: ${analysis.category}\nView: ${process.env.DASHBOARD_URL}/admin/tickets/${ticket.ticket_id}`
    });
  }

  async appendToPostCallEmail(call_id, analysis, ticket) {
    // Enhance the existing post-call email with diagnostic info
    // This gets appended to the email you already receive
    return {
      issueDetected: true,
      ticketNumber: ticket.ticket_number,
      severity: analysis.severity,
      rootCause: analysis.root_cause,
      proposedSolution: analysis.proposed_solution
    };
  }

  getSeverityColor(severity) {
    const colors = {
      critical: '#FF0000',
      high: '#FF6600',
      medium: '#FFAA00',
      low: '#00AA00'
    };
    return colors[severity] || '#666666';
  }

  extractRelevantExcerpt(transcript) {
    // Extract the most relevant 500 characters around the failure point
    // Logic to identify key failure moment in transcript
    return transcript.slice(-500); // Simplified: last 500 chars
  }

  async getAgentConfig(agent_id) {
    // Fetch from database or Retell API
    const agent = await retellClient.agent.retrieve(agent_id);
    return JSON.stringify(agent, null, 2);
  }

  async getRetellDocumentation() {
    // Embedded Retell docs relevant to common issues
    return `
      - availability-get tool: Fetches available time slots
      - booking-create tool: Creates Square appointment
      - Common hallucinations: Making up availability times without calling tool
      - Tool failure handling: Agent should transition to take_message state
    `;
  }

  async getSquareDocumentation() {
    // Embedded Square docs relevant to booking issues
    return `
      - CreateBooking API: Requires valid startAt, customerId or customer details, appointmentSegments
      - Common errors: "email is invalid" (domain blacklist), "service not found", "staff unavailable"
      - Rate limits: 100 requests per minute
    `;
  }
}

module.exports = new IssueDetectionService();
```

**Step 3: Database Schema for Tickets**

```sql
CREATE TABLE support_tickets (
  ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(20) UNIQUE NOT NULL,  -- e.g., "TICKET-2025-001"
  call_id VARCHAR(255) NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  tenant_id UUID REFERENCES tenants(tenant_id),  -- Which customer's agent
  category VARCHAR(50) NOT NULL,  -- 'hallucination', 'api_error', 'prompt_issue', 'user_error', 'system_failure'
  severity VARCHAR(20) NOT NULL,  -- 'critical', 'high', 'medium', 'low'
  root_cause TEXT NOT NULL,
  proposed_solution TEXT NOT NULL,
  prevention_strategy TEXT,
  transcript_excerpt TEXT,
  status VARCHAR(50) DEFAULT 'open',  -- 'open', 'in_progress', 'resolved', 'wont_fix'
  assigned_to VARCHAR(255),  -- Who's working on it
  resolution_notes TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_severity ON support_tickets(severity);
CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at DESC);
```

**Step 4: Enhanced Post-Call Email**

```javascript
// Modify existing retellEmailService.js

async sendPostCallEmail(call_id) {
  const callData = await this.getCallData(call_id);
  const issue = await this.getIssueIfExists(call_id);  // NEW

  const emailBody = `
    <h2>Call Summary - ${callData.business_name}</h2>

    <!-- Existing call details -->
    <p><strong>Call ID:</strong> ${call_id}</p>
    <p><strong>Duration:</strong> ${callData.duration}s</p>
    <p><strong>Caller:</strong> ${callData.caller_phone}</p>
    <p><strong>Booking Success:</strong> ${callData.booking_success}</p>

    ${issue ? `
      <!-- NEW: Issue Detection Section -->
      <hr style="margin: 20px 0; border: 2px solid ${this.getSeverityColor(issue.severity)}">
      <h2 style="color: ${this.getSeverityColor(issue.severity)}">⚠️ Issue Detected</h2>

      <p><strong>Ticket:</strong> ${issue.ticket_number}</p>
      <p><strong>Severity:</strong> ${issue.severity.toUpperCase()}</p>
      <p><strong>Category:</strong> ${issue.category}</p>

      <h3>Root Cause:</h3>
      <p>${issue.root_cause}</p>

      <h3>Proposed Solution:</h3>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px;">${issue.proposed_solution}</pre>

      <h3>Prevention:</h3>
      <p>${issue.prevention_strategy}</p>

      <p>
        <a href="${process.env.DASHBOARD_URL}/admin/tickets/${issue.ticket_id}"
           style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          View Full Ticket
        </a>
      </p>
    ` : ''}

    <p><a href="${process.env.DASHBOARD_URL}/calls/${call_id}">View Full Details</a></p>
  `;

  await emailService.send({
    to: process.env.ADMIN_EMAIL,
    subject: issue
      ? `🚨 Call Issue: ${callData.business_name} - ${issue.category}`
      : `Call Summary: ${callData.business_name}`,
    html: emailBody
  });
}
```

**Step 5: Admin Ticket Dashboard**

```javascript
// GET /admin/tickets - View all open tickets
// GET /admin/tickets/:id - View specific ticket details
// PUT /admin/tickets/:id - Update ticket (mark resolved, add notes)

// Example ticket view:
{
  ticket_number: "TICKET-2025-001",
  call_id: "call_xyz",
  severity: "high",
  category: "hallucination",
  root_cause: "Agent invented availability times without calling availability-get tool",
  proposed_solution: "Update greeting_intent state prompt to emphasize NEVER MAKE UP INFORMATION rule",
  status: "open",
  created_at: "2025-10-29T14:30:00Z",
  call_recording_url: "https://retell.ai/recordings/xyz",
  transcript_excerpt: "Agent: I have 2pm available today... (without calling availability tool)"
}
```

**Notification Preferences**:

```javascript
// Database: admin_notification_preferences
{
  admin_id: 'you',
  email: 'nicolas@yourdomain.com',
  phone: '+1234567890',
  notify_on: ['critical', 'high'],  // Only notify for critical/high severity
  notification_channels: ['email', 'sms'],
  quiet_hours: { start: '22:00', end: '08:00' }  // No SMS during sleep
}
```

**Issue Categories & Auto-Detection**:

- **Hallucination**: Agent claims something without tool confirmation
- **API Error**: Square/Retell API returned error
- **Prompt Issue**: Agent followed instructions incorrectly
- **User Error**: Caller provided invalid information
- **System Failure**: Server timeout, database error, network issue

**Implementation Impact**:

- Need OpenAI API key for diagnostic analysis (~$0.10-0.50 per analysis)
- Need support_tickets table in PostgreSQL
- Need Twilio for SMS notifications
- Need admin ticket dashboard UI
- Enhanced post-call email template
- Estimated cost: $5-20/month for AI diagnostics (assuming 50-200 failed calls/month)

**Benefits**:

- ✅ Proactive issue detection (you know before customer complains)
- ✅ Faster resolution (AI suggests fixes)
- ✅ Learning system (track patterns, prevent recurring issues)
- ✅ Customer trust (fix problems before they notice)
- ✅ Continuous improvement (data-driven agent optimization)

---

### **Question 11: Agent Update Strategy** ⚠️ **[REVISIT]**

**Q: When we improve master agent templates, how do we roll out updates to customers?**

**Your Answer**: ✅ **Surgical Merge Strategy with Gradual Rollout** _(Critical: Preserve customer
customizations)_

**Decision Rationale**:

- Customer agents have manual customizations that MUST NOT be overwritten
- Updates should be surgical (specific prompt sections, not full replacement)
- Need version control to track what changed in template vs what customer customized
- Gradual rollout + monitoring catches issues before affecting all customers
- Rollback capability essential for safety

**Challenge**: Each customer's agent has unique customizations after your meeting with them. We can't just
replace their agent with the new template version.

**Solution**: **Diff-Based Surgical Updates**

**How It Works**:

**1. Track Customization Layers**

```sql
CREATE TABLE agent_customizations (
  customization_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(tenant_id),
  agent_id VARCHAR(255) NOT NULL,
  template_version INTEGER NOT NULL,  -- Which template version they started from
  customization_type VARCHAR(50),  -- 'prompt_section', 'tool_config', 'state_logic', 'voice_setting'
  section_path VARCHAR(255),  -- e.g., 'states.greeting_intent.state_prompt'
  original_value TEXT,  -- What template had
  custom_value TEXT,  -- What you changed it to
  customization_reason TEXT,  -- "Customer requested: don't book kids under 5"
  applied_by VARCHAR(255),  -- 'nicolas@yourdomain.com'
  applied_at TIMESTAMP DEFAULT NOW()
);
```

**2. Template Update Process**

When you fix a bug in the master template (e.g., fix hallucination issue in `availability_search` state):

```javascript
// Example: You update the master template
const templateUpdate = {
  version: 2, // Template v1 → v2
  changes: [
    {
      type: 'prompt_section',
      path: 'states.availability_search.state_prompt',
      changeType: 'append', // 'replace', 'append', 'prepend', 'remove'
      oldText: null,
      newText:
        '\n\n🚨 CRITICAL: Wait for availability-get tool response before speaking. NEVER make up times.',
      reason: 'Fix hallucination: agent was inventing availability times',
      affectsCustomizations: false // This is a new addition, doesn't conflict with customizations
    }
  ]
};
```

**3. Surgical Merge Algorithm**

```javascript
// src/services/agentUpdateService.js - NEW FILE

class AgentUpdateService {
  async applyTemplateUpdate(templateUpdate, targetTenants = 'gradual') {
    // Step 1: Identify affected agents
    const agents = await this.getAgentsForUpdate(templateUpdate.version, targetTenants);

    // Step 2: For each agent, analyze customizations
    for (const agent of agents) {
      const customizations = await this.getCustomizations(agent.tenant_id);
      const conflicts = await this.detectConflicts(templateUpdate.changes, customizations);

      if (conflicts.length > 0) {
        // CONFLICT: Update touches something customer customized
        await this.createMergeReview(agent, templateUpdate, conflicts);
        // Skip auto-update, wait for your manual review
        continue;
      }

      // NO CONFLICT: Safe to auto-apply
      await this.applySurgicalUpdate(agent, templateUpdate.changes);
    }
  }

  async detectConflicts(templateChanges, customerCustomizations) {
    const conflicts = [];

    for (const change of templateChanges) {
      // Check if customer has customization in same section
      const customization = customerCustomizations.find(c => c.section_path === change.path);

      if (customization) {
        // Customer modified this section - potential conflict
        conflicts.push({
          change,
          customization,
          conflictType: this.analyzeConflictType(change, customization)
        });
      }
    }

    return conflicts;
  }

  analyzeConflictType(change, customization) {
    // Smart analysis: Does the change overlap with customization?

    if (change.changeType === 'append' || change.changeType === 'prepend') {
      // Adding text - usually safe even if customer customized
      return 'safe_merge';
    }

    if (change.changeType === 'replace') {
      // Replacing text - check if customer's custom text would be lost
      if (customization.custom_value.includes(change.oldText)) {
        return 'destructive_conflict'; // Would destroy customer's work
      }
      return 'safe_merge';
    }

    return 'unknown';
  }

  async applySurgicalUpdate(agent, changes) {
    // Fetch current agent config from Retell
    const currentAgent = await retellClient.agent.retrieve(agent.agent_id);

    // Apply each change surgically
    for (const change of changes) {
      const updatedConfig = this.applyChange(currentAgent, change);

      // Update agent via Retell API
      await retellClient.agent.update(agent.agent_id, updatedConfig);

      // Log the update
      await this.logAgentUpdate(agent, change);
    }
  }

  applyChange(agentConfig, change) {
    const { path, changeType, newText, oldText } = change;

    // Navigate to the nested property (e.g., states.greeting_intent.state_prompt)
    const pathParts = path.split('.');
    let target = agentConfig;
    for (let i = 0; i < pathParts.length - 1; i++) {
      target = target[pathParts[i]];
    }
    const finalKey = pathParts[pathParts.length - 1];

    switch (changeType) {
      case 'append':
        target[finalKey] += newText;
        break;
      case 'prepend':
        target[finalKey] = newText + target[finalKey];
        break;
      case 'replace':
        target[finalKey] = target[finalKey].replace(oldText, newText);
        break;
      case 'remove':
        target[finalKey] = target[finalKey].replace(oldText, '');
        break;
    }

    return agentConfig;
  }

  async createMergeReview(agent, templateUpdate, conflicts) {
    // Create a review ticket for you to manually merge
    await db.query(
      `INSERT INTO merge_reviews 
       (tenant_id, agent_id, template_version, conflicts, status)
       VALUES ($1, $2, $3, $4, 'pending_review')`,
      [agent.tenant_id, agent.agent_id, templateUpdate.version, JSON.stringify(conflicts)]
    );

    // Email you: "Manual merge needed for Customer X"
    await emailService.send({
      to: process.env.ADMIN_EMAIL,
      subject: `⚠️ Merge Conflict: ${agent.business_name} - Template v${templateUpdate.version}`,
      html: `
        <h2>Manual Merge Required</h2>
        <p><strong>Customer:</strong> ${agent.business_name}</p>
        <p><strong>Template Update:</strong> v${templateUpdate.version}</p>
        
        <h3>Conflicts Detected:</h3>
        <ul>
          ${conflicts
            .map(
              c => `
            <li>
              <strong>${c.change.path}</strong>
              <br>Template wants to: ${c.change.reason}
              <br>Customer has: ${c.customization.customization_reason}
              <br>Conflict type: ${c.conflictType}
            </li>
          `
            )
            .join('')}
        </ul>
        
        <p><a href="${process.env.DASHBOARD_URL}/admin/merge-reviews/${agent.agent_id}">Review and Merge</a></p>
      `
    });
  }
}

module.exports = new AgentUpdateService();
```

**4. Gradual Rollout Strategy**

```javascript
// Rollout phases
const rolloutPhases = {
  canary: {
    percentage: 10,
    duration_hours: 48,
    criteria: 'lowest_call_volume',  // Test on least risky customers first
    auto_rollback_on: ['hallucination_increase', 'error_rate_increase', 'customer_complaint']
  },

  phase_2: {
    percentage: 50,
    duration_hours: 24,
    criteria: 'mid_call_volume'
  },

  full_rollout: {
    percentage: 100,
    criteria: 'all_remaining'
  }
};

// Monitoring during rollout
async monitorRollout(templateVersion) {
  const metrics = {
    hallucinationRate: await this.getHallucinationRate(templateVersion),
    errorRate: await this.getErrorRate(templateVersion),
    bookingSuccessRate: await this.getBookingSuccessRate(templateVersion),
    ticketRate: await this.getTicketRate(templateVersion)
  };

  // Compare to baseline (previous version)
  const baseline = await this.getBaselineMetrics(templateVersion - 1);

  if (metrics.hallucinationRate > baseline.hallucinationRate * 1.5) {
    // 50% increase in hallucinations = ABORT
    await this.rollbackUpdate(templateVersion);
    await this.alertAdmin('Rollback triggered: Hallucination spike');
  }
}
```

**5. Database Schema for Updates**

```sql
CREATE TABLE template_versions (
  version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number INTEGER NOT NULL,
  industry VARCHAR(100),  -- 'barbershop', 'spa', etc.
  changelog TEXT NOT NULL,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE template_updates (
  update_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID REFERENCES template_versions(version_id),
  change_type VARCHAR(50),  -- 'prompt_section', 'tool_config', 'state_logic'
  section_path VARCHAR(255),
  change_operation VARCHAR(20),  -- 'append', 'prepend', 'replace', 'remove'
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  affects_customizations BOOLEAN DEFAULT false
);

CREATE TABLE agent_update_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(tenant_id),
  agent_id VARCHAR(255),
  template_version INTEGER,
  update_type VARCHAR(50),  -- 'auto', 'manual_merge', 'skipped_conflict'
  changes_applied JSONB,
  rollback_snapshot JSONB,  -- Store previous state for rollback
  applied_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE merge_reviews (
  review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(tenant_id),
  agent_id VARCHAR(255),
  template_version INTEGER,
  conflicts JSONB,
  status VARCHAR(50) DEFAULT 'pending_review',  -- 'pending_review', 'merged', 'skipped'
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**6. Update Workflow Example**

**Scenario**: You discover agents are hallucinating availability times. You update the master template to add
stronger anti-hallucination rules.

```javascript
// Step 1: You create template update
const update = {
  version: 2,
  changes: [
    {
      path: 'states.availability_search.state_prompt',
      changeType: 'append',
      newText:
        '\n\n🚨 CRITICAL RULE: NEVER state a specific time until availability-get tool returns success. If tool fails, say "Let me have someone call you back."',
      reason: 'Fix hallucination: agents inventing times without tool confirmation'
    }
  ]
};

// Step 2: System applies to 10% of customers (canary)
await agentUpdateService.applyTemplateUpdate(update, 'canary');

// Step 3: Monitor for 48 hours
// - Check hallucination_detected rate in post-call analysis
// - Check ticket creation rate
// - Check customer complaints

// Step 4a: If stable → roll out to remaining 90%
// Step 4b: If issues → auto-rollback, create ticket for you
```

**7. Admin UI for Updates**

```javascript
// Dashboard: /admin/template-updates

{
  templateVersion: 2,
  status: 'in_progress',
  rolloutPhase: 'canary',
  affectedAgents: {
    total: 50,
    applied: 5,  // 10% canary
    conflicts: 2,  // Need manual merge
    pending: 43
  },
  metrics: {
    hallucinationRate: '+2%',  // Within acceptable range
    errorRate: '-5%',  // Improved!
    bookingSuccessRate: '94%'  // Stable
  },
  actions: [
    { label: 'Continue Rollout', action: 'proceed' },
    { label: 'Pause', action: 'pause' },
    { label: 'Rollback All', action: 'rollback' }
  ]
}
```

**Key Principles**:

1. ✅ **Never overwrite customer customizations**
2. ✅ **Detect conflicts before applying**
3. ✅ **Surgical changes only (specific sections, not full replacement)**
4. ✅ **Gradual rollout with monitoring**
5. ✅ **Auto-rollback on quality regression**
6. ✅ **Manual review for conflicts**
7. ✅ **Always keep rollback snapshot**

**Implementation Impact**:

- Need agent_customizations table to track what was changed
- Need version control system for templates
- Need diff algorithm to detect conflicts
- Need rollback snapshots for safety
- Need monitoring dashboard for rollout progress
- Need email notifications for merge conflicts
- Estimated dev time: 2-3 weeks for full system

---

### **Question 12: Analytics & Insights** ⚠️ **[REVISIT]**

**Q: What AI-powered insights should we provide to customers in their dashboard?**

**Your Answer**: ✅ **Tiered Analytics with Business Impact Focus** _(Subject to customer feedback)_

**Decision Rationale**:

- Basic tier gets essential metrics only (drive upgrades)
- Mid-tier gets actionable insights (optimize operations)
- Premium gets predictive intelligence (strategic decisions)
- Focus on metrics that drive ROI and retention
- Start simple, add complexity based on customer requests

**Analytics Features by Tier**:

**Basic Tier (Minimal Analytics)**:

- ✅ **Total Calls**: Count only (no breakdown)
- ✅ **Minutes Used**: Usage tracking for billing
- ✅ **Next Invoice Date**: Billing reminder
- ❌ No detailed analytics (incentivize upgrade)

**Mid-Tier Dashboard Analytics (MVP Launch)**:

**Call Analytics**:

- ✅ **Peak Call Times Chart**: When customers call most (hourly breakdown)
  - Bar chart: X-axis = hour of day, Y-axis = call count
  - Use case: Staff scheduling optimization
- ✅ **Booking Conversion Rate**: Percentage of calls resulting in appointments
  - Formula: (successful_bookings / total_calls) × 100
  - Trend: 7-day, 30-day, all-time
- ✅ **Common Questions**: Top 5 FAQ topics this month
  - Extracted from call transcripts using NLP
  - Examples: "What are your hours?", "Do you take walk-ins?", "How much is a haircut?"
  - Use case: Update agent prompt with better answers
- ✅ **Language Breakdown**: Pie chart of calls by language
  - English, Spanish, Portuguese percentages
  - Use case: Validate multi-language investment

**Call Outcome Distribution**:

- ✅ Successful bookings
- ✅ Cancellations
- ✅ Updates/reschedules
- ✅ Information only
- ✅ Failed/escalated

**Premium Tier Analytics (Phase 2 - Post-Launch)**:

**AI Performance Metrics**:

- ⏳ **Hallucination Rate**: % of calls with detected hallucinations
  - From post_call_analysis_data.hallucination_detected
  - Trend tracking to validate template improvements
- ⏳ **Tool Success Rate**: % of tool calls that succeed vs fail
  - availability-get, booking-create, customer-info-update success rates
  - Identifies API reliability issues
- ⏳ **Average Call Duration**: Efficiency metric
  - Segment by outcome (booking = longer, info = shorter)
  - Optimize for speed without sacrificing quality

**Customer Intelligence**:

- ⏳ **Sentiment Analysis**: Happy vs frustrated caller trends
  - From post_call_analysis_data.caller_sentiment
  - Alert when sentiment drops (quality issue indicator)
- ⏳ **Repeat Caller Rate**: % of callers who called before
  - Tracks customer retention
  - VIP identification (frequent callers)
- ⏳ **No-Show Prevention**: Calls that prevented cancellations
  - Track calls where customers updated/confirmed appointments
  - ROI metric: "AI saved X appointments worth $Y"

**Business Impact Metrics (Phase 3 - Future)**:

- ⏳ **Revenue Impact**: Estimated booking value from AI calls
  - Calculate: bookings × average service price from Square
  - ROI proof: "AI generated $X,XXX this month"
- ⏳ **Time Saved**: Estimated staff hours saved
  - Calculate: call_count × avg_human_call_duration - AI_cost
  - Example: "Saved 40 hours of staff time = $600"
- ⏳ **Missed Call Recovery**: Calls answered outside business hours
  - Count calls during closed hours that led to bookings
  - Value: "Captured 15 after-hours bookings = $450"

**Analytics Data Pipeline**:

```javascript
// src/services/analyticsService.js - NEW FILE

class AnalyticsService {
  async generateDashboardAnalytics(tenant_id, tier, date_range) {
    const data = {};

    // All tiers: Basic usage
    data.totalCalls = await this.getTotalCalls(tenant_id, date_range);
    data.minutesUsed = await this.getMinutesUsed(tenant_id, date_range);

    if (tier === 'basic') {
      return data; // Stop here for basic tier
    }

    // Mid tier+: Detailed analytics
    data.peakCallTimes = await this.getPeakCallTimes(tenant_id, date_range);
    data.bookingConversionRate = await this.getBookingConversionRate(tenant_id, date_range);
    data.commonQuestions = await this.getCommonQuestions(tenant_id, date_range);
    data.languageBreakdown = await this.getLanguageBreakdown(tenant_id, date_range);
    data.callOutcomes = await this.getCallOutcomes(tenant_id, date_range);

    if (tier === 'premium') {
      // Premium only: Advanced analytics
      data.hallucinationRate = await this.getHallucinationRate(tenant_id, date_range);
      data.toolSuccessRate = await this.getToolSuccessRate(tenant_id, date_range);
      data.sentimentTrends = await this.getSentimentTrends(tenant_id, date_range);
      data.repeatCallerRate = await this.getRepeatCallerRate(tenant_id, date_range);
    }

    return data;
  }

  async getPeakCallTimes(tenant_id, date_range) {
    const result = await db.query(
      `
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as call_count
      FROM call_logs
      WHERE tenant_id = $1 
        AND created_at BETWEEN $2 AND $3
      GROUP BY hour
      ORDER BY hour
    `,
      [tenant_id, date_range.start, date_range.end]
    );

    return result.rows;
  }

  async getCommonQuestions(tenant_id, date_range) {
    // Use OpenAI to extract questions from transcripts
    const calls = await db.query(
      `
      SELECT transcript 
      FROM call_logs
      WHERE tenant_id = $1 
        AND created_at BETWEEN $2 AND $3
        AND transcript IS NOT NULL
      LIMIT 100
    `,
      [tenant_id, date_range.start, date_range.end]
    );

    // Batch analyze transcripts to extract common questions
    const questions = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content:
            'Extract the top 5 most common customer questions from these call transcripts. Return as JSON array.'
        },
        {
          role: 'user',
          content: JSON.stringify(calls.rows.map(c => c.transcript))
        }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(questions.choices[0].message.content);
  }

  async getBookingConversionRate(tenant_id, date_range) {
    const result = await db.query(
      `
      SELECT 
        COUNT(*) FILTER (WHERE booking_success = 'success') as successful_bookings,
        COUNT(*) as total_calls,
        ROUND(
          (COUNT(*) FILTER (WHERE booking_success = 'success')::DECIMAL / COUNT(*)) * 100, 
          2
        ) as conversion_rate
      FROM call_logs
      JOIN post_call_analysis ON call_logs.call_id = post_call_analysis.call_id
      WHERE call_logs.tenant_id = $1 
        AND call_logs.created_at BETWEEN $2 AND $3
    `,
      [tenant_id, date_range.start, date_range.end]
    );

    return result.rows[0];
  }
}

module.exports = new AnalyticsService();
```

**Database Schema for Analytics**:

```sql
CREATE TABLE call_analytics_cache (
  cache_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(tenant_id),
  metric_name VARCHAR(100),
  metric_value JSONB,
  date_range_start DATE,
  date_range_end DATE,
  calculated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP  -- Cache for 1 hour
);

CREATE INDEX idx_call_analytics_tenant_metric ON call_analytics_cache(tenant_id, metric_name);
CREATE INDEX idx_call_analytics_expires ON call_analytics_cache(expires_at);
```

**Chart Components** (React):

```jsx
// Peak Call Times Bar Chart
<BarChart data={analytics.peakCallTimes}>
  <XAxis dataKey="hour" label="Hour of Day" />
  <YAxis label="Number of Calls" />
  <Bar dataKey="call_count" fill="#4F46E5" />
</BarChart>

// Booking Conversion Rate Trend
<LineChart data={analytics.conversionTrend}>
  <XAxis dataKey="date" />
  <YAxis label="Conversion Rate %" />
  <Line type="monotone" dataKey="rate" stroke="#10B981" />
</LineChart>

// Language Breakdown Pie Chart
<PieChart>
  <Pie data={analytics.languageBreakdown} dataKey="percentage" nameKey="language" />
</PieChart>
```

**Implementation Priority**:

**Phase 1 (MVP - Week 1-3)**:

1. Peak call times chart (Mid tier+)
2. Booking conversion rate (Mid tier+)
3. Total calls + minutes used (All tiers)
4. Basic call logs (Mid tier+)

**Phase 2 (Post-Launch - Week 4-6)**:

1. Common questions extraction (OpenAI integration)
2. Language breakdown chart
3. Call outcome distribution
4. Sentiment trends (Premium)

**Phase 3 (Future - Month 3+)**:

1. Hallucination rate tracking
2. Tool success rate monitoring
3. Revenue impact calculator
4. Predictive analytics (booking likelihood)

**Analytics Caching Strategy**:

- Cache expensive queries (common questions, sentiment analysis) for 1 hour
- Real-time for simple metrics (total calls, minutes used)
- Background jobs to pre-calculate daily/weekly aggregates

**Implementation Impact**:

- Need call_analytics_cache table for performance
- Need OpenAI API for common questions extraction (~$0.05-0.20 per analysis)
- Need Chart.js or Recharts for visualizations
- Need background job scheduler (node-cron) for cache warmup
- Estimated dev time: 1-2 weeks for Phase 1 analytics

**⚠️ NOTE**: Analytics features subject to revision based on customer feedback and usage patterns.

---

## 🏗️ Technical Architecture

### **System Overview**

```
┌─────────────────────────────────────────────────────────────────┐
│                        CUSTOMER LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  - Signup Form (React)                                          │
│  - Customer Dashboard (React)                                    │
│  - Phone Calls → Retell AI Agent                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  Express.js API (Node.js 20.x)                                  │
│  - OAuth Controller (Square authorization)                      │
│  - Webhook Controller (Retell call events)                       │
│  - Booking Controller (Square appointments)                      │
│  - Dashboard API (analytics, call logs)                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       SERVICE LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  - Retell Agent Creation Service (auto-create agents)          │
│  - Issue Detection Service (AI diagnostics)                      │
│  - Agent Update Service (surgical template merges)              │
│  - Analytics Service (dashboard metrics)                         │
│  - Billing Service (Stripe subscription management)             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL (Azure Database for PostgreSQL Flexible Server)    │
│  - tenants, retell_agents, square_credentials                  │
│  - voice_preferences, subscription_tiers, usage_tracking       │
│  - support_tickets, merge_reviews, agent_customizations        │
│  - call_logs, post_call_analysis, call_analytics_cache        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   EXTERNAL INTEGRATIONS                          │
├─────────────────────────────────────────────────────────────────┤
│  - Retell AI API (agent management, phone numbers, calls)      │
│  - Square API (OAuth, bookings, customers, locations)           │
│  - Stripe API (subscriptions, invoices, payments)              │
│  - OpenAI API (issue diagnostics, analytics extraction)        │
│  - Twilio API (SMS notifications for admins)                    │
│  - SendGrid/Mailgun (email notifications)                       │
└─────────────────────────────────────────────────────────────────┘
```

### **Infrastructure (Azure)**

- **App Service**: square-middleware-prod-api (Node.js 20.x, Linux, B1 tier)
- **Database**: Azure Database for PostgreSQL Flexible Server (Standard_B1ms)
- **Storage**: Azure Blob Storage (call recordings backup - optional)
- **CDN**: Azure CDN (dashboard static assets)
- **Monitoring**: Application Insights (performance, errors, traces)
- **Region**: East US

---

## 📅 Implementation Roadmap

### **Phase 1: MVP Foundation (Weeks 1-4)**

#### Phase 1 Options Review

- **Implementation Summary**: Keep the current Azure App Service and existing PostgreSQL instance, add the
  multi-tenant schema with `pgcrypto`, migrate legacy token/config data in place, and wire Square OAuth plus
  monitoring/backups so new tenants can be onboarded without restarts.
- **Alternative Approach**: Stand up fresh infrastructure (new App Service or managed Postgres elsewhere) to
  isolate the SaaS build-out, then migrate once the MVP stabilizes.
- **Recommended Approach**: Reuse the existing stack per your direction—this avoids new hosting costs, keeps
  DNS/deployment untouched, and lets you iterate quickly while headcount and customer volume stay small.

##### ✅ Phase 1 Completion Snapshot (January 2025)

- Multi-tenant database schema (tenants, users, subscriptions, QA queue, encrypted Square credentials)
  deployed via migration `0003_create_saas_multitenant_core.sql`.
- JWT-based auth stack (signup/login/refresh/logout/me) with hashed passwords and refresh-token rotation now
  served from `/api/auth/*`.
- Square OAuth callback persists tokens, voice preferences, and QA queue entries directly in Postgres while
  issuing agent bearer tokens for Retell. Admin onboarding flows run through `/api/admin/complete-onboarding`
  without restarting App Service.
- Admin dashboards pull from Postgres (`/api/admin/agents`, `/api/admin/pending-agents`) and onboarding
  preferences land in `/api/onboarding/preferences`; tenant middleware now sources Square credentials from the
  database.
- Tooling confirmations: `npm run format`, `npm run lint`, and `npm test` all pass on the new codebase (see
  testing notes below).
- Required env vars confirmed in App Service: `PG_CONNECTION_STRING`, `DB_ENCRYPTION_KEY`,
  `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (optional overrides: `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`,
  `BCRYPT_SALT_ROUNDS`).

**Week 1: Database & Authentication**

- [ ] Configure existing Azure PostgreSQL instance for multi-tenant schema
- [ ] Create database schema (all tables from questions 1-12)
- [ ] Enable pgcrypto extension for token encryption
- [ ] Implement JWT authentication for customer dashboard
- [ ] Create admin authentication system
- [ ] Configure Application Insights + backup policy on existing App Service/DB

**Week 2: Customer Onboarding Flow**

- [ ] Build customer signup form (React)
  - Business info fields
  - Voice preference selectors
  - Phone number option selection
- [ ] Implement Retell agent auto-creation service
- [ ] Redesign OAuth callback (auto-store tokens, clean success page)
- [ ] Create pending_activations workflow
- [ ] Build admin QA dashboard (view pending agents, test call button)

**Week 3: Billing & Subscription Management**

- [ ] Integrate Stripe for subscription management
- [ ] Implement usage tracking from Retell webhooks
- [ ] Create subscription tier enforcement (feature flags)
- [ ] Build invoice generation and email delivery
- [ ] Implement 14-day trial logic with auto-conversion
- [ ] Create billing dashboard for customers

**Week 4: Core Dashboard Features**

- [ ] Build customer dashboard authentication
- [ ] Implement usage tracking display (minutes used/remaining)
- [ ] Create call logs with pagination and search (Mid tier+)
- [ ] Add call recordings playback (Mid tier+)
- [ ] Implement pause/resume agent toggle
- [ ] Build account settings page

---

### **Phase 2: Advanced Features (Weeks 5-8)**

**Week 5: AI Issue Detection Pipeline**

- [ ] Build issue detection service with OpenAI integration
- [ ] Create support_tickets database schema
- [ ] Implement automatic ticket creation on failed calls
- [ ] Build email + SMS notification system for admins
- [ ] Enhance post-call email with diagnostic info
- [ ] Create admin ticket dashboard

**Week 6: Analytics & Insights**

- [ ] Implement peak call times chart (Mid tier+)
- [ ] Build booking conversion rate calculator
- [ ] Create common questions extraction (OpenAI)
- [ ] Add language breakdown chart
- [ ] Implement call outcome distribution
- [ ] Build analytics caching system

**Week 7: Agent Template Management**

- [ ] Create agent_customizations tracking system
- [ ] Build template version control system
- [ ] Implement surgical merge algorithm
- [ ] Create conflict detection for updates
- [ ] Build admin UI for template updates
- [ ] Implement gradual rollout system with monitoring

**Week 8: Phone Number Management**

- [ ] Integrate Retell phone number purchase API
- [ ] Build call forwarding instruction generator
- [ ] Create phone number assignment workflow
- [ ] Implement porting coordination system
- [ ] Add phone number status to admin dashboard

---

### **Phase 3: Scale & Optimize (Weeks 9-12)**

**Week 9: Premium Features**

- [ ] Implement customer memory system (Mid tier+)
- [ ] Build sentiment analysis (Premium)
- [ ] Create AI performance scoring (Premium)
- [ ] Add warm handoff functionality (Mid tier+)
- [ ] Implement multi-person SMS notifications (Premium)

**Week 10: Support Infrastructure**

- [ ] Build AI phone agent for customer support
- [ ] Implement AI chat widget on website
- [ ] Create help center with FAQs and video tutorials
- [ ] Set up public status page (status.yourdomain.com)
- [ ] Implement in-app support ticket system

**Week 11: Security & Compliance**

- [ ] Hire lawyer for Privacy Policy + Terms of Service
- [ ] Implement GDPR/CCPA data export API
- [ ] Build data deletion workflow
- [ ] Add cookie consent banner
- [ ] Implement audit logging for data access
- [ ] Set up automated data retention cleanup

**Week 12: Testing & Launch Prep**

- [ ] End-to-end testing of onboarding flow
- [ ] Load testing with simulated customers
- [ ] Security audit and penetration testing
- [ ] Documentation for customer onboarding guide
- [ ] Create launch marketing materials
- [ ] Set up monitoring and alerting

---

## ⏱️ Timeline & Milestones

### **Sprint Schedule**

| Sprint       | Dates      | Focus        | Deliverables                                |
| ------------ | ---------- | ------------ | ------------------------------------------- |
| **Sprint 1** | Week 1-2   | Foundation   | Database, auth, signup form, agent creation |
| **Sprint 2** | Week 3-4   | MVP Core     | Billing, dashboard, call logs               |
| **Sprint 3** | Week 5-6   | Intelligence | Issue detection, analytics                  |
| **Sprint 4** | Week 7-8   | Scalability  | Template management, phone numbers          |
| **Sprint 5** | Week 9-10  | Premium      | Advanced features, support                  |
| **Sprint 6** | Week 11-12 | Launch       | Security, testing, compliance               |

### **Key Milestones**

- **Week 2 End**: First customer can sign up and get agent created ✅
- **Week 4 End**: MVP Dashboard live, billing working ✅
- **Week 6 End**: Issue detection operational ✅
- **Week 8 End**: Template management system complete ✅
- **Week 12 End**: PUBLIC LAUNCH 🚀

---

## 💰 Budget & Resources

### **Development Costs**

| Item                             | Cost         | Notes                      |
| -------------------------------- | ------------ | -------------------------- |
| **Your Time**                    | $0           | Solo founder               |
| **Legal (Privacy Policy + ToS)** | $2,000-5,000 | One-time                   |
| **Design Assets**                | $500-1,000   | Logo, brand kit (optional) |

### **Monthly Infrastructure Costs**

| Service                              | Cost/Month                   | Notes                                |
| ------------------------------------ | ---------------------------- | ------------------------------------ |
| **Azure App Service (B1)**           | ~$55                         | Can start with Free tier for testing |
| **Azure PostgreSQL (Standard_B1ms)** | ~$25                         | Scales with usage                    |
| **Retell AI**                        | $0.10-0.15/min               | Pass through to customers            |
| **OpenAI API**                       | $20-100                      | Issue diagnostics, analytics         |
| **Stripe**                           | 2.9% + $0.30 per transaction | Payment processing                   |
| **Twilio SMS**                       | $0.0079/SMS                  | Admin notifications                  |
| **SendGrid Email**                   | $0-15                        | Free tier: 100 emails/day            |
| **Domain + SSL**                     | $15                          | Annual domain                        |
| **TOTAL (without calls)**            | **~$120-200/month**          | Scales with customers                |

### **Revenue Projections (First 20 Customers)**

| Metric                  | Value                         |
| ----------------------- | ----------------------------- |
| **Setup Fees**          | 20 × $500 = $10,000           |
| **Monthly (Basic)**     | 10 × $99 = $990/mo            |
| **Monthly (Mid)**       | 7 × $199 = $1,393/mo          |
| **Monthly (Premium)**   | 3 × $399 = $1,197/mo          |
| **Total MRR**           | **$3,580/month**              |
| **Annual Run Rate**     | **$42,960/year**              |
| **Minus Costs**         | -$2,400/year (infrastructure) |
| **Net Profit (Year 1)** | **~$40,560**                  |

---

## ⚠️ Risk Assessment & Mitigation

### **Technical Risks**

| Risk                              | Impact   | Probability | Mitigation                                 |
| --------------------------------- | -------- | ----------- | ------------------------------------------ |
| **Retell API Downtime**           | HIGH     | LOW         | Monitor status, have backup contact method |
| **Square API Rate Limits**        | MEDIUM   | MEDIUM      | Implement caching, request throttling      |
| **Database Failure**              | HIGH     | LOW         | Azure auto-backups, point-in-time restore  |
| **Security Breach**               | CRITICAL | LOW         | Follow security checklist, regular audits  |
| **Template Update Breaks Agents** | HIGH     | MEDIUM      | Gradual rollout, auto-rollback, monitoring |

### **Business Risks**

| Risk                         | Impact   | Probability | Mitigation                                         |
| ---------------------------- | -------- | ----------- | -------------------------------------------------- |
| **Low Customer Acquisition** | HIGH     | MEDIUM      | Early adopter discounts, referral program          |
| **High Churn Rate**          | HIGH     | MEDIUM      | Proactive support, issue detection, QA calls       |
| **Compliance Violation**     | CRITICAL | LOW         | Hire lawyer, follow GDPR/CCPA guidelines           |
| **Competitor**               | MEDIUM   | HIGH        | Focus on niche (Square-first), superior support    |
| **Retell Pricing Increase**  | MEDIUM   | LOW         | Pass costs to customers, negotiate volume discount |

---

## 🎯 Success Metrics (90-Day Goals)

### **Customer Acquisition**

- ✅ **20 paying customers** (early adopter tier)
- ✅ **$3,500+ MRR** (monthly recurring revenue)
- ✅ **$10,000 setup fees** (one-time revenue)

### **Product Quality**

- ✅ **<5% hallucination rate** (AI accuracy)
- ✅ **>90% booking success rate** (agent effectiveness)
- ✅ **<10 support tickets/month** (product stability)
- ✅ **<2% churn rate** (customer retention)

### **Operational Efficiency**

- ✅ **<30 min agent customization time** (per customer)
- ✅ **<10 min QA testing time** (per customer)
- ✅ **<24 hour issue resolution time** (support SLA)

---

## 📝 Next Steps

### **Immediate Actions (This Week)**

1. ✅ **Review this master plan** - Confirm all decisions align with vision
2. ⬜ **Provision Azure PostgreSQL** - Set up production database
3. ⬜ **Create database schema** - Run all migration scripts
4. ⬜ **Hire lawyer** - Draft Privacy Policy + Terms of Service
5. ⬜ **Design signup form** - Wireframe customer onboarding UI
6. ⬜ **Test Retell agent creation API** - Verify we can auto-create agents

### **First Customer Checklist**

Before onboarding Customer #1:

- [ ] Database fully migrated and tested
- [ ] Signup form live and functional
- [ ] Retell agent auto-creation working
- [ ] OAuth flow redesigned (no exposed tokens)
- [ ] Billing system integrated with Stripe
- [ ] Admin QA dashboard operational
- [ ] Privacy Policy + Terms of Service published
- [ ] Support email set up (support@yourdomain.com)
- [ ] Post-call issue detection pipeline working
- [ ] You + wife trained on support workflow

---

## 📞 Questions? Clarifications?

This master plan captures all 12 strategic decisions and provides a complete roadmap to launch.

**Items marked ⚠️ [REVISIT]** should be reviewed with customers or adjusted based on early feedback.

**Ready to start building?** 🚀
