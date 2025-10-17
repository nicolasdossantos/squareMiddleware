# Customer Context & Preference Management System

## Overview

Building a **Customer Memory System** that persists call analysis data and customer preferences to enable:
1. **Language Preference Learning** - Remember and adapt to customer's preferred language
2. **Call Continuity** - Track unresolved issues across calls
3. **Progressive Intelligence** - Agents get smarter with each customer interaction

## Strategic Value

### Competitive Advantages Over Standard Square:
- ✅ **Personalized Experience** - "We remember you"
- ✅ **Reduced Friction** - No repeat questions
- ✅ **Issue Tracking** - Nothing falls through the cracks
- ✅ **Multi-language Support** - Automatic language detection and preference
- ✅ **Context-Aware Conversations** - "Last time you mentioned..."

## Database Architecture

### Proposed PostgreSQL Schema

#### Table 1: `customer_profiles`
Stores persistent customer data and preferences.

```sql
CREATE TABLE customer_profiles (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  square_customer_id VARCHAR(255) UNIQUE NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  
  -- Contact Info (denormalized for quick access)
  phone_number VARCHAR(20),
  email VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  
  -- Preferences
  preferred_language VARCHAR(10) DEFAULT 'en',
  language_confidence DECIMAL(3,2) DEFAULT 0.50, -- 0.00-1.00
  communication_preference VARCHAR(20), -- 'sms', 'email', 'phone'
  
  -- Metadata
  total_calls INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  first_call_date TIMESTAMP,
  last_call_date TIMESTAMP,
  
  -- System
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_square_customer_id (square_customer_id),
  INDEX idx_tenant_phone (tenant_id, phone_number),
  INDEX idx_last_call (last_call_date DESC)
);
```

#### Table 2: `call_history`
Stores detailed call analysis and summaries.

```sql
CREATE TABLE call_history (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retell_call_id VARCHAR(255) UNIQUE NOT NULL,
  customer_profile_id UUID REFERENCES customer_profiles(id) ON DELETE CASCADE,
  tenant_id VARCHAR(255) NOT NULL,
  
  -- Call Details
  call_start_time TIMESTAMP NOT NULL,
  call_end_time TIMESTAMP,
  call_duration_seconds INTEGER,
  
  -- Analysis Results
  call_successful BOOLEAN,
  user_sentiment VARCHAR(20), -- 'Positive', 'Neutral', 'Negative'
  detected_language VARCHAR(10),
  
  -- Content
  call_summary TEXT,
  call_transcript TEXT,
  
  -- Actions Taken
  booking_created BOOLEAN DEFAULT FALSE,
  booking_id VARCHAR(255),
  sms_sent BOOLEAN DEFAULT FALSE,
  
  -- Agent State
  final_agent_state VARCHAR(50),
  spam_detected BOOLEAN DEFAULT FALSE,
  
  -- System
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_customer_profile (customer_profile_id),
  INDEX idx_retell_call (retell_call_id),
  INDEX idx_tenant_date (tenant_id, call_start_time DESC),
  INDEX idx_customer_recent (customer_profile_id, call_start_time DESC)
);
```

#### Table 3: `open_issues`
Tracks unresolved items that need follow-up.

```sql
CREATE TABLE open_issues (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID REFERENCES customer_profiles(id) ON DELETE CASCADE,
  call_history_id UUID REFERENCES call_history(id) ON DELETE CASCADE,
  tenant_id VARCHAR(255) NOT NULL,
  
  -- Issue Details
  issue_type VARCHAR(50) NOT NULL, -- 'booking_incomplete', 'question_unanswered', 'callback_requested', 'custom'
  issue_description TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  
  -- Status
  status VARCHAR(20) DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'cancelled'
  resolved_at TIMESTAMP,
  resolved_by_call_id UUID REFERENCES call_history(id),
  resolution_notes TEXT,
  
  -- System
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_customer_open (customer_profile_id, status),
  INDEX idx_tenant_open (tenant_id, status, created_at DESC)
);
```

#### Table 4: `conversation_context`
Stores key-value pairs for dynamic context data.

```sql
CREATE TABLE conversation_context (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_profile_id UUID REFERENCES customer_profiles(id) ON DELETE CASCADE,
  
  -- Context Data
  context_key VARCHAR(100) NOT NULL, -- e.g., 'favorite_stylist', 'preferred_time', 'service_preference'
  context_value TEXT NOT NULL,
  value_type VARCHAR(20) DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
  
  -- Confidence & Learning
  confidence DECIMAL(3,2) DEFAULT 0.50, -- How sure we are about this data
  source VARCHAR(50), -- 'explicit_statement', 'inferred', 'booking_history', 'manual'
  last_confirmed_at TIMESTAMP,
  
  -- System
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  UNIQUE(customer_profile_id, context_key),
  
  -- Indexes
  INDEX idx_customer_context (customer_profile_id, context_key)
);
```

## Integration with Retell AI

### Retell AI Configuration (Already Set Up!)

