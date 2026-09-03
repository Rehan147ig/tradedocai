import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { ExtractedTradeDocument } from "@/lib/validators";

export type InvoiceDocType = "commercial_invoice" | "packing_list";

function euro(value: string | null | undefined, currency: string | null | undefined) {
  if (!value) return "-";
  const cur = currency ?? "USD";
  return `${cur} ${value}`;
}

export async function generateInvoicePdf(data: ExtractedTradeDocument, opts?: { type?: InvoiceDocType; laneLabel?: string; orderName?: string | null }): Promise<Uint8Array> {
  const type = opts?.type ?? "commercial_invoice";
  const title = type === "packing_list" ? "PACKING LIST" : "COMMERCIAL INVOICE";
  const doc = await PDFDocument.create();
  let page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  let y = height - 50;

  function draw(text: string, x: number, yy: number, size = 9, f = font, color = rgb(0, 0, 0)) {
    page.drawText(text.slice(0, 95), { x, y: yy, size, font: f, color });
  }

  // Header
  draw(title, 40, y, 16, bold, rgb(0.12, 0.25, 0.55)); y -= 8;
  draw("ClearShip AI — TradeDocAI", 40, y, 8, font, rgb(0.4, 0.4, 0.4)); y -= 6;
  draw(`Generated: ${new Date().toISOString().slice(0, 10)}   Lane: ${opts?.laneLabel ?? (data as unknown as Record<string, string>).trade_lane ?? "global"}`, 40, y, 7, font, rgb(0.4, 0.4, 0.4)); y -= 18;

  // Boxes
  const boxH = 70;
  page.drawRectangle({ x: 40, y: y - boxH, width: 255, height: boxH, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
  page.drawRectangle({ x: 305, y: y - boxH, width: 250, height: boxH, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
  draw("SELLER / EXPORTER", 46, y - 12, 7, bold);
  draw(String(data.seller_name ?? "Seller not set"), 46, y - 24, 8, font);
  draw(String(data.seller_address ?? data.seller_country ?? ""), 46, y - 34, 7, font);
  if (data.eori_number) draw(`EORI: ${data.eori_number}`, 46, y - 44, 7, font);

  draw("BUYER / CONSIGNEE", 312, y - 12, 7, bold);
  draw(String(data.buyer_name ?? "Buyer not set"), 312, y - 24, 8, font);
  draw(String(data.buyer_address ?? data.buyer_country ?? ""), 312, y - 34, 7, font);
  if (data.vat_number) draw(`VAT: ${data.vat_number}`, 312, y - 44, 7, font);

  y -= boxH + 14;

  // Meta row
  draw(`Invoice: ${data.invoice_number ?? opts?.orderName ?? "-"}`, 40, y, 8, font); draw(`Date: ${data.invoice_date ?? new Date().toISOString().slice(0, 10)}`, 200, y, 8, font); draw(`Incoterms: ${data.incoterms ?? "-"}`, 380, y, 8, font); y -= 12;
  draw(`Currency: ${data.currency ?? "-"}`, 40, y, 8, font); draw(`Total: ${euro(data.total_value ?? null, data.currency)}`, 200, y, 8, bold); y -= 16;

  // Table header
  page.drawRectangle({ x: 40, y: y - 14, width: 515, height: 14, color: rgb(0.12, 0.25, 0.55) });
  draw(" #", 44, y - 10, 7, bold, rgb(1, 1, 1));
  draw("Description", 60, y - 10, 7, bold, rgb(1, 1, 1));
  draw("HS Code", 260, y - 10, 7, bold, rgb(1, 1, 1));
  draw("Origin", 330, y - 10, 7, bold, rgb(1, 1, 1));
  draw("Qty", 410, y - 10, 7, bold, rgb(1, 1, 1));
  draw("Value", 460, y - 10, 7, bold, rgb(1, 1, 1));
  y -= 18;

  for (let i = 0; i < data.items.length; i++) {
    const it = data.items[i];
    if (y < 90) { // new page
      page = doc.addPage([595, 842]);
      y = height - 50;
    }
    draw(String(i + 1), 44, y, 8, font);
    draw(String(it.description ?? "-").slice(0, 42), 60, y, 8, font);
    draw(String(it.hs_code ?? "missing"), 260, y, 7, font, it.hs_status !== "valid" ? rgb(0.8, 0, 0) : rgb(0, 0, 0));
    draw(String(it.country_of_origin ?? "-"), 330, y, 7, font);
    draw(String(it.quantity ?? "-"), 410, y, 7, font);
    draw(euro(it.total_line_value ?? it.unit_price ?? null, data.currency), 460, y, 7, font);
    // weight line if packing list
    if (type === "packing_list" && (it.net_weight || it.gross_weight)) {
      y -= 9;
      draw(`  Net: ${it.net_weight ?? "-"} kg  Gross: ${it.gross_weight ?? "-"} kg`, 60, y, 6, font, rgb(0.4, 0.4, 0.4));
    }
    y -= 14;
    page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
    y -= 4;
  }

  y -= 8;
  if (type === "commercial_invoice") {
    draw(`Declared value: ${euro(data.total_value, data.currency)}   —   For customs purposes only`, 40, y, 7, bold); y -= 12;
    const lc = (data as unknown as Record<string, unknown>).landed_cost as { estimatedDuty: number; estimatedTax: number; estimatedLandedCost: number } | undefined;
    if (lc) { draw(`Est. duty ${lc.estimatedDuty} + tax ${lc.estimatedTax} = landed ~${lc.estimatedLandedCost} (preflight estimate)`, 40, y, 6, font, rgb(0.4, 0.4, 0.4)); y -= 10; }
  } else {
    draw(`Total packages/collis: ${data.items.length}   Total qty: ${data.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)}`, 40, y, 7, font); y -= 10;
  }

  // Footer audit
  y -= 6;
  page.drawRectangle({ x: 40, y: Math.max(y - 28, 20), width: 515, height: 28, color: rgb(0.96, 0.96, 0.96) });
  draw("Audit: Generated by ClearShip AI deterministic workflow (Interfaze.AI). Verify HS before filing. This is pre-shipment advice, not legal filing.", 44, Math.max(y - 12, 28), 6, font, rgb(0.4, 0.4, 0.4));
  draw("TradeDocAI", width - 100, 22, 7, font, rgb(0.6, 0.6, 0.6));

  return doc.save();
}
