---
name: KAIROS
description: "Call the moment." A live rundown run like a stage manager's prompt book, under an aurora-lit cue strip.
colors:
  control-room-black: "#05070D"
  desk: "#0A1433"
  desk-raised: "#0F1B45"
  ink: "#06175A"
  signal: "#3D7BFF"
  signal-fill: "#2B63E6"
  signal-fill-hover: "#2457D4"
  signal-ink: "#9DBCFF"
  ice: "#D6E4FF"
  text: "#EEF3FF"
  text-2: "#C9D4EE"
  muted: "#A3B0CC"
  dim: "#8592B3"
  rule: "rgba(214, 228, 255, .10)"
  rule-strong: "rgba(214, 228, 255, .20)"
  standby-amber: "#F2B33D"
  last-minute-red: "#FF4D5E"
  cat-live: "#3D7BFF"
  cat-interview: "#A78BFA"
  cat-graphics: "#22D3EE"
  cat-platform: "#C9D4EA"
  cat-charity: "#F472B6"
  cat-sponsor-ing: "#FF6200"
  cat-donations: "#E4F53B"
  cat-giveaway: "#34D399"
  cat-break: "#9AA3B5"
typography:
  timer:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "clamp(54px, 6.6vw, 104px)"
    fontWeight: 500
    lineHeight: 0.9
    letterSpacing: "-0.03em"
  hero-title:
    fontFamily: "Inter Tight, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(30px, 3.6vw, 56px)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Archivo, Inter Tight, Helvetica Neue, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    fontVariation: "'wdth' 125"
  section-header:
    fontFamily: "Archivo, Inter Tight, Helvetica Neue, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.06em"
    fontVariation: "'wdth' 125"
  show-title:
    fontFamily: "Archivo, Inter Tight, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 125"
  title:
    fontFamily: "Inter Tight, Helvetica Neue, Arial, sans-serif"
    fontSize: "14.5px"
    fontWeight: 600
    lineHeight: 1.45
  body:
    fontFamily: "Inter Tight, Helvetica Neue, Arial, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "'tnum'"
  script:
    fontFamily: "Inter Tight, Helvetica Neue, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter Tight, Helvetica Neue, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.06em"
  cue-number:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "12.5px"
    fontWeight: 500
  clock:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "24px"
    fontWeight: 500
rounded:
  cue: "4px"
  control: "6px"
  button: "8px"
  panel: "10px"
  aurora: "18px"
spacing:
  hairline: "1px"
  xs: "4px"
  sm: "8px"
  cell: "10px"
  md: "12px"
  lg: "16px"
  gutter: "24px"
components:
  button-primary:
    backgroundColor: "{colors.signal-fill}"
    textColor: "#FFFFFF"
    rounded: "{rounded.button}"
    height: "36px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.signal-fill-hover}"
  button-primary-armed:
    backgroundColor: "{colors.standby-amber}"
    textColor: "#1B1200"
  button-default:
    backgroundColor: "{colors.desk}"
    textColor: "{colors.text}"
    rounded: "{rounded.button}"
    height: "36px"
    padding: "0 14px"
  button-default-hover:
    backgroundColor: "{colors.desk-raised}"
  mode-switch-live-on:
    backgroundColor: "{colors.signal-fill}"
    textColor: "#FFFFFF"
    rounded: "{rounded.control}"
    height: "32px"
  cue-box:
    textColor: "{colors.text-2}"
    typography: "{typography.cue-number}"
    rounded: "{rounded.cue}"
    padding: "2px 6px"
  cue-box-go:
    backgroundColor: "{colors.signal-fill}"
    textColor: "#FFFFFF"
    rounded: "{rounded.cue}"
  cue-box-standby:
    textColor: "{colors.standby-amber}"
    rounded: "{rounded.cue}"
  table-header:
    backgroundColor: "{colors.desk}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    padding: "10px"
  dialog:
    backgroundColor: "{colors.desk}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "22px"
    width: "min(440px, 92vw)"
  input:
    backgroundColor: "{colors.control-room-black}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    height: "38px"
    padding: "0 11px"
