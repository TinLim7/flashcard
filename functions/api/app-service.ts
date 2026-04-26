// @ts-nocheck

const DAILY_NEW_LIMIT = 25;
const SESSION_BATCH_SIZE = 50;
const STAGE_INTERVAL_MINUTES = [10, 24 * 60, 2 * 24 * 60, 4 * 24 * 60, 7 * 24 * 60, 15 * 24 * 60, 30 * 24 * 60];
const STAGE_SCHEDULED_DAYS = [0, 1, 2, 4, 7, 15, 30];
const MAX_STAGE_INDEX = STAGE_INTERVAL_MINUTES.length - 1;

function ok(data, headers = {}) {
  return Response.json({ ok: true, data }, { headers });
}

function fail(code, message, extra = {}) {
  return Response.json({ ok: false, code, message, ...extra }, { status: code === "INTERNAL_ERROR" ? 500 : 200 });
}

function withResponseHeaders(data, headers = {}) {
  return { __responseHeaders: headers, data };
}

class AppError extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.retryable = retryable;
  }
}

function assert(condition, code, message) {
  if (!condition) {
    throw new AppError(code, message);
  }
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
}

function safeJsonParse(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function json(value) {
  return JSON.stringify(value ?? null);
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function arrayBufferToBase64(buffer) {
  return bytesToBase64(new Uint8Array(buffer));
}

async function all(db, sql, params = []) {
  const result = await db.prepare(sql).bind(...params).all();
  return result.results ?? [];
}

async function first(db, sql, params = []) {
  return (await db.prepare(sql).bind(...params).first()) ?? null;
}

async function run(db, sql, params = []) {
  return db.prepare(sql).bind(...params).run();
}

function getShanghaiDayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getStartOfShanghaiDay(value = new Date()) {
  return new Date(`${getShanghaiDayKey(value)}T00:00:00+08:00`);
}

function isSameShanghaiDay(left, right = new Date()) {
  if (!left) {
    return false;
  }

  return getShanghaiDayKey(left) === getShanghaiDayKey(right);
}

function formatDayLabel(date) {
  return new Intl.DateTimeFormat("zh-CN", { weekday: "short", timeZone: "Asia/Shanghai" })
    .format(date)
    .replace("周", "");
}

function buildDefaultScheduling(nowIso) {
  return {
    state: "new",
    dueAt: nowIso,
    stability: null,
    difficulty: null,
    retrievability: null,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
    stageIndex: -1,
    introducedAt: null,
    lastRating: null,
    needsSameDayPass: false,
  };
}

function clampStageIndex(stageIndex) {
  if (!Number.isFinite(Number(stageIndex))) {
    return -1;
  }

  return Math.min(Math.max(Number(stageIndex), -1), MAX_STAGE_INDEX);
}

function getClosestStageIndex(scheduledDays = 0) {
  let matchedStageIndex = 0;
  let matchedDistance = Number.POSITIVE_INFINITY;

  STAGE_SCHEDULED_DAYS.forEach((stageDays, stageIndex) => {
    const distance = Math.abs(stageDays - scheduledDays);

    if (distance < matchedDistance) {
      matchedStageIndex = stageIndex;
      matchedDistance = distance;
    }
  });

  return matchedStageIndex;
}

function normalizeScheduling(scheduling, status = "new") {
  const base = {
    ...buildDefaultScheduling(new Date().toISOString()),
    ...(scheduling ?? {}),
  };

  let stageIndex = base.stageIndex;

  if (!Number.isFinite(Number(stageIndex))) {
    if (status === "new") {
      stageIndex = -1;
    } else if (status === "learning" || status === "relearning") {
      stageIndex = 0;
    } else {
      stageIndex = getClosestStageIndex(base.scheduledDays ?? 0);
    }
  }

  return {
    ...base,
    stageIndex: clampStageIndex(stageIndex),
    lastRating: [1, 2, 3, 4].includes(Number(base.lastRating)) ? Number(base.lastRating) : null,
    needsSameDayPass: Boolean(base.needsSameDayPass),
  };
}

function getStageScheduledDays(stageIndex) {
  if (stageIndex < 0) {
    return 0;
  }

  return STAGE_SCHEDULED_DAYS[clampStageIndex(stageIndex)];
}

function getStagePreview(stageIndex) {
  const normalizedStageIndex = clampStageIndex(stageIndex);

  if (normalizedStageIndex === 0) {
    return "10 分钟后";
  }

  if (normalizedStageIndex === 1) {
    return "明天";
  }

  return `${getStageScheduledDays(normalizedStageIndex)} 天后`;
}

function addMinutes(now, minutes) {
  return new Date(now.getTime() + minutes * 60 * 1000);
}

function addDays(baseDate, days) {
  return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
}

function getDueAtForStage(stageIndex, now) {
  const normalizedStageIndex = clampStageIndex(stageIndex);

  if (normalizedStageIndex <= 0) {
    return addMinutes(now, STAGE_INTERVAL_MINUTES[0]);
  }

  return addDays(getStartOfShanghaiDay(now), getStageScheduledDays(normalizedStageIndex));
}

function getEffectiveDueAt(scheduling, status = "new") {
  const normalizedScheduling = normalizeScheduling(scheduling, status);

  if (normalizedScheduling.stageIndex < 0 || !normalizedScheduling.lastReviewedAt) {
    return normalizedScheduling.dueAt ?? null;
  }

  return getDueAtForStage(normalizedScheduling.stageIndex, new Date(normalizedScheduling.lastReviewedAt)).toISOString();
}

function buildSchedulingFromStage(currentScheduling, stageIndex, now, patch = {}) {
  const normalizedStageIndex = clampStageIndex(stageIndex);
  const dueAt = getDueAtForStage(normalizedStageIndex, now);

  return {
    ...currentScheduling,
    state: normalizedStageIndex === 0 ? "learning" : "review",
    dueAt: dueAt.toISOString(),
    stability: null,
    difficulty: null,
    retrievability: null,
    elapsedDays: currentScheduling.lastReviewedAt
      ? Math.max(Math.round((now.getTime() - new Date(currentScheduling.lastReviewedAt).getTime()) / 86400000), 0)
      : 0,
    scheduledDays: getStageScheduledDays(normalizedStageIndex),
    reps: (currentScheduling.reps ?? 0) + 1,
    lapses: currentScheduling.lapses ?? 0,
    lastReviewedAt: now.toISOString(),
    stageIndex: normalizedStageIndex,
    lastRating: patch.lastRating ?? currentScheduling.lastRating ?? null,
    needsSameDayPass: patch.needsSameDayPass ?? false,
    introducedAt: patch.introducedAt ?? currentScheduling.introducedAt ?? null,
  };
}

function isSchedulingReadyForReview(status, scheduling, now = new Date()) {
  if (status === "new") {
    return false;
  }

  const normalizedScheduling = normalizeScheduling(scheduling, status);

  if (normalizedScheduling.needsSameDayPass) {
    return true;
  }

  const effectiveDueAt = getEffectiveDueAt(normalizedScheduling, status);
  return effectiveDueAt ? new Date(effectiveDueAt).getTime() <= now.getTime() : false;
}

function hasBeenIntroducedToday(scheduling, now = new Date()) {
  return isSameShanghaiDay(normalizeScheduling(scheduling, "new").introducedAt, now);
}

function scheduleReview(scheduling, rating, status = "new") {
  const now = new Date();
  const current = normalizeScheduling(scheduling, status);
  const introducedAt = current.introducedAt ?? now.toISOString();

  if (rating === 1 || rating === 2) {
    const nextScheduling = buildSchedulingFromStage(current, 0, now, {
      introducedAt,
      lastRating: rating,
      needsSameDayPass: true,
    });

    if (rating === 1) {
      nextScheduling.lapses += 1;
    }

    return {
      preview: getStagePreview(0),
      scheduling: nextScheduling,
      sameDayRequeueRequired: true,
      sameDayRequeueOffset: rating === 1 ? 4 : 8,
    };
  }

  let nextStageIndex = 1;

  if (current.needsSameDayPass || current.stageIndex < 0) {
    nextStageIndex = rating === 4 ? 2 : 1;
  } else if (rating === 3) {
    nextStageIndex = current.stageIndex + 1;
  } else {
    nextStageIndex = current.stageIndex + 2;
  }

  const nextScheduling = buildSchedulingFromStage(current, nextStageIndex, now, {
    introducedAt,
    lastRating: rating,
    needsSameDayPass: false,
  });

  return {
    preview: getStagePreview(nextScheduling.stageIndex),
    scheduling: nextScheduling,
    sameDayRequeueRequired: false,
    sameDayRequeueOffset: 0,
  };
}

function toDeckDoc(row) {
  if (!row) {
    return null;
  }

  return {
    _id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description ?? "",
    tags: safeJsonParse(row.tags_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastStudiedAt: row.last_studied_at ?? null,
  };
}

function toCardDoc(row) {
  if (!row) {
    return null;
  }

  return {
    _id: row.id,
    ownerId: row.owner_id,
    deckId: row.deck_id,
    frontText: row.front_text,
    backText: row.back_text,
    phonetic: row.phonetic ?? "",
    exampleText: row.example_text ?? "",
    note: row.note ?? "",
    status: row.status ?? "new",
    scheduling: safeJsonParse(row.scheduling_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toReviewLogDoc(row) {
  return {
    _id: row.id,
    ownerId: row.owner_id,
    cardId: row.card_id,
    deckId: row.deck_id,
    reviewedAt: row.reviewed_at,
    rating: Number(row.rating),
    before: safeJsonParse(row.before_json, null),
    after: safeJsonParse(row.after_json, null),
  };
}

function toSessionDoc(row) {
  if (!row) {
    return null;
  }

  return {
    _id: row.id,
    id: row.id,
    ownerId: row.owner_id,
    mode: row.mode,
    status: row.status,
    deckScope: row.deck_scope,
    selectedDeckIds: safeJsonParse(row.selected_deck_ids_json, []),
    queueCounts: safeJsonParse(row.queue_counts_json, { review: 0, new: 0 }),
    cards: safeJsonParse(row.cards_json, []),
    currentIndex: Number(row.current_index ?? 0),
    completedCount: Number(row.completed_count ?? 0),
    revisitCount: Number(row.revisit_count ?? 0),
    startedAt: row.started_at,
    completedAt: row.completed_at ?? null,
    updatedAt: row.updated_at,
  };
}

function toDeckView(deck, cards) {
  const deckCards = cards.filter((card) => card.deckId === deck._id);
  const dueCount = deckCards.filter((card) => isSchedulingReadyForReview(card.status, card.scheduling)).length;
  const newCount = deckCards.filter((card) => card.status === "new").length;

  return {
    id: deck._id,
    name: deck.name,
    description: deck.description,
    dueCount,
    newCount,
    totalCount: deckCards.length,
    lastStudiedLabel: deck.lastStudiedAt ? "最近学习" : "从未学习",
    tags: deck.tags ?? [],
  };
}

function toCardView(card) {
  const normalizedScheduling = normalizeScheduling(card.scheduling, card.status);

  return {
    id: card._id,
    deckId: card.deckId,
    front: card.frontText,
    back: card.backText,
    phonetic: card.phonetic || undefined,
    example: card.exampleText || undefined,
    note: card.note || undefined,
    status: card.status,
    nextDueAt: getEffectiveDueAt(normalizedScheduling, card.status),
    stageIndex: normalizedScheduling.stageIndex,
    introducedAt: normalizedScheduling.introducedAt,
    lastRating: normalizedScheduling.lastRating ? String(normalizedScheduling.lastRating) : null,
    needsSameDayPass: normalizedScheduling.needsSameDayPass,
  };
}

function toSessionCard(card, position, queue) {
  return {
    ...toCardView(card),
    queue,
    position,
  };
}

async function listDecksByOwner(db, ownerId) {
  return (await all(db, "SELECT * FROM decks WHERE owner_id = ? ORDER BY updated_at DESC", [ownerId])).map(toDeckDoc);
}

async function listCardsByOwner(db, ownerId) {
  return (await all(db, "SELECT * FROM cards WHERE owner_id = ? ORDER BY updated_at DESC", [ownerId])).map(toCardDoc);
}

async function listCardsByDeck(db, ownerId, deckId) {
  return (await all(db, "SELECT * FROM cards WHERE owner_id = ? AND deck_id = ? ORDER BY updated_at DESC", [ownerId, deckId])).map(toCardDoc);
}

async function getDeckById(db, ownerId, deckId) {
  return toDeckDoc(await first(db, "SELECT * FROM decks WHERE owner_id = ? AND id = ?", [ownerId, deckId]));
}

async function getDeckByName(db, ownerId, name) {
  return toDeckDoc(await first(db, "SELECT * FROM decks WHERE owner_id = ? AND name = ?", [ownerId, name]));
}

async function getCardById(db, ownerId, cardId) {
  return toCardDoc(await first(db, "SELECT * FROM cards WHERE owner_id = ? AND id = ?", [ownerId, cardId]));
}

async function listReviewLogsByOwner(db, ownerId) {
  return (await all(db, "SELECT * FROM review_logs WHERE owner_id = ? ORDER BY reviewed_at DESC", [ownerId])).map(toReviewLogDoc);
}

async function getStudySessionById(db, ownerId, sessionId) {
  return toSessionDoc(await first(db, "SELECT * FROM study_sessions WHERE owner_id = ? AND id = ?", [ownerId, sessionId]));
}

async function getLatestActiveFormalSession(db, ownerId) {
  const sessions = (await all(
    db,
    "SELECT * FROM study_sessions WHERE owner_id = ? AND mode = 'formal' AND status = 'active' ORDER BY updated_at DESC LIMIT 5",
    [ownerId],
  )).map(toSessionDoc);

  return sessions.find((session) => {
    const cards = Array.isArray(session.cards) ? session.cards : [];
    const currentIndex = Number(session.currentIndex ?? 0);
    return cards.length > 0 && currentIndex < cards.length;
  }) ?? null;
}

async function getDeckMaterial(db, ownerId) {
  const [decks, cards, reviewLogs] = await Promise.all([
    listDecksByOwner(db, ownerId),
    listCardsByOwner(db, ownerId),
    listReviewLogsByOwner(db, ownerId),
  ]);

  return { decks, cards, reviewLogs };
}

function getClientContext(payload) {
  const clientContext = payload.clientContext ?? {};
  return {
    uid: clientContext.uid ?? "single-user",
    deviceId: clientContext.deviceId ?? "single-user-web",
    deviceLabel: clientContext.deviceLabel ?? "Current Browser",
    ownerId: clientContext.ownerId ?? "",
  };
}

function requireClientContext(payload) {
  const clientContext = getClientContext(payload);
  assert(clientContext.ownerId, "UNAUTHENTICATED", "缺少 owner 标识。");
  return clientContext;
}

async function ensureContext({ db, payload }) {
  const deviceId = String(payload.deviceId ?? "").trim() || "single-user-web";
  const deviceLabel = String(payload.deviceLabel ?? "").trim() || "Current Browser";
  const now = new Date().toISOString();

  const existingDevice = await first(db, "SELECT * FROM devices WHERE device_id = ?", [deviceId]);

  let ownerId;

  if (existingDevice) {
    ownerId = existingDevice.owner_id;
    await run(db, "UPDATE devices SET device_label = ?, last_seen_at = ?, updated_at = ? WHERE id = ?", [
      deviceLabel, now, now, existingDevice.id,
    ]);
  } else {
    ownerId = randomId("owner");
    await run(db, "INSERT INTO owners (id, created_at, updated_at) VALUES (?, ?, ?)", [ownerId, now, now]);
    await run(
      db,
      "INSERT INTO devices (id, owner_id, device_id, device_label, paired_at, last_seen_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [randomId("device"), ownerId, deviceId, deviceLabel, now, now, now, now],
    );
  }

  return { uid: deviceId, ownerId, deviceId, deviceLabel };
}

function computeStreak(reviewLogs) {
  const reviewedDays = new Set(reviewLogs.map((log) => getShanghaiDayKey(log.reviewedAt)));
  let streak = 0;
  const cursor = getStartOfShanghaiDay(new Date());

  while (reviewedDays.has(getShanghaiDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function buildWeeklyActivity(reviewLogs) {
  const today = getStartOfShanghaiDay(new Date());
  const counts = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);
    const count = reviewLogs.filter((log) => {
      const reviewedAt = new Date(log.reviewedAt);
      return reviewedAt >= day && reviewedAt < nextDay;
    }).length;

    counts.push({ day: formatDayLabel(day), count });
  }

  return counts;
}

function buildLowRatingStats(reviewLogs) {
  const grouped = new Map();

  reviewLogs
    .filter((log) => Number(log.rating) <= 2)
    .forEach((log) => {
      const current = grouped.get(log.cardId) ?? {
        cardId: log.cardId,
        lowRatingCount: 0,
        lastReviewedAt: null,
      };

      grouped.set(log.cardId, {
        ...current,
        lowRatingCount: current.lowRatingCount + 1,
        lastReviewedAt:
          current.lastReviewedAt && current.lastReviewedAt > log.reviewedAt
            ? current.lastReviewedAt
            : log.reviewedAt,
      });
    });

  return grouped;
}

function buildWeakCards({ reviewLogs, cardsById, decksById }) {
  return [...buildLowRatingStats(reviewLogs).values()]
    .map((item) => {
      const card = cardsById.get(item.cardId);
      if (!card) {
        return null;
      }

      const deck = decksById.get(card.deckId);
      return {
        cardId: item.cardId,
        front: card.frontText,
        deckName: deck?.name ?? "未命名牌组",
        lowRatingCount: item.lowRatingCount,
        lastReviewedAt: item.lastReviewedAt,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.lowRatingCount - left.lowRatingCount)
    .slice(0, 5);
}

function buildHighlights({ reviewLogs, dueCount, newCount, deckCount }) {
  const ratings = reviewLogs.map((item) => Number(item.rating)).filter((value) => Number.isFinite(value));
  const avgRating = ratings.length > 0 ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0;
  const passRate = ratings.length > 0 ? Math.round((ratings.filter((value) => value >= 3).length / ratings.length) * 100) : 0;

  return [
    { label: "最近 7 日评分", value: ratings.length > 0 ? avgRating.toFixed(1) : "0.0", hint: "按 review_logs 平均分计算" },
    { label: "达标率", value: `${passRate}%`, hint: "评分为 3 / 4 视为达标" },
    { label: "现在可复习", value: String(dueCount), hint: "基于 cards.scheduling.dueAt 统计" },
    { label: "牌组数", value: String(deckCount), hint: `今日新词剩余 ${newCount} 张` },
  ];
}

async function getHomePageData({ db, payload }) {
  const clientContext = requireClientContext(payload);
  const { decks, cards, reviewLogs } = await getDeckMaterial(db, clientContext.ownerId);
  const deckViews = decks.map((deck) => toDeckView(deck, cards));
  const dueCount = deckViews.reduce((sum, deck) => sum + deck.dueCount, 0);
  const introducedTodayCount = cards.filter((card) => hasBeenIntroducedToday(card.scheduling)).length;
  const todayReviewedCount = new Set(reviewLogs.filter((log) => isSameShanghaiDay(log.reviewedAt)).map((log) => log.cardId)).size;
  const remainingNewCount = dueCount > 0 ? 0 : Math.max(DAILY_NEW_LIMIT - introducedTodayCount, 0);
  const completedToday = reviewLogs.filter((log) => isSameShanghaiDay(log.reviewedAt)).length;

  return {
    stats: {
      reviews: dueCount,
      newCards: remainingNewCount,
      completed: completedToday,
      total: dueCount + remainingNewCount + completedToday,
      streak: computeStreak(reviewLogs),
      estMinutes: Math.max(Math.ceil((dueCount + remainingNewCount) / 5), 5),
      todayNewLimit: DAILY_NEW_LIMIT,
      todayNewIntroduced: introducedTodayCount,
      todayReviewedCount,
    },
    recentDecks: deckViews.slice(0, 3),
  };
}

async function getStudyEntryData(args) {
  const clientContext = requireClientContext(args.payload);
  const homeData = await getHomePageData(args);
  const { decks, cards } = await getDeckMaterial(args.db, clientContext.ownerId);
  return { stats: homeData.stats, decks: decks.map((deck) => toDeckView(deck, cards)) };
}

async function getDeckListData({ db, payload }) {
  const clientContext = requireClientContext(payload);
  const { decks, cards } = await getDeckMaterial(db, clientContext.ownerId);
  return { decks: decks.map((deck) => toDeckView(deck, cards)) };
}

async function getDeckDetailData({ db, payload }) {
  const clientContext = requireClientContext(payload);
  assert(payload.deckId, "INVALID_INPUT", "缺少 deckId。");
  const [deck, cards] = await Promise.all([
    getDeckById(db, clientContext.ownerId, payload.deckId),
    listCardsByDeck(db, clientContext.ownerId, payload.deckId),
  ]);
  return { deck: deck ? toDeckView(deck, cards) : null, cards: cards.map((card) => toCardView(card)) };
}

async function getAllCards({ db, payload }) {
  const clientContext = requireClientContext(payload);
  return (await listCardsByOwner(db, clientContext.ownerId)).map((card) => toCardView(card));
}

async function createDeck({ db, payload }) {
  const clientContext = requireClientContext(payload);
  const name = String(payload.name ?? "").trim();
  const description = String(payload.description ?? "").trim();
  const tags = Array.isArray(payload.tags) ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean) : [];
  assert(name, "INVALID_INPUT", "牌组名称不能为空。");
  const now = new Date().toISOString();
  const deckId = randomId("deck");

  await run(db, "INSERT INTO decks (id, owner_id, name, description, tags_json, created_at, updated_at, last_studied_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
    deckId,
    clientContext.ownerId,
    name,
    description,
    json(tags),
    now,
    now,
    null,
  ]);

  const deck = await getDeckById(db, clientContext.ownerId, deckId);
  return { deck: toDeckView(deck, []) };
}

async function createCard({ db, payload }) {
  const clientContext = requireClientContext(payload);
  const deckId = String(payload.deckId ?? "").trim();
  const front = String(payload.front ?? "").trim();
  const back = String(payload.back ?? "").trim();
  assert(deckId, "INVALID_INPUT", "缺少 deckId。");
  assert(front, "INVALID_INPUT", "英文正面不能为空。");
  assert(back, "INVALID_INPUT", "中文释义不能为空。");
  assert(await getDeckById(db, clientContext.ownerId, deckId), "NOT_FOUND", "牌组不存在。");
  const now = new Date().toISOString();
  const cardId = randomId("card");

  await run(
    db,
    "INSERT INTO cards (id, owner_id, deck_id, front_text, back_text, phonetic, example_text, note, status, scheduling_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      cardId,
      clientContext.ownerId,
      deckId,
      front,
      back,
      String(payload.phonetic ?? "").trim(),
      String(payload.example ?? "").trim(),
      String(payload.note ?? "").trim(),
      "new",
      json(buildDefaultScheduling(now)),
      now,
      now,
    ],
  );
  await run(db, "UPDATE decks SET updated_at = ? WHERE id = ?", [now, deckId]);
  return { card: toCardView(await getCardById(db, clientContext.ownerId, cardId)) };
}

async function deleteDeck({ db, payload }) {
  const clientContext = requireClientContext(payload);
  const deckId = String(payload.deckId ?? "").trim();
  assert(deckId, "INVALID_INPUT", "缺少 deckId。");
  assert(await getDeckById(db, clientContext.ownerId, deckId), "NOT_FOUND", "牌组不存在。");
  await run(db, "DELETE FROM cards WHERE owner_id = ? AND deck_id = ?", [clientContext.ownerId, deckId]);
  await run(db, "DELETE FROM review_logs WHERE owner_id = ? AND deck_id = ?", [clientContext.ownerId, deckId]);
  await run(db, "DELETE FROM decks WHERE owner_id = ? AND id = ?", [clientContext.ownerId, deckId]);
  return { deleted: true, deckId };
}

function normalizeImportKey(deckName, frontText) {
  return `${String(deckName ?? "").trim().toLowerCase()}::${String(frontText ?? "").trim().toLowerCase()}`;
}

async function importCsv({ db, payload }) {
  const clientContext = requireClientContext(payload);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const existingDecks = await listDecksByOwner(db, clientContext.ownerId);
  const existingCards = await listCardsByOwner(db, clientContext.ownerId);
  const deckByName = new Map(existingDecks.map((deck) => [deck.name, deck]));
  const existingKeys = new Set(
    existingCards.map((card) => {
      const deck = existingDecks.find((item) => item._id === card.deckId);
      return normalizeImportKey(deck?.name ?? "", card.frontText);
    }),
  );
  const batchKeys = new Set();
  const failures = [];
  let createdCount = 0;

  for (const row of rows) {
    const frontText = String(row.front_text ?? "").trim();
    const backText = String(row.back_text ?? "").trim();
    const rowNumber = Number(row.rowNumber ?? createdCount + failures.length + 1);

    if (!frontText || !backText) {
      failures.push({ rowNumber, errorCode: "missing_required_field", message: "front_text 和 back_text 不能为空。" });
      continue;
    }

    const deckName = String(row.deck_name || payload.defaultDeckName || "导入词库").trim();
    const dedupeKey = normalizeImportKey(deckName, frontText);

    if (batchKeys.has(dedupeKey) || existingKeys.has(dedupeKey)) {
      failures.push({ rowNumber, errorCode: "duplicate_card", message: `词条已存在: ${frontText}` });
      continue;
    }

    batchKeys.add(dedupeKey);
    const now = new Date().toISOString();
    let deck = deckByName.get(deckName) ?? null;

    if (!deck) {
      const deckId = randomId("deck");
      await run(db, "INSERT INTO decks (id, owner_id, name, description, tags_json, created_at, updated_at, last_studied_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
        deckId,
        clientContext.ownerId,
        deckName,
        "CSV 导入",
        json(["导入"]),
        now,
        now,
        null,
      ]);
      deck = await getDeckById(db, clientContext.ownerId, deckId);
      deckByName.set(deckName, deck);
    }

    await run(
      db,
      "INSERT INTO cards (id, owner_id, deck_id, front_text, back_text, phonetic, example_text, note, status, scheduling_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        randomId("card"),
        clientContext.ownerId,
        deck._id,
        frontText,
        backText,
        String(row.phonetic ?? "").trim(),
        String(row.example_text ?? "").trim(),
        String(row.note ?? "").trim(),
        "new",
        json(buildDefaultScheduling(now)),
        now,
        now,
      ],
    );
    createdCount += 1;
  }

  return {
    batchId: randomId("batch"),
    createdCount,
    failedCount: failures.length,
    rowFailures: failures,
  };
}

function renumberSessionCards(cards) {
  return cards.map((card, index) => ({ ...card, position: index + 1 }));
}

function getQueueCounts(sessionCards) {
  return sessionCards.reduce(
    (counts, card) => {
      if (card.queue === "review") {
        counts.review += 1;
      } else {
        counts.new += 1;
      }
      return counts;
    },
    { review: 0, new: 0 },
  );
}

function buildSessionDocument({ sessionId, ownerId, mode = "formal", selectedDeckIds = [], cards, queueCounts, startedAt }) {
  return {
    id: sessionId,
    ownerId,
    mode,
    status: cards.length > 0 ? "active" : "completed",
    deckScope: selectedDeckIds.length > 0 ? "selected" : "all",
    selectedDeckIds,
    queueCounts: queueCounts ?? getQueueCounts(cards),
    cards: renumberSessionCards(cards),
    currentIndex: 0,
    completedCount: 0,
    revisitCount: 0,
    startedAt,
    completedAt: cards.length > 0 ? null : startedAt,
    updatedAt: startedAt,
  };
}

async function saveSession(db, session) {
  await run(
    db,
    "INSERT OR REPLACE INTO study_sessions (id, owner_id, mode, status, deck_scope, selected_deck_ids_json, queue_counts_json, cards_json, current_index, completed_count, revisit_count, started_at, completed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      session.id,
      session.ownerId,
      session.mode,
      session.status,
      session.deckScope,
      json(session.selectedDeckIds),
      json(session.queueCounts),
      json(session.cards),
      session.currentIndex,
      session.completedCount,
      session.revisitCount,
      session.startedAt,
      session.completedAt,
      session.updatedAt,
    ],
  );
}

function serializeSession(session) {
  if (!session) {
    return null;
  }

  return {
    id: session.id || session._id,
    ownerId: session.ownerId,
    status: session.status ?? "active",
    mode: session.mode ?? "formal",
    deckScope: session.deckScope ?? "all",
    selectedDeckIds: session.selectedDeckIds ?? [],
    queueCounts: session.queueCounts ?? getQueueCounts(session.cards ?? []),
    cards: renumberSessionCards(session.cards ?? []),
    currentIndex: session.currentIndex ?? 0,
    completedCount: session.completedCount ?? 0,
    revisitCount: session.revisitCount ?? 0,
    startedAt: session.startedAt,
    completedAt: session.completedAt ?? null,
    updatedAt: session.updatedAt ?? session.startedAt,
  };
}

function buildSessionResult(session) {
  return {
    sessionId: session.id,
    ownerId: session.ownerId,
    queueCounts: session.queueCounts,
    cards: renumberSessionCards(session.cards ?? []),
    currentIndex: session.currentIndex,
    completedCount: session.completedCount,
    revisitCount: session.revisitCount,
    startedAt: session.startedAt,
    mode: session.mode,
    status: session.status,
    completedAt: session.completedAt,
    updatedAt: session.updatedAt,
    selectedDeckIds: session.selectedDeckIds,
    deckScope: session.deckScope,
  };
}

function sortDueCards(left, right) {
  const leftDue = left.scheduling?.dueAt ? new Date(left.scheduling.dueAt).getTime() : Number.POSITIVE_INFINITY;
  const rightDue = right.scheduling?.dueAt ? new Date(right.scheduling.dueAt).getTime() : Number.POSITIVE_INFINITY;
  return leftDue !== rightDue
    ? leftDue - rightDue
    : new Date(left.updatedAt || left.createdAt || 0).getTime() - new Date(right.updatedAt || right.createdAt || 0).getTime();
}

function sortNewCards(left, right) {
  return new Date(left.createdAt || left.updatedAt || 0).getTime() - new Date(right.createdAt || right.updatedAt || 0).getTime();
}

async function createStudySession({ db, payload }) {
  const clientContext = requireClientContext(payload);
  const selectedDeckIds = Array.isArray(payload.selectedDeckIds) ? payload.selectedDeckIds.map((item) => String(item)) : [];
  const batchSize = Number(payload.maxQueueSize ?? SESSION_BATCH_SIZE);
  const now = new Date();
  const nowIso = now.toISOString();
  const activeSession = await getLatestActiveFormalSession(db, clientContext.ownerId);

  if (activeSession) {
    return buildSessionResult(activeSession);
  }

  const cards = await listCardsByOwner(db, clientContext.ownerId);
  const scopedCards = selectedDeckIds.length > 0 ? cards.filter((card) => selectedDeckIds.includes(card.deckId)) : cards;
  const dueCards = scopedCards.filter((card) => isSchedulingReadyForReview(card.status, card.scheduling, now)).sort(sortDueCards);

  if (dueCards.length > 0) {
    const batchCards = dueCards.slice(0, batchSize);
    const session = buildSessionDocument({
      sessionId: `ses_${Date.now()}`,
      ownerId: clientContext.ownerId,
      mode: "formal",
      selectedDeckIds,
      cards: batchCards.map((card, index) => toSessionCard(card, index + 1, "review")),
      queueCounts: { review: batchCards.length, new: 0 },
      startedAt: nowIso,
    });
    await saveSession(db, session);
    return buildSessionResult(session);
  }

  const pendingIntroducedCards = scopedCards.filter((card) => card.status === "new" && hasBeenIntroducedToday(card.scheduling, now)).sort(sortNewCards);

  if (pendingIntroducedCards.length > 0) {
    const batchCards = pendingIntroducedCards.slice(0, batchSize);
    const session = buildSessionDocument({
      sessionId: `ses_${Date.now()}`,
      ownerId: clientContext.ownerId,
      mode: "formal",
      selectedDeckIds,
      cards: batchCards.map((card, index) => toSessionCard(card, index + 1, "new")),
      queueCounts: { review: 0, new: batchCards.length },
      startedAt: nowIso,
    });
    await saveSession(db, session);
    return buildSessionResult(session);
  }

  const introducedTodayCount = cards.filter((card) => hasBeenIntroducedToday(card.scheduling, now)).length;
  const remainingNewSlots = Math.max(DAILY_NEW_LIMIT - introducedTodayCount, 0);
  const selectedNewCards = scopedCards
    .filter((card) => card.status === "new" && !hasBeenIntroducedToday(card.scheduling, now))
    .sort(sortNewCards)
    .slice(0, Math.min(batchSize, remainingNewSlots));

  assert(selectedNewCards.length > 0, "NOT_FOUND", "现在没有可学习的卡片了。等下一批复习到点，或明天再引入新的新词。");

  const sessionCards = [];
  for (const [index, card] of selectedNewCards.entries()) {
    const normalizedScheduling = normalizeScheduling(card.scheduling ?? buildDefaultScheduling(nowIso), card.status);
    const introducedScheduling = { ...normalizedScheduling, introducedAt: normalizedScheduling.introducedAt ?? nowIso };
    await run(db, "UPDATE cards SET scheduling_json = ?, updated_at = ? WHERE id = ?", [json(introducedScheduling), nowIso, card._id]);
    sessionCards.push(toSessionCard({ ...card, scheduling: introducedScheduling }, index + 1, "new"));
  }

  const session = buildSessionDocument({
    sessionId: `ses_${Date.now()}`,
    ownerId: clientContext.ownerId,
    mode: "formal",
    selectedDeckIds,
    cards: sessionCards,
    queueCounts: { review: 0, new: selectedNewCards.length },
    startedAt: nowIso,
  });
  await saveSession(db, session);
  return buildSessionResult(session);
}

async function createTodayReviewSession({ db, payload }) {
  const clientContext = requireClientContext(payload);
  const [cards, reviewLogs] = await Promise.all([listCardsByOwner(db, clientContext.ownerId), listReviewLogsByOwner(db, clientContext.ownerId)]);
  const latestLogsByCardId = new Map();

  for (const reviewLog of reviewLogs) {
    if (isSameShanghaiDay(reviewLog.reviewedAt) && !latestLogsByCardId.has(reviewLog.cardId)) {
      latestLogsByCardId.set(reviewLog.cardId, reviewLog);
    }
  }

  const cardsById = new Map(cards.map((card) => [card._id, card]));
  const reviewCards = Array.from(latestLogsByCardId.values())
    .map((reviewLog) => {
      const card = cardsById.get(reviewLog.cardId);
      return card ? { reviewLog, card } : null;
    })
    .filter(Boolean)
    .sort((left, right) => {
      const ratingDiff = left.reviewLog.rating - right.reviewLog.rating;
      return ratingDiff !== 0 ? ratingDiff : new Date(right.reviewLog.reviewedAt).getTime() - new Date(left.reviewLog.reviewedAt).getTime();
    });

  const nowIso = new Date().toISOString();
  const session = buildSessionDocument({
    sessionId: `ses_${Date.now()}`,
    ownerId: clientContext.ownerId,
    mode: "today-review",
    cards: reviewCards.map(({ card, reviewLog }, index) => ({ ...toSessionCard(card, index + 1, "review"), lastRating: String(reviewLog.rating) })),
    queueCounts: { review: reviewCards.length, new: 0 },
    startedAt: nowIso,
  });
  await saveSession(db, session);
  return buildSessionResult(session);
}

function validateSessionCard(session, cardId) {
  const currentCard = session.cards[session.currentIndex];
  assert(currentCard, "NOT_FOUND", "学习 session 不存在或已经完成。");
  assert(currentCard.id === cardId, "INVALID_INPUT", "当前卡片状态已过期，请刷新学习页。");
  return currentCard;
}

function appendSessionRevisitCard(session, currentCard, options) {
  if (!options.sameDayRequeueRequired) {
    return { ...session, revisitPreview: options.nextDuePreview };
  }

  const revisitAfterCards = options.sameDayRequeueOffset ?? 4;
  const insertIndex = Math.min(session.currentIndex + revisitAfterCards + 1, session.cards.length);
  const revisitCard = {
    ...currentCard,
    position: insertIndex + 1,
    revisitStep: (currentCard.revisitStep ?? 0) + 1,
    revisitAfterCards,
    stageIndex: options.stageIndex ?? currentCard.stageIndex,
    needsSameDayPass: options.needsSameDayPass ?? currentCard.needsSameDayPass,
  };
  const nextCards = [...session.cards];
  nextCards.splice(insertIndex, 0, revisitCard);

  return {
    ...session,
    cards: renumberSessionCards(nextCards),
    revisitCount: (session.revisitCount ?? 0) + 1,
    revisitPreview: options.nextDuePreview
      ? `本轮约 ${revisitAfterCards} 张后返场；下次复习：${options.nextDuePreview}`
      : `本轮约 ${revisitAfterCards} 张后返场`,
  };
}

async function updateSessionSnapshot(db, session, options) {
  validateSessionCard(session, options.cardId);
  const revisitState = appendSessionRevisitCard(session, session.cards[session.currentIndex], options);
  const nextIndex = session.currentIndex + 1;
  const isCompleted = nextIndex >= revisitState.cards.length;
  const nextSession = {
    ...revisitState,
    currentIndex: nextIndex,
    completedCount: (session.completedCount ?? 0) + 1,
    status: isCompleted ? "completed" : "active",
    completedAt: isCompleted ? options.updatedAt : null,
    updatedAt: options.updatedAt,
  };
  await saveSession(db, nextSession);
  return nextSession;
}

async function submitReview({ db, payload, traceId }) {
  const clientContext = requireClientContext(payload);
  const cardId = String(payload.cardId ?? "").trim();
  const sessionId = String(payload.sessionId ?? "").trim();
  const rating = Number(payload.rating);
  assert(cardId, "INVALID_INPUT", "缺少 cardId。");
  assert(sessionId, "INVALID_INPUT", "缺少 sessionId。");
  assert([1, 2, 3, 4].includes(rating), "INVALID_INPUT", "评分必须是 1 到 4。");
  const session = await getStudySessionById(db, clientContext.ownerId, sessionId);
  assert(session, "NOT_FOUND", "学习 session 不存在，请返回学习入口重新开始。");

  if (session.mode === "today-review") {
    const sameDayRequeueRequired = rating === 1 || rating === 2;
    const sameDayRequeueOffset = rating === 1 ? 4 : rating === 2 ? 8 : 0;
    const now = new Date().toISOString();
    const currentCard = validateSessionCard(session, cardId);
    const nextSession = await updateSessionSnapshot(db, session, {
      cardId,
      updatedAt: now,
      nextDuePreview: "正式复习计划保持不变",
      stageIndex: currentCard.stageIndex,
      needsSameDayPass: sameDayRequeueRequired,
      sameDayRequeueRequired,
      sameDayRequeueOffset,
    });
    return {
      traceId,
      nextDuePreview: nextSession.revisitPreview ?? "正式复习计划保持不变",
      stageIndex: currentCard.stageIndex,
      needsSameDayPass: sameDayRequeueRequired,
      sameDayRequeueRequired,
      sameDayRequeueOffset,
    };
  }

  const card = await getCardById(db, clientContext.ownerId, cardId);
  assert(card, "NOT_FOUND", "卡片不存在。");
  const normalizedBeforeScheduling = normalizeScheduling(card.scheduling, card.status);
  const before = {
    stageIndex: normalizedBeforeScheduling.stageIndex,
    scheduledDays: normalizedBeforeScheduling.scheduledDays ?? 0,
    stability: null,
    difficulty: null,
    dueAt: normalizedBeforeScheduling.dueAt ?? null,
    needsSameDayPass: normalizedBeforeScheduling.needsSameDayPass,
  };
  const scheduled = scheduleReview(card.scheduling, rating, card.status);
  const now = new Date().toISOString();
  await run(db, "UPDATE cards SET scheduling_json = ?, status = ?, updated_at = ? WHERE id = ?", [
    json(scheduled.scheduling),
    scheduled.scheduling.state === "new" ? "new" : scheduled.scheduling.state,
    now,
    card._id,
  ]);
  await run(db, "UPDATE decks SET updated_at = ?, last_studied_at = ? WHERE id = ?", [now, now, card.deckId]);
  await run(
    db,
    "INSERT INTO review_logs (id, owner_id, card_id, deck_id, reviewed_at, rating, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      randomId("review"),
      clientContext.ownerId,
      card._id,
      card.deckId,
      now,
      rating,
      json(before),
      json({
        stageIndex: scheduled.scheduling.stageIndex,
        scheduledDays: scheduled.scheduling.scheduledDays,
        stability: null,
        difficulty: null,
        dueAt: scheduled.scheduling.dueAt,
        needsSameDayPass: scheduled.scheduling.needsSameDayPass,
      }),
    ],
  );
  const nextSession = await updateSessionSnapshot(db, session, {
    cardId,
    updatedAt: now,
    nextDuePreview: scheduled.preview,
    stageIndex: scheduled.scheduling.stageIndex,
    needsSameDayPass: scheduled.scheduling.needsSameDayPass,
    sameDayRequeueRequired: scheduled.sameDayRequeueRequired,
    sameDayRequeueOffset: scheduled.sameDayRequeueOffset,
  });

  return {
    traceId,
    nextDuePreview: nextSession.revisitPreview ?? scheduled.preview,
    stageIndex: scheduled.scheduling.stageIndex,
    needsSameDayPass: scheduled.scheduling.needsSameDayPass,
    sameDayRequeueRequired: scheduled.sameDayRequeueRequired,
    sameDayRequeueOffset: scheduled.sameDayRequeueOffset,
  };
}

async function getStudySessionSnapshot({ db, payload }) {
  const clientContext = requireClientContext(payload);
  const sessionId = String(payload.sessionId ?? "").trim();
  assert(sessionId, "INVALID_INPUT", "缺少 sessionId。");
  return { session: serializeSession(await getStudySessionById(db, clientContext.ownerId, sessionId)) };
}

async function getActiveStudySession({ db, payload }) {
  const clientContext = requireClientContext(payload);
  return { session: serializeSession(await getLatestActiveFormalSession(db, clientContext.ownerId)) };
}

async function getStatsPageData({ db, payload }) {
  const clientContext = requireClientContext(payload);
  const { decks, cards, reviewLogs } = await getDeckMaterial(db, clientContext.ownerId);
  const deckViews = decks.map((deck) => toDeckView(deck, cards));
  const dueCount = deckViews.reduce((sum, deck) => sum + deck.dueCount, 0);
  const introducedTodayCount = cards.filter((card) => hasBeenIntroducedToday(card.scheduling)).length;
  const newCount = dueCount > 0 ? 0 : Math.max(DAILY_NEW_LIMIT - introducedTodayCount, 0);
  const cardsById = new Map(cards.map((card) => [card._id, card]));
  const decksById = new Map(decks.map((deck) => [deck._id, deck]));

  return {
    highlights: buildHighlights({ reviewLogs, dueCount, newCount, deckCount: decks.length }),
    weeklyActivity: buildWeeklyActivity(reviewLogs),
    weakCards: buildWeakCards({ reviewLogs, cardsById, decksById }),
  };
}

function getLevenshteinDistance(left, right) {
  if (left === right) {
    return 0;
  }
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let col = 0; col < cols; col += 1) matrix[0][col] = col;
  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(matrix[row - 1][col] + 1, matrix[row][col - 1] + 1, matrix[row - 1][col - 1] + cost);
    }
  }
  return matrix[left.length][right.length];
}

