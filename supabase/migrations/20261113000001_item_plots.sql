-- Which plots each product of a shipment comes from (null = all plots of the shipment).
-- Used for the producers of each commodity in the due diligence statement.
alter table public.shipment_items add column plot_ids uuid[] check (plot_ids is null or cardinality(plot_ids) <= 2000);
