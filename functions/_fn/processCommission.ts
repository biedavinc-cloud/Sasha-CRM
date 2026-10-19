import { serverContext } from '../_lib/context.ts';
import { calculateCommissionAmount } from './shared/commission.ts';
import { logAudit } from './shared/audit.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const ctx = serverContext(req);
    const user = await ctx.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { referralId, grossAmount, eligibleAmount } = body;
    if (!referralId) return Response.json({ error: 'referralId is required' }, { status: 400 });

    const referral = await ctx.asServiceRole.entities.Referral.get(referralId);
    if (!referral) return Response.json({ error: 'Referral not found' }, { status: 404 });

    const partner = await ctx.asServiceRole.entities.Partner.get(referral.partner_id);
    if (!partner) return Response.json({ error: 'Partner not found' }, { status: 404 });

    const serviceId = referral.service_id;
    if (serviceId && partner.excluded_service_ids?.includes(serviceId)) {
      return Response.json({ error: 'Service excluded from partner commission' }, { status: 400 });
    }
    if (partner.eligible_service_ids?.length && serviceId && !partner.eligible_service_ids.includes(serviceId)) {
      return Response.json({ error: 'Service not eligible for partner commission' }, { status: 400 });
    }

    const num = (v: any) => (v === undefined || v === null || v === '' ? undefined : Number(v));
    const gross = num(grossAmount) ?? referral.gross_amount ?? 0;
    const eligible = num(eligibleAmount) ?? referral.eligible_amount ?? gross;
    if (!Number.isFinite(gross) || gross < 0 || !Number.isFinite(eligible) || eligible < 0) {
      return Response.json({ error: 'Amounts must be non-negative numbers' }, { status: 400 });
    }

    // One live commission per referral (a rejected one may be recalculated)
    const existing = await ctx.asServiceRole.entities.Commission.filter({ referral_id: referralId });
    if (existing.some((c: any) => c.status !== 'rejected')) {
      return Response.json({ error: 'A commission already exists for this referral' }, { status: 409 });
    }

    const calc = calculateCommissionAmount({
      basis: partner.commission_basis || 'gross',
      grossAmount: gross,
      eligibleAmount: eligible,
      rate: partner.commission_percentage || 0,
      minTransaction: partner.min_transaction_amount,
      maxCommission: partner.max_commission,
    });

    if (!calc.eligible) {
      return Response.json({ error: 'Transaction does not meet minimum amount' }, { status: 400 });
    }

    const commission = await ctx.asServiceRole.entities.Commission.create({
      commission_id: 'C-' + Date.now() + '-' + crypto.randomUUID().slice(0, 4),
      referral_id: referralId,
      partner_id: partner.id,
      partner_user_id: partner.user_id,
      partner_name: partner.business_name,
      client_name: referral.client_name,
      service_name: referral.service_name || referral.service_category || null,
      service_id: referral.service_id,
      basis: partner.commission_basis || 'gross',
      gross_amount: gross,
      eligible_amount: calc.base,
      commission_rate: partner.commission_percentage || 0,
      commission_amount: calc.amount,
      status: 'pending',
    });

    await ctx.asServiceRole.entities.Referral.update(referralId, {
      status: 'commission_pending',
      gross_amount: gross,
      eligible_amount: calc.base,
      commission_id: commission.id,
    });

    await logAudit(ctx, {
      action: 'commission_created',
      entity: 'Commission',
      entityId: commission.id,
      newValue: { amount: calc.amount, basis: partner.commission_basis, referralId },
      details: `Commission calculated for ${partner.business_name}`,
    });

    return Response.json({ commission, calculation: calc });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}