---

# Design System: KAIROS

## Overview

**Creative North Star: "The Prompt Book Under the Aurora"**

KAIROS runs a show the way a stage manager calls one. The working surfaces are a prompt book on a blue-lit desk in a blacked-out control room: ruled hairline rows, every segment a boxed cue number (Q1…Qn), the next cue marked STANDBY in amber, the running cue filled solid blue for GO. Every time and cue number is set in a mono face so the clock never jitters. Above the book sits the one owner-pinned exception to its austerity: the **aurora strip**, the show timeline with its gradient blocks and liquid fill, and the NOW / NEXT cards lit from below by slow vertical light beams, with two soft blue glows behind the page.

The system is dense but glanceable: a laptop in a dark room, a phone in a lit venue, a big screen. Depth is tonal (black, desk, raised desk), separation is by hairline rule, and colour carries meaning, never decoration: blue is GO, live and the primary action; amber is STANDBY and nothing else; red is the last minute of the timer and nothing else.

**Key Characteristics:**
- Control-room black ground, blue-lit desk panels, ice-white text, hairline rules instead of cards.
- Boxed mono cue numbers; STANDBY amber outline becomes a filled blue GO when the cue is called.
- The aurora strip (timeline, NOW / NEXT cards, background glows) is the owner's pinned look and the only place light effects live.
- Archivo Expanded for the show's own names, Inter Tight for UI and hero titles, JetBrains Mono for every time, duration and cue.
- Square-shouldered controls (4 to 10px radii); 18px only inside the aurora strip.

## Colors

A near-black, blue-lit palette where three signal colours each mean exactly one thing.

### Primary
- **Signal Blue** (signal): the playhead, the live dot, the cue line drawn on the running row, focus-adjacent accents and the aurora's default beam colour. It is the brand's playhead colour from the wordmark.
- **Signal Fill** (signal-fill): solid fill for the primary action, the Live segment of the mode switch and the GO cue box; deep enough that white text passes AA. Hover darkens to signal-fill-hover.
- **Signal Ink** (signal-ink): blue text on dark grounds (links, comment counts, the GO state label).

### Secondary
- **Standby Amber** (standby-amber): the next cue's outline and label in Live, the armed (confirm-to-act) state of buttons, connecting/error sync states and destructive-hover icons. Never a category, never a warning colour for the timer.

### Tertiary
- **Last-Minute Red** (last-minute-red): the timer text in its final minute and when over time. Nowhere else.
- **Category set** (cat-*): each segment category owns one hue, used as a chip tint, timeline block fill and aurora beam colour (`--cc` / `--ac`). Sponsor ING is the sponsor's own orange. None is red.

### Neutral
- **Control-Room Black** (control-room-black): page ground, table ground, input wells.
- **Desk** / **Desk Raised** (desk, desk-raised): panels, sticky table header, dialogs, drawer, menus; raised for hover and selected states.
- **Ink** (ink): brand navy for avatars, the End-show button and quiet secondary fills.
- **Ice** (ice): focus ring, focused field border, clock and time-of-day text, the current timeline block outline.
- **Text / Text-2 / Muted / Dim**: primary copy, script and secondary copy, labels and meta, placeholders and inactive glyphs.
- **Rule / Rule Strong**: hairlines between rows and around panels; strong for control borders and header underlines.

### Named Rules
**The One Meaning Rule.** Blue means GO / live / primary, amber means STANDBY, red means the last minute. A colour that means something is never used to decorate.

**The Never-Red Category Rule.** Segment categories are never red, so a red glance always means the clock.

**The Logo Is Untouchable Rule.** The wordmark ("The Cut") is placed as supplied, never redrawn, recoloured or effected.

## Typography

**Display Font:** Archivo at 125% width (Archivo Expanded), with Inter Tight fallback
**Body Font:** Inter Tight (with Helvetica Neue, Arial)
**Label/Mono Font:** JetBrains Mono (with ui-monospace)

