# Retell AI Post-Call Analysis Configuration

## Currently Configured ✅

### language_preference

- **Type:** Selector
- **Model:** GPT-5 Nano
- **Optional:** Yes
- **Description:** "Has the user expressed preference for a different language other than English? If, so,
  what language?"
- **Choices:**
  - Brazilian Portuguese
  - Russian
  - Spanish

**Database Mapping:** → `customer_profiles.preferred_language`

---

## Recommended Additional Fields

### 1. unresolved_issue

- **Type:** String (Free Text)
- **Model:** GPT-5 Nano
- **Optional:** Yes
- **Description:** "Did the customer mention any problem, question, or request that was not resolved during
  this call? Provide a brief summary."

**Database Mapping:** → `open_issues.issue_description`

**Example Responses:**

- "Customer wanted to know about color treatment pricing but we didn't have the stylist available to quote"
- "Asked about Saturday availability but system showed no slots"
- null (if everything was resolved)

---

### 2. callback_requested

- **Type:** Boolean
- **Model:** GPT-5 Nano
- **Optional:** Yes
- **Description:** "Did the customer explicitly request a callback or follow-up?"

**Database Mapping:** → `open_issues.issue_type` = 'callback_requested'

---

### 3. preferred_stylist

- **Type:** String (Free Text)
- **Model:** GPT-5 Nano
- **Optional:** Yes
- **Description:** "Did the customer mention or request a specific stylist or service provider by name?"

**Database Mapping:** → `conversation_context.context_key` = 'favorite_stylist'

**Example Responses:**

- "Carmen"
- "Maria"
- "The guy who did my last haircut"
- null

---

### 4. service_interest

- **Type:** String (Free Text)
- **Model:** GPT-5 Nano
- **Optional:** Yes
- **Description:** "What service(s) is the customer interested in? Be specific."

**Database Mapping:** → `conversation_context.context_key` = 'service_interest'

**Example Responses:**

- "Haircut and beard trim"
- "Color treatment for special event"
- "Basic haircut"

---

### 5. special_occasion

- **Type:** String (Free Text)
- **Model:** GPT-5 Nano
- **Optional:** Yes
- **Description:** "Did the customer mention any special event or occasion for the service?"

**Database Mapping:** → `conversation_context.context_key` = 'special_occasion'

**Example Responses:**

- "Wedding next month"
- "Quinceañera in June"
- "Job interview"
- null

---

### 6. preferred_time_of_day

- **Type:** Selector
- **Model:** GPT-5 Nano
- **Optional:** Yes
- **Description:** "What time of day does the customer prefer for appointments?"
- **Choices:**
  - Morning (before 12pm)
  - Afternoon (12pm-5pm)
  - Evening (after 5pm)
  - Weekend
  - No preference stated

**Database Mapping:** → `conversation_context.context_key` = 'preferred_time'

---

### 7. price_sensitive

- **Type:** Boolean
- **Model:** GPT-5 Nano
- **Optional:** Yes
- **Description:** "Did the customer express concern about pricing or ask for discounts/deals?"

**Database Mapping:** → `conversation_context.context_key` = 'price_sensitivity'

---

### 8. referral_source

- **Type:** String (Free Text)
- **Model:** GPT-5 Nano
- **Optional:** Yes
- **Description:** "How did the customer say they heard about us? (Friend, Google, social media, etc.)"

**Database Mapping:** → `conversation_context.context_key` = 'referral_source'

---

### 9. hallucination_detected

- **Type:** Boolean
- **Model:** GPT-5 Nano
- **Optional:** Yes
- **Description:** "Did the AI agent provide any information that contradicts what the custom functions (tool
  calls) returned, or made up details that couldn't be verified? Compare what the agent SAID to customers vs
  what the tools (GetAvailability, GetCustomerInfo, etc.) actually RETURNED. Examples: agent confirms 2pm slot
  but GetAvailability showed no slots; agent quotes $25 but tool returned $45; agent mentions services not in
  the catalog."

**Database Mapping:** → `call_history.hallucination_detected` (add column)

**Why This Works:** The post-call analysis has access to `transcript_with_tool_calls`, so it can compare:

- What the agent told the customer
- What your middleware tools actually returned

**Example Scenarios:**

- ✅ Detect: Agent says "Carmen available Saturday 2pm" BUT GetAvailability returned `{ slots: [] }`
- ✅ Detect: Agent says "Haircut is $25" BUT service catalog shows $45
- ✅ Detect: Agent says "We offer laser removal" BUT service not in GetServiceList response
- ❌ Don't flag: Agent says "Let me check" then correctly reports tool response
- ❌ Don't flag: Agent provides information that matches tool response exactly

---

### 10. hallucination_details

- **Type:** String (Free Text)
- **Model:** GPT-5 Nano
- **Optional:** Yes
- **Description:** "If hallucination was detected, describe exactly what incorrect information was provided
  and what the correct information should have been."

**Database Mapping:** → `call_history.hallucination_details` (add column)

**Example Responses:**

