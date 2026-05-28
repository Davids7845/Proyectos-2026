import { describe, it, expect } from "vitest";
import { ALIAS_MATERIAL_EXCEL, normalizeMaterialName } from "@/lib/import/aliases_materiales";

describe("ALIAS_MATERIAL_EXCEL (Fase 2d.1)", () => {
  it("contiene >= 100 aliases", () => {
    expect(Object.keys(ALIAS_MATERIAL_EXCEL).length).toBeGreaterThanOrEqual(100);
  });

  it("nombres del Excel resuelven a códigos BD esperados", () => {
    const cases: Array<[string, string]> = [
      ["caliza + martillo",                  "CALIZATRI"],
      ["caliza explotada",                   "CALTLVTRIT"],
      ["caliza en cemento ug",               "CALTLVTRIT"],
      ["arcilla en prehomo",                 "ARCTLVTRIT"],
      ["costo adicional martillo",           "COST_MART"],
      ["caliza comprada a externos",         "CALIZAEXT"],
      ["sanoha",                             "CARB_SANOHA"],
      ["trancora sas",                       "CARB_TRANCO"],
      ["chip de madera",                     "CHIPS"],
      ["biochips biowatt",                   "BIOCHIPS"],
      ["cdr focus green antioquia",          "CDR_FG_ANT"],
      ["tdf sistema verde cundinamarca",     "TDF_SV_CUN"],
      ["diesel",                             "DIESEL"],
      ["barras trituradora",                 "BARRAS_TRIT"],
      ["ductos del horno",                   "DUCT_HORNO"],
      ["enfriador horno",                    "ENFR_HORNO"],
      ["láminas crudo",                      "LAM_CRUDO"],
      ["placas y segmentos rodillo cemento", "PLAC_SEG_CEM"],
      ["cargue clinker venta",               "CARG_CK_VTA"],
      ["dosificacion sal",                   "DOSIF_SAL"],
      ["sal marina",                         "SAL_MARINA"],
      ["yesos prada",                        "YESO_PRADA"],
      ["yeso rey miranda",                   "YESO_MIRAND"],
      ["puzolana la dorada",                 "PUZ_DORADA"],
      ["sacos 50 kg ug",                     "SACO_50KG"],
      ["sacos 50 kg topex",                  "SACO_50_TPX"],
      ["sacos 42,5 kg art",                  "SACO_42_ART"],
      ["aditivo cemento",                    "ADITIVO_CEM"],
      ["precio regalías arcilla",            "REG_ARCILLA"],
      ["precio regalías caliza",             "REG_CALIZA"],
    ];
    for (const [excel, codigo] of cases) {
      expect(ALIAS_MATERIAL_EXCEL[excel], `alias "${excel}" debe mapear a ${codigo}`).toBe(codigo);
    }
  });

  it("variantes 'en <proceso>' apuntan al mismo material base", () => {
    // Caliza explotada se consume en varios procesos; todas las variantes
    // deben apuntar a CALTLVTRIT.
    expect(ALIAS_MATERIAL_EXCEL["caliza en prehomo"]).toBe("CALTLVTRIT");
    expect(ALIAS_MATERIAL_EXCEL["caliza en crudo"]).toBe("CALTLVTRIT");
    expect(ALIAS_MATERIAL_EXCEL["caliza en cemento ug"]).toBe("CALTLVTRIT");
    expect(ALIAS_MATERIAL_EXCEL["caliza en cemento art"]).toBe("CALTLVTRIT");
    expect(ALIAS_MATERIAL_EXCEL["caliza en cemento fibro"]).toBe("CALTLVTRIT");
  });
});

describe("normalizeMaterialName", () => {
  it("trim + lowercase + colapsa espacios", () => {
    expect(normalizeMaterialName("  Caliza   Explotada  ")).toBe("caliza explotada");
  });

  it("remueve sufijo '(PCI)' de combustibles", () => {
    expect(normalizeMaterialName("Sanoha (PCI)")).toBe("sanoha");
    expect(normalizeMaterialName("CDR Veolia (PCI)")).toBe("cdr veolia");
    expect(normalizeMaterialName("Diesel (PCI)")).toBe("diesel");
  });

  it("no toca strings sin '(PCI)'", () => {
    expect(normalizeMaterialName("Caliza")).toBe("caliza");
    expect(normalizeMaterialName("Arcilla en Prehomo")).toBe("arcilla en prehomo");
  });
});
