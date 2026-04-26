import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const inputArg = process.argv[2];
const inputPath = inputArg
  ? path.resolve(process.cwd(), inputArg)
  : await findLatestExport(path.join(projectRoot, "migration-data"));
const outputPath = path.join(projectRoot, "migration-data", "d1-import.sql");

function sqlString(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlJson(value, fallback) {
  return sqlString(JSON.stringify(value ?? fallback));
}

function normalizeDate(value, fallback = new Date().toISOString()) {
  return value ? String(value) : fallback;
}

async function findLatestExport(dir) {
  const entries = await fs.readdir(dir);
  const exports = entries
    .filter((entry) => entry.startsWith("cloudbase-export-") && entry.endsWith(".json"))
    .sort();

  if (exports.length === 0) {
    throw new Error("未找到 CloudBase 导出文件，请先运行 npm run export:cloudbase。");
  }

  return path.join(dir, exports[exports.length - 1]);
}

function pushInsert(lines, table, columns, values) {
  lines.push(`INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${values.join(", ")});`);
}

const exportData = JSON.parse(await fs.readFile(inputPath, "utf8"));
const collections = exportData.collections ?? {};
const now = new Date().toISOString();
const lines = [
  "BEGIN TRANSACTION;",
  "DELETE FROM confusion_groups;",
  "DELETE FROM pair_codes;",
  "DELETE FROM study_sessions;",
  "DELETE FROM review_logs;",
  "DELETE FROM cards;",
  "DELETE FROM decks;",
  "DELETE FROM devices;",
  "DELETE FROM owners;",
];

for (const owner of collections.owners ?? []) {
  pushInsert(
    lines,
    "owners",
    ["id", "created_at", "updated_at"],
    [sqlString(owner._id), sqlString(normalizeDate(owner.createdAt, now)), sqlString(normalizeDate(owner.updatedAt, owner.createdAt ?? now))],
  );
}

for (const device of collections.devices ?? []) {
  pushInsert(
    lines,
    "devices",
    ["id", "owner_id", "device_id", "device_label", "paired_at", "last_seen_at", "created_at", "updated_at"],
    [
      sqlString(device._id),
      sqlString(device.ownerId),
      sqlString(device.deviceId ?? device._id),
      sqlString(device.deviceLabel ?? "Current Browser"),
      sqlString(device.pairedAt ?? device.createdAt ?? now),
      sqlString(device.lastSeenAt ?? null),
      sqlString(normalizeDate(device.createdAt, now)),
      sqlString(normalizeDate(device.updatedAt, device.createdAt ?? now)),
    ],
  );
}

for (const deck of collections.decks ?? []) {
  pushInsert(
    lines,
    "decks",
    ["id", "owner_id", "name", "description", "tags_json", "created_at", "updated_at", "last_studied_at"],
    [
      sqlString(deck._id),
      sqlString(deck.ownerId),
      sqlString(deck.name),
      sqlString(deck.description ?? ""),
      sqlJson(deck.tags, []),
      sqlString(normalizeDate(deck.createdAt, now)),
      sqlString(normalizeDate(deck.updatedAt, deck.createdAt ?? now)),
      sqlString(deck.lastStudiedAt ?? null),
    ],
  );
}

for (const card of collections.cards ?? []) {
  pushInsert(
    lines,
    "cards",
    [
      "id",
      "owner_id",
      "deck_id",
      "front_text",
      "back_text",
      "phonetic",
      "example_text",
      "note",
      "status",
      "scheduling_json",
      "created_at",
      "updated_at",
    ],
    [
      sqlString(card._id),
      sqlString(card.ownerId),
      sqlString(card.deckId),
      sqlString(card.frontText),
      sqlString(card.backText),
      sqlString(card.phonetic ?? ""),
      sqlString(card.exampleText ?? ""),
      sqlString(card.note ?? ""),
      sqlString(card.status ?? "new"),
      sqlJson(card.scheduling, null),
      sqlString(normalizeDate(card.createdAt, now)),
      sqlString(normalizeDate(card.updatedAt, card.createdAt ?? now)),
    ],
  );
}

for (const review of collections.review_logs ?? []) {
  pushInsert(
    lines,
    "review_logs",
    ["id", "owner_id", "card_id", "deck_id", "reviewed_at", "rating", "before_json", "after_json"],
    [
      sqlString(review._id),
      sqlString(review.ownerId),
      sqlString(review.cardId),
      sqlString(review.deckId),
      sqlString(normalizeDate(review.reviewedAt, now)),
      String(Number(review.rating ?? 0)),
      sqlJson(review.before, null),
      sqlJson(review.after, null),
    ],
  );
}

for (const session of collections.study_sessions ?? []) {
  pushInsert(
    lines,
    "study_sessions",
    [
      "id",
      "owner_id",
      "mode",
      "status",
      "deck_scope",
      "selected_deck_ids_json",
      "queue_counts_json",
      "cards_json",
      "current_index",
      "completed_count",
      "revisit_count",
      "started_at",
      "completed_at",
      "updated_at",
    ],
    [
      sqlString(session._id ?? session.id),
      sqlString(session.ownerId),
      sqlString(session.mode ?? "formal"),
      sqlString(session.status ?? "active"),
      sqlString(session.deckScope ?? "all"),
      sqlJson(session.selectedDeckIds, []),
      sqlJson(session.queueCounts, { review: 0, new: 0 }),
      sqlJson(session.cards, []),
      String(Number(session.currentIndex ?? 0)),
      String(Number(session.completedCount ?? 0)),
      String(Number(session.revisitCount ?? 0)),
      sqlString(normalizeDate(session.startedAt, now)),
      sqlString(session.completedAt ?? null),
      sqlString(normalizeDate(session.updatedAt, session.startedAt ?? now)),
    ],
  );
}

for (const pairCode of collections.pair_codes ?? []) {
  pushInsert(
    lines,
    "pair_codes",
    ["id", "owner_id", "source_device_id", "device_label", "code", "expires_at", "used_at", "created_at", "updated_at"],
    [
      sqlString(pairCode._id),
      sqlString(pairCode.ownerId),
      sqlString(pairCode.sourceDeviceId ?? ""),
      sqlString(pairCode.deviceLabel ?? "My Device"),
      sqlString(pairCode.code),
      sqlString(normalizeDate(pairCode.expiresAt, now)),
      sqlString(pairCode.usedAt ?? null),
      sqlString(normalizeDate(pairCode.createdAt, now)),
      sqlString(normalizeDate(pairCode.updatedAt, pairCode.createdAt ?? now)),
    ],
  );
}

for (const group of collections.confusion_groups ?? []) {
  pushInsert(
    lines,
    "confusion_groups",
    ["id", "owner_id", "source_card_id", "source", "target_card_ids_json", "created_at", "updated_at"],
    [
      sqlString(group._id),
      sqlString(group.ownerId),
      sqlString(group.sourceCardId),
      sqlString(group.source ?? "manual"),
      sqlJson(group.targetCardIds, []),
      sqlString(normalizeDate(group.createdAt, now)),
      sqlString(normalizeDate(group.updatedAt, group.createdAt ?? now)),
    ],
  );
}

lines.push("COMMIT;");
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${lines.join("\n")}\n`);

console.log("D1 import SQL generated.");
console.log(`Input: ${inputPath}`);
console.log(`Output: ${outputPath}`);
console.log("Counts:");
for (const [name, rows] of Object.entries(collections)) {
  console.log(`- ${name}: ${Array.isArray(rows) ? rows.length : 0}`);
}
