# Complaint Policy (example)

> **Synthetic example for the Hardware Service Decision Copilot PoC.** This is not the policy of
> any real company and not legal advice. It is modelled on Polish/EU consumer rules on lack of
> conformity of goods with the contract and is injected into the decision agent as binding rules.

Version: 1.0 · Effective: 2026-11-01

## C1. Eligibility window

- **C1.1** The seller is liable for a lack of conformity (defect) that becomes apparent within
  **24 months** of the date of purchase (treated as the delivery date in this PoC).
- **C1.2** A defect that becomes apparent within this period is presumed to have existed at
  delivery, unless the evidence shows otherwise (see C2).
- **C1.3** A complaint registered after 24 months is rejected under this policy; the agent may
  mention that a separate manufacturer's warranty may still apply.
- **C1.4** A purchase date in the future is invalid; the case requires manual review.

## C2. Covered and excluded damage

- **C2.1 Covered** — manufacturing or material defects appearing in normal use: dead pixels or
  backlight bleed without impact marks, failure to power on without visible damage, battery
  degradation beyond the stated specification, faulty buttons or ports without signs of force,
  delamination, hinge failure without impact marks.
- **C2.2 Excluded** — damage caused by the user: cracked or shattered glass with an impact point,
  dents and bent casing, liquid damage (corrosion, stains, liquid indicators), burn marks from
  third-party chargers, unauthorised modification or opening.
- **C2.3** Normal wear of consumables (scratches on casing from use, worn keycap print, ear pads) is
  not a defect.
- **C2.4** If the photo is consistent with both a covered cause and an excluded cause, the case is
  referred to **manual review** (physical inspection).

## C3. Remedies (order of preference)

- **C3.1** `REPAIR` — the default remedy for a covered defect.
- **C3.2** `REPLACE` — when repair is impossible or would take disproportionately long, or the
  device is dead on arrival (defect reported within 14 days of purchase).
- **C3.3** `REFUND` — when repair and replacement are impossible, the same defect has already been
  repaired before, or the defect is so serious that an immediate refund is justified.
- **C3.4** The agent recommends one remedy; the final remedy is confirmed by the service team.

## C4. Evidence

- **C4.1** One photo showing the defect is required, together with a description of the problem.
- **C4.2** If the photo does not show the declared device, does not show the described defect, or
  is too unclear to assess, the case is referred to **manual review** with a request for better
  evidence or for the device to be sent for inspection.
- **C4.3** Defects that cannot be photographed (for example "does not power on", "no sound") are
  assessed from the description; the photo must still show the device and rule out visible
  excluded damage.

## C5. Outcomes

| Decision | When |
|---|---|
| `REPAIR` / `REPLACE` / `REFUND` | Within 24 months, covered defect (C2.1), per C3 |
| `REJECT` | Outside 24 months, or clearly excluded damage (C2.2) or normal wear (C2.3) |
| `NEEDS_MANUAL_REVIEW` | Ambiguous cause (C2.4), insufficient evidence (C4.2), invalid data (C1.4), or conflict between description and photo |

## C6. Timeline

- The company responds to a complaint within **14 calendar days** of receiving it.
- Shipping of the device to service is free of charge for the customer.
