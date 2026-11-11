-- Reference data. Idempotent: safe to run again after updates.

-- Country risk classification. Source: Commission Implementing Regulation (EU) 2025/1093.
-- TODO: preveri, ali je bila razvrstitev v letu 2026 posodobljena.
insert into public.country_risk (country, risk, source_act, valid_from, notes) values
  ('SI', 'low', 'Izvedbena uredba (EU) 2025/1093', date '2025-06-30', 'TODO: preveri posodobitev 2026'),
  ('HR', 'low', 'Izvedbena uredba (EU) 2025/1093', date '2025-06-30', 'TODO: preveri posodobitev 2026'),
  ('BA', 'low', 'Izvedbena uredba (EU) 2025/1093', date '2025-06-30', 'TODO: preveri posodobitev 2026'),
  ('RS', 'low', 'Izvedbena uredba (EU) 2025/1093', date '2025-06-30', 'TODO: preveri posodobitev 2026'),
  ('AT', 'low', 'Izvedbena uredba (EU) 2025/1093', date '2025-06-30', 'TODO: preveri posodobitev 2026'),
  ('IT', 'low', 'Izvedbena uredba (EU) 2025/1093', date '2025-06-30', 'TODO: preveri posodobitev 2026'),
  ('HU', 'low', 'Izvedbena uredba (EU) 2025/1093', date '2025-06-30', 'TODO: preveri posodobitev 2026'),
  ('ME', 'low', 'Izvedbena uredba (EU) 2025/1093', date '2025-06-30', 'TODO: preveri posodobitev 2026')
on conflict (country) do update set risk = excluded.risk, source_act = excluded.source_act, valid_from = excluded.valid_from, notes = excluded.notes;

