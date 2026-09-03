import { prisma } from "@/lib/db";

export const DEMO_ALERTS = [
  {
    hsCode: "6109.10",
    lane: "IN_US",
    alertType: "tariff_change",
    severity: "critical",
    title: "Section 301 tariff rate changed for HS 6109.10 (Cotton knit shirts)",
    body: "The US has updated the tariff rate for cotton knit shirts. Review your declared values and pricing before your next shipment.",
  },
  {
    hsCode: "8471.30",
    lane: "IN_UK",
    alertType: "regulation_update",
    severity: "warning",
    title: "UK HMRC updated commodity code guidance for laptops/tablets (HS 8471)",
    body: "HMRC updated classification guidance for portable computing devices. Make sure product descriptions include screen size and primary function.",
  },
  {
    hsCode: "7113.19",
    lane: "IN_EU",
    alertType: "new_adcvd",
    severity: "warning",
    title: "New EU origin documentation requirement for precious metal jewellery",
    body: "The EU now requires stronger proof of origin for gold and silver jewellery from India. Add certificate of origin before dispatch.",
  },
];

export async function seedDemoAlerts(userId: string) {
  const existing = await prisma.tariffAlert.count({ where: { userId } });
  if (existing > 0) return;

  for (const alert of DEMO_ALERTS) {
    const product = await prisma.product.upsert({
      where: { userId_sku: { userId, sku: `DEMO-${alert.hsCode.replace(/[.\s]/g, "")}` } },
      update: {},
      create: {
        userId,
        sku: `DEMO-${alert.hsCode.replace(/[.\s]/g, "")}`,
        name: alert.title.split("(")[0].replace("Section 301 tariff rate changed for HS", "Cotton knit shirts").trim(),
        customsDescription: alert.body.slice(0, 180),
        hsCode: alert.hsCode.replace(/[.\s]/g, ""),
        countryOfOrigin: alert.lane.startsWith("IN") ? "India" : "China",
        defaultLane: alert.lane,
        confidenceNote: "Demo alert for onboarding.",
      },
    });

    await prisma.tariffAlert.create({
      data: {
        userId,
        skuId: product.id,
        hsCode: alert.hsCode,
        alertType: alert.alertType,
        title: alert.title,
        body: alert.body,
        lane: alert.lane,
        severity: alert.severity,
      },
    });
  }
}
