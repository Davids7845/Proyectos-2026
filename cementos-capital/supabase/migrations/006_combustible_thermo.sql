-- Fase 1.6: campos del modelo térmico del horno (Clinker)
-- Cierra el gap de combustible Carbón + Alternos en ORD 5.

alter table parametros_energia
  add column if not exists kcal_tck                decimal(12, 4),  -- "Prueba PCI" fila 428: Kcal/Ton Clinker del horno
  add column if not exists pct_energia_carbones    decimal(8, 6),   -- fila 411
  add column if not exists pct_energia_alternos    decimal(8, 6),   -- fila 410
  add column if not exists pct_energia_diesel      decimal(8, 6),   -- fila 409
  add column if not exists pci_ponderado_carbones  decimal(10, 2),  -- ponderado masa (filas 399, 401) × PCI (417, 419)
  add column if not exists pci_ponderado_alternos  decimal(10, 2),  -- ponderado CDR/TDF (405, 406) × PCI (413, 414)
  add column if not exists pci_ponderado_diesel    decimal(10, 2);  -- fila 412
