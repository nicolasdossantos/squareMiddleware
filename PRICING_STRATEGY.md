# 💰 AI Receptionist SaaS - Pricing Strategy

**Project**: Square Middleware → SaaS Platform  
**Date Created**: October 29, 2025  
**Status**: Planning / Pre-Launch  
**Owner**: Nicolas dos Santos

---

## 📋 Table of Contents

1. [Cost Structure Analysis](#cost-structure-analysis)
2. [Pricing Tiers](#pricing-tiers)
3. [Profitability Analysis](#profitability-analysis)
4. [Pricing Scenarios](#pricing-scenarios)
5. [Competitive Positioning](#competitive-positioning)
6. [Recommendations](#recommendations)

---

## 💵 Cost Structure Analysis

### **Fixed Costs (Per Month - Base Infrastructure)**

| Service                              | Monthly Cost  | Notes                                      |
| ------------------------------------ | ------------- | ------------------------------------------ |
| **Azure App Service (B1)**           | $12           | Node.js hosting, can scale up              |
| **Azure PostgreSQL (Standard_B1ms)** | $18           | 32 GiB storage, 1 vCore                    |
| **SendGrid Email**                   | $15           | Transactional emails (can start free tier) |
| **Domain + SSL**                     | $2            | Annual domain cost / 12                    |
| **SUBTOTAL (Fixed)**                 | **$47/month** | Base costs regardless of customers         |

### **Variable Costs (Per Customer Per Month)**

| Cost Item                    | Per Customer      | Calculation                      |
| ---------------------------- | ----------------- | -------------------------------- |
| **Retell AI (Agent Calls)**  | $13.50            | 50 calls × 3 min avg × $0.09/min |
| **Retell AI (Phone Number)** | $2-5              | ~$2/month per number             |
| **Twilio SMS (Alerts)**      | $0.50             | ~60 alerts/month × $0.0083       |
| **OpenAI (Diagnostics)**     | $0.15             | ~5 failed calls/month × $0.003   |
| **Stripe Fees**              | $3.47             | ($0.30 + 2.9% of $110 avg)       |
| **SUBTOTAL (Variable)**      | **~$20/customer** | Minimum cost to serve 1 customer |

### **Total Cost Per Customer**

| Customer Count    | Fixed Costs | Variable Costs | Total Monthly Cost | Cost Per Customer |
| ----------------- | ----------- | -------------- | ------------------ | ----------------- |
| **1 customer**    | $47         | $20            | $67                | $67.00            |
| **10 customers**  | $47         | $200           | $247               | $24.70            |
| **20 customers**  | $47         | $400           | $447               | $22.35            |
| **50 customers**  | $47         | $1,000         | $1,047             | $20.94            |
| **100 customers** | $47         | $2,000         | $2,047             | $20.47            |

**Key Insight:** Cost per customer drops as you scale due to fixed cost distribution.

---

## 🎯 Pricing Tiers

### **Option A: Conservative Pricing (Market Entry)**

| Feature                  | Basic         | Mid-Tier          | Premium              |
| ------------------------ | ------------- | ----------------- | -------------------- |
| **Monthly Price**        | $99           | $199              | $349                 |
| **Setup Fee (First 20)** | $500          | $500              | $500                 |
| **Setup Fee (After 20)** | $1,000        | $1,000            | $1,000               |
| **Included Minutes**     | 500 min       | 1,000 min         | 2,000 min            |
| **Overage Rate**         | $0.25/min     | $0.20/min         | $0.15/min            |
| **Languages**            | 1 language    | Up to 3           | Unlimited            |
| **Customer Memory**      | ❌ No         | ✅ Yes            | ✅ Yes (Advanced)    |
| **Dashboard Analytics**  | ❌ Basic only | ✅ Full analytics | ✅ Advanced insights |
| **Call Recordings**      | 30 days       | 90 days           | 1 year               |
| **Warm Handoff**         | ❌ No         | ✅ Yes (owner)    | ✅ Yes (anyone)      |
| **Support**              | Email only    | Email + Chat      | Priority phone       |
| **14-Day Trial**         | ✅ Yes        | ✅ Yes            | ✅ Yes               |

**Your Cost to Serve:**

- **Basic:** ~$60/month (Retell $45 + infra $15) → **39% margin**
- **Mid:** ~$105/month (Retell $90 + infra $15) → **47% margin**
- **Premium:** ~$195/month (Retell $180 + infra $15) → **44% margin**

---

### **Option B: Aggressive Pricing (Fast Growth)**

| Tier        | Price       | Minutes   | Your Cost | Margin  |
| ----------- | ----------- | --------- | --------- | ------- |
| **Basic**   | **$89/mo**  | 450 min   | $56       | **37%** |
| **Mid**     | **$179/mo** | 900 min   | $96       | **46%** |
| **Premium** | **$299/mo** | 1,500 min | $150      | **50%** |

**Strategy:** Lower entry price to maximize customer acquisition, upsell to Mid/Premium later.

---

### **Option C: Premium Positioning (High Value)**

| Tier        | Price       | Minutes   | Your Cost | Margin  |
| ----------- | ----------- | --------- | --------- | ------- |
| **Basic**   | **$129/mo** | 600 min   | $69       | **47%** |
| **Mid**     | **$249/mo** | 1,200 min | $123      | **51%** |
| **Premium** | **$449/mo** | 2,500 min | $240      | **47%** |

**Strategy:** Position as premium solution, attract high-value customers, justify with white-glove service.

---

## 📊 Profitability Analysis

### **Scenario 1: Conservative Pricing (20 Customers)**

**Customer Mix:**

- 10 Basic ($99) = $990/month
- 7 Mid ($199) = $1,393/month
- 3 Premium ($349) = $1,047/month

**Revenue:**

- Monthly Recurring: $3,430/month
- Setup Fees (one-time): 20 × $500 = $10,000

**Costs:**

- Fixed Infrastructure: $47/month
- Retell Calls: 20 × $13.50 avg = $270/month
- Phone Numbers: 20 × $3 = $60/month
- SMS/Email/AI: $30/month
- Stripe Fees: ~$105/month
- **Total Costs: ~$512/month**

**Profit:**

- Monthly Net: $3,430 - $512 = **$2,918/month**
- **Margin: 85%** (exceptional!)
- Annual Net: ($2,918 × 12) + $10,000 = **$45,016**

---

### **Scenario 2: Aggressive Pricing (20 Customers)**

**Customer Mix:**

- 10 Basic ($89) = $890/month
- 7 Mid ($179) = $1,253/month
- 3 Premium ($299) = $897/month

**Revenue:**

- Monthly Recurring: $3,040/month
- Setup Fees (one-time): 20 × $500 = $10,000

**Costs:** ~$512/month (same infrastructure)

**Profit:**

- Monthly Net: $3,040 - $512 = **$2,528/month**
- **Margin: 83%**
- Annual Net: ($2,528 × 12) + $10,000 = **$40,336**

---

### **Scenario 3: Premium Positioning (20 Customers)**

**Customer Mix:**

- 10 Basic ($129) = $1,290/month
- 7 Mid ($249) = $1,743/month
- 3 Premium ($449) = $1,347/month

**Revenue:**

- Monthly Recurring: $4,380/month
- Setup Fees (one-time): 20 × $500 = $10,000

**Costs:** ~$512/month (same infrastructure)

**Profit:**

- Monthly Net: $4,380 - $512 = **$3,868/month**
- **Margin: 88%**
- Annual Net: ($3,868 × 12) + $10,000 = **$56,416**

---

## 💡 Pricing Scenarios by Customer Volume

### **At 50 Customers (6 Months)**

| Pricing Model    | MRR     | Costs  | Net Profit | Margin |
| ---------------- | ------- | ------ | ---------- | ------ |
| **Conservative** | $8,575  | $1,122 | $7,453     | 87%    |
| **Aggressive**   | $7,600  | $1,122 | $6,478     | 85%    |
| **Premium**      | $10,950 | $1,122 | $9,828     | 90%    |

### **At 100 Customers (12 Months)**

| Pricing Model    | MRR     | Costs  | Net Profit | Margin |
| ---------------- | ------- | ------ | ---------- | ------ |
| **Conservative** | $17,150 | $2,094 | $15,056    | 88%    |
| **Aggressive**   | $15,200 | $2,094 | $13,106    | 86%    |
| **Premium**      | $21,900 | $2,094 | $19,806    | 90%    |

---

## 🎯 Competitive Positioning

### **Competitor Landscape**

| Competitor        | Price Range                | Key Features                         | Positioning       |
| ----------------- | -------------------------- | ------------------------------------ | ----------------- |
| **Slang.ai**      | $299-799/mo                | Multi-channel, no Square integration | Enterprise focus  |
| **PolyAI**        | $500-2,000/mo              | Custom voice, enterprise             | High-end          |
| **Vapi.ai**       | Usage-based (~$100-300/mo) | Developer platform                   | Technical users   |
| **CallFluent**    | $99-399/mo                 | General AI receptionist              | Direct competitor |
| **Your Platform** | **$99-349/mo**             | **Square-first, industry templates** | **Niche focus**   |

**Your Differentiators:**

1. ✅ **Square Integration Native** - Competitors require manual setup
2. ✅ **Industry-Specific Templates** - Pre-configured for barbershops, salons, spas
3. ✅ **White-Glove Onboarding** - Personal customization meeting included
4. ✅ **AI Issue Detection** - Proactive problem solving (unique feature)
5. ✅ **Surgical Agent Updates** - Template improvements without losing customizations

**Positioning Statement:**

> "The only AI receptionist built specifically for Square-based businesses. Get a fully customized AI agent
> for your barbershop, salon, or spa in 48 hours—not weeks."

---

## 📈 Recommendations

### **Recommended Launch Pricing: Option A (Conservative)**

**Why Conservative Pricing Wins:**

1. ✅ **Market Testing:** $99/$199/$349 is competitive but not cheapest
2. ✅ **High Margins:** 85%+ margin gives room for customer acquisition costs
3. ✅ **Premium Feel:** Setup fee signals quality and filters serious customers
4. ✅ **Upsell Path:** Easy to justify Mid → Premium upgrade ($150/month more = advanced features)
5. ✅ **Sustainable:** Can offer discounts/promos without going unprofitable

### **Early Adopter Program (First 20 Customers)**

**Incentive Structure:**

- ✅ **Setup Fee:** $500 (50% off standard $1,000)
- ✅ **Grandfathered Pricing:** Lock in current rates forever
- ✅ **Free Upgrade:** 3 months free upgrade to next tier
- ✅ **Direct Access:** Personal support from you (founder)
- ✅ **Case Study:** Featured in marketing materials

**Total Value for Early Adopters:**

- Setup savings: $500
- 3 months free upgrade: $300 (Basic → Mid)
- **Total savings: $800+ for being first**

### **Trial Strategy**

**14-Day Free Trial:**

- ✅ **Credit Card Required:** Auto-convert after trial (60-70% conversion)
- ✅ **Usage Limit:** 100 minutes during trial (prevents abuse)
- ✅ **White-Glove Onboarding:** Customization meeting during trial
- ✅ **Email Sequence:**
  - Day 0: Welcome + setup guide
  - Day 7: Usage stats + "7 days left"
  - Day 13: "Trial ends tomorrow! Add payment to continue"
  - Day 14: Auto-convert or pause agent

**Trial Costs to You:**

- 100 minutes × $0.09 = $9 per trial user
- If 5 trials/month, conversion rate 60% = 3 paying customers
- Trial cost: $45, Revenue: $597 (3 × $199 avg) → **1,227% ROI**

### **Pricing Adjustments Over Time**

**After First 10 Customers:**

- ✅ Validate pricing (track churn, upgrade rate, customer feedback)
- ✅ Consider reducing Basic to $89 if market demands
- ✅ Add new premium features to justify Premium tier

**After First 50 Customers:**

- ✅ Introduce annual billing (10% discount = predictable revenue)
- ✅ Launch referral program ($100 credit per referral)
- ✅ Consider usage-based pricing for enterprise (100+ employees)

**After 100 Customers:**

- ✅ Increase setup fee to $1,500 (signal premium positioning)
- ✅ Raise base prices by 10-15% (Basic → $109, Mid → $219, Premium → $399)
- ✅ Grandfather existing customers (maintain loyalty)

---

## 🚨 Pricing Guardrails

### **Never Go Below These Minimums:**

| Tier        | Minimum Price | Reason                                  |
| ----------- | ------------- | --------------------------------------- |
| **Basic**   | $79/mo        | Break-even point + 30% margin           |
| **Mid**     | $159/mo       | Covers analytics costs + healthy margin |
| **Premium** | $279/mo       | Justifies premium support + features    |

### **Red Flags to Watch:**

1. **High Churn on Basic:** Customers canceling because "too expensive for simple needs"
   - **Fix:** Introduce "Starter" tier at $79/mo with 300 minutes
2. **No Premium Customers:** Everyone choosing Basic/Mid
   - **Fix:** Add exclusive Premium features (priority API access, dedicated account manager)
3. **Overage Complaints:** Customers upset about unexpected charges

   - **Fix:** Send email alert at 80% usage, offer mid-cycle upgrade

4. **Low Trial Conversion (<40%):** Trials not converting to paid
   - **Fix:** Improve onboarding, add friction to trial (require call with you)

---

## 📞 Pricing Communication

### **Website Pricing Page Copy**

**Basic Tier ($99/month)**

> "Perfect for solo practitioners and small teams"

- ✅ 500 minutes/month (~167 calls)
- ✅ AI books, cancels, and updates appointments
- ✅ Answers common questions 24/7
- ✅ Single language support
- ✅ Email support
- ✅ 30-day call recording retention

**Mid-Tier ($199/month)** ⭐ **MOST POPULAR**

> "For growing businesses ready to scale"

- ✅ 1,000 minutes/month (~333 calls)
- ✅ Everything in Basic, plus:
- ✅ Customer memory (remembers past conversations)
- ✅ Up to 3 languages (English + Spanish + Portuguese)
- ✅ Full analytics dashboard
- ✅ Warm handoff to your phone
- ✅ 90-day call retention
- ✅ Live chat support

**Premium Tier ($349/month)**

> "For high-volume businesses demanding the best"

- ✅ 2,000 minutes/month (~667 calls)
- ✅ Everything in Mid-Tier, plus:
- ✅ Unlimited languages
- ✅ Advanced AI insights & sentiment analysis
- ✅ Transfer calls to any staff member
- ✅ 1-year call retention
- ✅ Priority phone support
- ✅ Quarterly optimization calls

**Setup Fee: $500 (first 20 customers) | $1,000 (standard)**

> Includes personal customization meeting, voice tuning, and white-glove setup

**14-Day Free Trial - No Commitment**

---

## 🎯 Final Recommendation

**Launch with Conservative Pricing (Option A):**

- Basic: $99/month
- Mid: $199/month
- Premium: $349/month
- Setup: $500 (early adopters) → $1,000 (standard)

**Why:**

1. Defensible margins (85%+)
2. Room for discounts/promos
3. Premium positioning
4. Competitive but not cheapest
5. Justifies white-glove service

**Revisit pricing after first 20 customers based on:**

- Churn rate (target: <5%)
- Upgrade rate Basic → Mid (target: 30%)
- Customer feedback on value
- Competitor pricing changes

---

**Questions or need to adjust pricing? This is a living document - update as you validate assumptions with
real customers.**