function getShapeSimilarity(left, right) {
  const normalizedLeft = String(left ?? "").trim().toLowerCase();
  const normalizedRight = String(right ?? "").trim().toLowerCase();
  if (!normalizedLeft || !normalizedRight) return 0;
  const maxLength = Math.max(normalizedLeft.length, normalizedRight.length);
  return Math.max(0, 1 - getLevenshteinDistance(normalizedLeft, normalizedRight) / maxLength);
}

function toConfusionCandidate(card, deck, lowRatingStats, sourceCard = null) {
  const stat = lowRatingStats.get(card._id) ?? { lowRatingCount: 0, lastReviewedAt: null };
  return {
    cardId: card._id,
    front: card.frontText,
    back: card.backText,
    deckName: deck?.name ?? "",
    lowRatingCount: stat.lowRatingCount,
    lastReviewedAt: stat.lastReviewedAt,
    similarityScore: sourceCard ? getShapeSimilarity(sourceCard.frontText, card.frontText) : 1,
  };
}

async function getConfusionPageData({ db, payload }) {
  const clientContext = requireClientContext(payload);
  const [decks, cards, reviewLogs, savedGroups] = await Promise.all([
    listDecksByOwner(db, clientContext.ownerId),
    listCardsByOwner(db, clientContext.ownerId),
    listReviewLogsByOwner(db, clientContext.ownerId),
    all(db, "SELECT * FROM confusion_groups WHERE owner_id = ? ORDER BY updated_at DESC", [clientContext.ownerId]),
  ]);
  const cardsById = new Map(cards.map((card) => [card._id, card]));
  const decksById = new Map(decks.map((deck) => [deck._id, deck]));
  const lowRatingStats = buildLowRatingStats(reviewLogs);
  const groups = [];

  for (const group of savedGroups) {
    const sourceCard = cardsById.get(group.source_card_id);
    if (!sourceCard) continue;
    const targetIds = safeJsonParse(group.target_card_ids_json, []);
    groups.push({
      cardId: sourceCard._id,
      front: sourceCard.frontText,
      back: sourceCard.backText,
      deckName: decksById.get(sourceCard.deckId)?.name ?? "",
      lowRatingCount: lowRatingStats.get(sourceCard._id)?.lowRatingCount ?? 0,
      lastReviewedAt: lowRatingStats.get(sourceCard._id)?.lastReviewedAt ?? null,
      source: group.source,
      confusions: targetIds
        .map((id) => cardsById.get(id))
        .filter(Boolean)
        .map((card) => toConfusionCandidate(card, decksById.get(card.deckId), lowRatingStats, sourceCard)),
    });
  }

  for (const stat of lowRatingStats.values()) {
    if (groups.some((group) => group.cardId === stat.cardId)) continue;
    const sourceCard = cardsById.get(stat.cardId);
    if (!sourceCard) continue;
    const candidates = cards
      .filter((card) => card._id !== sourceCard._id && card.deckId === sourceCard.deckId)
      .map((card) => toConfusionCandidate(card, decksById.get(card.deckId), lowRatingStats, sourceCard))
      .sort((left, right) => right.similarityScore - left.similarityScore)
      .slice(0, 3);
    if (candidates.length > 0) {
      groups.push({
        cardId: sourceCard._id,
        front: sourceCard.frontText,
        back: sourceCard.backText,
        deckName: decksById.get(sourceCard.deckId)?.name ?? "",
        lowRatingCount: stat.lowRatingCount,
        lastReviewedAt: stat.lastReviewedAt,
        source: "auto",
        confusions: candidates,
      });
    }
  }

  return { groups: groups.slice(0, 12) };
}