**Character:** A wide, assertive expanded face names the show; a tight grotesk does the work; a mono face keeps time. Tabular numerals are on globally.

### Hierarchy
- **Timer** (JetBrains Mono 500, clamp 54 to 104px, line-height 0.9): the remaining time of the running segment; the largest thing on every surface.
- **Hero title** (Inter Tight 600, clamp 30 to 56px, uppercase): NOW and NEXT segment names inside the aurora strip only.
- **Headline** (Archivo Expanded 700, 17px): dialog and drawer titles; the pop-up's segment title (Archivo 700, uppercase).
- **Section header** (Archivo Expanded 700, 13px, 0.06em, uppercase, ice): header rows that divide the rundown.
- **Show title** (Archivo Expanded 600, 14px): the show name in the top bar.
- **Title** (Inter Tight 600, 14.5px): segment titles in the table.
- **Body** (Inter Tight 400, 13.5px, 1.45): table cells, menus, dialogs. Script text runs at 15px / 1.5, capped at 75ch.
- **Label** (Inter Tight 600, 12px, 0.06em, uppercase): table column heads, menu group heads, chips (11.5px).
- **Cue number / clock** (JetBrains Mono 500, 12.5px / 24px): boxed cues, start times, durations, the wall clock.

### Named Rules
**The Mono Clock Rule.** Every time, duration, drift, count and cue number is JetBrains Mono with tabular numerals. Proportional digits never show a time.

**The 12px Floor Rule.** No interface text below 12px except the 10.5 to 11.5px state micro-labels (STANDBY, cue state, comment tags), which are bold and letter-spaced.

## Layout

A single full-width column capped at 1800px with 24px gutters. Top bar 64px, sticky, on one row: wordmark and show title left, clock centred, mode switch, primary action and overflow right. Below it the aurora strip: the timeline, then a two-column NOW (1.55fr) / NEXT (1fr) grid with 18px gap. In Live on screens wider than 900px the NOW / NEXT strip sticks under the top bar on a black backing so the clock never scrolls away; script previews clamp to 3 and 2 lines. Then the toolbar (category filters left, totals and actions right) and the rundown table, which scrolls horizontally below 1120px and keeps a sticky header. Cells pad 10px; header rows open with 20px above. Under 900px cards pad 16 by 18px and the NOW title shrinks; under 760px timeline labels hide. The pop-up is its own single column built for a phone: title, timer, playhead bar, script, a three-part transport (Back, GO 2.2fr, Prompter) with 44 to 56px targets, and a STANDBY bar pinned to the bottom.

## Elevation & Depth

