# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Show director / producer** (Vlad and the people he invites as editors): builds the rundown before the event and runs it live — from a laptop in a dark control room, and from a phone in the venue through the pop-up with prompter controls.
- **Team editors**: invited by link, edit the same rundown, see the same live timer.
- **Clients** (sponsors, partners, the event's organisers): read the rundown before the show from home or the office and leave comments; each sees only their own comments.
- **Screen viewers**: the full-page screen version runs as an OBS/vMix browser source or on a monitor in the venue.

## Product Purpose

KAIROS is a live rundown for shows and broadcasts: one shared timer for the whole team, Plan and Live modes (Auto/Manual advance), an always-on-top pop-up, a prompter, and client comments. Success is a show that runs on time with everyone looking at the same moment, and a client review that happens in the rundown instead of in email threads.

## Positioning

Tagline: "Call the moment." The live timer is server-synchronised and shared across editors, the pop-up and the screen version, so the director calls the next segment once and every surface follows.

## Operating Context

- Live use under event pressure: a dark control room on a laptop, a phone in a lit venue, a big screen or OBS source. Glanceability and error prevention matter more than density.
- Pre-show use: editing segments, categories, video/graphics notes, script for the prompter, segment music (editors only may download it; clients must not).
- First event: Turneul Artiștilor · Charity Padel Cup, 15.11.2026 (the default rundown in `rundown-data.js`). Rundown content can be in any language; the interface language is English.

## Capabilities and Constraints

- Static site on GitHub Pages (`vdeaconescu91-cell/kairos`, branch `main`), no build step; Firebase compat SDK 10.14.1 from CDN (auth, Firestore, Storage), project `kairos-rundown`. Without Firebase the app runs locally with the default rundown.
- Pages: `index.html` (sign-in, projects), `rundown.html` (editor, Plan/Live, pop-up `P`, prompter `T`), `client.html` (client read + comment), `join.html` (invite), `preview.html` (generated static preview).
- CSS/JS links carry `?v=` cache-busting that must be bumped on every change.
- `ADMINS` in `sync.js` and `isAdmin()` in `firestore.rules` must stay identical.
- The screen (broadcast) version keeps its current look: next 2 events when the prompter is off, only the next one when it is on.
- Interface language selector (EN, RO, FR, ES, IT, RU, ZH = Simplified Chinese), since 25.11.2026: `kairos-i18n.js` + `kairos-i18n-dict.js`. It translates the interface only; rundown content (titles, scripts, names, comments) always stays in the language it was written in, which is the language of the stream. The choice is per browser (localStorage `kairos-lang`) and changing it reloads the page.
- Undecided: per-segment Auto/Manual; rundown templates.

## Brand Commitments

- Name KAIROS; logo is wordmark C, "The Cut" (the I is a blue playhead #3D7BFF, "ROS" drops 30% of cap height). Never redraw or recolour it. The small mark is for favicon/avatar/app icon only.
- Brand colours: control-room black #05070D, signal #3D7BFF, ink #06175A, ice #D6E4FF. Fonts in the brand guide: Archivo Expanded, Inter Tight, JetBrains Mono.
- Red appears only in the last minute of the timer. Segment categories are never red.
- No unproven superlatives ("first", "biggest") in copy.
- Interface language: English by default, with a selector for RO, FR, ES, IT, RU, ZH (25.11.2026). Rundown content is never translated.

## Evidence on Hand

- Real rundown: Turneul Artiștilor, 39 segments (`rundown-data.js`).
- Brand guide and logo files in the local project folder `D:\_CLAUDE PROIECTE\KAIROS\brand`; wordmark and favicons in `brand/` here.
- No testimonials, customer list or usage numbers exist; do not invent them.

## Product Principles

1. One moment, everywhere: every surface shows the same now/next, from the same clock.
2. Live is a different state, not a different colour: going live, advancing and ending are deliberate acts that are hard to trigger by accident.
3. Readable at a glance, in the dark, on a phone.
4. The director's phone is a first-class control surface, not a mirror.

## Accessibility & Inclusion

WCAG 2.2 AA as the floor: text contrast, 24 px minimum targets (44 px on the phone controls used live), keyboard operation of every live action, reduced-motion respected.
