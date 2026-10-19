export async function logAudit(ctx: any, entry: {
  action: string;
  entity: string;
  entityId?: string;
  previousValue?: any;
  newValue?: any;
  details?: string;
}) {
  try {
    const user = await ctx.auth.me().catch(() => null);
    await ctx.asServiceRole.entities.AuditLog.create({
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId || null,
      user_id: user?.id || null,
      user_email: user?.email || null,
      user_role: user?.role || null,
      previous_value: entry.previousValue ? JSON.stringify(entry.previousValue) : null,
      new_value: entry.newValue ? JSON.stringify(entry.newValue) : null,
      details: entry.details || null,
    });
  } catch (e) {
    // best-effort audit logging
  }
}