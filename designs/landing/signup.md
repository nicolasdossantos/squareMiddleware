## 🧭 Page 1 — Landing / Sign-Up (Web)

### 🎨 Visual Direction

**Aesthetic:** modern, tech-forward, calming. Think “Square meets OpenAI”—flat yet dimensional, with soft
glowing cyan accents that mirror the logo’s aura.  
**Tone:** professional but approachable — AI that feels human and competent.

---

## 🌗 Color System

### **Light Mode**

| Role           | Color                                   | Notes                           |
| -------------- | --------------------------------------- | ------------------------------- |
| Background     | `#F8FAFB`                               | soft neutral white              |
| Surface        | `#FFFFFF`                               | cards, nav                      |
| Primary Accent | `#00C7C7`                               | teal-cyan glow                  |
| Primary Hover  | `#00AFAF`                               | darker teal                     |
| Text Primary   | `#1B1D1F`                               | high contrast                   |
| Text Secondary | `#636C72`                               | muted                           |
| Border         | `#E3E7EA`                               | subtle dividers                 |
| Gradient       | linear-gradient(135°, #00C7C7, #007BFF) | used in buttons/CTA backgrounds |

### **Dark Mode**

| Role           | Color                             | Notes                   |
| -------------- | --------------------------------- | ----------------------- |
| Background     | `#0D1117`                         | deep slate gray         |
| Surface        | `#161B22`                         | cards/nav               |
| Primary Accent | `#00E0E0`                         | glowing cyan            |
| Text Primary   | `#F3F6F8`                         | high contrast           |
| Text Secondary | `#9CA3AF`                         | muted gray              |
| Border         | `#2B3138`                         |                         |
| Glow           | `0 0 20px rgba(0, 224, 224, 0.3)` | ambient lighting effect |

Typography: **Inter** (variable) — weights 400 / 500 / 600 / 700  
Button Radius: `12px` Card Radius: `20px` Spacing Scale: `8 px`

---

## 🧱 Layout Overview

### **Header**

- **Logo (left):** Fluent Front AI mark + wordmark.
- **Nav Links (right):**  
  “Features” | “Pricing” | “Docs” | “Support” | CTA → **Get Started**
- Sticky behavior on scroll, fades to solid background.

---

### **Hero Section**

**Structure:** 2-column grid (text + illustration).

**Left Column (text block):**

```
Fluent Front AI
Your Front Desk, Fluent in Every Language.
```

**Body copy:**

> Our agent answers calls, schedules appointments, handles customer questions, and remembers preferences—so
> your team can stay focused on clients.  
> No “press 1 to continue.” Just a real conversation.

**CTAs:**

- **Primary:** “Get Started” (filled gradient button)
- **Secondary:** “▶ Watch Demo” (outlined, opens video modal)

**Right Column (visual):**

- 3D glowing AI-bot illustration (based on your logo)
- Subtle orbiting dots or light trails to convey speech/waveform activity.

**Background:**

- Dark radial gradient anchored behind illustration
- Soft ambient glow using the teal palette
- Optional floating glass cards previewing “Call summary,” “Appointment booked,” etc., for motion depth.

---

### **Demo Carousel**

Below hero — large centered video frame (16:9), autoplay muted.  
Thumbnails or swipe dots underneath for:

1. “AI Receptionist Demo”
2. “Call Scheduling Demo”
3. “Multilingual Example”

Hover: soft cyan glow ring + “▶ Play Preview”.

---

### **Feature Highlights**

Three-column responsive grid with icons:

1. **Conversational AI** — _Not a phone menu. Not a voicemail. A real conversation._
2. **Smart Scheduling** — _Sounds like your best employee, never stressed, never rushed._
3. **Multilingual Support** — _Fluent in English, Spanish, Portuguese, and more._

Each card has subtle glassmorphism: translucent surface with border blur.

---

### **Signup CTA Banner**

Wide full-width section with gradient background (`#00C7C7 → #007BFF`).

**Text:**

> Ready to make every call sound effortless?

**Button:** **Start Free Trial**  
_Secondary link:_ “Contact Sales”.

---

### **Footer**

Dark neutral strip:

- Left: logo + © 2025 Fluent Front AI
- Center: Privacy Policy | Terms | Status
- Right: LinkedIn / X / YouTube icons (monotone cyan on hover)

---

### **Micro-Interactions**

- Buttons: elevate + cyan glow shadow on hover.
- Scroll: header background transitions from transparent → surface color.
- Light/dark toggle in header.
