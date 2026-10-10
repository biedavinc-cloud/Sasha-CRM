export interface FraudCheck {
  check: string;
  triggered: boolean;
  detail?: string;
  score: number;
}

export interface FraudResult {
  fraudFlag: boolean;
  fraudReason: string | null;
  fraudScore: number;
  checks: FraudCheck[];
}

function unwrap<T>(result: any): T[] {
  if (Array.isArray(result)) return result;
  return result?.items || [];
}

export async function runFraudChecks(
  base44: any,
  opts: {
    partner: any;
    clientPhone?: string | null;
    clientEmail?: string | null;
    clientIp?: string | null;
    clickId?: string | null;
  }
): Promise<FraudResult> {
  const { partner, clientPhone, clientEmail, clientIp, clickId } = opts;
  const checks: FraudCheck[] = [];
  let score = 0;

  // 1 — Duplicate phone across ALL partners (cross-partner is more suspicious)
  if (clientPhone) {
    const dup = unwrap(
      await base44.asServiceRole.entities.Referral.filter(
        { client_phone: clientPhone },
        { limit: 50 }
      )
    );
    if (dup.length > 0) {
      const crossPartner = dup.filter((r: any) => r.partner_id !== partner.id);
      if (crossPartner.length > 0) {
        checks.push({ check: "duplicate_phone_cross_partner", triggered: true, detail: `${crossPartner.length} prior referral(s) from other partners`, score: 40 });
        score += 40;
      } else {
        checks.push({ check: "duplicate_phone_same_partner", triggered: true, detail: "Already referred by this partner", score: 25 });
        score += 25;
      }
    } else {
      checks.push({ check: "duplicate_phone", triggered: false, score: 0 });
    }
  }

  // 2 — Duplicate email
  if (clientEmail) {
    const dup = unwrap(
      await base44.asServiceRole.entities.Referral.filter(
        { client_email: clientEmail },
        { limit: 50 }
      )
    );
    if (dup.length > 0) {
      checks.push({ check: "duplicate_email", triggered: true, detail: `${dup.length} prior referral(s)`, score: 30 });
      score += 30;
    } else {
      checks.push({ check: "duplicate_email", triggered: false, score: 0 });
    }
  }

  // 3 — Self-referral: client contact matches partner contact
  if (clientEmail && partner.email && clientEmail.toLowerCase() === partner.email.toLowerCase()) {
    checks.push({ check: "self_referral_email", triggered: true, detail: "Client email matches partner email", score: 50 });
    score += 50;
  }
  if (clientPhone && partner.phone && clientPhone === partner.phone) {
    checks.push({ check: "self_referral_phone", triggered: true, detail: "Client phone matches partner phone", score: 50 });
    score += 50;
  }

  // 4 — Velocity: too many referrals from this partner in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = unwrap(
    await base44.asServiceRole.entities.Referral.filter(
      { partner_id: partner.id, created_date: { $gte: oneHourAgo } },
      { limit: 50 }
    )
  );
  if (recent.length >= 10) {
    checks.push({ check: "high_velocity", triggered: true, detail: `${recent.length} referrals in the last hour`, score: 35 });
    score += 35;
  } else {
    checks.push({ check: "velocity", triggered: false, score: 0 });
  }

  // 5 — Multiple conversions from the same IP
  if (clientIp) {
    const sameIp = unwrap(
      await base44.asServiceRole.entities.ReferralClick.filter(
        { ip_address: clientIp, converted: true },
        { limit: 50 }
      )
    );
    if (sameIp.length >= 5) {
      checks.push({ check: "same_ip_conversions", triggered: true, detail: `${sameIp.length} conversions from this IP`, score: 30 });
      score += 30;
    } else {
      checks.push({ check: "same_ip", triggered: false, score: 0 });
    }
  }

  // 6 — Click-to-conversion time too fast (< 2 minutes = bot-like)
  if (clickId) {
    try {
      const click = await base44.asServiceRole.entities.ReferralClick.get(clickId);
      if (click) {
        const elapsed = Date.now() - new Date(click.created_date).getTime();
        if (elapsed < 2 * 60 * 1000) {
          checks.push({ check: "fast_conversion", triggered: true, detail: `Converted in ${Math.round(elapsed / 1000)}s`, score: 20 });
          score += 20;
        } else {
          checks.push({ check: "conversion_time", triggered: false, score: 0 });
        }
      }
    } catch {
      // click not found — skip
    }
  }

  const fraudFlag = score >= 40;
  const triggered = checks.filter((c) => c.triggered);
  const fraudReason = fraudFlag
    ? triggered.map((c) => `${c.check}: ${c.detail || ""}`).join("; ")
    : null;

  return { fraudFlag, fraudReason, fraudScore: score, checks };
}