async function createManualConfusionGroup({ db, payload }) {
  const clientContext = requireClientContext(payload);
  const sourceCardId = String(payload.sourceCardId ?? "").trim();
  const targetCardIds = Array.isArray(payload.targetCardIds) ? payload.targetCardIds.map(String).filter(Boolean) : [];
  assert(sourceCardId, "INVALID_INPUT", "缺少 sourceCardId。");
  const now = new Date().toISOString();
  const existing = await first(db, "SELECT * FROM confusion_groups WHERE owner_id = ? AND source_card_id = ? AND source = 'manual'", [
    clientContext.ownerId,
    sourceCardId,
  ]);

  if (existing) {
    await run(db, "UPDATE confusion_groups SET target_card_ids_json = ?, updated_at = ? WHERE id = ?", [json(targetCardIds), now, existing.id]);
    return { groupId: existing.id };
  }

  const groupId = randomId("confusion");
  await run(
    db,
    "INSERT INTO confusion_groups (id, owner_id, source_card_id, source, target_card_ids_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [groupId, clientContext.ownerId, sourceCardId, "manual", json(targetCardIds), now, now],
  );
  return { groupId };
}

async function getManualConfusionGroups(args) {
  const data = await getConfusionPageData(args);
  return { groups: data.groups.filter((group) => group.source === "manual") };
}

