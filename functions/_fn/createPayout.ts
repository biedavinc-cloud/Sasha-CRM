import { serverContext } from '../_lib/context.ts';
import { logAudit } from './shared/audit.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const ctx = serverContext(req);
    const user = await ctx.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { partnerId, notes } = body;
    const commissionIds: string[] = Array.isArray(body.commissionIds)
      ? [...new Set<string>(body.commissionIds.filter((x: any) => typeof x === 'string'))]
      : [];
    if (!partnerId || !commissionIds.length) return Response.json({ error: 'partnerId and commissionIds required' }, { status: 400 });

    const partner = await ctx.asServiceRole.entities.Partner.get(partnerId);
    if (!partner) return Response.json({ error: 'Partner not found' }, { status: 404 });

    const Commission = ctx.asServiceRole.entities.Commission;
    const preview = await Commission.filter({ id: { $in: commissionIds } });
    if (preview.length !== commissionIds.length || preview.some((c: any) => c.status !== 'payable')) {
      return Response.json({ error: 'Some commissions are not payable' }, { status: 400 });
    }
    if (preview.some((c: any) => c.partner_id !== partnerId)) {
      return Response.json({ error: 'Commissions belong to a different partner' }, { status: 400 });
    }

    // Atomically claim the commissions (payable -> paid) in ONE statement. If two admins pay the same commission
    // at the same time, only one claim can match; the other gets 409 and nothing is paid twice.
    const token = crypto.randomUUID();
    const now = new Date().toISOString();
    const claimed = await Commission.claimMany(commissionIds, {
      where: { status: 'payable', partner_id: partnerId },
      patch: { status: 'paid', claim_token: token, paid_date: now },
    });
    const release = () => Commission.claimMany(commissionIds, {
      where: { claim_token: token },
      patch: { status: 'payable', claim_token: null, paid_date: null },
    });
    if (claimed !== commissionIds.length) {
      if (claimed > 0) await release();
      return Response.json({ error: 'Some commissions were just paid or changed — refresh and try again' }, { status: 409 });
    }

    let payout: any;
    try {
      const claimedRows = await Commission.filter({ id: { $in: commissionIds } });
      const amount = claimedRows.reduce((sum: number, c: any) => sum + (c.commission_amount || 0), 0);
      payout = await ctx.asServiceRole.entities.Payout.create({
        payout_id: 'P-' + Date.now() + '-' + crypto.randomUUID().slice(0, 4),
        partner_id: partnerId,
        partner_user_id: partner.user_id,
        partner_name: partner.business_name,
        amount: Math.round(amount * 100) / 100,
        status: 'pending',
        commission_ids: commissionIds,
        notes: notes || null,
      });
      await Commission.claimMany(commissionIds, {
        where: { claim_token: token },
        patch: { payout_id: payout.id, claim_token: null },
      });

      const referralIds = claimedRows.map((c: any) => c.referral_id).filter(Boolean);
      if (referralIds.length) {
        await ctx.asServiceRole.entities.Referral.updateMany({ id: { $in: referralIds } }, { $set: { status: 'paid' } });
      }
    } catch (e) {
      await release(); // never leave commissions marked paid without a payout
      throw e;
    }

    await logAudit(ctx, {
      action: 'payout_created',
      entity: 'Payout',
      entityId: payout.id,
      newValue: { amount: payout.amount, partnerId, commissionCount: commissionIds.length },
      details: `Payout created for ${partner.business_name}`,
    });

    return Response.json({ payout });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
