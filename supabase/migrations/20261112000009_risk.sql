-- Risk assessment (EUDR art. 10) and mitigation (art. 11) recorded per shipment.
alter table public.shipments
  add column risk_assessment text check (risk_assessment is null or length(risk_assessment) <= 5000),
  add column risk_mitigation text check (risk_mitigation is null or length(risk_mitigation) <= 5000),
  add column risk_negligible boolean,
  add column risk_assessed_at timestamptz;

-- High-risk countries of Implementing Regulation (EU) 2025/1093. Every country not listed as low or high is standard risk.
-- TODO: preveri posodobitev seznama v letu 2026.
insert into public.country_risk (country, risk, source_act, valid_from, notes) values
  ('BY', 'high', 'Izvedbena uredba (EU) 2025/1093', date '2025-06-30', 'TODO: preveri posodobitev 2026'),
  ('KP', 'high', 'Izvedbena uredba (EU) 2025/1093', date '2025-06-30', 'TODO: preveri posodobitev 2026'),
  ('MM', 'high', 'Izvedbena uredba (EU) 2025/1093', date '2025-06-30', 'TODO: preveri posodobitev 2026'),
  ('RU', 'high', 'Izvedbena uredba (EU) 2025/1093', date '2025-06-30', 'TODO: preveri posodobitev 2026')
on conflict (country) do nothing;
