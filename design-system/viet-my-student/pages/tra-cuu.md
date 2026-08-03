# Tra Cuu Page Overrides

> **PROJECT:** Viet My Student
> **Generated:** 2026-08-03 22:34:34
> **Page Type:** General

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** 1200px (standard)
- **Layout:** Full-width sections, centered content
- **Sections:** 1. Hero headline, 2. Short description, 3. Benefit bullets (3 max), 4. CTA, 5. Footer

### Spacing Overrides

- No overrides — use Master spacing

### Typography Overrides

- No overrides — use Master typography

### Color Overrides

- **Strategy:** Minimalist: Brand + white #FFFFFF + accent. Buttons: High contrast 7:1+. Text: Black/Dark grey

### Component Overrides

- Avoid: Desktop-first causing mobile issues
- Avoid: Same tiny buttons on mobile
- Avoid: Large blocking CSS files

---

## Page-Specific Components

- No unique components for this page

---

## Recommendations

- Effects: Multi-layer shadow stacks (nested View) to simulate clay depth, LinearGradient #A78BFA→#7C3AED buttons, borderRadius 40–50 outer / 32 cards / 20 buttons, Reanimated spring squish (scale 0.92 on press), BlurView glass-clay hybrid cards, floating blobs with slow ±20px drift, Haptics Light on every press
- Responsive: Start with mobile styles then add breakpoints
- Responsive: Increase touch targets on mobile
- Performance: Inline critical CSS defer non-critical
- CTA Placement: Center, large CTA button
