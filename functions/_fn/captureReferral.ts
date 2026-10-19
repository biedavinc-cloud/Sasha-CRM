import { serverContext } from '../_lib/context.ts';
import { runFraudChecks } from './shared/fraud.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const ctx = serverContext(req);
    const body = await req.json();
    const { serviceInterest, utmSource, utmMedium, utmCampaign } = body;
    const referralCode = String(body.referralCode ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{2,39}$/.test(referralCode)) return Response.json({ error: 'Invalid referral code' }, { status: 404 });

    const clientName = String(body.clientName ?? '').trim();
    if (clientName.length < 2 || clientName.length > 100) return Response.json({ error: 'Please enter your full name' }, { status: 400 });
    const clientPhone = String(body.clientPhone ?? '').replace(/[\s().-]/g, '');
    if (!/^\+?[0-9]{7,15}$/.test(clientPhone)) return Response.json({ error: 'Please enter a valid phone number' }, { status: 400 });
    const clientEmail = String(body.clientEmail ?? '').trim();
    if (clientEmail && (clientEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail))) {
      return Response.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    const partners = await ctx.asServiceRole.entities.Partner.filter({ referral_code: referralCode, status: 'active' });
    const partnerArr = (partners as any)?.items || partners;
    if (!partnerArr?.length) return Response.json({ error: 'Invalid referral code' }, { status: 404 });
    const partner = partnerArr[0];

    // Same person submitting twice (double tap, refresh) must not create two referrals / two commissions
    const recent = await ctx.asServiceRole.entities.Referral.filter({ partner_id: partner.id, client_phone: clientPhone }, { sort: '-created_date', limit: 1 });
    if (recent.length && Date.now() - new Date(recent[0].created_date).getTime() < 24 * 3600 * 1000) {
      return Response.json({ ok: true, referralId: recent[0].id });
    }

    // A click id only counts if it is a real, unconverted click of THIS partner
    let clickId: string | null = null;
    if (typeof body.clickId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(body.clickId)) {
      const click = await ctx.asServiceRole.entities.ReferralClick.get(body.clickId);
      if (click && click.partner_id === partner.id && !click.converted) clickId = click.id;
    }

    // Extract IP from request headers
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;

    // Run multi-criteria fraud scoring
    const fraud = await runFraudChecks(ctx, {
      partner,
      clientPhone: clientPhone || null,
      clientEmail: clientEmail || null,
      clientIp,
      clickId: clickId || null,
    });

    const referral = await ctx.asServiceRole.entities.Referral.create({
      referral_id: 'R-' + Date.now() + '-' + crypto.randomUUID().slice(0, 4),
      partner_id: partner.id,
      partner_user_id: partner.user_id,
      partner_name: partner.business_name,
      client_name: clientName,
      client_phone: clientPhone,
      client_email: clientEmail || null,
      service_category: typeof serviceInterest === 'string' ? serviceInterest.slice(0, 80) || null : null,
      status: 'lead_created',
      fraud_flag: fraud.fraudFlag,
      fraud_reason: fraud.fraudReason,
      fraud_score: fraud.fraudScore,
      click_id: clickId,
      ip_address: clientIp,
      utm_source: typeof utmSource === 'string' ? utmSource.slice(0, 60) || null : null,
      utm_medium: typeof utmMedium === 'string' ? utmMedium.slice(0, 60) || null : null,
      utm_campaign: typeof utmCampaign === 'string' ? utmCampaign.slice(0, 80) || null : null,
    });

    // Mark the click as converted
    if (clickId) {
      try {
        await ctx.asServiceRole.entities.ReferralClick.update(clickId, {
          converted: true,
          referral_id: referral.id,
        });
      } catch {
        // best-effort
      }
    }

    return Response.json({
      ok: true,
      referralId: referral.id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}