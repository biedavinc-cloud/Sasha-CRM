import { serverContext } from '../_lib/context.ts';
import { logAudit } from './shared/audit.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const ctx = serverContext(req);
    const user = await ctx.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { commissionId, reason } = body;
    if (!commissionId) return Response.json({ error: 'commissionId required' }, { status: 400 });

    const commission = await ctx.asServiceRole.entities.Commission.get(commissionId);
    if (!commission) return Response.json({ error: 'Commission not found' }, { status: 404 });

    const previous = { status: commission.status, amount: commission.commission_amount };
    const reasonText = reason || 'Treatment refunded';

    if (commission.status === 'paid') {
      // Already paid — mark disputed for manual clawback from the payout
      await ctx.asServiceRole.entities.Commission.update(commissionId, {
        status: 'disputed',
        adjustment_notes: `REFUND/REVERSAL: ${reasonText}`,
      });
      await ctx.asServiceRole.entities.Referral.update(commission.referral_id, {
        status: 'refunded',
        notes: `Commission reversed: ${reasonText}`,
      });
      if (commission.payout_id) {
        await logAudit(ctx, {
          action: 'commission_refund_clawback_needed',
          entity: 'Payout',
          entityId: commission.payout_id,
          newValue: { commissionId, reason: reasonText },
          details: `PAID commission ${commissionId} reversed — clawback needed from payout ${commission.payout_id}`,
        });
      }
    } else {
      // Not yet paid — simply reject and mark referral refunded
      await ctx.asServiceRole.entities.Commission.update(commissionId, {
        status: 'rejected',
        adjustment_notes: `REFUND/REVERSAL: ${reasonText}`,
      });
      await ctx.asServiceRole.entities.Referral.update(commission.referral_id, {
        status: 'refunded',
        notes: `Commission reversed: ${reasonText}`,
      });
    }

    await logAudit(ctx, {
      action: 'commission_refunded',
      entity: 'Commission',
      entityId: commissionId,
      previousValue: previous,
      newValue: { status: commission.status === 'paid' ? 'disputed' : 'rejected', reason: reasonText },
      details: `Commission reversed by ${user.email}: ${reasonText}`,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}