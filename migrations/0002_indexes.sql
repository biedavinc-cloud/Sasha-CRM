-- Expression indexes for the fields the app filters on most. Queries use the same literal json_extract paths,
-- and created_date as the last column also serves the default "newest first" ordering.
CREATE INDEX IF NOT EXISTS idx_ent_status          ON entities(entity, json_extract(data, '$.status'), created_date);
CREATE INDEX IF NOT EXISTS idx_ent_partner_id      ON entities(entity, json_extract(data, '$.partner_id'), created_date);
CREATE INDEX IF NOT EXISTS idx_ent_partner_user_id ON entities(entity, json_extract(data, '$.partner_user_id'), created_date);
CREATE INDEX IF NOT EXISTS idx_ent_user_id         ON entities(entity, json_extract(data, '$.user_id'), created_date);
CREATE INDEX IF NOT EXISTS idx_ent_referral_code   ON entities(entity, json_extract(data, '$.referral_code'));
CREATE INDEX IF NOT EXISTS idx_ent_referral_id     ON entities(entity, json_extract(data, '$.referral_id'), created_date);
