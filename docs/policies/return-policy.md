# Return Policy (example)

> **Synthetic example for the Hardware Service Decision Copilot PoC.** This is not the policy of
> any real company and not legal advice. It is modelled on Polish/EU consumer rules for
> withdrawal from a distance contract and is injected into the decision agent as binding rules.

Version: 1.0 · Effective: 2026-11-01

## R1. Eligibility window

- **R1.1** A customer may return equipment without giving a reason within **14 calendar days** of
  the date of purchase (in this PoC the purchase date is treated as the delivery date).
- **R1.2** Day 1 is the day after the purchase date. A return registered on day 14 is in time.
- **R1.3** A return registered after day 14 is rejected under this policy. The agent may point out
  that a complaint (see Complaint Policy) is a separate procedure if the customer reports a defect.
- **R1.4** A purchase date in the future is invalid; the case requires manual review.

## R2. Condition of the equipment

- **R2.1** Returned equipment must be resaleable as new: no scratches, dents, cracks, stains,
  stickers, engravings, or other signs of use beyond what is needed to check its nature,
  characteristics and functioning (as in a physical store).
- **R2.2** Minor marks consistent only with unboxing and a brief check (for example fingerprints,
  removed protective film) do not block the return.
- **R2.3** Visible wear (scratched screen or casing, worn keys, dirt in ports, battery swelling,
  liquid traces) means the return is **rejected**, or, where the wear is slight and the value loss
  can be estimated, **referred to manual review** for a partial refund decision.
- **R2.4** Missing accessories or original packaging alone does not block a return, but must be
  listed in the next steps (the customer must send them, or a deduction may apply after
  manual review).

## R3. Excluded items

- **R3.1** Items with a broken hygiene seal (in-ear headphones, earbuds) cannot be returned once the
  seal is broken.
- **R3.2** Equipment personalised to the customer's specification (for example engraved devices)
  cannot be returned.

## R4. Evidence

- **R4.1** One photo of the equipment is required. If the photo does not show the declared device,
  is too blurry or too dark to assess condition, or shows only part of the device so that wear
  cannot be excluded, the case is referred to **manual review** with a request for better photos.

## R5. Outcomes

| Decision | When |
|---|---|
| `ACCEPT` | Within the window (R1), no signs of use (R2.1–R2.2), not excluded (R3) |
| `REJECT` | Outside the window, clear signs of use, or excluded item |
| `NEEDS_MANUAL_REVIEW` | Evidence insufficient (R4.1), slight wear (R2.3), invalid data (R1.4), or any conflict between the form data and the photo |

## R6. Next steps after acceptance

1. Customer packs the device with all accessories received.
2. Customer ships it within 14 days of registering the return.
3. Refund to the original payment method within 14 days of receiving the return statement; the
   refund may be withheld until the device is received back.