- "Agent stated haircut price is $30 but actual price is $45"
- "Agent confirmed Saturday 3pm availability but no slots exist in system"
- "Agent mentioned services we don't offer: eyebrow tinting, facials"
- null (if no hallucination)

---

## Priority Implementation Order

### Phase 1 (MVP - Do First) 🚀

1. ✅ `language_preference` (Already done!)
2. `unresolved_issue` - Critical for follow-up
3. `callback_requested` - Important for customer service
4. `hallucination_detected` - **CRITICAL for quality control**

### Phase 2 (High Value) 💎

5. `hallucination_details` - Understand what went wrong
6. `preferred_stylist` - Builds loyalty
7. `service_interest` - Helps with recommendations
8. `preferred_time_of_day` - Improves booking success

### Phase 3 (Nice to Have) ⭐

9. `special_occasion` - Personalization
10. `price_sensitive` - Sales intelligence
11. `referral_source` - Marketing data

---

## How These Map to Database

### Example Call Analysis Response

```json
{
  "call_analysis": {
    "call_successful": true,
    "user_sentiment": "Positive",
    "language_preference": "Spanish",
    "unresolved_issue": "Customer wanted to know about color treatment pricing",
    "callback_requested": true,
    "preferred_stylist": "Carmen",
    "service_interest": "Haircut and color for wedding",
    "special_occasion": "Wedding next month",
    "preferred_time_of_day": "Evening (after 5pm)",
    "price_sensitive": false,
    "referral_source": "Google search",
    "hallucination_detected": false,
    "hallucination_details": null
  }
}
```

### Database Updates Triggered

**1. customer_profiles**

```sql
UPDATE customer_profiles SET
  preferred_language = 'es',
  language_confidence = 0.85,
  last_call_date = NOW()
WHERE square_customer_id = 'CUST123';
```

**2. call_history**

```sql
INSERT INTO call_history (
  retell_call_id,
  customer_profile_id,
  call_summary,
  detected_language,
  call_successful,
  user_sentiment
) VALUES (
  'call_xyz789',
  'uuid-123',
  'Customer inquired about wedding services with Carmen',
  'es',
  true,
  'Positive'
);
```

**3. open_issues**

```sql
INSERT INTO open_issues (
  customer_profile_id,
  call_history_id,
  issue_type,
  issue_description,
  priority
) VALUES (
  'uuid-123',
  'uuid-call-456',
  'callback_requested',
  'Customer wanted to know about color treatment pricing',
  'normal'
);
```

**4. conversation_context** (Multiple inserts)

```sql
INSERT INTO conversation_context (customer_profile_id, context_key, context_value, source)
VALUES
  ('uuid-123', 'favorite_stylist', 'Carmen', 'explicit_statement'),
  ('uuid-123', 'service_interest', 'Haircut and color for wedding', 'explicit_statement'),
  ('uuid-123', 'special_occasion', 'Wedding next month', 'explicit_statement'),
  ('uuid-123', 'preferred_time', 'Evening (after 5pm)', 'explicit_statement'),
  ('uuid-123', 'referral_source', 'Google search', 'explicit_statement');
```

---

## Testing Strategy

### 1. Start Simple

Add fields one at a time and test extraction quality:

- Make test calls with explicit mentions
- Check if GPT-5 Nano extracts correctly
- Verify data appears in webhook

### 2. Test Edge Cases

- Customer mentions multiple languages
- Vague answers ("sometime next week")
- No clear preference stated
- Customer changes mind during call

### 3. Validate with Real Calls

- Monitor first 10-20 real calls
- Check extraction accuracy
- Adjust descriptions if needed
- Add choices to selectors based on patterns

---

## Quick Setup in Retell Dashboard

For each field:

1. Go to **Post-Call Analysis** section
2. Click **"+ Add"**
3. Fill in:
   - **Name:** (exact field name from above)
   - **Description:** (copy description)
   - **Type:** String/Boolean/Selector
   - **Model:** GPT-5 Nano
   - **Optional:** Yes (always start with optional)
4. For selectors: Add choices
5. Click **"Update"**

---

## Critical Feature: Hallucination Detection 🚨

### What Data Does Retell AI Have Access To?

**✅ YES - Post-Call Analysis Has Access To:**

- 📝 **Full transcript** - Everything said in the conversation
- 🔧 **Tool calls** - Via `transcript_with_tool_calls` field in webhook
- 🎯 **Custom function responses** - What your middleware returned
- 📊 **LLM dynamic variables** - Context passed to the agent

**This Means:** The post-call analysis LLM can **compare what the agent said vs what the tools returned**!

**Example Detection:**

```json
// Tool returned this:
GetAvailability() → { slots: [] }  // NO availability

// But agent said this:
"Great! I can book you for Saturday at 2pm"  // HALLUCINATION!

// Post-call analysis can detect:
hallucination_detected: true
hallucination_details: "Agent confirmed 2pm Saturday slot but GetAvailability returned no slots"
```

### Why This Matters

**The Risk:** LLMs can confidently state incorrect information, which in a business context can:

- ❌ Quote wrong prices → lost revenue or angry customers
- ❌ Confirm fake availability → double bookings or no-shows
- ❌ Promise services you don't offer → disappointed customers
- ❌ Provide wrong business hours → customers show up when closed
- ❌ Make up policies → legal/compliance issues

