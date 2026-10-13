export function formatAED(amount) {
  const n = Number(amount) || 0;
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);
}

export function formatAEDPrecise(amount) {
  const n = Number(amount) || 0;
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const REFERRAL_STATUS_FLOW = [
  "clicked", "lead_created", "contacted", "appointment_booked", "appointment_completed",
  "treatment_completed", "satisfaction_confirmed", "commission_pending",
  "commission_approved", "commission_payable", "paid",
];

export const REFERRAL_STATUSES = {
  clicked: { label: "Clicked", tone: "neutral" },
  lead_created: { label: "Lead Created", tone: "neutral" },
  contacted: { label: "Contacted", tone: "info" },
  appointment_booked: { label: "Appointment Booked", tone: "info" },
  appointment_completed: { label: "Appointment Completed", tone: "info" },
  treatment_completed: { label: "Treatment Completed", tone: "info" },
  satisfaction_confirmed: { label: "Satisfaction Confirmed", tone: "info" },
  commission_pending: { label: "Commission Pending", tone: "warn" },
  commission_approved: { label: "Commission Approved", tone: "info" },
  commission_payable: { label: "Commission Payable", tone: "good" },
  paid: { label: "Paid", tone: "good" },
  cancelled: { label: "Cancelled", tone: "bad" },
  no_show: { label: "No Show", tone: "bad" },
  rejected: { label: "Rejected", tone: "bad" },
  refunded: { label: "Refunded", tone: "bad" },
  disputed: { label: "Disputed", tone: "bad" },
};

export const COMMISSION_STATUSES = {
  pending: { label: "Pending", tone: "warn" },
  approved: { label: "Approved", tone: "info" },
  payable: { label: "Payable", tone: "good" },
  paid: { label: "Paid", tone: "good" },
  rejected: { label: "Rejected", tone: "bad" },
  held: { label: "On Hold", tone: "warn" },
  disputed: { label: "Disputed", tone: "bad" },
};

export const PAYOUT_STATUSES = {
  pending: { label: "Pending", tone: "warn" },
  processing: { label: "Processing", tone: "info" },
  paid: { label: "Paid", tone: "good" },
  failed: { label: "Failed", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const PARTNER_STATUSES = {
  active: { label: "Active", tone: "good" },
  suspended: { label: "Suspended", tone: "bad" },
  inactive: { label: "Inactive", tone: "neutral" },
  pending: { label: "Pending", tone: "warn" },
};

export const LEAD_STATUSES = {
  new: { label: "New", tone: "info" },
  contacted: { label: "Contacted", tone: "info" },
  consultation_booked: { label: "Consultation Booked", tone: "info" },
  appointment_booked: { label: "Appointment Booked", tone: "info" },
  completed: { label: "Completed", tone: "good" },
  lost: { label: "Lost", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const APPOINTMENT_STATUSES = {
  booked: { label: "Booked", tone: "info" },
  confirmed: { label: "Confirmed", tone: "info" },
  completed: { label: "Completed", tone: "good" },
  cancelled: { label: "Cancelled", tone: "bad" },
  no_show: { label: "No Show", tone: "warn" },
};

export const PARTNER_TYPES = {
  hair_salon: "Hair Salon",
  beauty_salon: "Beauty Salon",
  spa: "Spa",
  gym: "Gym",
  influencer: "Influencer",
  corporate: "Corporate",
  hotel: "Hotel",
  other: "Other",
};

export const TONE_CLASSES = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-blue-50 text-blue-700",
  warn: "bg-amber-50 text-amber-700",
  good: "bg-emerald-50 text-emerald-700",
  bad: "bg-rose-50 text-rose-700",
};
// Referral links are built from the current site address + the partner's code, so they stay correct if the domain changes
// (pages.dev -> custom domain). The stored referral_link is only a fallback.
export const referralLinkOf = (partner) =>
  partner && partner.referral_code ? `${window.location.origin}/r/${partner.referral_code}` : (partner && partner.referral_link) || "";