-- Wood HS codes in Annex I of Regulation (EU) 2023/1115 (4-digit level unless noted).
-- TODO: preveri Delegirano uredbo (EU) 2026/2102 (izjeme za rabljene izdelke, bambus, ratan; ex 9401/9403) in točne 8-mestne KN kode.
insert into public.hs_codes (code, description_sl, description_en, in_scope, applies_from, notes) values
  ('4401', 'Les za kurjavo, sekanci, žagovina, peleti', 'Fuel wood, wood chips, sawdust, pellets', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('4402', 'Lesno oglje', 'Wood charcoal', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('4403', 'Les, surov (hlodovina)', 'Wood in the rough (logs)', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('4404', 'Obročni les, količki, kole', 'Hoopwood, split poles, stakes', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('4405', 'Lesna volna, lesna moka', 'Wood wool, wood flour', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('4406', 'Železniški in tramvajski pragovi', 'Railway or tramway sleepers', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('4407', 'Les, žagan ali rezan po dolžini', 'Wood sawn or chipped lengthwise', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('4408', 'Listi za furnir', 'Sheets for veneering', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('4409', 'Les, profiliran', 'Wood continuously shaped', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('4410', 'Iverne plošče', 'Particle board, OSB', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('4411', 'Vlaknene plošče', 'Fibreboard', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('4412', 'Vezan les, furnirane plošče', 'Plywood, veneered panels', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('4413', 'Zgoščen les', 'Densified wood', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('4414', 'Leseni okvirji za slike, ogledala', 'Wooden frames for paintings, mirrors', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('4415', 'Zaboji, palete (razen embalaže, ki le podpira drug izdelek)', 'Packing cases, pallets (excluding packaging used only to support another product)', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102 (rabljeni izdelki)'),
  ('4416', 'Sodi in drugi sodarski izdelki', 'Casks, barrels and other coopers'' products', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102 (rabljeni izdelki)'),
  ('4417', 'Orodja, ročaji iz lesa', 'Tools, tool handles of wood', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('4418', 'Stavbno pohištvo in tesarski izdelki', 'Builders'' joinery and carpentry of wood', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('4419', 'Namizni in kuhinjski pribor iz lesa', 'Tableware and kitchenware of wood', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('4420', 'Intarzije, skrinjice, okrasni predmeti iz lesa', 'Wood marquetry, caskets, ornaments', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('4421', 'Drugi izdelki iz lesa', 'Other articles of wood', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('47', 'ex 47: Celuloza (razen bambusa in recikliranih izdelkov)', 'ex 47: Pulp (excluding bamboo-based and recovered products)', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('48', 'ex 48: Papir in karton (razen bambusa in recikliranih izdelkov)', 'ex 48: Paper and paperboard (excluding bamboo-based and recovered products)', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('49', 'ex 49: Tiskovine – izbrisano z Uredbo (EU) 2025/2650', 'ex 49: Printed products – deleted by Regulation (EU) 2025/2650', false, date '2026-12-30', 'TODO: preveri Uredbo (EU) 2025/2650'),
  ('9401', 'ex 9401: Sedežno pohištvo iz lesa', 'ex 9401: Seats of wood', true, date '2026-12-30', 'TODO: preveri razdelitev na podštevilke (Delegirana uredba (EU) 2026/2102)'),
  ('940330', 'Pisarniško pohištvo iz lesa', 'Wooden furniture used in offices', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('940340', 'Kuhinjsko pohištvo iz lesa', 'Wooden furniture used in kitchens', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('940350', 'Spalniško pohištvo iz lesa', 'Wooden furniture used in bedrooms', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('940360', 'Drugo pohištvo iz lesa', 'Other wooden furniture', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('940391', 'Deli pohištva iz lesa', 'Parts of furniture, of wood', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102'),
  ('940610', 'Montažne stavbe iz lesa', 'Prefabricated buildings of wood', true, date '2026-12-30', 'TODO: preveri Delegirano uredbo (EU) 2026/2102 (rabljeni izdelki)')
on conflict (code) do update set
  description_sl = excluded.description_sl, description_en = excluded.description_en,
  in_scope = excluded.in_scope, applies_from = excluded.applies_from, notes = excluded.notes;

-- Most common tree species in Slovenia, Croatia, Bosnia and Herzegovina and Serbia.
insert into public.species (scientific_name, common_name_sl, common_name_hr, common_name_sr, common_name_bs, common_name_en) values
  ('Picea abies', 'navadna smreka', 'obična smreka', 'smrča', 'smrča', 'Norway spruce'),
  ('Abies alba', 'bela jelka', 'obična jela', 'jela', 'jela', 'Silver fir'),
  ('Fagus sylvatica', 'navadna bukev', 'obična bukva', 'bukva', 'bukva', 'European beech'),
  ('Pinus sylvestris', 'rdeči bor', 'obični bor', 'beli bor', 'bijeli bor', 'Scots pine'),
  ('Pinus nigra', 'črni bor', 'crni bor', 'crni bor', 'crni bor', 'Black pine'),
  ('Larix decidua', 'evropski macesen', 'europski ariš', 'evropski ariš', 'evropski ariš', 'European larch'),
  ('Quercus robur', 'dob', 'hrast lužnjak', 'hrast lužnjak', 'hrast lužnjak', 'Pedunculate oak'),
  ('Quercus petraea', 'graden', 'hrast kitnjak', 'hrast kitnjak', 'hrast kitnjak', 'Sessile oak'),
  ('Quercus cerris', 'cer', 'cer', 'cer', 'cer', 'Turkey oak'),
  ('Acer pseudoplatanus', 'gorski javor', 'gorski javor', 'gorski javor', 'gorski javor', 'Sycamore maple'),
  ('Fraxinus excelsior', 'veliki jesen', 'obični jasen', 'beli jasen', 'bijeli jasen', 'European ash'),
  ('Castanea sativa', 'pravi kostanj', 'pitomi kesten', 'pitomi kesten', 'pitomi kesten', 'Sweet chestnut'),
  ('Carpinus betulus', 'navadni gaber', 'obični grab', 'beli grab', 'bijeli grab', 'European hornbeam'),
  ('Betula pendula', 'navadna breza', 'obična breza', 'breza', 'breza', 'Silver birch'),
  ('Populus spp.', 'topol', 'topola', 'topola', 'topola', 'Poplar'),
  ('Alnus glutinosa', 'črna jelša', 'crna joha', 'crna jova', 'crna joha', 'Black alder'),
  ('Tilia spp.', 'lipa', 'lipa', 'lipa', 'lipa', 'Lime (linden)'),
  ('Prunus avium', 'divja češnja', 'divlja trešnja', 'divlja trešnja', 'divlja trešnja', 'Wild cherry')
on conflict (scientific_name) do update set
  common_name_sl = excluded.common_name_sl, common_name_hr = excluded.common_name_hr, common_name_sr = excluded.common_name_sr,
  common_name_bs = excluded.common_name_bs, common_name_en = excluded.common_name_en;
