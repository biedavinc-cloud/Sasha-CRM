import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { logAudit } from '../../shared/audit.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { commissionId, action, notes } = body;
    if (!commissionId || !action) return Response.json({ error: 'commissionId and action required' }, { status: 400 });

    const commission = await base44.asServiceRole.entities.Commission.get(commissionId);
    if (!commission) return Response.json({ error: 'Commission not found' }, { status: 404 });

    const previous = { status: commission.status };
    let newStatus: string;
    let referralStatus: string | null = null;
    switch (action) {
      case 'approve': newStatus = 'payable'; referralStatus = 'commission_payable'; break;
      case 'reject': newStatus = 'rejected'; referralStatus = 'rejected'; break;
      case 'hold': newStatus = 'held'; break;
      case 'dispute': newStatus = 'disputed'; referralStatus = 'disputed'; break;
      default: return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    await base44.asServiceRole.entities.Commission.update(commissionId, {
      status: newStatus,
      approved_by: user.email,
      approved_date: new Date().toISOString(),
      adjustment_notes: notes || null,
    });

    if (referralStatus) {
      await base44.asServiceRole.entities.Referral.update(commission.referral_id, { status: referralStatus });
    }

    await logAudit(base44, {
      action: 'commission_' + action,
      entity: 'Commission',
      entityId: commissionId,
      previousValue: previous,
      newValue: { status: newStatus, notes },
      details: `Commission ${action} by ${user.email}`,
    });

    return Response.json({ ok: true, status: newStatus });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}