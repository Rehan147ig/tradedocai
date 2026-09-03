import { ExtractedTradeDocument } from "@/lib/validators";

export type CarrierFormat = "generic" | "easyship" | "dhl" | "ups";

export function buildCarrierEdi(decisionOutput: ExtractedTradeDocument, audit: Record<string, unknown>, opts: { format: CarrierFormat; orderName?: string | null; reference?: string }) {
  const output = decisionOutput as unknown as Record<string, unknown>;
  const landed = (output.landed_cost as Record<string, unknown>) ?? {};
  const carrierPayload = (audit.carrierPayload as Record<string, unknown>) ?? {};

  const base = {
    reference: opts.reference ?? opts.orderName ?? (decisionOutput.invoice_number ?? "CLEARSHIP-ORDER"),
    shipment: {
      incoterms: decisionOutput.incoterms ?? "DAP",
      currency: decisionOutput.currency ?? "USD",
      declared_value: decisionOutput.total_value ?? null,
      estimated_duty: landed.estimatedDuty ?? null,
      estimated_tax: landed.estimatedTax ?? null,
      estimated_landed_cost: landed.estimatedLandedCost ?? null,
      lane: (output.trade_lane as string) ?? (audit.lane as string) ?? "global",
      lane_label: landed.laneLabel ?? null,
    },
    shipper: {
      name: decisionOutput.seller_name ?? null,
      country: decisionOutput.seller_country ?? null,
      eori: decisionOutput.eori_number ?? null,
    },
    consignee: {
      name: decisionOutput.buyer_name ?? null,
      address: decisionOutput.buyer_address ?? null,
      country: decisionOutput.buyer_country ?? null,
      city: (carrierPayload.recipient as Record<string, unknown> | undefined)?.city ?? null,
      zip: (carrierPayload.recipient as Record<string, unknown> | undefined)?.zip ?? null,
      province: (carrierPayload.recipient as Record<string, unknown> | undefined)?.province ?? null,
    },
    parcels: decisionOutput.items.map((it, idx) => ({
      line: idx + 1,
      description: it.description,
      hs_code: it.hs_code,
      hs_status: it.hs_status,
      country_of_origin: it.country_of_origin,
      quantity: it.quantity,
      unit_price: it.unit_price,
      total_value: it.total_line_value,
      weight_kg: (it as unknown as Record<string, unknown>).gross_weight ?? (it as unknown as Record<string, unknown>).net_weight ?? null,
      unit_of_measure: (it as unknown as Record<string, unknown>).unit_of_measure ?? "pcs",
    })),
    compliance: {
      confidence: decisionOutput.confidence,
      status: decisionOutput.status,
      flags: (decisionOutput.flags ?? []).map((f) => ({ severity: f.severity, field: f.field, title: f.title, fix: f.fix, source: f.source, link: f.link })),
      restricted_hits: (audit.restrictedHits as unknown[]) ?? (output.restricted_hits as unknown[]) ?? [],
      audit_trail: {
        workflow: audit.workflowId ?? audit.interfazeWorkflow ?? "local",
        runId: audit.runId ?? audit.interfazeRunId ?? null,
        ruleIds: audit.ruleIds ?? [],
        steps: audit.steps ?? [],
      },
    },
    clearance_instructions: {
      vat_mode: (output.buyer_country as string | null)?.toLowerCase().includes("kingdom") ? "UK £135 threshold: VAT at checkout ≤£135, at import >£135" : "Use IOSS if ≤€150 to EU",
      battery_declaration_required: ((audit.restrictedHits as Array<{ category: string }> | undefined) ?? []).some((h) => h.category === "batteries"),
    },
  };

  if (opts.format === "easyship") {
    return {
      meta: { format: "easyship", version: "2024-10" },
      easyship: {
        order_reference: base.reference,
        incoterms: base.shipment.incoterms,
        currency: base.shipment.currency,
        insurance: false,
        parcels: base.parcels.map((p) => ({
          description: p.description,
          hs_code: p.hs_code?.replace(/[.\s]/g, "") ?? null,
          origin_country: p.country_of_origin,
          quantity: Number(p.quantity) || 1,
          declared_value: Number(String(p.total_value ?? p.unit_price ?? 0).replace(/[^0-9.]/g, "")) || 0,
          weight: p.weight_kg ? Number(p.weight_kg) : null,
        })),
        destination: base.consignee,
        customs: { ...base.compliance },
      },
    };
  }

  if (opts.format === "dhl") {
    return {
      meta: { format: "dhl-express", version: "myDHL-API" },
      dhl: {
        shipmentReference: base.reference,
        incoterm: base.shipment.incoterms,
        customsValue: base.shipment.declared_value,
        currency: base.shipment.currency,
        consignee: base.consignee,
        lineItems: base.parcels.map((p) => ({
          commodityCode: p.hs_code?.replace(/[.\s]/g, "") ?? "",
          description: p.description,
          originCountry: p.country_of_origin,
          quantity: p.quantity,
          unitValue: p.unit_price,
          netWeight: p.weight_kg,
        })),
        complianceSnapshot: base.compliance,
      },
    };
  }

  return { meta: { format: "generic", version: "clearship-1.0" }, ...base };
}