async function createAutoConfusionGroups({ db, payload }) {
  const clientContext = requireClientContext(payload);
  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  const now = new Date().toISOString();
  let createdCount = 0;

  for (const group of groups) {
    const sourceCardId = String(group.sourceCardId ?? "").trim();
    const targetCardIds = Array.isArray(group.targetCardIds) ? group.targetCardIds.map(String).filter(Boolean) : [];
    if (!sourceCardId || targetCardIds.length === 0) continue;
    const existing = await first(db, "SELECT * FROM confusion_groups WHERE owner_id = ? AND source_card_id = ? AND source = 'auto'", [
      clientContext.ownerId,
      sourceCardId,
    ]);
    if (existing) {
      await run(db, "UPDATE confusion_groups SET target_card_ids_json = ?, updated_at = ? WHERE id = ?", [json(targetCardIds), now, existing.id]);
    } else {
      await run(
        db,
        "INSERT INTO confusion_groups (id, owner_id, source_card_id, source, target_card_ids_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [randomId("confusion"), clientContext.ownerId, sourceCardId, "auto", json(targetCardIds), now, now],
      );
      createdCount += 1;
    }
  }

  return { createdCount };
}

const handlers = {
  ensureContext,
  getHomePageData,
  getStudyEntryData,
  getDeckListData,
  getDeckDetailData,
  getAllCards,
  createDeck,
  createCard,
  deleteDeck,
  importCsv,
  createStudySession,
  createTodayReviewSession,
  getActiveStudySession,
  getStudySession: getStudySessionSnapshot,
  getStudySessionSnapshot,
  submitReview,
  getStatsPageData,
  getConfusionPageData,
  getManualConfusionGroups,
  createManualConfusionGroup,
  createAutoConfusionGroups,
};

export async function onRequestPost(context) {
  const db = context.env.DB;

  if (!db) {
    return fail("CONFIG_MISSING", "缺少 Cloudflare D1 绑定 DB。");
  }

  let body = {};

  try {
    body = await context.request.json();
  } catch {
    body = {};
  }

  const action = body.action;
  const payload = body.payload ?? {};
  const traceId = body.traceId || crypto.randomUUID();

  if (!action || !handlers[action]) {
    return fail("NOT_FOUND", `未找到 action: ${action ?? "unknown"}`);
  }

  try {
    const data = await handlers[action]({
      db,
      env: context.env,
      payload,
      traceId,
      request: context.request,
    });

    if (data?.__responseHeaders) {
      return ok(data.data, data.__responseHeaders);
    }

    return ok(data, { "Cache-Control": "no-store" });
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error.code, error.message, { retryable: error.retryable });
    }

    return fail("INTERNAL_ERROR", error instanceof Error ? error.message : "Cloudflare 后端执行失败");
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}
