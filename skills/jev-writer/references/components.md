# Design System & UI Components Architecture

This document defines the component-first architecture for the `jev-writer` dashboard, enabling AI agents and developers to build stunning, production-grade UIs depending on the available data depth (Tiers 1-3).

## 1. Design System & Tokens

The dashboard uses a modern, shadcn/ui-inspired palette using HSL variables to support clean light and dark modes. It relies entirely on inline CSS for portability.

### Color Palette (CSS Custom Properties)

```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --accent: 240 4.8% 95.9%;
  --accent-foreground: 240 5.9% 10%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 240 10% 3.9%;
  --radius: 0.75rem;

  /* Band / Status Colors */
  --status-excellent: 142 71% 45%;
  --status-strong: 173 80% 40%;
  --status-typical: 240 3.8% 46.1%;
  --status-weak: 38 92% 50%;
  --status-poor: 0 84% 60%;
}

[data-theme="dark"] {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --card: 240 10% 3.9%;
  --card-foreground: 0 0% 98%;
  --popover: 240 10% 3.9%;
  --popover-foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  --primary-foreground: 240 5.9% 10%;
  --secondary: 240 3.7% 15.9%;
  --secondary-foreground: 0 0% 98%;
  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;
  --accent: 240 3.7% 15.9%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 3.7% 15.9%;
  --input: 240 3.7% 15.9%;
  --ring: 240 4.9% 83.9%;
}
```

### Typography & Layout
- **Font Families:** Inter or System Sans-Serif (`ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`).
- **Tabular Numerals:** Use `font-variant-numeric: tabular-nums` (Geist Mono style) for data tables, metrics, and chart labels.
- **Card Styling:** 1px solid border (`var(--border)`), subtle shadow (`box-shadow: 0 1px 3px rgba(0,0,0,0.1)`), backdrop-filter on sticky headers.

## 2. Component Specification

Depending on the data available, agents should assemble dashboards dynamically across three tiers.

### Tier 1: Sparse (Text Only)
Data: Raw text of posts.
- **Rubric Audits:** Mapping to `Tabs` component to flip between dimensions.
- **AI-Feel Distribution:** `Progress` bar showing probability of text reading like AI vs human.
- **Writing Style Diagnosis:** `Card` with `Accordion` for collapsible deep dives into identified traits.
- **Writing Prompt Generator:** A styled code block with a Copy-to-clipboard button (using `Tooltip` for success state).

### Tier 2: Text + Volume/Cadence
Data: Dates of posts + Text.
- **Volume Timeline:** High-fidelity SVG Bar Chart showing posting consistency.
- **Cadence Velocity:** `Badge` components indicating streaks or drop-offs.
- **Style Evolution:** `Tabs` with timeline views.

### Tier 3: Full Text + Outcomes
Data: Engagements, Impressions, Followers + Dates + Text.
- **Outcome Metrics Grid:** 4-up `Card` grid showing total reach, typical engagement, top posts.
- **Reach vs Conversion Quadrants:** Scatterplot matrix (if possible via SVG) or simplified 4-box layout.
- **Format/Hook Breakdown:** Advanced horizontal bar charts.

## 3. High-Fidelity SVG Charts

All charts must be written as string-concatenated functions returning pure SVG. They must be responsive (`viewBox`), accessible (`aria-label`), and standalone.

### 3.1. Volume & Cadence (Bar Chart)
```javascript
function volumeChart(data) {
  // data: { year: string, posts: number }[]
  const max = Math.max(...data.map(d => d.posts), 1);
  const bars = data.map((d, i) => {
    const height = (d.posts / max) * 100;
    const x = i * 40;
    return \`
      <g class="group" tabindex="0">
        <rect x="\${x}" y="\${100 - height}" width="24" height="\${height}" rx="4" class="fill-primary transition-all hover:fill-accent" />
        <text x="\${x + 12}" y="\${100 - height - 4}" class="text-[10px] fill-muted-foreground text-anchor-middle opacity-0 group-hover:opacity-100 transition-opacity">\${d.posts}</text>
        <text x="\${x + 12}" y="112" class="text-[10px] fill-muted-foreground text-anchor-middle">\${d.year}</text>
      </g>\`;
  }).join('');

  return \`
    <svg viewBox="0 -10 300 130" class="w-full h-auto overflow-visible" role="img" aria-label="Volume Chart">
      \${bars}
    </svg>\`;
}
```

