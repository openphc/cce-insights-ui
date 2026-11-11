# UI Pages & Wireframes

> **CCE Insights UI** — Page-by-page design reference with ASCII wireframes  
> Each page maps to one or more Insights Service API endpoints. Compliance categories are binary: **Compliant** (`on_track`) and **Non-Compliant** (`non_compliant`).
> Default date range: **90 days** (`VITE_DEFAULT_DATE_RANGE_DAYS`).

---

## Table of Contents

1. [Dashboard](#1-dashboard)
2. [Compliance Overview](#2-compliance-overview)
3. [Protocol Analytics](#3-protocol-analytics)
4. [Patient List](#4-patient-list)
5. [Patient Detail](#5-patient-detail)
6. [Deviations](#6-deviations)
7. [Event Volume](#7-event-volume)
8. [Source Comparison](#8-source-comparison)
9. [Facility Analytics](#9-facility-analytics)
10. [Practitioner Analytics](#10-practitioner-analytics)
11. [Intelligence](#11-intelligence)
12. [Ingestion Pipeline](#12-ingestion-pipeline)
13. [Exports](#13-exports)
14. [Shared Components](#14-shared-components)

---

## 1. Dashboard

**Route:** `/`  
**Purpose:** Landing page — high-level operational metrics, trend snapshots. Default 180-day date range.

### APIs Used

| Endpoint | Purpose |
|----------|---------|  
| `GET /v1/insights/dashboard/overview` | Summary metrics (events, deviations, etc.) |
| `GET /v1/insights/dashboard/compliance-summary` | Patient/facility/practitioner compliance |
| `GET /v1/insights/deviations/trends` | Deviation trend sparkline |
| `GET /v1/insights/events/trends` | Event volume trend sparkline |
| `GET /v1/insights/lookups/protocols` | Protocol list for selectors |
| `GET /v1/insights/lookups/facilities` | Facility list for global filter |

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ┌──────────┐                                                                 │
│ │ CCE      │  Dashboard                              [📅 180 days ▼]        │
│ │ Insights │                                                                 │
│ ├──────────┤  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│ │          │  │ Tracked    │ │ Compliant  │ │ Non-Compl. │ │ Active     │   │
│ │ Dashboard│  │ Cohort     │ │ Care       │ │ Care       │ │ Protocols  │   │
│ │ ● Dash   │  │   248      │ │ Journeys   │ │ Journeys   │ │    3       │   │
│ │          │  │            │ │    180     │ │    68      │ │            │   │
│ │Compliance│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│ │Facilities│                                                                 │
│ │Practition│  ┌─────────────────────────────┐ ┌─────────────────────────┐   │
│ │Deviations│  │ Deviation Trends            │ │ Event Volume            │   │
│ │Intelligen│  │                             │ │                         │   │
│ │ Patients │  │   ╱╲    ╱╲                  │ │   ▄▄▆▆██▇▇▆▆▄▄██▆▆    │   │
│ │ Events   │  │  ╱  ╲──╱  ╲──╱╲            │ │   Encounter ■           │   │
│ │ Ingestion│  │ ╱              ╲           │ │   Observation ■         │   │
│ │ Exports  │  │ overdue ── missed ──       │ │   Condition ■           │   │
│ │          │  └─────────────────────────────┘ └─────────────────────────┘   │
│ └──────────┘                                                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

### MetricCard Details

| Card | Value Source | Description |
|------|-------------|-------------|
| Tracked Cohort | `dashboard/compliance-summary → patients.trackedPatients` | Total patients enrolled |
| Compliant Care Journeys | `patients.compliantPatients` | No active deviations |
| Non-Compliant Care Journeys | `patients.nonCompliantPatients` | Has active deviations |
| Active Protocols | `dashboard/compliance-summary → activeProtocols` | Protocols being tracked |

**Consent Metrics row** — Tiberbu (Kenya SHA outpatient protocol) specific, shown with a "Tiberbu" badge next to the section heading (`StatusBadge`, `components/shared/StatusBadge.tsx`):

| Card | Value Source | Description |
|------|-------------|-------------|
| Total Consents Received | `compliance-summary → consent.totalReceived` | `consent-request` steps completed |
| Total Consents Verified | `consent.totalVerified` (denominator: `totalReceived`) | `consent-verification` steps completed |
| Consent Verification Rate | `consent.verificationRate` | `totalVerified / totalReceived`, computed server-side |

---

## 2. Compliance Overview

**Route:** `/compliance`  
**Purpose:** Protocol and facility compliance summaries. Entry point to protocol analytics and patient lists.

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/protocols/{id}/compliance-summary` | Protocol-level compliance metrics |
| `GET /v1/insights/facilities/{id}/compliance-summary` | Facility-level compliance metrics |
| `GET /v1/insights/protocols/{id}/patients` | Patient list by compliance status |

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Compliance Overview              [📅 180 days ▼]                 │
│         │                                                                    │
│         │  Select Protocol: [ANC High-Risk v2.1              ▼]             │
│         │                                                                    │
│         │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐         │
│         │  │ Enrolled │ │Compliance│ │ Active   │ │ Deviations   │         │
│         │  │   248    │ │   72%    │ │   180    │ │    270       │         │
│         │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘         │
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
│         │                                                                    │
│         │  ┌─ Patient Compliance ──────────────────────────────────────────┐ │
│         │  │ Filter: [Compliant] [Non-Compliant]                          │ │
│         │  │                                                               │ │
│         │  │ Patient ID        │ Status        │ Rate │ Steps │ Deviat.   │ │
│         │  │ 260225-0002-5501  │ 🟢 Compliant  │ 85%  │ 5/6   │ 0         │ │
│         │  │ 260310-0008-4421  │ 🔴 Non-Compl. │ 25%  │ 1/4   │ 3         │ │
│         │  │                                 ◀ 1 of 5 ▶                   │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Key Interactions

| Action | Behavior |
|--------|----------|
| Select protocol from dropdown | Fetch compliance summary + step analytics + action order |
| Click "View Protocol Analytics →" | Navigate to `/compliance/protocols/{id}` |
| Click patient row | Navigate to `/compliance/patients/{patientId}` |
| Switch compliance filter tabs | Re-query patient list with `status` parameter |

**Step groups in the Service Workflow Compliance tree** (`buildWorkflowTree`). A step group, such as
a visit, has no step data of its own. It shows as a container (`group: true` in the action order)
whenever a step inside it, at any depth, has data:
- A group inside a group, such as a consultation inside a visit, is nested inside it. It is not shown
  as a second card beside it, and its steps are not lifted to the top level.
- Its children are listed as **Steps (n)**. A step's children are **Sub-actions (n)**. `n` counts
  every step below, at any depth; a group inside it is not counted.
- Its header shows its own figures from step analytics `groups[]`: how often it opened, for how many
  patients, and how many of those had every step so far done. For example: `step group · 150 opened
  for 105 patients · 40% completed (60/150)`. Against an API without `groups[]`, it shows only
  "step group".
- A step inside a group, at any depth, can repeat once per visit. So it is measured per time it was
  expected (`completedStepInstanceCount / stepInstanceCount`), with its patients alongside:
  `30/150 times · 21/105 patients`. A step outside every group is measured per patient, against the
  patients who completed the step before it, as before: `50 of 105 patients completed`. Every count
  shows its unit.
- A step with no data is still left out. A step below it hangs on its nearest shown ancestor: a step
  with data, or a group. A protocol without groups, such as Kenya SHA, shows as before.

Example, the Rwanda outpatient protocol:

```
● Registration                                    48%
    50 of 105 patients completed · 55 missing
● Outpatient Visit   step group · 150 opened for 105 patients · 40% completed (60/150)
    STEPS (10)
    ● Patient Visit                  100%  140/140 times · 97/97 patients
    ● Vitals Recording                20%  30/150 times · 21/105 patients
    ○ Clinical Consultation  step group · 120 opened for 83 patients · 75% completed (90/120)
        STEPS (8)
        ● Clinical Consultation      83%  100/120 times · 73/83 patients
        ● Chief Complaints          100%  60/60 times · 43/43 patients
        ● History of Present Illness 100% 12/12 times · 9/9 patients
        ● Laboratory Order          100%  40/40 times · 31/31 patients
            ● Laboratory Results     56%  14/25 times · 12/20 patients
        ● Clinical Diagnosis         32%  38/118 times · 27/82 patients
        ● Treatment Prescription    100%  30/30 times · 23/23 patients
        ● Referral                  100%  18/18 times · 15/15 patients
```

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
│         │  │ Action       │ Completed │ Rate  │ On Time │ Late │ vs Due   │ │
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
| Rate | `completionRate` (0–1 fraction) | Percentage bar, `formatRate` (×100) |
| On Time | `timelinessDistribution.completedOnTime` | Count (completed + SLA met) |
| Late | `timelinessDistribution.completedLate` | Count (completed + SLA overdue/missed), highlighted amber |
| Avg vs Due | `avgDaysToComplete` | Average of `completed_at − due_date` in days, shown as "N d early" / "N d late" (negative = before the due date) |
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
**Purpose:** Browse patients by compliance category (Compliant / Non-Compliant only).

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/protocols/{id}/patients` | Patient list with compliance status |
| `GET /v1/insights/patients/at-risk-hotspots` | Non-compliant concentration by facility |
| `GET /v1/insights/patients/repeat-deviations` | High-risk patients |

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Patient Compliance              [📅 180 days ▼]                   │
│         │                                                                    │
│         │  ┌─ Patient List ────────────────────────────────────────────────┐ │
│         │  │ Protocol: [ANC High-Risk ▼]                                  │ │
│         │  │ Status: [Compliant] [Non-Compliant]                          │ │
│         │  │                                                               │ │
│         │  │ Patient ID        │ Category        │ Rate │ Steps │ Deviat. │ │
│         │  │ 260225-0002-5501  │ 🔴 Non-Compliant│ 25%  │ 1/4   │ 7       │ │
│         │  │ 260115-0001-7823  │ 🟢 Compliant    │ 85%  │ 5/6   │ 0       │ │
│         │  │                                      ◀ 1 of 5 ▶              │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Patient Detail

**Route:** `/compliance/patients/:patientId`  
**Purpose:** Individual patient compliance timeline, protocol tracking, events, and deviations.

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/patients/{id}/compliance-timeline` | Chronological timeline |
| `GET /v1/insights/patients/{id}/protocol-tracking` | All protocol instances |
| `GET /v1/insights/patients/{id}/protocol-tracking/{piId}` | Step details |
| `GET /v1/insights/patients/{id}/events` | Clinical event history |
| `GET /v1/insights/patients/{id}/deviations` | Cross-protocol deviations |

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Patient: 260225-0002-5501                                         │
│         │  ← Back to Patient List                                            │
│         │                                                                    │
│         │  ┌─ Protocol Enrollments ────────────────────────────────────────┐ │
│         │  │                                                               │ │
│         │  │  ┌─────────────────────────────────────────────────────────┐  │ │
│         │  │  │ 🟢 ACTIVE  ANC High-Risk v2.1                         │  │ │
│         │  │  │ Enrolled: Jan 15, 2026  ·  Rate: 50%  ·  Steps: 3/6  │  │ │
│         │  │  │ ████████░░░░░░░░  ■ 2 completed ■ 1 overdue ○ 3 pend │  │ │
│         │  │  │                                            [Details →] │  │ │
│         │  │  └─────────────────────────────────────────────────────────┘  │ │
│         │  │                                                               │ │
│         │  │  ┌─────────────────────────────────────────────────────────┐  │ │
│         │  │  │ 🔵 COMPLETED  Malaria Treatment v1.0                   │  │ │
│         │  │  │ Enrolled: Dec 10, 2025  ·  Rate: 100%  ·  Steps: 4/4  │  │ │
│         │  │  │ ████████████████  ■ 3 on-time ■ 1 late                │  │ │
│         │  │  │                                            [Details →] │  │ │
│         │  │  └─────────────────────────────────────────────────────────┘  │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
│         │                                                                    │
│         │  ┌─ Compliance Timeline ─────────────┐ ┌─ Deviations ───────────┐ │
│         │  │                                   │ │                         │ │
│         │  │  ● Jan 15  Enrolled in ANC v2.1   │ │ ⚠ OVERDUE              │ │
│         │  │                                   │ │ anc-visit-2             │ │
│         │  │  ● Jan 20  🟢 anc-visit-1         │ │ 5 days overdue         │ │
│         │  │    Completed ON_TIME              │ │ Detected: Feb 20       │ │
│         │  │    Source: ebuzima/kigali-south    │ │                         │ │
│         │  │                                   │ └─────────────────────────┘ │
│         │  │  ● Feb 15  🟠 anc-visit-2         │                            │
│         │  │    OVERDUE (5 days)               │                            │
│         │  │                                   │                            │
│         │  │  ● Mar 10  ⚪ anc-visit-3          │                            │
│         │  │    PENDING                        │                            │
│         │  └───────────────────────────────────┘                            │
│         │                                                                    │
│         │  ┌─ Event History ───────────────────────────────────────────────┐ │
│         │  │ Time         │ Source       │ Type      │ Action   │ Status   │ │
│         │  │ Jan 20 09:30 │ ebuzima      │ Encounter │ visit-1  │ MATCHED  │ │
│         │  │ Jan 20 09:35 │ ebuzima      │ Observatn │ visit-1  │ MATCHED  │ │
│         │  │ Feb 05 11:00 │ rhie         │ Condition │ —        │ ZERO_MTH │ │
│         │  │                              ◀ 1 of 3 ▶                      │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Protocol Journey statuses

Every journey step is listed. An untriggered action — `status` `NOT_STARTED` with no `stepStatus` — shows as **Not Started** (gray). A step that exists but is still outstanding with no breached deadline also arrives as `NOT_STARTED`, but with `stepStatus: 'NOT_STARTED'`; the page renders it as **Pending** (blue).

### Step groups

A step group is a set of steps that belong together, such as one visit. The protocol defines it. Its
row in the journey has a **Step group** badge, and its steps follow it, one level deeper.

Under the group's name, each of its instances is listed, in the order they opened. A group that
repeats, such as one visit per day, has one instance per cycle. Each instance shows:
- a number (`#1`, `#2`, …), when the group opened more than once;
- its status: **Completed**, **In progress** (still open), **Overdue** or **Missed** (the group's own
  deadline);
- how many of its steps are done, such as `1/2 steps`. Steps in a group nested inside it count too;
- the day it opened.

**One cycle at a time.** The steps under a group show one of its instances, not all of them merged:
- By default, the latest instance is shown.
- When a group has more than one instance, each instance is a button. Click one to show its steps.
  The shown instance has a blue ring.
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

An instance is named by its number and the day it opened, such as `#2 · Nov 3, 2026`. A group that
opened once shows only the day.

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
  [#1 · Nov 2, 2026 · Completed · 2/2 steps] ((#2 · Nov 3, 2026 · In progress · 1/2 steps))
  ● History                   [Completed]
  ● Blood Pressure            [Pending]
```

Clicking `#1` shows the first visit: Visit and both steps read **Completed**.

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
**Purpose:** Deviation trends, most-deviated steps, resolution rate, and paginated deviation list.

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/deviations/trends` | Time-bucketed deviation trends |
| `GET /v1/insights/deviations/by-action` | Most-deviated protocol steps |
| `GET /v1/insights/deviations/resolution-rate` | Resolved vs escalated overdue steps |
| `GET /v1/insights/intelligence/summary` | Deviation summary counts |
| `GET /v1/insights/deviations` | Paginated deviation list |

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Deviation Analytics              [📅 Last 30 days ▼] [🏥 All ▼] │
│         │                                                                    │
│         │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐     │
│         │  │ Total    │ │ ⚠ Over-  │ │ 🔴 Missed│ │ Resolution Rate  │     │
│         │  │ Deviat.  │ │ due      │ │          │ │                  │     │
│         │  │   270    │ │   180    │ │    90    │ │  66.7% resolved  │     │
│         │  └──────────┘ └──────────┘ └──────────┘ └───────────────────┘     │
│         │                                                                    │
│         │  ┌─ Deviation Trends ────────────────────────────────────────────┐ │
│         │  │ Interval: [Daily] [Weekly •] [Monthly]                       │ │
│         │  │                                                               │ │
│         │  │  20│  ▓▓                              ▓▓▓▓                   │ │
│         │  │  15│  ▓▓▒▒▒▒    ▓▓▓▓                  ▓▓▓▓▒▒               │ │
│         │  │  10│  ▓▓▒▒▒▒    ▓▓▓▓▒▒▒▒    ▓▓▓▓▒▒  ▓▓▓▓▒▒               │ │
│         │  │   5│  ▓▓▒▒▒▒    ▓▓▓▓▒▒▒▒    ▓▓▓▓▒▒  ▓▓▓▓▒▒               │ │
│         │  │    └──────────────────────────────                            │ │
│         │  │    ■ Overdue    ▒ Missed                                     │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
│         │                                                                    │
│         │  ┌─ Most Deviated Steps ──────────┐ ┌─ Resolution Rate ─────────┐ │
│         │  │                                │ │                           │ │
│         │  │ Action         │ Total │ Missed│ │ ████████████████░░░░░░░░  │ │
│         │  │ lab-result     │  85   │  23   │ │ 66.7% Resolved (120)     │ │
│         │  │ anc-visit-3    │  58   │  18   │ │ 33.3% Escalated (60)     │ │
│         │  │ anc-visit-2    │  42   │  12   │ │                           │ │
│         │  │ monthly-check  │  35   │   8   │ │ Avg days to resolve: 4.2 │ │
│         │  └────────────────────────────────┘ └───────────────────────────┘ │
│         │                                                                    │
│         │  ┌─ Deviation List ──────────────────────────────────────────────┐ │
│         │  │ Type: [All ▼]  Protocol: [All ▼]  Sort: [Detected ▼ desc]   │ │
│         │  │                                                               │ │
│         │  │ Patient          │ Action     │ Type    │ Facility │ Detected │ │
│         │  │ 260225-0002-5501 │ anc-visit-2│ OVERDUE │ 0002     │ Feb 20   │ │
│         │  │ 260310-0008-4421 │ lab-result │ MISSED  │ 0008     │ Feb 22   │ │
│         │  │                               ◀ 1 of 3 ▶                     │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

> **Step groups:** the Deviation List has a **Visit** column, such as `Outpatient Visit #2
> (Sep 6, 2026)`, for a step in a step group, and `—` otherwise. The patient link opens the patient at
> that visit.

---

## 7. Event Volume

**Route:** `/events`  
**Purpose:** Clinical event metrics — volume by resource type, facility, practitioner, source, and processing quality.

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/events/summary` | Composite event volume |
| `GET /v1/insights/events/trends` | Volume over time |
| `GET /v1/insights/events/by-resource-type` | Resource type breakdown |
| `GET /v1/insights/events/by-facility` | Facility event counts |
| `GET /v1/insights/events/by-practitioner` | Practitioner activity |
| `GET /v1/insights/events/by-source` | Source system counts |
| `GET /v1/insights/events/processing-quality` | MATCHED/ZERO_MATCH/DUPLICATE per source |

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Event Volume & Activity          [📅 Last 30 days ▼] [🏥 All ▼] │
│         │                                                                    │
│         │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│         │  │ Total    │ │ Matched  │ │ Zero     │ │ Duplicate│             │
│         │  │ Events   │ │ Rate     │ │ Match    │ │ Rate     │             │
│         │  │ 12,480   │ │ 78.7%   │ │ 20.4%   │ │ 0.9%    │             │
│         │  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
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
│         │  Tabs: [By Resource Type •] [By Facility] [By Practitioner]       │
│         │        [By Source] [Processing Quality]                            │
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
│         │                                                                    │
│         │  [Compare Sources →]                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Tab Panels (within Events page)

| Tab | Content | API |
|-----|---------|-----|
| By Resource Type | Bar chart + table with counts and percentages | `events/by-resource-type` |
| By Facility | Table: facility, total events, resource type sub-groups | `events/by-facility` |
| By Practitioner | Table: practitioner ref, display name, facility, event counts | `events/by-practitioner` |
| By Source | Table: source system, total events, status breakdown | `events/by-source` |
| Processing Quality | Stacked bar chart per source: MATCHED/ZERO_MATCH/DUPLICATE | `events/processing-quality` |

---

## 8. Source Comparison

**Route:** `/events/source-comparison`  
**Purpose:** Compare two source systems for event overlap and unique events.

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/events/source-comparison` | Overlap detection between two sources |
| `GET /v1/insights/events/by-source` | Source list for selectors |

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Source Comparison                                                 │
│         │  ← Back to Event Volume                                            │
│         │                                                                    │
│         │  Source A: [rhie-mediator       ▼]                                │
│         │  Source B: [ebuzima/kigali-south▼]                                │
│         │  Match Window: [300] seconds     [Compare]                        │
│         │                                                                    │
│         │  ┌──────────────────┐  ┌──────────┐  ┌──────────────────┐        │
│         │  │ Source A         │  │ Overlap  │  │ Source B         │        │
│         │  │ rhie-mediator    │  │          │  │ ebuzima/south    │        │
│         │  │ Total: 8,400     │  │  3,200   │  │ Total: 4,080     │        │
│         │  │ Unique: 5,200    │  │ events   │  │ Unique: 880      │        │
│         │  │ Overlap: 38.1%   │  │          │  │ Overlap: 78.4%   │        │
│         │  └──────────────────┘  └──────────┘  └──────────────────┘        │
│         │                                                                    │
│         │  ┌─ Overlap by Resource Type ────────────────────────────────────┐ │
│         │  │ Encounter     ████████████  1,100                            │ │
│         │  │ Observation   ██████████    950                              │ │
│         │  │ Condition     █████         480                              │ │
│         │  │ MedicationReq ████          380                              │ │
│         │  │ ServiceReq    ███           290                              │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
│         │                                                                    │
│         │  ┌─ Sample Pairs ────────────────────────────────────────────────┐ │
│         │  │ Patient          │ ResourceType │ Time A     │ Time B  │ Diff│ │
│         │  │ 260225-0002-5501 │ Encounter    │ Jan 20 9:30│ 9:30    │ 0s  │ │
│         │  │ 260115-0001-7823 │ Observation  │ Jan 22 14:0│ 14:02   │ 120s│ │
│         │  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Facility Analytics

**Route:** `/facilities`  
**Purpose:** Facility leaderboard by compliance rate, deviation count, or event volume. Color-coded compliance column with legend. Non-Compliant Hotspots section (binary: Compliant / Non-Compliant).

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/facilities/ranking` | Facility leaderboard |
| `GET /v1/insights/patients/at-risk-hotspots` | Non-compliant concentration by facility |

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Facility Analytics               [📅 180 days ▼]                 │
│         │                                                                    │
│         │  Rank By: [Compliance Rate •] [Deviation Count] [Event Volume]    │
│         │  Protocol: [All Protocols ▼]                                      │
│         │                                                                    │
│         │  ┌─ Facility Ranking Table ──────────────────────────────────────┐ │
│         │  │ Rank │ Facility │ Enrollments │ Compliance │ Deviations│Events│ │
│         │  │  1   │ 0015     │ 89          │ 🟢 82%     │ 5         │ 2800 │ │
│         │  │  2   │ 0002     │ 156         │ 🟡 74%     │ 12        │ 3200 │ │
│         │  │  3   │ 0008     │ 62          │ 🔴 58%     │ 22        │ 2100 │ │
│         │  │                                                              │ │
│         │  │  Legend: 🟢 ≥80%  🟡 50-79%  🔴 <50%                         │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
│         │                                                                    │
│         │  ┌─ Non-Compliant Hotspots ──────────────────────────────────────┐ │
│         │  │ Facility │ Total │ Compliant      │ Non-Compliant            │ │
│         │  │ 0008     │  62   │ 🟢 18 (29%)    │ 🔴 44 (71%)              │ │
│         │  │ 0002     │ 156   │ 🟢 95 (61%)    │ 🔴 61 (39%)              │ │
│         │  │ 0015     │  89   │ 🟢 63 (71%)    │ 🔴 26 (29%)              │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Practitioner Analytics

**Route:** `/practitioners`  
**Purpose:** Practitioner compliance table with color-coded compliance percentage and legend.

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/practitioners/ranking` | Practitioner leaderboard |

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Practitioner Analytics           [📅 180 days ▼]                 │
│         │                                                                    │
│         │  Protocol: [All Protocols ▼]  Facility: [All ▼]                  │
│         │                                                                    │
│         │  ┌─ Practitioner Table ──────────────────────────────────────────┐ │
│         │  │ Practitioner    │ Facility │ Enrollments │ Compliance│Deviat. │ │
│         │  │ Dr. A           │ 0015     │ 45          │ 🟢 88%    │ 2      │ │
│         │  │ Dr. B           │ 0002     │ 72          │ 🟡 71%    │ 8      │ │
│         │  │ Nurse C         │ 0008     │ 30          │ 🔴 43%    │ 12     │ │
│         │  │                                                              │ │
│         │  │  Legend: 🟢 ≥80%  🟡 50-79%  🔴 <50%                         │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Intelligence

**Route:** `/intelligence`  
**Purpose:** Intelligence delivery analytics — action instances, delivery status donut, destinations, adaptors, and actions table.

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/intelligence/summary` | Intelligence delivery summary |
| `GET /v1/insights/protocols/{id}/action-order` | Action definitions for protocol |

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Intelligence                                                      │
│         │                                                                    │
│         │  ┌────────────────┐                                               │
│         │  │ Total Action   │                                               │
│         │  │ Instances      │                                               │
│         │  │   1,240        │                                               │
│         │  └────────────────┘                                               │
│         │                                                                    │
│         │  ┌──────────┐  ┌───────────────────┐  ┌──────────────────┐       │
│         │  │  Donut   │  │ Destinations      │  │ Adaptors         │       │
│         │  │  Chart   │  │ dest-1  │ 450     │  │ adaptor-a │ 600  │       │
│         │  │  (status │  │ dest-2  │ 320     │  │ adaptor-b │ 400  │       │
│         │  │  breakdown)│ │ dest-3  │ 270     │  │ adaptor-c │ 240  │       │
│         │  └──────────┘  └───────────────────┘  └──────────────────┘       │
│         │                                                                    │
│         │  ┌─ Intelligence Actions ────────────────────────────────────────┐ │
│         │  │ Action ID       │ Type │ Title           │ Deliveries │ Rate  │ │
│         │  │ alert-overdue   │ alert│ Overdue Alert   │ 320        │ 95%   │ │
│         │  │ notify-provider │ push │ Provider Notify │ 280        │ 88%   │ │
│         │  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Ingestion Pipeline

**Route:** `/ingestion`  
**Purpose:** Ingestion health monitoring — acceptance/rejection funnel, rejection reasons, source quality, pipeline loss detection.

### APIs Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/insights/ingestion/funnel` | ACCEPTED/REJECTED/DUPLICATE breakdown |
| `GET /v1/insights/ingestion/rejections` | Rejection reason analytics |
| `GET /v1/insights/ingestion/source-quality` | Per-source acceptance rates |
| `GET /v1/insights/ingestion/pipeline-loss` | Lost events detection |

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Ingestion Pipeline               [📅 Last 30 days ▼] [🏥 All ▼] │
│         │                                                                    │
│         │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│         │  │ Received │ │ Accepted │ │ Rejected │ │ Pipeline │             │
│         │  │ 15,000   │ │ 88.0%   │ │  8.0%   │ │ Loss     │             │
│         │  │          │ │ 13,200   │ │  1,200   │ │ 30 (0.2%)│             │
│         │  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
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

## 13. Exports

**Route:** `/exports`  
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

## 14. Shared Components

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

Global date range filter (`DateRangeFilter.tsx`). Two date inputs (From/To) in the sticky header. Updates `FilterContext`.

### FacilityFilter

Global facility selector (`FacilityFilter.tsx`). Dropdown powered by `useFacilityLookup()` from lookups API. Updates `FilterContext`.

### CursorPagination

```
Showing 1-50 of many    [← Previous] [Next →]
```

Manages `cursor` and `limit` params. Disables Previous on first page. Shows Next only when `has_more = true`.

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

### DataTable

Generic paginated table with:
- Column sorting (client-side or via `sort` query param)
- Row click handler (for navigation)
- Loading skeleton state
- Empty state placeholder
