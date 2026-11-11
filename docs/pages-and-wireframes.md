# UI Pages & Wireframes

> **CCE Insights UI** — Page-by-page design reference with ASCII wireframes  
> Each page maps to one or more Insights Service API endpoints. Compliance categories are binary: **Compliant** (`on_track`) and **Non-Compliant** (`non_compliant`).
> Default date range: **90 days** (`VITE_DEFAULT_DATE_RANGE_DAYS`). The global header (RI-67: a blue
> government-style bar carrying the Rwanda MoH seal + "Republic of Rwanda" / "Care Coordination
> Engine") holds a **District** + **Facility** dropdown pair, then a **From / To** date-picker pair
> (`DistrictFilter` + `FacilityFilter` + `DateRangeFilter`). The sidebar links to 7 pages: Dashboard,
> Facilities, Compliance, Deviations, Patients, Events, Ingestion — all 7 render the same branded
> header. (Adoption, Practitioners, Intelligence, and Exports are URL-only / removed — not in the
> nav.)

---

## 0. Recent changes & global filters

**MoH branding (RI-67).** The global header's background changed from plain white to `#1d5fae`
(the same blue used on the Keycloak login page, RI-66), with the Rwanda MoH seal and "Republic of
Rwanda" / "Care Coordination Engine" added on the left — same seal reused in the sidebar's home
link, above "CCE Insights" / "MOH Digital Health". `DistrictFilter`/`FacilityFilter`/
`DateRangeFilter` labels changed from gray to a light blue tint for contrast against the new
background, and their `<select>`/`<input type="date">` elements got an explicit white background
(previously implicit/browser-default, which read as a translucent tint once the header stopped
being white).

**Global District + Facility filters (RI-56).** The header carries `District` (`DistrictFilter`,
options from `GET /lookups/districts`) and `Facility` (`FacilityFilter`, options from
`GET /lookups/facilities`, constrained to the selected district) dropdowns next to the date range.
Both are URL-synced via `FilterContext`, threaded through `useGlobalFilters` into every page's query
params + queryKeys, and scope results to the selected district/facility alongside the date range —
**every page, including Ingestion**, which previously had no district support at all and hid the
District dropdown entirely. `FacilityFilter` auto-resets to "All Facilities" if the district changes
and the current selection falls out of scope, and disambiguates two facilities sharing a display
name by appending the facility id (same convention as the Facility Ranking table).

This pair is now the **only** facility picker in the app. The per-page local facility dropdowns
previously on Deviations, Compliance Overview, and the Events page's Zero-Match Events table were
removed in favor of it, and the `DistrictFacilityFilter` bundled control used on 4 cards
(`PatientReferralCards`, `EbuzimaAdoptionCard`, `ReferralMetricsCard`, `ComplianceFacilityBreakdown`)
had its Facility half suppressed via a `showFacility={false}` prop; those cards still layer their
own District refinement on top of the global district. The Facilities page's ranking table also
lost its "Search Facility" free-text box, now redundant with the global picker.

**Other recent structural changes:**
- **Dashboard** — the four national indicators (Service Compliance Rate, Total Facilities, eBuzima
  Adoption Rate, **Total Referrals**) are grouped into **one card** that links to Facilities. Rates are
  the **simple average of each facility's rate** (equal weight, divided by total facility count).
  The Ingestion Rate and Referral Rate placeholder tiles were removed.
  **RI-51:** **Total Referrals** is the **event count** of referrals received by HIE — it reads the
  `/dashboard/referrals` KPI (`totalReferralsReceived`, from `mv_daily_referral_kpis.referral_count`),
  the **same source** the Facility Ranking **Referrals** column and the Facilities **Referral Details**
  card use, so the three surfaces always agree. (Previously it counted *distinct patients* via
  `/patients/referrals/received-by-hie`, which disagreed with those event-count surfaces.) The
  Compliance page's Service Workflow **Referral** step is a **separate** metric — patients who
  *completed* the referral step — and is intentionally not reconciled with this received count.
  **RI-53:** a fifth indicator, **Patients Received by HIE**, was retained on the Dashboard — **distinct
  protocol-tracked patients** (`uniq(subject)` over ACCEPTED inbound events **matched to a protocol**),
  **not** a raw source-filtered count. It uses the shared matched-cohort query, scoped by **`event_time`**,
  facility **and district** (`/dashboard/overview` → `patientsReceivedHIE`; the endpoint now accepts a
  `district` param) — consistent with the other cards. The indicators sit on a **uniform 3-column grid** (equal widths, columns aligned across
  both rows) — three on top, two on the second row — separated by hairline dividers. The **Total
  Facilities** *active · inactive* line was enlarged (`text-sm`) and **colour-coded** — active in
  **green**, inactive in **red**.
- **Facilities → Facility Ranking** — enriched with the adoption columns (**Expected Visits (Period)**,
  **Actual Visits (Period)**, Reporting Gap, Adoption Rate) and a **Status** (Active/Inactive) column;
  the Events column was dropped; columns are grouped (Referrals | Compliance | **e-Buzima Adoption
  (Selected Period)** | Status). **RI-33:** Expected/Actual are **period totals** for the selected
  date range — Expected = baseline/day × days in range, Actual = Σ daily reporters — not per-day
  figures (for a single-day view they equal the daily baseline). The **Facility
  Status** Active/Inactive indicators filter the ranking; sorting is by Referrals / Compliance /
  Adoption Rate (default Referrals). Clicking a facility opens it on the Compliance page
  (`/compliance?facility=<id>`). **Top/Bottom-5** sits at the bottom and is sliced **client-side from
  the single district-scoped ranking** (`splitTopBottom`) — so both lists reflect the same scoped set
  and, with ≤ 5 facilities in scope, show all of them in opposite order. (Fetching separate
  server-side `limit=5` desc/asc lists broke under the district filter, since the limit is applied
  before district scoping.)
- **Adoption** page removed from the sidebar (its metrics now live in the Facility Ranking).
- **Compliance** transactions **Overdue / Missed** tiles link to the Deviations page with the
  matching filter (carrying the protocol); the **Deviations** top cards filter the Deviation List.
- **Patients** page — the top Referrals card was removed.

---

## Table of Contents

1. [Dashboard](#1-dashboard)
2. [Compliance Overview](#2-compliance-overview)
3. [Protocol Analytics](#3-protocol-analytics)
4. [Patient List](#4-patient-list)
5. [Patient Detail](#5-patient-detail)
6. [Deviations](#6-deviations)
7. [Event Volume](#7-event-volume)
8. [Facility Analytics](#8-facility-analytics)
8a. [Adoption](#8a-adoption)
9. [Practitioner Analytics](#9-practitioner-analytics)
10. [Intelligence](#10-intelligence)
11. [Ingestion Pipeline](#11-ingestion-pipeline)
12. [Exports](#12-exports)
13. [Shared Components](#13-shared-components)

---

## 1. Dashboard

**Route:** `/`  
**Purpose:** Landing page — **high-level national indicators only** (RI-38). Each indicator is a `KpiCard` showing the national number plus a supporting context line; the **whole card is a link** into the section where its detail lives. Per-facility / per-protocol breakdowns and the trend charts were moved to those section pages. Default 90-day date range.

### APIs Used

| Endpoint | KpiCard |
|----------|---------|  
| `GET /v1/insights/dashboard/compliance-summary` | **Service Compliance Rate** (`patients.complianceRate`; context = compliant of tracked) |
| `GET /v1/insights/facilities/activity-summary` | **Total Facilities** (`totalInScope`; context = active · inactive) |
| `GET /v1/insights/facilities/adoption` | **eBuzima Adoption Rate** (Σ actual ÷ Σ expected; context = actual vs expected over the selected period) |
| `GET /v1/insights/dashboard/referrals` | **Referral Rate** — *placeholder 0%, definition pending* |
| `GET /v1/insights/ingestion/funnel` | **Ingestion Rate** (`acceptanceRate`; context = accepted of received) |

### Layout

A single **"National Indicators"** grid of `KpiCard`s — each is an icon chip + title (+ ⓘ) + big value + context line + a "View … →" drill-in link. Rate values are health-coloured (green ≥ 80, amber ≥ 50, red < 50); plain counts are neutral. The five cards use a balanced **3-over-2** grid (6-col: three `col-span-2` on top, two `col-span-3` below) so the odd count has no orphaned gap. Whole card links to its section; the global date filter (`event_time`) scopes the numbers.

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Dashboard                                              [📅 From – To]         │
│  NATIONAL INDICATORS                                                           │
│  ┌─ Service Compliance ─┐ ┌─ Total Facilities ──┐ ┌─ eBuzima Adoption ──┐     │
│  │ 🩺  75.0%           │ │ 🏢  17              │ │ 📈  0.0%            │     │
│  │ 6 of 8 compliant    │ │ 2 active · 15 inact.│ │ 3 actual / 0 exp.   │     │
│  │ View compliance →   │ │ View facilities →   │ │ View facilities →   │     │
│  └─────────────────────┘ └─────────────────────┘ └─────────────────────┘     │
│  ┌─ Referral Rate ──────────────────┐ ┌─ Ingestion Rate ─────────────────┐   │
│  │ ⇄  —   (Definition pending)      │ │ 📥  98.2%                         │   │
│  │ View patients →                  │ │ 108 of 110 accepted · View ing.→ │   │
│  └──────────────────────────────────┘ └──────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Cards

| Card | Value | Context line | Links to |
|------|-------|--------------|----------|
| **Service Compliance Rate** | `patients.complianceRate` | compliant of tracked | `/compliance` |
| **Total Facilities** | `totalInScope` | active · inactive | `/facilities` |
| **eBuzima Adoption Rate** | Σ actual ÷ Σ expected | actual vs expected (selected period) | `/facilities` |
| **Referral Rate** | `—` (neutral placeholder, 0%) | "Definition pending" | `/compliance/patients` |
| **Ingestion Rate** | `acceptanceRate` | accepted of received | `/ingestion` |

Notes:
- **Detail relocated (RI-38):** Compliant / Non-Compliant journeys → Compliance page; Active / Inactive → Facilities page; e-Buzima Adoption breakdown → new **Adoption** menu; **Deviation Trends → Deviations**, **Volume Trends → Events**.
- **Referral Rate** is deferred — shown as a neutral `0%` "Definition pending" card until numerator/denominator are agreed; it still links to Patients.
- The orphaned `ReferralMetricsCard` and `ComplianceFacilityBreakdown` components are retained (unused) for potential future tickets.

---

## 2. Compliance Overview

**Route:** `/compliance`  
**Purpose:** Protocol and facility compliance summaries. Entry point to protocol analytics and patient lists.

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/protocols/{id}/compliance-summary` | Protocol-level compliance metrics (facility-scoped via param) |
| `GET /v1/insights/protocols/{id}/step-analytics` | Per-step rates for the workflow timeline |
| `GET /v1/insights/protocols/{id}/action-order` | Step ordering for the workflow timeline |

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Compliance Overview              [📅 From – To]                  │
│         │                                                                    │
│         │  Protocol: [ANC High-Risk v2.1 ▼]   Facility: [All Facilities ▼] │
│         │                                                                    │
│         │  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐     │
│         │  │ Tracked  │ │Compliant │ │ Non-Compliant│ │ Compliance   │     │
│         │  │ Patients │ │ Patients │ │ Patients     │ │ Rate  72%    │     │
│         │  │   248    │ │   180    │ │     68       │ │              │     │
│         │  └──────────┘ └──────────┘ └──────────────┘ └──────────────┘     │
│         │                                                                    │
│         │  ┌─ Transactions ───────────────────────────────────────────────┐ │
│         │  │ Total Steps │ Completed │ Not Started │ Overdue │ Missed │ Not Yet Judged │
│         │  └──────────────────────────────────────────────────────────────┘ │
│         │                                                                    │
│         │  ┌─ SERVICE WORKFLOW COMPLIANCE (vertical timeline) ────────────┐  │
│         │  │                                                              │  │
│         │  │  ⬤───┌──────────────────────────────────────────────┐       │  │
│         │  │  │   │ 🟢 ANC Visit 1                    92%       │ light │  │
│         │  │  │   │ ████████████████████████████████░░       │ card  │  │
│         │  │  │   │ 210 of 228 completed · 18 missing       │ bg-   │  │
│         │  │  │   │                                              │ white │  │
│         │  │  │   │ Sub-actions (node timeline):                 │shadow │  │
│         │  │  │   │   ● 88% — Weight measurement                 │       │  │
│         │  │  │   │   │                                          │       │  │
│         │  │  │   │   ● 92% — Blood pressure check               │       │  │
│         │  │  │   │   │                                          │       │  │
│         │  │  │   │   ● 85% — Urine analysis                     │       │  │
│         │  │  │   └──────────────────────────────────────────────┘       │  │
│         │  │  │                                                        │  │
│         │  │  ⬤───┌──────────────────────────────────────────────┐       │  │
│         │  │  │   │ 🟡 ANC Visit 2                    65%       │       │  │
│         │  │  │   │ ████████████████████░░░░░░░░░░░░       │       │  │
│         │  │  │   │ 136 of 210 completed · 74 missing       │       │  │
│         │  │  │   └──────────────────────────────────────────────┘       │  │
│         │  │                                                              │  │
│         │  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

> The patient compliance table no longer lives on this page — it has moved to the dedicated
> [Patient List](#4-patient-list) page.

### Key Interactions

| Action | Behavior |
|--------|----------|
| Select protocol from dropdown | Fetch compliance summary + step analytics + action order |
| Select facility from dropdown | Re-scope the summary + workflow timeline to that facility. **RI-48:** when facilities share a name, the option shows `Name (id)` to disambiguate (same logic as the Facility Ranking table). |
| Expand a workflow step | Reveal its sub-actions in the timeline |

> **RI-50 — Service Workflow Compliance tree** (`buildWorkflowTree`): actions are nested as the
> protocol nests them, to any depth: top-level steps with their data-bearing sub-actions, and a step
> under a sub-action under it (e.g. lab results under lab order). If a cohort's **only** activity is a
> sub-action whose parent step has no data (e.g. a referral-only journey — the patient completed a
> `referral` sub-action but no `consultation` step), the parent is **synthesized as a grouping
> container** ("sub-actions only", no bar of its own) so the sub-action is still visible — previously
> the whole section rendered blank. Every level above a step with data is synthesized the same way.

**Step groups in the Service Workflow Compliance tree.** A step group, such as a visit, has no step
data of its own. It is always a container (`group: true` in the action order):
- A group inside a group, such as a consultation inside a visit, is nested inside it. It is not shown
  as a second card beside it.
- Its children are listed as **Steps (n)**. A step's children are **Sub-actions (n)**.
- Its header shows its own figures from step analytics `groups[]`: how often it opened, for how many
  patients, and how many of those had every step so far done. For example: `step group · 150 opened
  for 105 patients · 40% completed (60/150)`. Against an API without `groups[]`, it shows only
  "step group".
- A step inside a group, at any depth, can repeat once per visit. So it is measured per time it was
  expected (`completedStepInstanceCount / stepInstanceCount`), with its patients alongside:
  `30/150 times · 21/105 patients`. A step outside every group is measured per patient:
  `50/50 patients`. Every count shows its unit.

Example, the Rwanda outpatient protocol:

```
● Registration                                   100%
    50 of 50 patients completed
● Outpatient Visit   step group · 150 opened for 105 patients · 40% completed (60/150)
    STEPS (3)
    ● Patient Visit                  100%  140/140 times · 97/97 patients
    ● Vitals Recording                20%  30/150 times · 21/105 patients
    ○ Clinical Consultation  step group · 120 opened for 83 patients · 75% completed (90/120)
        STEPS (7)
        ● Clinical Consultation       83%  100/120 times · 73/83 patients
        ● Chief Complaints           100%  60/60 times · 43/43 patients
        ● History of Present Illness 100%  12/12 times · 9/9 patients
        ● Laboratory Order           100%  40/40 times · 31/31 patients
            SUB-ACTIONS (1)
            ● Laboratory Results      56%  14/25 times · 12/20 patients
        ● Clinical Diagnosis          32%  38/118 times · 27/82 patients
        ● Treatment Prescription     100%  30/30 times · 23/23 patients
        ● Referral                   100%  18/18 times · 15/15 patients
```

A step with no step instances in the range is left out, as Laboratory Results would be until one is
recorded.

---

## 3. Protocol Analytics

**Route:** `/compliance/protocols/:protocolDefinitionId`  
**Purpose:** Deep-dive protocol performance — step-level analytics, completion funnel, outcome distribution, enrollment trends.

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/protocols/{id}/step-analytics` | Per-step completion rates, timeliness |
| `GET /v1/insights/protocols/{id}/completion-funnel` | Drop-off at each step |
| `GET /v1/insights/protocols/{id}/outcome-distribution` | Terminal status breakdown |
| `GET /v1/insights/protocols/{id}/enrollment-trends` | Enrollments over time |

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  ANC High-Risk Monitoring v2.1 — Protocol Analytics               │
│         │  ← Back to Compliance                                              │
│         │                                                                    │
│         │  ┌─ Step Analytics ──────────────────────────────────────────────┐ │
│         │  │ Action       │ Completed │ Rate  │ On Time │ Late │ Avg vs Due│ │
│         │  │ anc-visit-1  │ 210/248   │ 85%   │ 145     │ 25   │ 1.2      │ │
│         │  │ anc-visit-2  │ 160/248   │ 65%   │ 100     │ 45   │ 3.8      │ │
│         │  │ anc-visit-3  │ 105/248   │ 42%   │  60     │ 30   │ 5.1      │ │
│         │  │ lab-result   │  95/248   │ 38%   │  50     │ 35   │ 6.2      │ │
│         │  └──────────────────────────────────────────────────────────────┘ │
│         │                                                                    │
│         │  ┌─ Completion Funnel ───────────┐ ┌─ Outcome Distribution ─────┐ │
│         │  │                               │ │                            │ │
│         │  │ ████████████████████████ 248  │ │        ┌─────────┐        │ │
│         │  │ enrollment (97%)              │ │       ╱  Active   ╲       │ │
│         │  │                               │ │      │   72.6%    │      │ │
│         │  │ ████████████████████  240     │ │       ╲           ╱       │ │
│         │  │ anc-visit-1 (88%)             │ │  Compl─┤         ├─Withd  │ │
│         │  │                               │ │  21.0% │         │ 3.2%  │ │
│         │  │ ██████████████  210           │ │        └─────────┘        │ │
│         │  │ anc-visit-2 (76%)             │ │        Expired 3.2%       │ │
│         │  │                               │ │                            │ │
│         │  │ ██████████  160               │ └────────────────────────────┘ │
│         │  │ anc-visit-3 (66%)             │                                │
│         │  │                               │                                │
│         │  └───────────────────────────────┘                                │
│         │                                                                    │
│         │  ┌─ Enrollment Trends ───────────────────────────────────────────┐ │
│         │  │ Interval: [Daily] [Weekly •] [Monthly]                       │ │
│         │  │                                                               │ │
│         │  │  30│       ●                                                  │ │
│         │  │  25│     ●   ╲                                                │ │
│         │  │  20│ ●─●     ●──●──●                                         │ │
│         │  │  15│                  ╲──●                                     │ │
│         │  │  10│                                                          │ │
│         │  │    └──────────────────────────                                │ │
│         │  │    Jan 6  Jan 13  Jan 20  Jan 27  Feb 3                      │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Step Analytics Table Columns

| Column | Source | Notes |
|--------|--------|-------|
| Action | `actionId` | Step name from PlanDefinition |
| Completed | `completedCount / totalInstances` | Ratio |
| Rate | `completionRate` | Percentage bar; the API sends a 0–1 fraction, shown ×100 |
| On Time | `timelinessDistribution.completedOnTime` | Count (completed + SLA met) |
| Late | `timelinessDistribution.completedLate` | Count (completed + SLA overdue/missed), highlighted amber |
| Avg Days vs Due | `avgDaysToComplete` | Average of `completed_at − due_date` in days, over completed steps with a due date; negative = completed early |
| Median | `medianDaysToComplete` | Median days (tooltip) |

The table shows two counts for each step:
- **Patients Completed** (`completedCount / totalInstances`) counts patients. A patient counts once,
  however many visits they had.
- **Visits Completed** (`completedStepInstanceCount / stepInstanceCount`) counts step instances. A step
  in a step group that repeats, such as one visit per day, has one per visit. So this shows how often
  it is done per visit. A patient who did vitals in visit 1 and skipped it in visits 2 to 5 counts as
  completed under Patients Completed, but only 1/5 here.

**Step Groups card.** It is shown below the table when the protocol has step groups. It has one row
per group, in protocol order:

| Column | Source | Notes |
|--------|--------|-------|
| Group | `groups[].title` | With the group's action id |
| Patients | `patientCount` | Patients with at least one instance |
| Instances | `instanceCount` | Each time the group opened, such as each visit. Also shown per patient. |
| Completed | `completedInstanceCount` | Every step in it so far done, nested groups' steps included, or recorded complete |
| Rate | `completionRate` | Bar; 0–1 from the API, shown ×100 |

---

## 4. Patient List

**Route:** `/compliance/patients`  
**Purpose:** Browse patients by compliance category (Compliant / Non-Compliant only). Cohort can be filtered by enrollment date or step activity date.

> **Note (RI-44 / RI-51):** the `Referrals` indicator strip (`PatientReferralCards`) described below is **not currently mounted** on this page (see "the top Referrals card was removed" above). The `/patients/referrals/received-by-hie` endpoint (distinct patients) remains available but is **not surfaced in the live UI** — after **RI-51**, the only referral counts shown are the **event counts** on the Dashboard, Facility Ranking, and Facilities pages. The section below is retained for when the strip is re-introduced.

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/protocols/{id}/patients` | Patient list with compliance status (`status`, `patientId`, `dateFilterMode`, paging params) |
| `GET /v1/insights/patients/referrals/received-by-hie` | **RI-44 Referrals** — patients with a referral received by HIE (drill-down list; date-scoped by `event_time`) |
| `GET /v1/insights/facilities/ranking` (limit 1000) | Facility catalog (id/name/district) for the referral drill-down's District/Facility filter |

### Referrals indicators (RI-44)

A `Referrals` card sits above the Patient List with four metrics:

| Metric | State |
|--------|-------|
| **Created Referrals** | placeholder (`—`, definition pending) |
| **Referrals Received by HIE** | **live** — distinct patients with a referral received by HIE in the period; **click to drill down** |
| **Failed Referrals** | placeholder (`—`, definition pending) |
| **Referral Rate** | placeholder (`—`, definition pending) |

The **Referrals Received by HIE** drill-down lists each patient (→ patient detail) with facility · referral date, and has its **own** District filter (shared `DistrictFacilityFilter`, same control as the Facilities page, with `showFacility={false}` as of RI-56 — Facility is exclusively the global header filter now) — the card value stays the unfiltered total while the drill-down count/list reflect the district + global facility filter. District is resolved per patient via the facility catalog.

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Patient Compliance              [📅 From – To]                    │
│         │  Distinct patients enrolled in the selected protocol during         │
│         │  the selected period. [description changes with mode toggle]        │
│         │                                                                    │
│         │  ┌─ Patient List ────────────────────────────────────────────────┐ │
│         │  │ Protocol: [ANC High-Risk ▼]                                  │ │
│         │  │ Status: [All] [Compliant] [Non-Compliant]                    │ │
│         │  │ Filter by: (●) Enrollment Date  ( ) Activity Date            │ │
│         │  │ Search: [patient id…________]  [Search] [Clear]              │ │
│         │  │                                                               │ │
│         │  │ Patient ID        │ Category        │ Rate │ Steps │ Deviat. │ │
│         │  │ 260225-0002-5501  │ 🔴 Non-Compliant│ 25%  │ 1/4   │ 7       │ │
│         │  │ 260115-0001-7823  │ 🟢 Compliant    │ 85%  │ 5/6   │ 0       │ │
│         │  │   Rows: [15 ▼]              Showing 1–15 of 248   ◀ ▶        │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Date Filter Mode

| Mode | Behaviour |
|------|-----------|
| **Enrollment Date** (default) | Cohort = patients whose `enrolled_at` falls in [startDate, endDate]. Matches the Dashboard and Compliance Overview cohort. |
| **Activity Date** | Cohort = patients with at least one step whose `updated_at` falls in [startDate, endDate], regardless of when they enrolled. Useful for "who had step activity this week?" |

---

## 5. Patient Detail

**Route:** `/compliance/patients/:patientId`  
**Purpose:** Individual patient view — a master-detail layout: every protocol the patient is
enrolled in listed on the left, full detail (journey timeline, deviations, intelligence alerts,
step details) for whichever one is selected on the right. Replaces the earlier design where every
protocol's journey rendered fully, stacked one after another on one long page — that didn't scale
once a patient carried several enrollments at once.

Arriving from the Patient List or the Deviations page (both link with
`?protocolInstanceId=<id>`) pins that specific protocol to the top of the left list and
auto-selects it, so a deep link lands on the enrollment the user actually came to look at rather
than an arbitrary default.

The **Deviations** and **Intelligence Alerts** lists show **5 at a time**. With more than 5, a pager
under the list shows the range, such as `1–5 of 12`, with ‹ and › to move between pages. Picking
another protocol starts both lists again at page 1.

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/patients/{id}/compliance-timeline` | Journey timeline for every protocol (left list + right panel) |
| `GET /v1/insights/patients/{id}/protocol-tracking` | Title/thumbnail/enrolled-at metadata per protocol instance |
| `GET /v1/insights/patients/{id}/protocol-tracking/{piId}` | Step Details table for the selected protocol (fetched lazily — only once its toggle is opened) |
| `GET /v1/insights/patients/{id}/deviations` | Cross-protocol deviations, filtered client-side to the selected protocol |
| `GET /v1/insights/patients/{id}/intelligence-deliveries` | Intelligence-alert deliveries, filtered client-side to the selected protocol's `protocolCanonical` |

### Wireframe

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  ← Back to Patient List                                                  │
│         │  Patient: 260225-0002-5501                                               │
│         │  ┌─ Protocols ──────────┐ ┌─ Protocol Journey ─────────────────────────┐ │
│         │  │ 🟢 ACTIVE            │ │ 🟢 ACTIVE  ANC High-Risk v2.1               │ │
│         │  │ ANC High-Risk v2.1   │ │ Enrolled: Jan 15, 2026   3/6 steps   2 dev. │ │
│         │  │ http://.../anc-hi... │ │                                              │ │
│         │  │ 3/6 steps  50%       │ │ Legend: ● Completed ● Pending ● Deviation   │ │
│         │  │ 2 deviations         │ │         ○ Not started  [Mandatory]          │ │
│         │  │──────────────────────│ │  ● anc-visit-1  Completed [ON TIME]         │ │
│         │  │ ⚪ COMPLETED (sel.)   │ │  ● anc-visit-2  🟣 DEVIATION                │ │
│         │  │ Facility Visit       │ │  ● anc-visit-3  Pending                     │ │
│         │  │ 1/1 steps  100%      │ │  (superseded NOT_STARTED hidden)            │ │
│         │  │ (scrolls indep. once │ │ ┌─ Deviations ────────┐┌─ Intell. Alerts ──┐│ │
│         │  │  list overflows;     │ │ │ ⚠ ORDER_VIOLATION    ││ overdue-alert     ││ │
│         │  │  panel stays sticky) │ │ │ anc-visit-2          ││ · sent            ││ │
│         │  └───────────────────────┘ └──────────────────────┘└───────────────────┘│ │
│         │                            ┌─ Step Details ▸ Show raw step-level data ──┐ │
│         │                            │ (collapsed by default; expands in place)   │ │
│         │                            └─────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────┘
```

Selecting a different protocol on the left swaps the entire right panel to that protocol's own
journey/deviations/alerts/step-details — nothing from one protocol is ever mixed into another's
view. The left list and the "Back to Patient List" + page title above it are both sticky, so
they stay visible while a long journey on the right scrolls.

### Protocol Journey Visibility Rules

Root steps that are untriggered — `status` `NOT_STARTED` with no `stepStatus`, i.e. no step instance yet — are suppressed when a later root step in the same protocol has progressed (any root step after them whose `status` is not `NOT_STARTED`). A step that exists but is still outstanding with no breached deadline also arrives as `NOT_STARTED`, but with `stepStatus: 'NOT_STARTED'`; the page renders it as **Pending** (blue) and never hides it. Sub-steps inherit parent visibility — a sub-step is hidden if its parent root step is hidden, ensuring orphaned sub-step entries never appear (e.g., "Laboratory Results" is not shown unless "Lab Order" is also shown). A step with an associated deviation (`ORDER_VIOLATION`/`OVERDUE`/`MISSED`) and a non-terminal status is rendered with a synthetic **DEVIATION** display status (purple).

### Step groups

A step group is a set of steps that belong together, such as one visit. The protocol defines it. Its
row in the journey has a **Step group** badge, and its steps follow it, one level deeper.

Under the group's name, each of its instances is a chip. A group that repeats, such as one visit
per day, has one instance per cycle.
- The chips run **newest first**.
- A chip shows a number (`#1`, `#2`, …) and the day it opened, such as `#14 · Nov 1`. The number is
  left out when the group opened once. The year is added when the visits span more than one year.
- A dot on each chip says how the visit went:
  - **green**: completed;
  - **purple**: in progress (still open);
  - **red**: has a deviation. A deviation's step is in that visit, at any depth, or the group missed its
    own deadline. Red wins over green and purple.
- The **latest 4** visits get a chip each. The rest sit behind an **"N earlier visits"** button. It opens
  a menu of them, newest first, each with its status and steps done. The menu never holds just one
  visit: with 5 visits, all 5 get chips.
- Hovering a chip shows it in full: `#6 · Oct 1, 2026 · In progress · 2/4 steps · has a deviation`.
- A line under the chips says the same for the shown visit: `Shown: #6 · Oct 1, 2026 · In progress ·
  2/4 steps`. Steps done count steps in a group nested inside it too. The status is **Completed**,
  **In progress**, **Overdue** or **Missed** (the group's own deadline).
- When a protocol has more than one visit, the legend adds the three dot colours under **Visit chips**.

**One cycle at a time.** The steps under a group show one of its instances, not all of them merged:
- By default, the latest instance is shown.
- When a group has more than one instance, each chip is a button. Click one to show its steps. The
  shown chip has a blue ring.
- Picking a visit from the **earlier visits** menu shows it and closes the menu. That visit then gets a
  chip of its own, after the latest 4, so the shown visit always has a chip. Escape or a click outside
  closes the menu.
- The group's badge, and each step's badge, time, SLA badge, practitioner and facility, come from the
  shown instance.
- A step with nothing in the shown instance reads **Not started**.
- A nested group, such as a consultation inside a visit, lists only its instances inside the shown
  visit. It is numbered from `#1` inside each visit. With none in that visit, it reads **Not started**.
- A step under another step, such as lab results under lab order, follows the group around them both.
- Deviation highlights count only step instances in the shown instances, or in no group.
- Picking another protocol goes back to the latest instances.
- An API without `instances[]` on step rows still works: the steps then merge every cycle, as before.

- A link can open the page at a visit: `?visit=groupActionId:groupInstanceId,…`. The Deviations page
  uses it.

Outside the chips, an instance is named by its number and the full day it opened, such as
`#2 · Nov 3, 2026`. A group that opened once shows only the day.

An open group reads **In progress** rather than Pending. A group that never opened is
**Not started**, and follows the visibility rules above like an untriggered step. The protocol's
`x/y steps` count and its deviation count still cover every cycle, and leave groups out. When a
group has more than one instance, the header says so: `3/3 steps · all visits`.

**Which visit.** Other parts of the page name the visit a step instance is in, from its `groupPath`,
such as `Outpatient Visit #2 (Sep 6, 2026) › Clinical Consultation`:
- Each card in **Deviations** says "In …" for a step in a group. When that visit isn't the one shown,
  **Show this visit** shows it. Otherwise the card says "shown above".
- The **Step Details** table has a **Visit** column.

Example: a patient with two visits. The first visit is done. The second has history recorded but not
BP. Visit #2 is shown, as the latest:

```
● Visit                       [In progress] [Step group]
  ((🟣 #2 · Nov 3))  [🟢 #1 · Nov 2]
  Shown: #2 · Nov 3, 2026 · In progress · 1/2 steps
  ● History                   [Completed]
  ● Blood Pressure            [Pending]
```

Clicking `#1` shows the first visit: Visit and both steps read **Completed**.

A patient with 14 visits, the latest shown. Visit #12 had a deviation:

```
● Outpatient Visit            [In progress] [Step group]
  ((🟣 #14 · Nov 1))  [🟢 #13 · Oct 28]  [🔴 #12 · Oct 21]  [🟣 #11 · Oct 17]  [🕘 10 earlier visits ⌄]
  Shown: #14 · Nov 1, 2026 · In progress · 2/4 steps
```

### Timeliness badges

Each completed journey step shows a timeliness badge read from the CCE 2.0.0 status pair:

| `stepStatus` | `slaStatus` | Badge | Color |
|--------------|-------------|-------|-------|
| `COMPLETED` | `MET` | **ON TIME** | green |
| `COMPLETED` | `OVERDUE` / `MISSED` | **LATE** | amber |

A completed step whose `slaStatus` is still null (the verdict lands within one Step SLA cycle, and
never for an optional step) shows no timeliness badge. 1.x's `EARLY` has no 2.0.0 equivalent — it is
`MET`.

---

## 6. Deviations

**Route:** `/deviations`  
**Purpose:** Deviation KPIs, trends, most-deviated steps, and a paginated/searchable deviation list.
Deviations have **three types**: `OVERDUE`, `MISSED`, `ORDER_VIOLATION`.

> **RI-49:** the page has a **Protocol** filter (per-page). Facility scoping is via the global
> header `Facility` filter (RI-56 — the page's own local Facility dropdown was removed) — it
> re-scopes **all four** sections — KPI cards, trends, Most Deviated Steps, and the Deviation List
> — via `facilityId` on every deviation endpoint, same as before.

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/deviations/kpis` | KPI cards (total / overdue / missed / order-violation counts) |
| `GET /v1/insights/deviations/trends` | Time-bucketed deviation trends |
| `GET /v1/insights/deviations/by-facility` | **RI-34** — facilities ranked by deviation count, by type (chart) |
| `GET /v1/insights/deviations/by-action` | Most-deviated protocol steps |
| `GET /v1/insights/deviations` | Paginated deviation list |

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Deviation Analytics              [📅 From – To]                   │
│         │  Protocol: [All Protocols ▼]                                       │
│         │                                                                    │
│         │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐      │
│         │  │ Total    │ │ ⚠ Over-  │ │ 🔴 Missed│ │ 🟣 Order         │      │
│         │  │ Deviat.  │ │ due      │ │          │ │    Violation     │      │
│         │  │   270    │ │   140    │ │    90    │ │      40          │      │
│         │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘      │
│         │                                                                    │
│         │  ┌─ Deviation Trends ────────────────────────────────────────────┐ │
│         │  │ Interval: [Daily] [Weekly •] [Monthly]                       │ │
│         │  │    ■ Overdue   ▒ Missed   ▓ Order Violation                  │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
│         │                                                                    │
│         │  ┌─ Deviations by Facility and Type ─────────────────────────────┐ │
│         │  │ [All Types] [Overdue] [Missed] [Order Violation]              │ │
│         │  │ ■ Overdue  ▒ Missed  ▓ Order Violation                        │ │
│         │  │ Facility A  ▓▓▓▓▓▓░░░░▒▒▒▒            18                     │ │
│         │  │ Facility B  ▓▓▓▓░░░░░░▒▒              11                     │ │
│         │  │                          ◀ 1-10 of 24 ▶                      │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
│         │                                                                    │
│         │  ┌─ Most Deviated Steps ─────────────────────────────────────────┐ │
│         │  │ Action      │ Total │ Overdue │ Missed │ Order Violation      │ │
│         │  │ lab-result  │  85   │  40     │  23    │  22                  │ │
│         │  │ anc-visit-3 │  58   │  30     │  18    │  10                  │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
│         │                                                                    │
│         │  ┌─ Deviation List ──────────────────────────────────────────────┐ │
│         │  │ [All Types] [Overdue] [Missed] [Order Violation]              │ │
│         │  │ Search: [patient id…________]                                 │ │
│         │  │                                                               │ │
│         │  │ Patient          │ Action     │ Type            │ Facility│Dtc│ │
│         │  │ 260225-0002-5501 │ anc-visit-2│ ORDER_VIOLATION │ 0002    │…  │ │
│         │  │ 260310-0008-4421 │ lab-result │ MISSED          │ 0008    │…  │ │
│         │  │                          Page 1 of 3   ◀ ▶                   │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

> **Step groups:** the Deviation List has a **Visit** column, such as `Outpatient Visit #2
> (Sep 6, 2026)`, for a step in a step group, and `—` otherwise. The patient link opens the patient at
> that visit.

> **RI-48:** in the Deviation List, the **Facility** column shows `Name (id)` when two or more
> facilities share the same name (same disambiguation as the Facility Ranking table); a unique
> name is shown plain.

> **RI-34 — Deviations by Facility and Type.** Stacked horizontal bar chart, one bar per facility,
> ranked by total deviations desc (or by a single type's count when that type is selected — see
> below). Paginated (`TableRangePagination`, page size 10) rather than a fixed "top 10" — scoped
> entirely by the page's existing global District/Facility filters: all facilities paginated when
> neither is set, every facility in the selected district when only District is set, exactly one
> bar when a specific Facility is set. The `[All Types] [Overdue] [Missed] [Order Violation]`
> toggle **shares state** with the KPI tiles above and the Deviation List's own identical toggle
> below — clicking any of the three updates all three sections together (one URL-synced `type`
> param). Selecting a single type re-ranks the page by that type's count via the endpoint's
> `deviationType` param, rather than just recoloring/filtering the existing total-ranked order.

---

## 7. Event Volume

**Route:** `/events`  
**Purpose:** Clinical event metrics — volume by resource type and facility.

Clicking the **Total Events** or **Zero Match Rate** header tiles scrolls to and highlights the
corresponding section below (By Resource Type / Zero-Match Events Info respectively) — the other
three tiles (Matched Rate, Duplicates, Pipeline Loss) are not clickable. Both scroll targets carry
`scroll-mt-24` so the sticky header doesn't cover the top of the section on landing.

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/events/summary` | Date-scoped header metrics (total, matched/zero-match/duplicate breakdown) |
| `GET /v1/insights/events/kpis` | Cumulative Pipeline Loss card (not date-filtered) |
| `GET /v1/insights/events/trends` | Volume over time |
| `GET /v1/insights/events/by-resource-type` | Resource type breakdown (chart) |
| `GET /v1/insights/events/by-facility` | Facility event counts |
| `GET /v1/insights/events/zero-match` | "Zero-Match Events Info" table — resource type, code, category, facility, and count for events that matched no protocol step |

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Event Volume & Activity          [📅 From – To]                   │
│         │                                                                    │
│         │  ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│         │  │ Total  │ │ Matched│ │ Zero     │ │ Dupli-   │ │ Pipeline │     │
│         │  │ Events │ │ Rate   │ │ Match    │ │ cates    │ │ Loss     │     │
│         │  │ 12,480 │ │ 78.7% │ │ Rate20.4%│ │   120    │ │ 0.2%    │     │
│         │  └────────┘ └────────┘ └──────────┘ └──────────┘ └──────────┘     │
│         │                                                                    │
│         │  ┌─ Volume Trends ───────────────────────────────────────────────┐ │
│         │  │ Interval: [Daily] [Weekly •] [Monthly]                       │ │
│         │  │                                                               │ │
│         │  │  2000│ ▒▒▒▒▒▒▓▓▓▓       ▒▒▒▒▒▒▒▓▓▓                         │ │
│         │  │  1500│ ▒▒▒▒▒▒▓▓▓▓       ▒▒▒▒▒▒▒▓▓▓                         │ │
│         │  │  1000│ ▒▒▒▒▒▒▓▓▓▓       ▒▒▒▒▒▒▒▓▓▓                         │ │
│         │  │   500│ ▒▒▒▒▒▒▓▓▓▓       ▒▒▒▒▒▒▒▓▓▓                         │ │
│         │  │      └──────────────────────────────                          │ │
│         │  │  ■ Encounter  ▒ Observation  ▓ Condition  □ Other            │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
│         │                                                                    │
│         │  Tabs: [By Resource Type •] [By Facility]                            │
│         │                                                                    │
│         │  ┌─ By Resource Type ────────────────────────────────────────────┐ │
│         │  │ Resource Type    │ Count │ Percentage │ Bar                   │ │
│         │  │ Encounter        │ 4,200 │ 33.7%      │ ████████████████     │ │
│         │  │ Observation      │ 3,850 │ 30.8%      │ ███████████████      │ │
│         │  │ Condition        │ 1,600 │ 12.8%      │ ██████               │ │
│         │  │ MedicationReq    │ 1,200 │  9.6%      │ █████                │ │
│         │  │ ServiceRequest   │   820 │  6.6%      │ ███                  │ │
│         │  │ Immunization     │   450 │  3.6%      │ ██                   │ │
│         │  │ Procedure        │   360 │  2.9%      │ █                    │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Tab Panels (within Events page)

| Tab | Content | API |
|-----|---------|-----|
| By Resource Type | `ResourceTypeBarChart` (bar chart) | `events/by-resource-type` |
| By Facility | Table (Facility / Total Events / Resource Types). API rows are **merged with the full facility reference list** so facilities with 0 events still appear; FOSA IDs resolve to names (duplicates disambiguated). Sorted by total events, **client-side paginated 10/page**. The zero-fill merge is scoped by both the global District *and* Facility filter as of RI-56 (a prior bug only checked district, so selecting a specific facility still merged in every other facility in that district with a synthetic 0-event row). | `events/by-facility` + `facilities/reference` |

Below the tabs, a separate **Zero-Match Events Info** table lists events that received no protocol
match (resource type, code, category, facility, count, percentage), server-side scoped by the
global District/Facility filter and date range. The FACILITY column shows the plain facility name,
appending `(facilityId)` only on a name collision — same disambiguation convention as the header
Facility dropdown and the Facility Ranking table (RI-64).

---

## 8. Facility Analytics

**Route:** `/facilities`  
**Purpose:** Facility activity summary, Top 5 / Bottom 5 compliance highlights, and a leaderboard
ranked by compliance rate, deviation count, or event volume (with a Best/Worst-first toggle).
Color-coded compliance column with legend. The table's local "Search Facility" text box was
removed as of RI-56 — now redundant with the global header Facility filter.

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/facilities/activity-summary` | Activity cards (total / active / inactive) |
| `GET /v1/insights/facilities/ranking` | Facility leaderboard + Top/Bottom-5 highlights |

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Facility Analytics               [📅 From – To]                  │
│         │                                                                    │
│         │  ┌──────────┐ ┌──────────┐ ┌──────────┐                           │
│         │  │ Total    │ │ Active   │ │ Inactive │                           │
│         │  │ Facilit. │ │ Facilit. │ │ Facilit. │                           │
│         │  └──────────┘ └──────────┘ └──────────┘                           │
│         │                                                                    │
│         │  ┌─ Highlights ──────────────────────┐                            │
│         │  │ Top 5 by compliance | Bottom 5    │                            │
│         │  └───────────────────────────────────┘                            │
│         │                                                                    │
│         │  Rank By: [Compliance Rate •] [Deviation Count] [Event Volume]    │
│         │  Order: [Best First •] [Worst First]                              │
│         │                                                                    │
│         │  ┌─ Facility Ranking Table ──────────────────────────────────────┐ │
│         │  │ Rank │ Facility │ Referrals │ Tracked Pts │ Compliance │ Dev│Ev│ │
│         │  │  1   │ 0015     │ 34        │ 89          │ 🟢 82%     │ 5 │..│ │
│         │  │  2   │ 0002     │ 51        │ 156         │ 🟡 74%     │ 12│..│ │
│         │  │  3   │ 0008     │ 12        │ 62          │ 🔴 58%     │ 22│..│ │
│         │  │  Legend: 🟢 ≥80%  🟡 50-79%  🔴 <50%   (Events = period)     │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

> The Facility Ranking table now includes a **Referrals** column (per-facility referral count,
> shown next to the facility).
>
> The **Non-Compliant Hotspots** section was removed from this page.

---

## 8a. Adoption (legacy — no longer a page)

**Route:** _none_ (removed)  ·  **Sidebar:** _not in nav_  
**Purpose:** e-Buzima reporting adoption vs. the expected baseline. Was briefly its own side menu
(RI-38) but has since been **removed** — the adoption metrics now live in the **Facility Ranking**
(Facilities page), and the Dashboard's **eBuzima Adoption Rate** card links to `/facilities`. The
`EbuzimaAdoptionCard` component below is retained off-nav; this section documents it for reference.

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/facilities/adoption` | Country adoption summary + per-facility breakdown |

### Content

Hosts the `EbuzimaAdoptionCard`: a country-level summary that **drills down** to facility detail
(RI-43).

> **Legacy:** this page was removed from the sidebar — the adoption metrics now live in the
> **Facility Ranking** (Facilities page). The `EbuzimaAdoptionCard` component is retained (off-nav)
> and its columns still read raw values, so RI-33's period totals apply here too.

- **Summary tiles** (top): Expected Visits, Actual Visits, Reporting Gap, Adoption
  Rate (Σ actual ÷ Σ expected). Click the card to expand the detail.
- **Drill-down table** (per facility): District · Facility · Expected Visits · Actual Visits ·
  Reporting Gap (±, red = under-reporting) · Adoption Rate (colour-coded ≥80 / ≥50 / <50), with a
  **District filter** (shared `DistrictFacilityFilter`, `showFacility={false}` as of RI-56 —
  Facility is exclusively the global header filter now) and pagination. Sorted district A→Z,
  facility A→Z, then highest rate.
- The global date filter scopes the period (multi-day aggregation via `getAdoptionKpisByDateRange`).

**Adoption-rate rule (RI-43):** when there is **no expected baseline** (`expected = 0`), the rate is
**100 %** if there is any actual reporting (`actual > 0`) — fully adopted / over-reporting — and **0 %**
only when **both** expected and actual are 0. This rule now applies **consistently** to the top
summary tile and the per-facility rows (previously the summary always showed 0 % when `expected = 0`,
disagreeing with the drill-down).

---

## 9. Practitioner Analytics

**Route:** `/practitioners`  _(URL-only — not linked in the sidebar)_  
**Purpose:** Practitioner leaderboard by **step-completion %** or patients served, with metric tiles,
a Best/Worst-first toggle, and search. Color-coded completion column with legend.

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/practitioners/ranking` | Practitioner leaderboard |

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Practitioner Analytics           [📅 From – To]                  │
│         │                                                                    │
│         │  ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│         │  │ Tracked    │ │ >90%     │ │ 75–90%   │ │ <75%     │            │
│         │  │ Practition.│ │ Step Cmp.│ │ Step Cmp.│ │ Step Cmp.│            │
│         │  └────────────┘ └──────────┘ └──────────┘ └──────────┘            │
│         │                                                                    │
│         │  Rank By: [Step Completion % •] [Patients Served]                  │
│         │  Order: [Best First •] [Worst First]   Search: [name…____]        │
│         │                                                                    │
│         │  ┌─ Practitioner Table ──────────────────────────────────────────┐ │
│         │  │ Rank│ Practitioner │ Facility │ Patients │ Step Compl.│ Steps  │ │
│         │  │  1  │ Dr. A        │ 0015     │ 45       │ 🟢 88%     │ 40/45  │ │
│         │  │  2  │ Dr. B        │ 0002     │ 72       │ 🟡 71%     │ 51/72  │ │
│         │  │  3  │ Nurse C      │ 0008     │ 30       │ 🔴 43%     │ 13/30  │ │
│         │  │  Legend: 🟢 ≥80%  🟡 50-79%  🔴 <50%                         │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Intelligence

**Route:** `/intelligence`  _(URL-only — not linked in the sidebar)_  
**Purpose:** Intelligence delivery-pipeline analytics — delivery counts, success/failure donut,
deliveries by destination, active adaptors, and the protocol's intelligence actions.

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/intelligence/summary` | Delivery-pipeline summary (delivered / failed / pending, byDestination, adaptors) |
| `GET /v1/insights/protocols/{id}/action-order` | Action definitions for the selected protocol |

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Intelligence            Protocol: [All Protocols ▼]              │
│         │                                                                    │
│         │  ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│         │  │ Total      │ │ Delivered│ │ Failed   │ │ Pending  │            │
│         │  │ Action Inst│ │   1,120  │ │    80    │ │    40    │            │
│         │  │   1,240    │ │          │ │          │ │          │            │
│         │  └────────────┘ └──────────┘ └──────────┘ └──────────┘            │
│         │                                                                    │
│         │  ┌─ Success / Failure ──┐  ┌─ Deliveries by Destination ───────┐  │
│         │  │   (donut chart)      │  │ dest-1 ████████ 450               │  │
│         │  └──────────────────────┘  │ dest-2 █████ 320                  │  │
│         │                            └───────────────────────────────────┘  │
│         │  ┌─ Active Adaptors & Routing ───────────────────────────────────┐ │
│         │  │ Adaptor      │ Status   │ Destinations                       │ │
│         │  │ adaptor-a    │ 🟢 active│ dest-1, dest-2                     │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
│         │  ┌─ Intelligence Actions ────────────────────────────────────────┐ │
│         │  │ # │ Action          │ Trigger        │ Parent Step           │ │
│         │  │ 1 │ overdue-alert   │ on overdue     │ anc-visit-2           │ │
│         │  │ 2 │ provider-notify │ on enrollment  │ —                     │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Ingestion Pipeline

**Route:** `/ingestion`  
**Purpose:** Ingestion health monitoring — acceptance/rejection funnel, rejection reasons, source quality, pipeline loss detection, last-ingested-event freshness.

> **RI-56:** as of this ticket, this page also renders the global **District** and **Facility**
> header filters (previously the only page without them — the backend had no district support at
> all for ingestion metrics). All 5 endpoints below now accept `district` alongside `facilityId`.

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/ingestion/funnel` | ACCEPTED/REJECTED/DUPLICATE breakdown |
| `GET /v1/insights/ingestion/rejections` | Rejection reason analytics |
| `GET /v1/insights/ingestion/source-quality` | Per-source acceptance rates |
| `GET /v1/insights/ingestion/pipeline-loss` | Lost events detection |
| `GET /v1/insights/ingestion/last-event` | "Last Ingested Event" tile — most recent `received_at` for the selected district/facility scope, **not** filtered by date range, polled every `VITE_POLLING_INTERVAL` ms and uncached server-side (pipeline-freshness indicator) |

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Ingestion Pipeline               [📅 From – To]                   │
│         │                                                                    │
│         │  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐       │
│         │  │Received│ │Accepted│ │Rejected│ │Duplicates│ │ Pipeline │       │
│         │  │ 15,000 │ │ 88.0% │ │  8.0% │ │   600    │ │ Loss     │       │
│         │  │        │ │ 13,200 │ │ 1,200  │ │          │ │ 30(0.2%) │       │
│         │  └────────┘ └────────┘ └────────┘ └──────────┘ └──────────┘       │
│         │                                                                    │
│         │  ┌─ Ingestion Funnel ────────────────────────────────────────────┐ │
│         │  │                                                               │ │
│         │  │  ████████████████████████████████████████  15,000 Received    │ │
│         │  │  ████████████████████████████████████      13,200 Accepted    │ │
│         │  │  ████████                                   1,200 Rejected    │ │
│         │  │  ████                                         600 Duplicate   │ │
│         │  │                                                               │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
│         │                                                                    │
│         │  ┌─ Rejection Reasons ───────────┐ ┌─ Source Quality ────────────┐ │
│         │  │                               │ │                            │ │
│         │  │ INVALID_FHIR     ████ 40.0%  │ │ Source        │Accept│Reject│ │
│         │  │ MISSING_SUBJECT  ███  25.0%  │ │ rhie-mediator │91.3% │ 5.7% │ │
│         │  │ INVALID_ENVELOPE ██   15.0%  │ │ ebuzima/south │93.8% │ 4.1% │ │
│         │  │ PAYLOAD_TOO_LARGE █   10.0%  │ │              │      │      │ │
│         │  │ DESERIALIZATION   █    6.0%  │ │              │      │      │ │
│         │  │ UNSUPPORTED_TYPE  ░    4.0%  │ │              │      │      │ │
│         │  └───────────────────────────────┘ └────────────────────────────┘ │
│         │                                                                    │
│         │  ┌─ Pipeline Loss ───────────────────────────────────────────────┐ │
│         │  │ ⚠ 30 events accepted by Collector but not found in          │ │
│         │  │   Compliance event_log (loss rate: 0.2%)                     │ │
│         │  │                                                               │ │
│         │  │ Lost by Source:  rhie-mediator: 18  ·  ebuzima/south: 12    │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Exports

**Route:** `/exports`  _(URL-only — not linked in the sidebar)_  
**Purpose:** Download compliance data as CSV or JSON with filter options.

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/exports/compliance-report` | Generate and download export |

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Export Compliance Data                                             │
│         │                                                                    │
│         │  ┌─ Export Configuration ─────────────────────────────────────────┐ │
│         │  │                                                               │ │
│         │  │  Format:    (●) JSON    (○) CSV                               │ │
│         │  │                                                               │ │
│         │  │  Protocol:  [All Protocols                    ▼]              │ │
│         │  │  Facility:  [All Facilities                   ▼]              │ │
│         │  │  Date Range: [2026-03-01] to [2026-03-31]                     │ │
│         │  │                                                               │ │
│         │  │                                    [📥 Download Report]       │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Shared Components

### MetricCard

```
┌──────────────────┐
│ 📊 Label         │
│                  │
│     12,480       │   ← large value
│   ▲ 8.2%         │   ← trend indicator (optional)
│   vs last period │
└──────────────────┘
```

Props: `label`, `value`, `icon`, `trend?` (up/down/neutral), `trendLabel?`

### StatusBadge

Unified badge component (`StatusBadge.tsx`) for compliance categories, step states, deviation types, processing status, and protocol statuses. Color-coded pills with consistent styling:
- Compliance: `on_track` (green), `non_compliant` (red)
- Step states: NOT_STARTED (gray), OVERDUE (amber), MISSED (red), COMPLETED (green)
- Deviation types: `OVERDUE` (amber), `MISSED` (red), `ORDER_VIOLATION` (purple)
- Processing: `MATCHED` (green), `ZERO_MATCH` (amber), `DUPLICATE` (gray)

### DateRangeFilter

Global date range filter (`DateRangeFilter.tsx`). Two date inputs (From/To) in the sticky header. Updates `FilterContext`. Default span is 90 days (`VITE_DEFAULT_DATE_RANGE_DAYS`).

### FacilityFilter / ProtocolFilter

As of **RI-56**, `FacilityFilter.tsx` is a **global header** dropdown (mirrors `DistrictFilter.tsx`
— renders next to it, before the date range, on every page). It reads/writes `facilityId` on
`FilterContext`, constrains its options to the selected district, auto-resets to "All Facilities"
if the district changes and the current selection falls out of scope, and disambiguates same-name
facilities with `(facilityId)`. It replaced every previous per-page local facility dropdown.

`ProtocolFilter.tsx` remains a **per-page** dropdown (not in the global header) — used on
Deviations, Intelligence, and Practitioner Analytics.

### Pagination components

- **PagePagination** (`PagePagination.tsx`) — page-size selector + range pagination (used by Patient List).
- **TableRangePagination** (`TableRangePagination.tsx`) — "Showing X–Y of N" range pager (used by Event Volume, Facility Ranking, EbuzimaAdoptionCard).
- **CursorPagination** (`CursorPagination.tsx`) — `cursor`/`limit` pager; Previous disabled on first page, Next shown only when `has_more = true`.

### PercentageBar

Horizontal stacked bar showing proportions. Used for status breakdown, compliance categories, processing quality.

```
████████████████░░░░░░░░
78.7% matched    20.4% zero-match   0.9% dup
```

### Additional Shared Components

- **Card** (`Card.tsx`) — Wrapper with white background, border, rounded corners
- **PageHeader** (`PageHeader.tsx`) — Page title + subtitle
- **ErrorAlert** (`ErrorAlert.tsx`) — Error message display with optional retry
- **EmptyState** (`EmptyState.tsx`) — No data placeholder
- **LoadingSpinner** (`LoadingSpinner.tsx`) — Tailwind spinner
- **ClickableMetricGroup** (`ClickableMetricGroup.tsx`, RI-35) — a group of metric tiles in one white `Card` (title + info ⓘ); clicking the tiles toggles a `detail` drill-down rendered inside the same card.
- **DistrictSelect** (`DistrictSelect.tsx`, RI-35) — exports `DistrictFacilityFilter` (cascading District→Facility dropdowns; as of RI-56 takes an optional `showFacility?: boolean` prop, default `true`, so callers relying on the global `FacilityFilter` instead can suppress the Facility half — used by the 4 cards under `components/facilities/` and `components/patients/`), `LabeledSelect` (status/category filter), and the `filterByDistrictFacility` / `districtOptions` client-side helpers used by every drill-down.

### Facility cards (`components/facilities/`)

- **EbuzimaAdoptionCard** — Dashboard adoption card: country summary + inline per-facility drill-down.
- **ReferralMetricsCard** (RI-35) — Dashboard Referrals card: received / compliant / non-compliant / rate + inline per-facility drill-down.
- **ComplianceFacilityBreakdown** (RI-35) — Service Compliance drill-down (per-facility compliant/non-compliant/rate from `facilities/ranking`), rendered inside the compliance card.
- **FacilityActivityCards** — Dashboard/Facilities Facility Status card: total/active/inactive + inline per-facility drill-down.
- **FacilityHighlightsCard** — Top 5 / Bottom 5 facilities by compliance (Facility Analytics).
- **FacilityRankingCard** — ranked facility leaderboard with Rank-By pills + order toggle. Local
  facility search box removed as of RI-56 (redundant with the global header Facility filter).

### DataTable

Generic paginated table with:
- Column sorting (client-side or via `sort` query param)
- Row click handler (for navigation)
- Loading skeleton state
- Empty state placeholder