### 3.2. Follower Growth (Area Chart)
Smooth gradient fills under a curved or strict path.

```javascript
function followerGrowthChart(points) {
  // points: { date, followers }
  // Calculate scaled X, Y points...
  const path = points.map((p, i) => \`\${i === 0 ? 'M' : 'L'} \${p.x} \${p.y}\`).join(' ');
  const areaPath = \`\${path} L \${points[points.length-1].x} 100 L \${points[0].x} 100 Z\`;

  return \`
    <svg viewBox="0 0 400 120" class="w-full h-auto" role="img" aria-label="Follower Growth">
      <defs>
        <linearGradient id="followerGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="hsl(var(--primary))" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="hsl(var(--primary))" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="\${areaPath}" fill="url(#followerGradient)" />
      <path d="\${path}" fill="none" stroke="hsl(var(--primary))" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>\`;
}
```

### 3.3. Post Format Matrix & Hook Archetype
Horizontal comparative bars (e.g., Text vs Image vs Video).
```javascript
function horizontalBarChart(formats) {
  // formats: { label, reachRate, engRate }[]
  const bars = formats.map((f, i) => {
    const y = i * 30;
    return \`
      <g>
        <text x="0" y="\${y + 12}" class="text-[11px] fill-foreground font-medium">\${f.label}</text>
        <rect x="80" y="\${y + 4}" width="\${f.reachRate * 100}%" height="8" rx="4" class="fill-muted" />
        <rect x="80" y="\${y + 4}" width="\${f.engRate * 100}%" height="8" rx="4" class="fill-primary" />
      </g>\`;
  }).join('');
  
  return \`<svg viewBox="0 0 300 \${formats.length * 30}" class="w-full" role="img">\${bars}</svg>\`;
}
```

## 4. User Dashboard Polish: Transforming src/dashboard.mjs

To elevate the current dashboard to production-grade, apply these layout and CSS/JS code patterns in `src/dashboard.mjs`:

### 4.1. Updated CSS Payload
Replace the current color strings with the HSL tokens defined in Section 1. Wrap custom logic in shadcn-like class names:
- Use `.card`, `.card-header`, `.card-content` for encapsulating content.
- Update \`.chip\` with exact border/background matching shadcn's \`Badge\` component variations.

### 4.2. Interactive Advanced Toggle
Add an "Advanced Mode" switch at the top right to reveal Tier 3 statistical diagnostics (e.g. permutations and power gate variables).
```html
<label class="flex items-center gap-2 cursor-pointer">
  <span class="text-sm font-medium text-muted-foreground">Advanced</span>
  <div class="relative inline-flex h-5 w-9 items-center rounded-full bg-input transition-colors peer-checked:bg-primary">
    <input type="checkbox" id="advancedToggle" class="peer sr-only" />
    <span class="inline-block h-4 w-4 transform rounded-full bg-background transition-transform peer-checked:translate-x-4"></span>
  </div>
</label>
```

### 4.3. Tooltips and Popovers
Implement a lightweight vanilla JS tooltip for SVG charts and info icons:
```javascript
// Vanilla JS Tooltip Logic
document.addEventListener('mouseover', e => {
  if(e.target.dataset.tooltip) {
    const tip = document.getElementById('tooltip-el');
    tip.textContent = e.target.dataset.tooltip;
    tip.style.opacity = '1';
    tip.style.left = e.pageX + 10 + 'px';
    tip.style.top = e.pageY + 10 + 'px';
  }
});
document.addEventListener('mouseout', e => {
  if(e.target.dataset.tooltip) {
    document.getElementById('tooltip-el').style.opacity = '0';
  }
});
```

### 4.4. Copy to Clipboard Button
In `src/dashboard.mjs`, update the copy logic to use a polished icon button that swaps out the SVG on success for immediate visual feedback.

By adopting these patterns, \`src/dashboard.mjs\` will yield a robust, zero-dependency HTML file that looks exactly like a modern React/shadcn application.
