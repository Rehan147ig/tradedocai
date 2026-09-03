import { PrismaClient } from "@prisma/client";
import { SEED_RULES } from "../src/lib/restricted";

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding ${SEED_RULES.length} restricted rules...`);
  for (const r of SEED_RULES) {
    await prisma.restrictedRule.create({ data: r });
  }
  console.log("Done. Rules:", await prisma.restrictedRule.count());
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
