import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { runFraudChecks } from '../../shared/fraud.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { referralCode, clientName, clientPhone, clientEmail, serviceInterest, clickId, utmSource, utmMedium, utmCampaign } = body;
    if (!referralCode) return Response.json({ error: 'referralCode required' }, { status: 400 });

    const partners = await base44.asServiceRole.entities.Partner.filter({ referral_code: referralCode, status: 'active' });
    const partnerArr = (partners as any)?.items || partners;
    if (!partnerArr?.length) return Response.json({ error: 'Invalid referral code' }, { status: 404 });
    const partner = partnerArr[0];

    // Extract IP from request headers
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;

    // Run multi-criteria fraud scoring
    const fraud = await runFraudChecks(base44, {
      partner,
      clientPhone: clientPhone || null,
      clientEmail: clientEmail || null,
      clientIp,
      clickId: clickId || null,
    });

    const referral = await base44.asServiceRole.entities.Referral.create({
      referral_id: 'R-' + Date.now(),
      partner_id: partner.id,
      partner_user_id: partner.user_id,
      partner_name: partner.business_name,
      client_name: clientName || 'Unknown',
      client_phone: clientPhone || null,
      client_email: clientEmail || null,
      service_category: serviceInterest || null,
      status: 'lead_created',
      fraud_flag: fraud.fraudFlag,
      fraud_reason: fraud.fraudReason,
      fraud_score: fraud.fraudScore,
      click_id: clickId || null,
      ip_address: clientIp,
      utm_source: utmSource || null,
      utm_medium: utmMedium || null,
      utm_campaign: utmCampaign || null,
    });

    // Mark the click as converted
    if (clickId) {
      try {
        await base44.asServiceRole.entities.ReferralClick.update(clickId, {
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
      fraudFlag: fraud.fraudFlag,
      fraudScore: fraud.fraudScore,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}