**The Solution:** Detect hallucinations in post-call analysis so you can:

1. **Immediately flag the call** for manual review
2. **Contact the customer** to correct misinformation
3. **Improve your agent prompt** to prevent future occurrences
4. **Track patterns** across all tenants
5. **Maintain quality standards** for your platform

### How to Configure in Retell

**Field 1: hallucination_detected**

```
Name: hallucination_detected
Type: Boolean
Optional: Yes
Model: GPT-5 Nano

Description:
"Did the AI agent provide any information that was factually incorrect,
made up details, or stated something it couldn't verify from available
data? Examples: wrong prices, incorrect availability, made-up services,
false business hours."
```

**Field 2: hallucination_details**

```
Name: hallucination_details
Type: String (Free Text)
Optional: Yes
Model: GPT-5 Nano

Description:
"If hallucination was detected, describe exactly what incorrect
information was provided and what the correct information should
have been."
```

### Implementation in Your System

#### 1. Database Schema Update

```sql
-- Add columns to call_history table
ALTER TABLE call_history
ADD COLUMN hallucination_detected BOOLEAN DEFAULT FALSE,
ADD COLUMN hallucination_details TEXT;

-- Create index for quick lookup
CREATE INDEX idx_hallucinations
ON call_history(tenant_id, hallucination_detected)
WHERE hallucination_detected = true;
```

#### 2. Auto-Alert on Hallucination

```javascript
// In webhook handler
if (callAnalysis.hallucination_detected) {
  // Create URGENT issue
  await createIssue({
    type: 'hallucination',
    priority: 'urgent',
    customer: customerData,
    details: callAnalysis.hallucination_details,
    requiresImmediate: true
  });

  // Notify business owner immediately
  await sendUrgentNotification({
    type: 'sms',
    message: `🚨 URGENT: AI provided incorrect info to ${customerName}. Review immediately.`
  });

  // Log for your platform monitoring
  await logPlatformIssue({
    severity: 'high',
    category: 'quality_control',
    tenant: tenantId,
    details: callAnalysis.hallucination_details
  });
}
```

#### 3. Dashboard Widget

```
┌─────────────────────────────────────────┐
│  🎯 Quality Control                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Hallucinations Detected: 2 this week   │
│                                          │
│  🚨 Recent Issues:                      │
│  • Wrong price quoted (2 days ago)      │
│  • Made-up service mentioned (5 days)   │
│                                          │
│  📊 Accuracy Rate: 99.1%                │
│  [View All] [Improve Agent]             │
└─────────────────────────────────────────┘
```

#### 4. Pattern Analysis

```javascript
// Detect hallucination patterns across tenants
async function analyzeHallucinationPatterns() {
  const patterns = await db.query(`
    SELECT 
      hallucination_details,
      COUNT(*) as occurrences,
      array_agg(DISTINCT tenant_id) as affected_tenants
    FROM call_history
    WHERE hallucination_detected = true
      AND call_start_time >= NOW() - INTERVAL '30 days'
    GROUP BY hallucination_details
    HAVING COUNT(*) >= 2
    ORDER BY occurrences DESC
  `);

  // If same hallucination across tenants = PROMPT ISSUE
  if (patterns.affected_tenants.length > 1) {
    await notifyPlatformTeam({
      alert: 'AGENT PROMPT NEEDS FIXING',
      pattern: patterns.hallucination_details,
      impact: `${patterns.occurrences} calls across ${patterns.affected_tenants.length} tenants`
    });
  }
}
```

### Testing Your Hallucination Detection

#### Test Scenarios:

**Test 1: Wrong Price**

- Have agent quote a service price
- Check if it matches Square API data
- If mismatch → should detect hallucination

**Test 2: Fake Availability**

- Have agent confirm specific time slot
- Verify slot actually exists in system
- If doesn't exist → should detect hallucination

**Test 3: Made-up Service**

- Have agent mention a service
- Check if service exists in catalog
- If not in catalog → should detect hallucination

**Test 4: Correct Usage (No hallucination)**

- Agent says "Let me check availability" → GOOD
- Agent retrieves data from API → GOOD
- Agent says "I'm not sure" → GOOD

### Business Value

**For YOU (Platform Owner):**

- Maintain high quality standards
- Identify prompt/agent issues quickly
- Protect your reputation
- Improve AI reliability over time

**For YOUR CUSTOMERS (Business Owners):**

- Catch mistakes before they cause problems
- Maintain customer trust
- Correct misinformation immediately
- Sleep better knowing quality is monitored

**For THEIR CUSTOMERS (End Users):**

- Get accurate information
- Better experience overall
- Trust the AI system

---

## Next Steps

Once you add more fields to Retell:

1. I'll update the webhook handler to extract them
2. We'll map them to the database schema
3. We'll test with sample calls
4. We'll inject the context back into new calls

**Ready to add more fields?** Start with Phase 1 (unresolved_issue and callback_requested) - they're the most
valuable for customer service! 🎯