You've configured `language_preference` in Retell's Post-Call Analysis:
- **Type:** Selector
- **Choices:** Brazilian Portuguese, Russian, Spanish
- **Model:** GPT-5 Nano
- **Description:** "Has the user expressed preference for a different language other than English? If, so, what language?"

This will be automatically extracted and included in the `call_analyzed` webhook payload as:
```json
{
  "call_analysis": {
    "language_preference": "Spanish"  // or "Brazilian Portuguese", "Russian", null
  }
}
```

### 1. POST Call Analysis Webhook Enhancement

**Current Flow:**
```
Retell AI → call_analyzed event → Email sent
```

**New Flow:**
```
Retell AI → call_analyzed event → {
  1. Extract language_preference from call_analysis
  2. Save to database
  3. Update customer profile
  4. Extract other preferences
  5. Check for open issues
  6. Send email
}
```

### 2. PRE Call Context Injection

**At Call Start (`call_started` event):**

```javascript
// Fetch customer context from database
const customerContext = await getCustomerContext(phoneNumber, tenantId);

// Inject into Retell AI dynamic variables
{
  "preferred_language": "es",
  "last_call_summary": "Customer asked about color treatment pricing",
  "open_issues": [
    {
      "type": "callback_requested",
      "description": "Wanted to discuss special event styling"
    }
  ],
  "favorite_stylist": "Maria",
  "typical_service": "Haircut + Beard Trim"
}
```

## Language Preference Detection

### Strategy:

```javascript
function detectAndUpdateLanguagePreference(callData) {
  const transcript = callData.transcript;
  const detectedLanguage = analyzeLanguage(transcript);
  
  // Update customer profile
  if (detectedLanguage !== customer.preferred_language) {
    if (customer.language_confidence < 0.8) {
      // Still learning, update preference
      updateLanguagePreference(customer, detectedLanguage);
    } else {
      // High confidence in current preference, might be one-off
      logLanguageVariation(customer, detectedLanguage);
    }
  } else {
    // Reinforce current preference
    increaseLanguageConfidence(customer);
  }
}
```

### Language Detection Methods:

**PRIMARY: Retell AI Post-Call Analysis** ✅
- Configured in Retell dashboard as `language_preference` selector
- Available languages: Brazilian Portuguese, Russian, Spanish
- Extracted automatically during call analysis
- Returned in `call_analyzed` webhook payload

**FALLBACK: Server-Side Detection**
1. **Transcript Analysis** - Analyze words/phrases in transcript
2. **Explicit Statements** - "I prefer to speak Spanish"
3. **Historical Pattern** - Consistency across calls
4. **Default** - English if no preference detected

## Open Issues Tracking

### Auto-Detection from Call Analysis:

```javascript
async function extractOpenIssues(callAnalysis) {
  const issues = [];
  
  // 1. Failed booking attempts
  if (callAnalysis.booking_attempted && !callAnalysis.booking_completed) {
    issues.push({
      type: 'booking_incomplete',
      description: callAnalysis.booking_failure_reason || 'Booking not completed',
      priority: 'high'
    });
  }
  
  // 2. Callback requests
  if (callAnalysis.callback_requested) {
    issues.push({
      type: 'callback_requested',
      description: callAnalysis.callback_reason,
      priority: callAnalysis.callback_urgent ? 'urgent' : 'normal'
    });
  }
  
  // 3. Unanswered questions
  if (callAnalysis.unanswered_questions?.length > 0) {
    for (const question of callAnalysis.unanswered_questions) {
      issues.push({
        type: 'question_unanswered',
        description: question,
        priority: 'normal'
      });
    }
  }
  
  // 4. Custom agent-identified issues
  if (callAnalysis.agent_notes) {
    const customIssues = parseAgentNotes(callAnalysis.agent_notes);
    issues.push(...customIssues);
  }
  
  return issues;
}
```

### Context Injection for Next Call:

```javascript
async function buildCallStartContext(phoneNumber, tenantId) {
  const customer = await getCustomerProfile(phoneNumber, tenantId);
  const openIssues = await getOpenIssues(customer.id);
  const lastCall = await getLastCall(customer.id);
  const context = await getConversationContext(customer.id);
  
  return {
    // Preferences
    preferred_language: customer.preferred_language,
    communication_preference: customer.communication_preference,
    
    // History
    is_returning_customer: customer.total_calls > 0,
    total_previous_calls: customer.total_calls,
    last_interaction: lastCall ? formatDate(lastCall.call_start_time) : null,
    
    // Last Call Summary
    last_call_summary: lastCall?.call_summary,
    last_call_sentiment: lastCall?.user_sentiment,
    
    // Open Issues
    has_open_issues: openIssues.length > 0,
    open_issues_count: openIssues.length,
    open_issues: openIssues.map(issue => ({
      type: issue.issue_type,
      description: issue.issue_description,
      created: formatDate(issue.created_at)
    })),
    
    // Learned Preferences
    favorite_stylist: context.favorite_stylist?.value,
    preferred_service: context.preferred_service?.value,
    preferred_time: context.preferred_time?.value,
    
    // Business Intelligence
    typical_service_duration: context.typical_duration?.value,
    average_spend: context.average_spend?.value,
    loyalty_tier: calculateLoyaltyTier(customer)
  };
}
```

