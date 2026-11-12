-- EUDR art. 9(1)(d): date or time range of production (for timber: felling/harvest) per plot.
alter table public.plots
  add column harvest_from date,
  add column harvest_to date,
  add constraint plots_harvest_range check (harvest_to is null or harvest_from is null or harvest_to >= harvest_from);

-- Supply-chain confidentiality: buyer links show supplier (producer) names only when the owner chooses so.
alter table public.buyer_shares add column show_suppliers boolean not null default false;
