import { serverContext } from '../_lib/context.ts';
import { logAudit } from './shared/audit.ts';

const ALLOWED_FIELDS = ['contact_person', 'phone', 'address'];

export default async function(req: Request): Promise<Response> {
  try {
    const ctx = serverContext(req);
    const user = await ctx.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const partners = await ctx.asServiceRole.entities.Partner.filter({ user_id: user.id });
    if (!partners.length) return Response.json({ error: 'Partner profile not found' }, { status: 404 });
    const partner = partners[0];

    const update: Record<string, string | null> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in body) {
        const val = body[key];
        update[key] = typeof val === 'string' ? val.slice(0, 500) : null;
      }
    }

    if (!Object.keys(update).length) {
      return Response.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    const updated = await ctx.asServiceRole.entities.Partner.update(partner.id, update);

    await logAudit(ctx, {
      action: 'partner_profile_updated',
      entity: 'Partner',
      entityId: partner.id,
      newValue: update,
      details: `Partner self-updated profile contact info (${user.email})`,
    });

    return Response.json({ partner: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}