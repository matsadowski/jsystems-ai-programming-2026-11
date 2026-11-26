// Deterministic decision facts (ADR 001 §4.2). Pure.
import { addCalendarMonths, compareIsoDates, daysBetween } from "@/lib/shared/dates";
import type { CaseType } from "@/lib/shared/enums";
import {
  COMPLAINT_WINDOW_MONTHS,
  DEAD_ON_ARRIVAL_DAYS,
  RETURN_WINDOW_DAYS,
} from "@/lib/shared/limits";
import type { DecisionFacts } from "./case";

export function computeDecisionFacts(
  caseType: CaseType,
  purchaseDate: string,
  submissionDate: string,
): DecisionFacts {
  const daysSincePurchase = daysBetween(purchaseDate, submissionDate);
  if (caseType === "RETURN") {
    return {
      submissionDate,
      daysSincePurchase,
      windowDays: 14,
      withinWindow: daysSincePurchase <= RETURN_WINDOW_DAYS,
      deadOnArrivalWindow: false,
    };
  }
  const windowEnd = addCalendarMonths(purchaseDate, COMPLAINT_WINDOW_MONTHS);
  return {
    submissionDate,
    daysSincePurchase,
    windowDays: 730,
    withinWindow: compareIsoDates(submissionDate, windowEnd) <= 0,
    deadOnArrivalWindow: daysSincePurchase <= DEAD_ON_ARRIVAL_DAYS,
  };
}