Flat and tonal. Depth is control-room black, then desk, then desk-raised, separated by hairline rules. Shadows exist only on things that float above the page (menu, toast, dialog, drawer) as long, dark ambient falloffs. The aurora strip is the one lit zone: beams blend in screen mode under a top-down black scrim, the timer and progress bar carry a soft glow in the running colour, and two blurred blue glows sit fixed behind the page.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 18px 40px -12px rgba(0,0,0,.7)`): menus and toasts.
- **Modal** (`box-shadow: 0 30px 60px -20px rgba(0,0,0,.8)`): dialogs; the drawer uses the same falloff pointed left.
- **Timer glow** (`text-shadow: 0 0 40px color-mix(in srgb, var(--ac) 55%, transparent)`): the big timer inside the aurora strip only.

### Named Rules
**The Lit-Strip Rule.** Light (beams, glows, gradient fills, text glow) lives in the aurora strip and the pop-up background. The prompt book below it is flat: no glass, no halos, no gradient text.

## Shapes

Square-shouldered and ruled. Cue boxes, chips and cells use a 4px corner; segmented controls and inputs 6px; buttons 8px; panels, table frame and dialogs 10px. The aurora strip alone rounds to 18px, and timeline blocks to 9px. Lines are 1px hairlines; state lines are heavier: 1.5px for STANDBY outlines and the current timeline block, 2px for the signal cue line above and below the running row, and a 2px white playhead tick on progress bars. Circles are reserved for status dots, avatars and the music play button.

## Components

### Buttons
- **Shape:** gently squared (8px), 36px tall, 32px small; 600 weight, 13px.
- **Primary:** signal-fill with white text, min-width 120px; one per bar (Go Live / Next / End).
- **Hover / Focus:** fill steps to the raised or darker tone over 150ms; press nudges 1px down; focus is a 2px ice outline offset 2px.
- **Armed:** a deliberate act (go live, end show, delete) first arms the control in standby amber with dark text; the second press commits.
- **Default / Ghost:** desk fill with a strong hairline border; ghost drops the fill.

### Mode switch
- A segmented control on desk with a hairline border; the selected segment is raised desk with an inset hairline, and the Live segment, when on, fills signal-fill.

### Chips
- **Style:** category hue at 12% over black, text tinted 55% toward white, 45% border, a 7px square swatch, uppercase 11.5px.
- **State:** filters turned off go transparent with a dashed rule border and dim text.

### Cards / Containers
- **Corner Style:** 10px panels; 18px in the aurora strip.
- **Background:** desk for floating panels; black for the table frame; the aurora cards run a black-to-category gradient from top to bottom.
- **Shadow Strategy:** only when floating (see Elevation).
- **Border:** 1px rule.
- **Internal Padding:** 18 to 22px; 22 by 24px in the aurora cards.

### Inputs / Fields
- **Style:** black well, strong hairline, 6px corner, 38px tall. Table cells are borderless until hovered (rule) or focused.
- **Focus:** border turns ice; focused table cells also lift to desk.

### Navigation
- The sticky top bar on black with a bottom rule; overflow opens a 260px desk menu with uppercase group heads, 36px rows and rule separators. The comments drawer slides in from the right at 420px on desk.

### Cue box (signature)
A boxed mono cue number heads every row. Plan: hairline box. Live, next cue: 1.5px amber outline with a STANDBY label beneath. Running cue: solid signal-fill, white numeral, GO label in signal-ink, and the row is ruled above and below by a 2px signal line on a desk ground. When the director calls the cue, the box flashes amber, scales to 1.12 and settles into blue GO over 0.9s.

### Aurora strip (owner-pinned)
The show timeline and the NOW / NEXT cards. Timeline blocks are category-tinted with 9px corners; finished blocks fill with a dark gradient, the current block fills on a canvas as a slow liquid "slosh" and carries an ice-tinted outline and glow. The NOW and NEXT cards stack a black-to-category gradient, a field of blurred vertical beams that sway and pulse in the current category colour (pausing when the show is paused and stopping under reduced motion), and a top-down black scrim for legibility. Titles are uppercase Inter Tight with a white-to-grey gradient; the big timer glows softly. On a segment change, the new content resolves from a blur over one second and the beams flash brighter. The pop-up carries the same beams as its background.

## Do's and Don'ts

### Do:
- **Do** use JetBrains Mono for every time, duration and cue number.
- **Do** mark the next cue STANDBY in standby-amber and the running cue GO in signal-fill; nothing else uses those states.
- **Do** keep red for the timer's last minute and over-time only.
- **Do** make live acts deliberate: arm in amber, commit on the second press.
- **Do** keep targets at least 24px, and 44px on the pop-up controls used live.
- **Do** keep the aurora strip exactly as the owner pinned it: gradient timeline blocks, liquid fill, beamed NOW / NEXT cards, background glows.
- **Do** honour reduced motion: beams, pulses and enter animations stop.

### Don't:
- **Don't** give a segment category a red hue.
- **Don't** use standby-amber for warnings, timer states or decoration.
- **Don't** redraw, recolour or add effects to the KAIROS wordmark.
- **Don't** carry beams, glass, glows or gradient text beyond the aurora strip and the pop-up background.
- **Don't** use uppercase status labels as kickers above headings on new surfaces.
- **Don't** set interface copy in any language but English.
