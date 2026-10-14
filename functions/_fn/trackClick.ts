import { createClientFromRequest } from '../_lib/compat.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { utmSource, utmMedium, utmCampaign, referrerSource } = body;
    const referralCode = String(body.referralCode ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{2,39}$/.test(referralCode)) return Response.json({ error: 'Invalid referral code' }, { status: 404 });

    const partners = await base44.asServiceRole.entities.Partner.filter({ referral_code: referralCode, status: 'active' });
    const partnerArr = (partners as any)?.items || partners;
    if (!partnerArr?.length) return Response.json({ error: 'Invalid referral code' }, { status: 404 });
    const partner = partnerArr[0];

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
    const userAgent = req.headers.get('user-agent') || null;

    const click = await base44.asServiceRole.entities.ReferralClick.create({
      click_id: 'CLK-' + Date.now() + '-' + crypto.randomUUID().slice(0, 4),
      partner_id: partner.id,
      referral_code: referralCode,
      ip_address: ip,
      user_agent: userAgent,
      utm_source: typeof utmSource === 'string' ? utmSource.slice(0, 60) || null : null,
      utm_medium: typeof utmMedium === 'string' ? utmMedium.slice(0, 60) || null : null,
      utm_campaign: typeof utmCampaign === 'string' ? utmCampaign.slice(0, 80) || null : null,
      referrer_source: typeof referrerSource === 'string' ? referrerSource.slice(0, 200) || null : null,
      converted: false,
    });

    return Response.json({
      ok: true,
      clickId: click.id,
      partnerName: partner.business_name,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}