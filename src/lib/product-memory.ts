import { Product } from "@prisma/client";
import { ExtractedTradeDocument } from "@/lib/validators";

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findMatchingProduct(description: string, products: Product[]) {
  const normalizedDescription = normalize(description);
  return products.find((product) => {
    const sku = normalize(product.sku);
    const name = normalize(product.name);
    return Boolean(
      (sku && normalizedDescription.includes(sku)) ||
      (name && normalizedDescription.includes(name)) ||
      name.split(" ").filter(Boolean).some((token) => token.length > 4 && normalizedDescription.includes(token)),
    );
  });
}

export function applyProductMemory(data: ExtractedTradeDocument, products: Product[]) {
  if (!products.length || !data.items?.length) return data;

  const flags = [...(data.flags ?? [])];
  data.items = data.items.map((item, index) => {
    const product = findMatchingProduct(item.description, products);
    if (!product) return item;

    const nextItem = { ...item };
    const incomingHs = item.hs_code?.replace(/[.\s]/g, "");
    if (!incomingHs) {
      nextItem.hs_code = product.hsCode;
      nextItem.hs_status = "valid";
      flags.push({
        severity: "info",
        field: `items[${index}].hs_code`,
        title: `HS code filled from SKU memory: ${product.sku}`,
        fix: `Using saved product rule ${product.hsCode}. Verify if the product changed.`,
      });
    } else if (incomingHs !== product.hsCode) {
      flags.push({
        severity: "warning",
        field: `items[${index}].hs_code`,
        title: `HS code differs from saved SKU memory: ${product.sku}`,
        fix: `Invoice has ${incomingHs}, but saved product memory uses ${product.hsCode}. Confirm before filing.`,
      });
    }

    if (!item.country_of_origin) {
      nextItem.country_of_origin = product.countryOfOrigin;
      flags.push({
        severity: "info",
        field: `items[${index}].country_of_origin`,
        title: `Origin filled from SKU memory: ${product.sku}`,
        fix: `Using saved origin ${product.countryOfOrigin}.`,
      });
    } else if (normalize(item.country_of_origin) !== normalize(product.countryOfOrigin)) {
      flags.push({
        severity: "warning",
        field: `items[${index}].country_of_origin`,
        title: `Origin differs from saved SKU memory: ${product.sku}`,
        fix: `Invoice says ${item.country_of_origin}, saved product memory says ${product.countryOfOrigin}.`,
      });
    }

    if (normalize(item.description).length < 18) {
      flags.push({
        severity: "warning",
        field: `items[${index}].description`,
        title: `Product description may be too vague: ${product.sku}`,
        fix: `Use customs-safe wording like: ${product.customsDescription}`,
      });
    }

    return nextItem;
  });

  data.flags = flags;
  return data;
}
