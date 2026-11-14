import { describe, expect, it } from "vitest";
import {
  datumPomena,
  dodajMesece,
  jeDatum,
  pomeniZa,
  statusPomena,
  zaTekst,
} from "../supabase/functions/parastosi/pomeni.ts";

describe("датуми помена (правила из Excel-а)", () => {
  it("40 дана = датум смрти + 40", () => {
    expect(datumPomena("2026-10-06", "40")).toBe("2026-11-15");
    expect(datumPomena("2024-11-07", "40")).toBe("2024-12-17");
  });
  it("40 дана са подешавањем „дан смрти је први дан“", () => {
    expect(datumPomena("2026-10-06", "40", 39)).toBe("2026-11-14");
  });
  it("пола године = исти дан, 6 месеци касније", () => {
    expect(datumPomena("2026-05-17", "pola")).toBe("2026-11-17");
    expect(datumPomena("2025-07-13", "pola")).toBe("2026-01-13");
    expect(datumPomena("2025-06-12", "pola")).toBe("2025-12-12");
  });
  it("пола године не прелива крај месеца", () => {
    expect(datumPomena("2025-08-31", "pola")).toBe("2026-02-28");
    expect(dodajMesece("2027-08-30", 6)).toBe("2028-02-29");
  });
  it("година = исти дан и месец следеће године", () => {
    expect(datumPomena("2025-11-18", "godina")).toBe("2026-11-18");
    expect(datumPomena("2028-02-29", "godina")).toBe("2029-02-28");
  });
});

describe("статуси", () => {
  it("границе", () => {
    expect(statusPomena(0)).toBe("ova_nedelja");
    expect(statusPomena(7)).toBe("ova_nedelja");
    expect(statusPomena(8)).toBe("uskoro");
    expect(statusPomena(60)).toBe("uskoro");
    expect(statusPomena(61)).toBe("kasnije");
    expect(statusPomena(-1)).toBe("skoro_proslo");
    expect(statusPomena(-7)).toBe("skoro_proslo");
    expect(statusPomena(-8)).toBe("proslo");
    expect(statusPomena(3, true)).toBe("obavljeno");
  });
  it("за (дана)", () => {
    const [p40] = pomeniZa("2026-10-06", "2026-11-14");
    expect(p40.zaDana).toBe(1);
    expect(zaTekst(1)).toBe("сутра");
    expect(zaTekst(0)).toBe("данас");
    expect(zaTekst(14)).toBe("за 14 дана");
    expect(zaTekst(21)).toBe("за 21 дан");
    expect(zaTekst(-3)).toBe("пре 3 дана");
  });
  it("провера датума", () => {
    expect(jeDatum("2026-02-28")).toBe(true);
    expect(jeDatum("2026-02-30")).toBe(false);
    expect(jeDatum("28.02.2026")).toBe(false);
  });
});
