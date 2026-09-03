import { createHash } from "crypto";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { extractWithAi } from "@/lib/ai";
import { detectFileType, extractTextFromUpload } from "@/lib/pdf";
import { getPlan } from "@/lib/plans";
import { applyProductMemory } from "@/lib/product-memory";
import { applyLaneRules, estimateLandedCost, inferLane, TradeLane } from "@/lib/lane-rules";
import { extractRuleFieldsFromText, ruleFlagsToDocumentFlags, runRuleEngine } from "@/lib/rule-engine";
import { validateTradeDocument } from "@/lib/validators";

export async function ensureStorage(userId: string, plan: string) {
  const limits = getPlan(plan);
  return prisma.userStorage.upsert({
    where: { userId },
    update: { storageLimitBytes: BigInt(limits.storageBytes) },
    create: {
      userId,
      storageLimitBytes: BigInt(limits.storageBytes),
    },
  });
}

export async function createAndProcessDocument(userId: string, originalName: string, buffer: Buffer, selectedLane?: TradeLane) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { storage: true } });
  const limits = getPlan(user.plan);
  const storage = user.storage ?? (await ensureStorage(user.id, user.plan));

  if (buffer.length > 20 * 1024 * 1024) {
    throw new Error("File too large. Maximum size is 20MB per document.");
  }

  if (user.documentsUsedThisMonth >= limits.docsPerMonth || storage.documentCountThisMonth >= limits.docsPerMonth) {
    throw new Error("Monthly document limit reached. Upgrade to continue.");
  }

  if (Number(storage.totalBytesUsed) + buffer.length > limits.storageBytes) {
    throw new Error("Storage limit reached. Upgrade or delete old documents.");
  }

  const fileType = detectFileType(buffer);
  if (!fileType) {
    throw new Error("Unsupported file type. Upload a PDF, PNG, or JPG.");
  }

  const checksumMd5 = createHash("md5").update(buffer).digest("hex");
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${randomUUID()}_${safeName}`;
  const uploadRoot = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
  const userDir = path.join(uploadRoot, userId);
  await mkdir(userDir, { recursive: true });
  const filePath = path.join(userDir, filename);
  await writeFile(filePath, buffer);

  const expiresAt = new Date(Date.now() + limits.retentionDays * 24 * 60 * 60 * 1000);
  const document = await prisma.document.create({
    data: {
      userId,
      filename,
      originalFilename: originalName,
      filePath,
      fileSizeBytes: buffer.length,
      fileType,
      checksumMd5,
      expiresAt,
      processingStartedAt: new Date(),
    },
  });

  const started = performance.now();
  try {
    const text = await extractTextFromUpload(buffer, fileType);
    const deterministic = extractRuleFieldsFromText(text);
    const preCheck = runRuleEngine(deterministic);
    console.info("[TradeDocAI] rule engine pre-check", {
      documentId: document.id,
      score: preCheck.score,
      status: preCheck.status,
      flags: preCheck.flags.length,
    });
    const extracted = preCheck.score >= 90 && preCheck.flags.every((flag) => flag.severity !== "critical")
      ? {
          ...deterministic,
          confidence: preCheck.score,
          flags: ruleFlagsToDocumentFlags(preCheck.flags),
          rule_score: preCheck.score,
          rule_status: preCheck.status,
          passing_checks: preCheck.passingChecks,
        }
      : await extractWithAi(text, preCheck.flags);
    extracted.flags = [...ruleFlagsToDocumentFlags(preCheck.flags), ...(extracted.flags ?? [])];
    extracted.rule_score = preCheck.score;
    extracted.rule_status = preCheck.status;
    extracted.passing_checks = preCheck.passingChecks;
    const products = await prisma.product.findMany({ where: { userId } });
    const withProductMemory = applyProductMemory(extracted, products);
    const withLaneRules = applyLaneRules(withProductMemory, selectedLane);
    const validated = validateTradeDocument(withLaneRules);
    const lane = selectedLane ?? inferLane(validated);
    const landedCost = estimateLandedCost(validated, lane);
    const enriched = { ...validated, trade_lane: lane, landed_cost: landedCost };
    const status = validated.status === "ready_to_ship" ? "ready" : validated.status === "critical_issues" ? "critical" : "needs_review";

    await prisma.$transaction([
      prisma.document.update({
        where: { id: document.id },
        data: {
          documentType: validated.document_type ?? "unknown",
          status,
          extractedDataJson: JSON.stringify(enriched),
          validationFlagsJson: JSON.stringify(validated.flags ?? []),
          confidenceScore: Number(validated.confidence ?? 0),
          processingTimeMs: Math.round(performance.now() - started),
          processingCompletedAt: new Date(),
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { documentsUsedThisMonth: { increment: 1 } },
      }),
      prisma.userStorage.update({
        where: { userId },
        data: {
          totalBytesUsed: { increment: BigInt(buffer.length) },
          documentCountTotal: { increment: 1 },
          documentCountThisMonth: { increment: 1 },
        },
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document processing failed";
    const fallback = {
      status: "critical_issues",
      confidence: 0,
      document_type: "unknown",
      items: [],
      flags: [
        {
          severity: "error",
          field: "document",
          title: "Could not process document",
          fix: message,
        },
      ],
    };

    await prisma.document.update({
      where: { id: document.id },
      data: {
        status: "critical",
        extractedDataJson: JSON.stringify(fallback),
        validationFlagsJson: JSON.stringify(fallback.flags),
        processingTimeMs: Math.round(performance.now() - started),
        processingCompletedAt: new Date(),
      },
    });
  }

  return document.id;
}