## Implementation Plan

### Phase 1: Database Setup ✅
1. Create PostgreSQL database in `rg-businesssystem-westus2`
2. Run schema migration scripts
3. Set up connection pooling
4. Configure environment variables

### Phase 2: Core Services 🔨
1. **Database Service** (`src/services/customerContextService.js`)
   - CRUD operations for all tables
   - Connection pool management
   - Transaction support

2. **Preference Learning Service** (`src/services/preferenceLearningService.js`)
   - Language detection
   - Context extraction
   - Confidence scoring

3. **Issue Tracking Service** (`src/services/issueTrackingService.js`)
   - Auto-detect issues from calls
   - Issue resolution matching
   - Priority management

### Phase 3: Integration 🔌
1. Enhance `retellWebhookService.js`:
   - Save call data on `call_analyzed`
   - Update customer profiles
   - Extract and store preferences
   - Detect open issues

2. Add `call_started` handler:
   - Fetch customer context
   - Build dynamic variables
   - Inject into Retell AI

### Phase 4: Retell AI Configuration 📡
1. Update agent prompts to use context
2. Configure dynamic variable schemas
3. Test context injection

### Phase 5: UI/Dashboard (Future) 📊
1. Customer profile viewer
2. Open issues dashboard
3. Preference management
4. Call history viewer

## Example: Complete Flow

### Scenario: Returning Customer Call

**Customer:** Maria Rodriguez
**Phone:** +1-555-0123
**History:** 3 previous calls, prefers Spanish

#### 1. Call Starts (`call_started` webhook)

```javascript
// Middleware fetches context
const context = await buildCallStartContext('+1-555-0123', 'elite-barber');

// Inject into Retell AI
{
  "customer_first_name": "Maria",
  "customer_last_name": "Rodriguez",
  "preferred_language": "es",
  "is_returning_customer": true,
  "total_previous_calls": 3,
  "last_call_summary": "Customer inquired about color treatment pricing for special event",
  "has_open_issues": true,
  "open_issues": [
    {
      "type": "callback_requested",
      "description": "Wanted to discuss quinceañera styling package"
    }
  ],
  "favorite_stylist": "Carmen"
}
```

#### 2. Agent Greeting (Retell AI)

**Agent:** "¡Hola Maria! Welcome back to Elite Barber Boutique. I see you had asked about our quinceañera styling package. ¿Te gustaría programar esa cita ahora?"

**Result:** Customer feels recognized and valued! 🎉

#### 3. Call Ends (`call_analyzed` webhook)

```javascript
// Save to database
await saveCallHistory({
  retell_call_id: 'call_abc123',
  customer_profile_id: customer.id,
  call_summary: 'Booked quinceañera styling package with Carmen for June 15th',
  detected_language: 'es',
  call_successful: true,
  user_sentiment: 'Positive',
  booking_created: true
});

// Resolve open issue
await resolveIssue(openIssue.id, {
  resolved_by_call_id: callHistory.id,
  resolution_notes: 'Successfully booked requested service'
});

// Update preferences
await updateConversationContext(customer.id, {
  'favorite_stylist': 'Carmen',
  'special_event_preference': 'quinceañera',
  'booking_lead_time': '45_days'
});
```

## Data Privacy & Compliance

### GDPR/CCPA Considerations:
- ✅ Customer data deletion on request
- ✅ Data export capabilities
- ✅ Consent tracking
- ✅ Retention policies
- ✅ Encryption at rest and in transit

### Retention Policy:
```javascript
const RETENTION_POLICY = {
  call_transcripts: '90 days',
  call_summaries: '2 years',
  customer_profiles: 'Until deletion request',
  open_issues: 'Auto-delete when resolved + 30 days'
};
```

## Performance Optimization

### Caching Strategy:
```javascript
// Redis cache for frequently accessed data
cache.set(`customer:${phoneNumber}:context`, context, 300); // 5 min TTL
```

### Database Indexes:
- Customer lookup by phone: `idx_tenant_phone`
- Recent call history: `idx_customer_recent`
- Open issues: `idx_customer_open`

## Metrics & Analytics

### Track Success:
- Language preference accuracy
- Issue resolution rate
- Context usage in successful bookings
- Customer satisfaction correlation with context usage

## Next Steps

**Immediate Actions:**
1. Review and approve database schema
2. Set up PostgreSQL database in Azure
3. Create migration scripts
4. Implement `customerContextService.js`
5. Update webhook handlers

**Questions to Consider:**
- What other customer preferences should we track?
- Should we store payment/tipping preferences?
- How long should we keep call transcripts?
- Do you want manual override capabilities for preferences?

---

Ready to start building this? Let me know if you want me to:
1. Create the database migration scripts
2. Build the `customerContextService.js`
3. Update the webhook handlers
4. Set up the Azure PostgreSQL database
