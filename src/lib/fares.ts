import { addDays, addMonths } from "date-fns";

export type TicketTypeKey = "single" | "return" | "weekly" | "monthly";

export const TICKET_TYPE_META: Record<TicketTypeKey, {
  label: string;
  fareMultiplier: number; // applied to base route fare
  validityDays: number;
  maxValidations: number;
  description: string;
}> = {
  single: { label: "Single", fareMultiplier: 1, validityDays: 1, maxValidations: 1,
    description: "One-way trip · valid for 24 hours" },
  return: { label: "Return", fareMultiplier: 1.8, validityDays: 1, maxValidations: 2,
    description: "Two trips · valid for 24 hours" },
  weekly: { label: "Weekly", fareMultiplier: 9.5, validityDays: 7, maxValidations: 14,
    description: "Up to 14 trips · valid for 7 days" },
  monthly: { label: "Monthly", fareMultiplier: 32, validityDays: 30, maxValidations: 60,
    description: "Up to 60 trips · valid for 30 days" },
};

export function calcFare(baseFare: number, t: TicketTypeKey) {
  return Math.round(baseFare * TICKET_TYPE_META[t].fareMultiplier * 100) / 100;
}

export function calcExpiry(t: TicketTypeKey): Date {
  const meta = TICKET_TYPE_META[t];
  const now = new Date();
  return meta.validityDays >= 30
    ? addMonths(now, 1)
    : addDays(now, meta.validityDays);
}
