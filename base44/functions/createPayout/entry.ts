import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { logAudit } from '../../shared/audit.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { partnerId, commissionIds, notes } = body;
    if (!partnerId || !commissionIds?.length) return Response.json({ error: 'partnerId and commissionIds required' }, { status: 400 });

    const partner = await base44.asServiceRole.entities.Partner.get(partnerId);
    if (!partner) return Response.json({ error: 'Partner not found' }, { status: 404 });

    const commissions = await base44.asServiceRole.entities.Commission.filter({ id: { $in: commissionIds } });
    const payable = commissions.filter((c: any) => c.status === 'payable');
    if (payable.length !== commissionIds.length) {
      return Response.json({ error: 'Some commissions are not payable' }, { status: 400 });
    }

    const amount = payable.reduce((sum: number, c: any) => sum + (c.commission_amount || 0), 0);
    const payout = await base44.asServiceRole.entities.Payout.create({
      payout_id: 'P-' + Date.now(),
      partner_id: partnerId,
      partner_user_id: partner.user_id,
      partner_name: partner.business_name,
      amount: Math.round(amount * 100) / 100,
      status: 'pending',
      commission_ids: commissionIds,
      notes: notes || null,
    });

    await base44.asServiceRole.entities.Commission.updateMany(
      { id: { $in: commissionIds }, status: 'payable' },
      { $set: { status: 'paid', payout_id: payout.id, paid_date: new Date().toISOString() } }
    );

    const referralIds = payable.map((c: any) => c.referral_id).filter(Boolean);
    if (referralIds.length) {
      await base44.asServiceRole.entities.Referral.updateMany(
        { id: { $in: referralIds } },
        { $set: { status: 'paid' } }
      );
    }

    await logAudit(base44, {
      action: 'payout_created',
      entity: 'Payout',
      entityId: payout.id,
      newValue: { amount, partnerId, commissionCount: commissionIds.length },
      details: `Payout created for ${partner.business_name}`,
    });

    return Response.json({ payout });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}