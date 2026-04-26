import { v4 as uuidv4 } from "uuid";

import { callAppService as callCloudflareAppService } from "@/lib/cloudflare/client";
import {
  confusionGroups,
  decks as mockDecks,
  importSampleRows,
  getCardsByDeckId,
  homeStats,
  statsHighlights,
  weeklyActivity,
} from "@/lib/mock-data";
import {
  createStudySession as createMockStudySession,
  importCsv as importMockCsv,
} from "@/lib/mock-api";
import { getServiceRuntimeInfo } from "@/lib/service-config";
import { calculateMultiDimensionalSimilarity } from "@/lib/confusion-similarity";
import type {
  Card,
  ConfusionGroup,
  ConfusionPageData,
  CreateAutoConfusionGroupsInput,
  CreateAutoConfusionGroupsResult,
  CreateCardInput,
  CreateCardResult,
  CreateDeckInput,
  CreateDeckResult,
  DeckScope,
  Deck,
  DeckDetailData,
  DeckListData,
  DeleteDeckInput,
  DeleteDeckResult,
  HomePageData,
  ImportCsvInput,
  ImportCsvResult,
  ReviewRating,
  SessionCard,
  SessionMode,
  StatsPageData,
  StudyCompletionSummary,
  StudyEntryData,
  StudySession,
  StudySessionResult,
  SubmitReviewInput,
  SubmitReviewResult,
} from "@/lib/types";

const SESSION_STORAGE_KEY = "animal-farm-study-sessions";
const CUSTOM_DECKS_STORAGE_KEY = "animal-farm-custom-decks";
const CUSTOM_CARDS_STORAGE_KEY = "animal-farm-custom-cards";
const DATA_CHANGE_STORAGE_KEY = "animal-farm-data-change-token";
const DATA_CHANGE_EVENT = "animal-farm:data-changed";
const SESSION_BATCH_SIZE = 50;
const IMPORT_HEADER_FIELDS = [
  "front_text",
  "back_text",
  "phonetic",
  "example_text",
  "note",
  "deck_name",
] as const;
const MOCK_REVIEW_PREVIEW_BY_RATING: Record<ReviewRating, string> = {
  "1": "10 分钟后",
  "2": "10 分钟后",
  "3": "明天",
  "4": "2 天后",
};

function canUseStorage() {
  return typeof window !== "undefined";
}

function readStorageItem<T>(key: string, fallback: T): T {
  if (!canUseStorage()) {
    return fallback;
  }

  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

function writeStorageItem<T>(key: string, value: T) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function readSessions() {
  return readStorageItem<Record<string, StudySession>>(SESSION_STORAGE_KEY, {});
}

function writeSessions(nextSessions: Record<string, StudySession>) {
  writeStorageItem(SESSION_STORAGE_KEY, nextSessions);
}

function getQueueCounts(sessionCards: SessionCard[]) {
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

function cacheStudySession(session: StudySession) {
  const normalizedSession = normalizePersistedSession(session);

  if (!normalizedSession) {
    return null;
  }

  const sessions = readSessions();

  writeSessions({
    ...sessions,
    [normalizedSession.id]: normalizedSession,
  });

  return normalizedSession;
}

function removeCachedStudySession(sessionId: string) {
  const sessions = readSessions();

  if (!sessions[sessionId]) {
    return;
  }

  const nextSessions = { ...sessions };
  delete nextSessions[sessionId];
  writeSessions(nextSessions);
}

function pruneCachedFormalSessions(keepSessionId?: string | null) {
  const sessions = readSessions();
  let hasChanges = false;
  const nextSessions = { ...sessions };

  for (const [sessionId, rawSession] of Object.entries(sessions)) {
    const session = normalizePersistedSession(rawSession);

    if (!session || getSessionMode(session) !== "formal" || isStudySessionCompleted(session)) {
      continue;
    }

    if (keepSessionId && sessionId === keepSessionId) {
      continue;
    }

    delete nextSessions[sessionId];
    hasChanges = true;
  }

  if (hasChanges) {
    writeSessions(nextSessions);
  }
}

function getSessionMode(session: Pick<StudySession, "mode"> | null | undefined): SessionMode {
  return session?.mode === "today-review" ? "today-review" : "formal";
}

function normalizePersistedSession(session: StudySession | null): StudySession | null {
  if (!session) {
    return null;
  }

  return {
    ...session,
    mode: getSessionMode(session),
    status:
      session.status ?? (session.currentIndex >= session.cards.length ? "completed" : "active"),
    completedAt:
      session.completedAt ?? (session.currentIndex >= session.cards.length ? session.updatedAt ?? session.startedAt : null),
    updatedAt: session.updatedAt ?? session.startedAt,
  };
}

function isStudySessionCompleted(session: StudySession | null | undefined) {
  if (!session) {
    return true;
  }

  return (
    session.status === "completed" ||
    session.cards.length === 0 ||
    session.currentIndex >= session.cards.length
  );
}

function isResumableFormalSession(session: StudySession | null | undefined) {
  if (!session) {
    return false;
  }

  return getSessionMode(session) === "formal" && !isStudySessionCompleted(session);
}

function buildStudySessionRecord({
  cards,
  selectedDeckIds = [],
  ownerId,
  sessionId = `ses_${uuidv4().slice(0, 8)}`,
  mode = "formal",
  currentIndex = 0,
  completedCount = 0,
  revisitCount = 0,
  startedAt = new Date().toISOString(),
  status = "active",
  completedAt = null,
  updatedAt = startedAt,
  deckScope,
}: {
  cards: SessionCard[];
  selectedDeckIds?: string[];
  ownerId?: string;
  sessionId?: string;
  mode?: SessionMode;
  currentIndex?: number;
  completedCount?: number;
  revisitCount?: number;
  startedAt?: string;
  status?: StudySession["status"];
  completedAt?: string | null;
  updatedAt?: string;
  deckScope?: DeckScope;
}) {
  return normalizePersistedSession({
    id: sessionId,
    mode,
    status,
    deckScope: deckScope ?? (selectedDeckIds.length > 0 ? "selected" : "all"),
    selectedDeckIds,
    ownerId,
    queueCounts: getQueueCounts(cards),
    cards,
    currentIndex,
    completedCount,
    revisitCount,
    startedAt,
    completedAt,
    updatedAt,
  });
}

function getLatestPersistedActiveFormalSession() {
  return Object.values(readSessions())
    .map((session) => normalizePersistedSession(session))
    .filter((session): session is StudySession => isResumableFormalSession(session))
    .sort(
      (left, right) =>
        new Date(right.updatedAt ?? right.startedAt).getTime() -
        new Date(left.updatedAt ?? left.startedAt).getTime(),
    )[0] ?? null;
}

function cacheCloudStudySessionPayload(
  payload: StudySessionResult & {
    cards: SessionCard[];
    ownerId: string;
    currentIndex?: number;
    completedCount?: number;
    revisitCount?: number;
    startedAt?: string;
    mode?: SessionMode;
    status?: StudySession["status"];
    completedAt?: string | null;
    updatedAt?: string;
    selectedDeckIds?: string[];
    deckScope?: DeckScope;
  },
  fallbackSelectedDeckIds: string[] = [],
  fallbackMode: SessionMode = "formal",
) {
  const session = buildStudySessionRecord({
    cards: payload.cards,
    selectedDeckIds: payload.selectedDeckIds ?? fallbackSelectedDeckIds,
    ownerId: payload.ownerId,
    sessionId: payload.sessionId,
    mode: payload.mode ?? fallbackMode,
    currentIndex: payload.currentIndex ?? 0,
    completedCount: payload.completedCount ?? 0,
    revisitCount: payload.revisitCount ?? 0,
    startedAt: payload.startedAt,
    status: payload.status,
    completedAt: payload.completedAt ?? null,
    updatedAt: payload.updatedAt ?? payload.startedAt,
    deckScope: payload.deckScope,
  });

  const cachedSession = session ? cacheStudySession(session) : null;

  if (cachedSession && getSessionMode(cachedSession) === "formal" && !isStudySessionCompleted(cachedSession)) {
    pruneCachedFormalSessions(cachedSession.id);
  }

  return cachedSession;
}

function readCustomDecks() {
  return readStorageItem<Deck[]>(CUSTOM_DECKS_STORAGE_KEY, []);
}

function writeCustomDecks(nextDecks: Deck[]) {
  writeStorageItem(CUSTOM_DECKS_STORAGE_KEY, nextDecks);
}

function readCustomCards() {
  return readStorageItem<Card[]>(CUSTOM_CARDS_STORAGE_KEY, []);
}

function writeCustomCards(nextCards: Card[]) {
  writeStorageItem(CUSTOM_CARDS_STORAGE_KEY, nextCards);
}

function notifyDataChanged() {
  if (!canUseStorage()) {
    return;
  }

  const token = `${Date.now()}_${uuidv4().slice(0, 8)}`;
  window.localStorage.setItem(DATA_CHANGE_STORAGE_KEY, token);
  window.dispatchEvent(new CustomEvent(DATA_CHANGE_EVENT, { detail: { token } }));
}

function isMockRecordId(value: string) {
  return (
    value.startsWith("deck-") ||
    value.startsWith("card-") ||
    value.startsWith("deck_local_") ||
    value.startsWith("card_local_")
  );
}

function getMockCardsByDeckId(deckId: string) {
  return [...getCardsByDeckId(deckId), ...readCustomCards().filter((card) => card.deckId === deckId)];
}

function getMergedMockDecks() {
  const customDecks = readCustomDecks();
  const customCards = readCustomCards();

  const baseDecks = mockDecks.map((deck) => {
    const extraCards = customCards.filter((card) => card.deckId === deck.id);
    const extraNewCount = extraCards.filter((card) => (card.status ?? "new") === "new").length;

    return {
      ...deck,
      totalCount: deck.totalCount + extraCards.length,
      newCount: deck.newCount + extraNewCount,
    };
  });

  const derivedCustomDecks = customDecks.map((deck) => {
    const deckCards = customCards.filter((card) => card.deckId === deck.id);

    return {
      ...deck,
      dueCount: deck.dueCount,
      newCount: deckCards.filter((card) => (card.status ?? "new") === "new").length,
      totalCount: deckCards.length,
    };
  });

  return [...derivedCustomDecks, ...baseDecks];
}

function getMockDeckById(deckId: string) {
  return getMergedMockDecks().find((deck) => deck.id === deckId) ?? null;
}

function getMockHomeStats() {
  const mergedDecks = getMergedMockDecks();
  const reviews = mergedDecks.reduce((sum, deck) => sum + deck.dueCount, 0);
  const rawNewCards = mergedDecks.reduce((sum, deck) => sum + deck.newCount, 0);
  const newCards = reviews > 0 ? 0 : Math.min(25, rawNewCards);
  const todayNewIntroduced = reviews > 0 ? 25 : 25 - newCards;

  return {
    ...homeStats,
    reviews,
    newCards,
    total: Math.max(homeStats.completed + reviews + newCards, homeStats.total),
    estMinutes: Math.max(Math.ceil((reviews + newCards) / 5), 5),
    todayNewLimit: 25,
    todayNewIntroduced,
    todayReviewedCount: getTodayFormalSessionCards().length,
  };
}

function createMockDeckRecord(input: CreateDeckInput): CreateDeckResult {
  const runtime = getServiceRuntimeInfo();
  const deck: Deck = {
    id: `deck_local_${uuidv4().slice(0, 8)}`,
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    dueCount: 0,
    newCount: 0,
    totalCount: 0,
    lastStudiedLabel: "刚刚",
    tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
  };

  writeCustomDecks([deck, ...readCustomDecks()]);
  notifyDataChanged();

  return {
    deck,
    dataMode: runtime.mode,
    isFallback: runtime.isFallback,
  };
}

function createMockCardRecord(input: CreateCardInput): CreateCardResult {
  const runtime = getServiceRuntimeInfo();
  const card: Card = {
    id: `card_local_${uuidv4().slice(0, 8)}`,
    deckId: input.deckId,
    front: input.front.trim(),
    back: input.back.trim(),
    phonetic: input.phonetic?.trim() || undefined,
    example: input.example?.trim() || undefined,
    note: input.note?.trim() || undefined,
    status: "new",
    nextDueAt: null,
    stageIndex: -1,
    introducedAt: null,
    lastRating: null,
    needsSameDayPass: false,
  };

  writeCustomCards([card, ...readCustomCards()]);
  notifyDataChanged();

  return {
    card,
    dataMode: runtime.mode,
    isFallback: runtime.isFallback,
  };
}

function deleteMockDeckRecord(deckId: string): DeleteDeckResult {
  const runtime = getServiceRuntimeInfo();

  if (!deckId.startsWith("deck_local_")) {
    throw new Error("演示内置牌组暂不支持删除，请切换到自建牌组测试。");
  }

  writeCustomDecks(readCustomDecks().filter((deck) => deck.id !== deckId));
  writeCustomCards(readCustomCards().filter((card) => card.deckId !== deckId));
  notifyDataChanged();

  return {
    deleted: true,
    deckId,
    dataMode: runtime.mode,
    isFallback: runtime.isFallback,
  };
}

function splitCsvRow(row: string) {
  return row.split(",").map((cell) => cell.trim());
}

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, "");
}

function normalizeImportValue(value: string) {
  return stripBom(value).trim();
}

function normalizeImportKey(...parts: string[]) {
  return parts.map((part) => normalizeImportValue(part).toLowerCase()).join("::");
}

function getNow() {
  return new Date();
}

function getStartOfToday() {
  const now = getNow();
  now.setHours(0, 0, 0, 0);
  return now;
}

function getTodayFormalSessionCards() {
  const todayStart = getStartOfToday().getTime();
  const uniqueCards = new Map<string, SessionCard>();
  const sessions = Object.values(readSessions())
    .map((session) => normalizePersistedSession(session))
    .filter((session): session is StudySession => session !== null)
    .filter(
      (session) => getSessionMode(session) === "formal" && new Date(session.startedAt).getTime() >= todayStart,
    )
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());

  for (const session of sessions) {
    const completedCards = session.cards
      .slice(0, Math.min(session.completedCount, session.cards.length))
      .slice()
      .reverse();

    for (const card of completedCards) {
      if (uniqueCards.has(card.id)) {
        continue;
      }

      uniqueCards.set(card.id, {
        ...card,
        queue: "review",
        position: 0,
        revisitStep: undefined,
        revisitAfterCards: undefined,
      });
    }
  }

  return renumberSessionCards(Array.from(uniqueCards.values()));
}

function getRelativeDuePreview(isoString: string) {
  const diffMs = new Date(isoString).getTime() - Date.now();
  const diffMinutes = Math.max(Math.round(diffMs / (1000 * 60)), 0);

  if (diffMinutes < 60) {
    return `${Math.max(diffMinutes, 1)} 分钟后`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} 小时后`;
  }

  const diffDays = Math.round(diffHours / 24);

  if (diffDays === 1) {
    return "明天";
  }

  return `${diffDays} 天后`;
}

function renumberSessionCards(cards: SessionCard[]) {
  return cards.map((card, index) => ({
    ...card,
    position: index + 1,
  }));
}

function buildSessionRevisitPreview(nextDuePreview: string | undefined, revisitAfterCards: number) {
  if (!nextDuePreview) {
    return `本轮约 ${revisitAfterCards} 张后返场`;
  }

  return `本轮约 ${revisitAfterCards} 张后返场；下次复习：${nextDuePreview}`;
}

function appendSessionRevisitCard(
  session: StudySession,
  currentCard: SessionCard,
  options: {
    nextDuePreview?: string;
    stageIndex?: number;
    needsSameDayPass?: boolean;
    sameDayRequeueRequired?: boolean;
    sameDayRequeueOffset?: number;
  },
) {
  if (!options.sameDayRequeueRequired) {
    return {
      cards: session.cards,
      revisitCount: session.revisitCount,
      revisitPreview: null as string | null,
    };
  }

  const revisitAfterCards = options.sameDayRequeueOffset ?? 4;
  const insertIndex = Math.min(session.currentIndex + revisitAfterCards + 1, session.cards.length);
  const revisitCard: SessionCard = {
    ...currentCard,
    queue: "review",
    revisitStep: (currentCard.revisitStep ?? 0) + 1,
    revisitAfterCards,
    stageIndex: options.stageIndex ?? currentCard.stageIndex,
    needsSameDayPass: options.needsSameDayPass ?? true,
  };
  const nextCards = [...session.cards];

  nextCards.splice(insertIndex, 0, revisitCard);

  return {
    cards: renumberSessionCards(nextCards),
    revisitCount: session.revisitCount + 1,
    revisitPreview: buildSessionRevisitPreview(options.nextDuePreview, revisitAfterCards),
  };
}

function buildImportKey(deckName: string, front: string, back: string) {
  return normalizeImportKey(deckName, front, back);
}

function parseImportRows(input: ImportCsvInput) {
  const nonEmptyRows = input.rows.map((row) => row.trim()).filter(Boolean);

  if (nonEmptyRows.length === 0) {
    return {
      rows: [],
      rowFailures: [] as NonNullable<ImportCsvResult["rowFailures"]>,
    };
  }

  const firstRow = splitCsvRow(nonEmptyRows[0]).map((cell) => normalizeImportValue(cell).toLowerCase());
  const looksLikeHeader = firstRow.some(
    (cell) =>
      IMPORT_HEADER_FIELDS.includes(cell as (typeof IMPORT_HEADER_FIELDS)[number]) ||
      cell.includes("_text") ||
      cell === "deck_name" ||
      cell === "phonetic" ||
      cell === "note",
  );
  const hasHeader = looksLikeHeader && firstRow.includes("front_text") && firstRow.includes("back_text");

  if (looksLikeHeader && !hasHeader) {
    return {
      rows: [],
      rowFailures: [
        {
          rowNumber: 1,
          errorCode: "invalid_header",
          message:
            "CSV 表头不合法。请使用 front_text, back_text, phonetic, example_text, note, deck_name 这些列名。",
        },
      ],
    };
  }

  const unknownHeaders = hasHeader
    ? firstRow.filter(
        (cell) => !IMPORT_HEADER_FIELDS.includes(cell as (typeof IMPORT_HEADER_FIELDS)[number]),
      )
    : [];

  if (unknownHeaders.length > 0) {
    return {
      rows: [],
      rowFailures: [
        {
          rowNumber: 1,
          errorCode: "invalid_header",
          message: `检测到不支持的列名：${unknownHeaders.join(", ")}。`,
        },
      ],
    };
  }

  const headers = hasHeader ? firstRow : [];
  const dataRows = hasHeader ? nonEmptyRows.slice(1) : nonEmptyRows;
  const rows = dataRows.map((row, index) => {
    const values = splitCsvRow(row);

    if (!hasHeader) {
      return {
        rowNumber: index + 1,
        front_text: values[0] ?? "",
        back_text: values[1] ?? "",
        phonetic: "",
        example_text: values[2] ?? "",
        note: "",
        deck_name: input.defaultDeckName ?? "",
      };
    }

    const mapped = headers.reduce<Record<string, string>>((result, header, headerIndex) => {
      result[header] = values[headerIndex] ?? "";
      return result;
    }, {});

    return {
      rowNumber: index + 2,
      front_text: mapped.front_text ?? "",
      back_text: mapped.back_text ?? "",
      phonetic: mapped.phonetic ?? "",
      example_text: mapped.example_text ?? "",
      note: mapped.note ?? "",
      deck_name: mapped.deck_name ?? input.defaultDeckName ?? "",
    };
  });

  return {
    rows,
    rowFailures: [] as NonNullable<ImportCsvResult["rowFailures"]>,
  };
}

function getSerializedSize(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function chunkImportRows(
  rows: ReturnType<typeof parseImportRows>["rows"],
  fileName: string,
  defaultDeckName?: string,
) {
  const batches: typeof rows[] = [];
  let currentBatch: typeof rows = [];

  for (const row of rows) {
    const candidateBatch = [...currentBatch, row];
    const candidatePayload = {
      fileName,
      rows: candidateBatch,
      defaultDeckName: defaultDeckName ?? "",
    };

    if (
      currentBatch.length > 0 &&
      getSerializedSize(candidatePayload) > 24 * 1024
    ) {
      batches.push(currentBatch);
      currentBatch = [row];
      continue;
    }

    currentBatch = candidateBatch;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

async function importMockCsvPersisted(input: ImportCsvInput) {
  if (input.simulateFailure) {
    return importMockCsv(input);
  }

  const batchId = `batch_${uuidv4().slice(0, 8)}`;
  const { rows: parsedRows, rowFailures: initialFailures } = parseImportRows(input);
  const createdCards: Card[] = [];
  const rowFailures: NonNullable<ImportCsvResult["rowFailures"]> = [...initialFailures];
  const deckCache = new Map(getMergedMockDecks().map((deck) => [deck.name, deck]));
  const existingKeys = new Set(
    getMergedMockDecks().flatMap((deck) =>
      getMockCardsByDeckId(deck.id).map((card) => buildImportKey(deck.name, card.front, card.back)),
    ),
  );
  const batchKeys = new Set<string>();

  for (const row of parsedRows) {
    if (!row.front_text || !row.back_text) {
      rowFailures.push({
        rowNumber: row.rowNumber,
        errorCode: "missing_required_field",
        message: "front_text 和 back_text 不能为空。",
      });
      continue;
    }

    const deckName = row.deck_name || input.defaultDeckName || "导入词库";
    const importKey = buildImportKey(deckName, row.front_text, row.back_text);

    if (batchKeys.has(importKey)) {
      rowFailures.push({
        rowNumber: row.rowNumber,
        errorCode: "duplicate_in_file",
        message: "同一批 CSV 内存在重复词条。",
      });
      continue;
    }

    if (existingKeys.has(importKey)) {
      rowFailures.push({
        rowNumber: row.rowNumber,
        errorCode: "duplicate_existing_card",
        message: "当前牌组里已经有相同词条，已跳过。",
      });
      continue;
    }

    let targetDeck = deckCache.get(deckName) ?? null;

    if (!targetDeck) {
      const createdDeck = createMockDeckRecord({
        name: deckName,
        description: "由 CSV 导入自动创建",
        tags: ["CSV 导入"],
      });
      targetDeck = createdDeck.deck;
      deckCache.set(deckName, targetDeck);
    }

    const createdCard = createMockCardRecord({
      deckId: targetDeck.id,
      front: row.front_text,
      back: row.back_text,
      phonetic: row.phonetic,
      example: row.example_text,
      note: row.note,
    });

    createdCards.push(createdCard.card);
    existingKeys.add(importKey);
    batchKeys.add(importKey);
  }

  return {
    batchId,
    createdCount: createdCards.length,
    failedCount: rowFailures.length,
    rowFailures,
  };
}

function persistStudySession(
  sessionCards: SessionCard[],
  selectedDeckIds: string[] = [],
  ownerId?: string,
  sessionId = `ses_${uuidv4().slice(0, 8)}`,
  mode: SessionMode = "formal",
) {
  const nextSession = buildStudySessionRecord({
    cards: sessionCards,
    selectedDeckIds,
    ownerId,
    sessionId,
    mode,
  });
  const cachedSession = nextSession ? cacheStudySession(nextSession) : null;

  return {
    sessionId: cachedSession?.id ?? sessionId,
    queueCounts: cachedSession?.queueCounts ?? getQueueCounts(sessionCards),
  };
}

function getPersistedStudySession(sessionId: string) {
  const sessions = readSessions();
  return normalizePersistedSession(sessions[sessionId] ?? null);
}

function getStudyCompletionFromSession(session: StudySession): StudyCompletionSummary {
  return {
    sessionId: session.id,
    sessionMode: getSessionMode(session),
    completedCount: session.completedCount,
    reviewCount: session.queueCounts.review,
    newCount: session.queueCounts.new,
    remainingCount: Math.max(session.cards.length - session.completedCount, 0),
  };
}

function validateReviewSession(input: SubmitReviewInput) {
  const session = getPersistedStudySession(input.sessionId);

  if (!session) {
    return {
      error: {
        status: "failure" as const,
        stage: "session_lookup",
        message: "学习 session 不存在，请重新开始。",
      },
      session: null,
      currentCard: null,
    };
  }

  const currentCard = session.cards[session.currentIndex];

  if (!currentCard || currentCard.id !== input.cardId) {
    return {
      error: {
        status: "failure" as const,
        stage: "card_lookup",
        message: "当前卡片状态已过期，请刷新学习页。",
      },
      session,
      currentCard: null,
    };
  }

  return {
    error: null,
    session,
    currentCard,
  };
}

function advancePersistedStudySession(
  input: SubmitReviewInput,
  options?: {
    nextDuePreview?: string;
    stageIndex?: number;
    needsSameDayPass?: boolean;
    sameDayRequeueRequired?: boolean;
    sameDayRequeueOffset?: number;
  },
): SubmitReviewResult {
  if (input.simulateFailure) {
    return {
      status: "failure",
      stage: "mock_submit",
      message: "模拟提交失败，请稍后重试。",
    };
  }

  const validation = validateReviewSession(input);

  if (validation.error || !validation.session) {
    return (
      validation.error ?? {
        status: "failure",
        stage: "session_lookup",
        message: "学习 session 不存在，请重新开始。",
      }
    );
  }

  const sessions = readSessions();
  const revisitState = appendSessionRevisitCard(validation.session, validation.currentCard, {
    nextDuePreview: options?.nextDuePreview ?? MOCK_REVIEW_PREVIEW_BY_RATING[input.rating],
    stageIndex: options?.stageIndex,
    needsSameDayPass: options?.needsSameDayPass,
    sameDayRequeueRequired:
      options?.sameDayRequeueRequired ?? (input.rating === "1" || input.rating === "2"),
    sameDayRequeueOffset: options?.sameDayRequeueOffset,
  });
  const updatedAt = new Date().toISOString();
  const nextSession: StudySession = {
    ...validation.session,
    cards: revisitState.cards,
    currentIndex: validation.session.currentIndex + 1,
    completedCount: validation.session.completedCount + 1,
    revisitCount: revisitState.revisitCount,
    updatedAt,
    status:
      validation.session.currentIndex + 1 >= revisitState.cards.length ? "completed" : "active",
    completedAt:
      validation.session.currentIndex + 1 >= revisitState.cards.length ? updatedAt : null,
  };

  writeSessions({
    ...sessions,
    [input.sessionId]: nextSession,
  });

  return {
    status: "success",
    nextDuePreview:
      revisitState.revisitPreview ??
      options?.nextDuePreview ??
      MOCK_REVIEW_PREVIEW_BY_RATING[input.rating],
    stageIndex: options?.stageIndex,
    needsSameDayPass: options?.needsSameDayPass,
    sameDayRequeueRequired:
      options?.sameDayRequeueRequired ?? (input.rating === "1" || input.rating === "2"),
    sameDayRequeueOffset: options?.sameDayRequeueOffset,
  };
}

function formatRelativeLabel(isoString: string) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffHours = Math.max(Math.floor(diffMs / (1000 * 60 * 60)), 0);

  if (diffHours < 1) {
    return "刚刚";
  }

  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) {
    return `${diffDays} 天前`;
  }

  return "一周前";
}

function getLocalCompletedCountToday() {
  const todayStart = getStartOfToday().getTime();

  return Object.values(readSessions()).reduce((sum, session) => {
    const startedAt = new Date(session.startedAt).getTime();
    return startedAt >= todayStart && getSessionMode(session) === "formal"
      ? sum + session.completedCount
      : sum;
  }, 0);
}

function getMockHomePageData(): HomePageData {
  const runtime = getServiceRuntimeInfo();

  return {
    stats: getMockHomeStats(),
    recentDecks: getMergedMockDecks().slice(0, 3),
    dataMode: runtime.mode,
    isFallback: runtime.isFallback,
  };
}

function getMockStudyEntryData(): StudyEntryData {
  const runtime = getServiceRuntimeInfo();

  return {
    stats: getMockHomeStats(),
    decks: getMergedMockDecks(),
    dataMode: runtime.mode,
    isFallback: runtime.isFallback,
  };
}

function getMockDeckListData(): DeckListData {
  const runtime = getServiceRuntimeInfo();

  return {
    decks: getMergedMockDecks(),
    dataMode: runtime.mode,
    isFallback: runtime.isFallback,
  };
}

function getMockDeckDetailData(deckId: string): DeckDetailData {
  const runtime = getServiceRuntimeInfo();

  return {
    deck: getMockDeckById(deckId),
    cards: getMockCardsByDeckId(deckId),
    dataMode: runtime.mode,
    isFallback: runtime.isFallback,
  };
}

function getMockStatsPageData(): StatsPageData {
  const runtime = getServiceRuntimeInfo();

  return {
    highlights: statsHighlights,
    weeklyActivity,
    weakCards: [],
    dataMode: runtime.mode,
    isFallback: runtime.isFallback,
  };
}

function getMockConfusionPageData(): ConfusionPageData {
  const runtime = getServiceRuntimeInfo();

  return {
    groups: confusionGroups,
    dataMode: runtime.mode,
    isFallback: runtime.isFallback,
  };
}

async function callCloudService<T>(action: string, payload: Record<string, unknown> = {}) {
  return callCloudflareAppService<T>(action, payload);
}

export async function getHomePageData(): Promise<HomePageData> {
  const runtime = getServiceRuntimeInfo();

  if (runtime.mode === "mock") {
    return {
      ...getMockHomePageData(),
      stats: {
        ...getMockHomeStats(),
        completed: getLocalCompletedCountToday(),
      },
    };
  }

  try {
    const result = await callCloudService<Omit<HomePageData, "dataMode" | "isFallback">>(
      "getHomePageData",
    );

    return {
      ...result,
      dataMode: runtime.mode,
      isFallback: false,
    };
  } catch (error) {
    return {
      ...getMockHomePageData(),
      stats: {
        ...getMockHomeStats(),
        completed: getLocalCompletedCountToday(),
      },
      dataMode: runtime.mode,
      isFallback: true,
    };
  }
}

export async function getStudyEntryData(refresh = false): Promise<StudyEntryData> {
  const runtime = getServiceRuntimeInfo();

  if (runtime.mode === "mock") {
    return {
      ...getMockStudyEntryData(),
      stats: {
        ...getMockHomeStats(),
        completed: getLocalCompletedCountToday(),
      },
    };
  }

  try {
    const result = await callCloudService<Omit<StudyEntryData, "dataMode" | "isFallback">>(
      "getStudyEntryData",
      { refresh }
    );

    return {
      ...result,
      dataMode: runtime.mode,
      isFallback: false,
    };
  } catch (error) {
    return {
      ...getMockStudyEntryData(),
      stats: {
        ...getMockHomeStats(),
        completed: getLocalCompletedCountToday(),
      },
      dataMode: runtime.mode,
      isFallback: true,
    };
  }
}

export async function getDeckListData(): Promise<DeckListData> {
  const runtime = getServiceRuntimeInfo();

  if (runtime.mode === "mock") {
    return getMockDeckListData();
  }

  try {
    const result = await callCloudService<{ decks: Deck[] }>("getDeckListData");

    return {
      decks: result.decks,
      dataMode: runtime.mode,
      isFallback: false,
    };
  } catch (error) {
    return {
      ...getMockDeckListData(),
      dataMode: runtime.mode,
      isFallback: true,
    };
  }
}

export async function getDeckDetailData(deckId: string): Promise<DeckDetailData> {
  const runtime = getServiceRuntimeInfo();

  if (runtime.mode === "mock" || isMockRecordId(deckId)) {
    return getMockDeckDetailData(deckId);
  }

  try {
    const result = await callCloudService<{ deck: Deck | null; cards: Card[] }>("getDeckDetailData", {
      deckId,
    });

    return {
      deck: result.deck,
      cards: result.cards,
      dataMode: runtime.mode,
      isFallback: false,
    };
  } catch (error) {
    return {
      ...getMockDeckDetailData(deckId),
      dataMode: runtime.mode,
      isFallback: true,
    };
  }
}

export async function getStatsPageData(): Promise<StatsPageData> {
  const runtime = getServiceRuntimeInfo();

  if (runtime.mode === "mock") {
    return getMockStatsPageData();
  }

  try {
    const result = await callCloudService<Omit<StatsPageData, "dataMode" | "isFallback">>(
      "getStatsPageData",
    );

    return {
      ...result,
      dataMode: runtime.mode,
      isFallback: false,
    };
  } catch (error) {
    return {
      ...getMockStatsPageData(),
      dataMode: runtime.mode,
      isFallback: true,
    };
  }
}

export async function getConfusionPageData(): Promise<ConfusionPageData> {
  const runtime = getServiceRuntimeInfo();

  if (runtime.mode === "mock") {
    return getMockConfusionPageData();
  }

  try {
    const result = await callCloudService<Omit<ConfusionPageData, "dataMode" | "isFallback">>(
      "getConfusionPageData",
    );

    return {
      ...result,
      dataMode: runtime.mode,
      isFallback: false,
    };
  } catch (error) {
    return {
      ...getMockConfusionPageData(),
      dataMode: runtime.mode,
      isFallback: true,
    };
  }
}

export async function createStudySession(selectedDeckIds: string[] = []): Promise<StudySessionResult> {
  const runtime = getServiceRuntimeInfo();
  const localActiveSession = getLatestPersistedActiveFormalSession();

  if (runtime.mode === "mock" || selectedDeckIds.some((deckId) => isMockRecordId(deckId))) {
    if (localActiveSession) {
      return {
        sessionId: localActiveSession.id,
        queueCounts: localActiveSession.queueCounts,
      };
    }

    return createMockStudySession(selectedDeckIds);
  }

  try {
    const result = await callCloudService<StudySessionResult & { cards: SessionCard[]; ownerId: string; currentIndex?: number; completedCount?: number; revisitCount?: number; startedAt?: string; mode?: SessionMode; status?: StudySession["status"]; completedAt?: string | null; updatedAt?: string; selectedDeckIds?: string[]; deckScope?: DeckScope }>("createStudySession", {
      selectedDeckIds,
      maxQueueSize: SESSION_BATCH_SIZE,
    });

    if (result.queueCounts.review + result.queueCounts.new === 0) {
      removeCachedStudySession(result.sessionId);
      return {
        sessionId: result.sessionId,
        queueCounts: result.queueCounts,
      };
    }

    const cachedSession = cacheCloudStudySessionPayload(result, selectedDeckIds, "formal");

    return {
      sessionId: cachedSession?.id ?? result.sessionId,
      queueCounts: cachedSession?.queueCounts ?? result.queueCounts,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "云端学习队列生成失败，请稍后重试。",
    );
  }
}

export async function createTodayReviewSession(): Promise<StudySessionResult> {
  const runtime = getServiceRuntimeInfo();

  if (runtime.mode === "mock") {
    const cards = getTodayFormalSessionCards();

    if (cards.length === 0) {
      throw new Error("今天还没有正式学过的卡，先完成一轮正式学习。");
    }

    return persistStudySession(cards, [], undefined, `ses_${uuidv4().slice(0, 8)}`, "today-review");
  }

  try {
    const result = await callCloudService<StudySessionResult & { cards: SessionCard[]; ownerId: string; currentIndex?: number; completedCount?: number; revisitCount?: number; startedAt?: string; mode?: SessionMode; status?: StudySession["status"]; completedAt?: string | null; updatedAt?: string; selectedDeckIds?: string[]; deckScope?: DeckScope }>("createTodayReviewSession");

    if (result.cards.length === 0) {
      throw new Error("今天还没有正式学过的卡，先完成一轮正式学习。");
    }

    const cachedSession = cacheCloudStudySessionPayload(result, [], "today-review");

    return {
      sessionId: cachedSession?.id ?? result.sessionId,
      queueCounts: cachedSession?.queueCounts ?? result.queueCounts,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "今日回看队列生成失败，请稍后重试。",
    );
  }
}

export async function getActiveStudySession() {
  const runtime = getServiceRuntimeInfo();

  if (runtime.mode === "mock") {
    return getLatestPersistedActiveFormalSession();
  }

  try {
    const result = await callCloudService<{ session: StudySession | null }>("getActiveStudySession");
    const session = normalizePersistedSession(result.session);

    if (!session || !isResumableFormalSession(session)) {
      pruneCachedFormalSessions(null);
      return null;
    }

    return cacheStudySession(session);
  } catch {
    // 学习入口的自动恢复必须以云端权威状态为准，避免旧的本地缓存把用户带回错误的 session。
    return null;
  }
}

export async function createDeck(input: CreateDeckInput): Promise<CreateDeckResult> {
  const runtime = getServiceRuntimeInfo();

  if (runtime.mode === "mock") {
    return createMockDeckRecord(input);
  }

  try {
    const result = await callCloudService<{ deck: Deck }>("createDeck", {
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
    });

    notifyDataChanged();

    return {
      deck: result.deck,
      dataMode: runtime.mode,
      isFallback: false,
    };
  } catch {
    const fallback = createMockDeckRecord(input);

    return {
      ...fallback,
      dataMode: runtime.mode,
      isFallback: true,
    };
  }
}

export async function createCard(input: CreateCardInput): Promise<CreateCardResult> {
  const runtime = getServiceRuntimeInfo();

  if (runtime.mode === "mock" || isMockRecordId(input.deckId)) {
    return createMockCardRecord(input);
  }

  try {
    const result = await callCloudService<{ card: Card }>("createCard", {
      deckId: input.deckId,
      front: input.front.trim(),
      back: input.back.trim(),
      phonetic: input.phonetic?.trim() || "",
      example: input.example?.trim() || "",
      note: input.note?.trim() || "",
    });

    notifyDataChanged();

    return {
      card: result.card,
      dataMode: runtime.mode,
      isFallback: false,
    };
  } catch {
    const fallback = createMockCardRecord(input);

    return {
      ...fallback,
      dataMode: runtime.mode,
      isFallback: true,
    };
  }
}

export async function deleteDeck(input: DeleteDeckInput): Promise<DeleteDeckResult> {
  const runtime = getServiceRuntimeInfo();
  const deckId = input.deckId;

  if (runtime.mode === "mock" || isMockRecordId(deckId)) {
    return deleteMockDeckRecord(deckId);
  }

  const result = await callCloudService<{ deleted: boolean; deckId: string }>("deleteDeck", {
    deckId,
  });

  notifyDataChanged();

  return {
    deleted: result.deleted,
    deckId: result.deckId,
    dataMode: runtime.mode,
    isFallback: false,
  };
}

export async function getStudySession(sessionId: string) {
  const localSession = getPersistedStudySession(sessionId);

  if (localSession) {
    return localSession;
  }

  const runtime = getServiceRuntimeInfo();

  if (runtime.mode === "mock") {
    return null;
  }

  try {
    const result = await callCloudService<{ session: StudySession | null }>("getStudySession", {
      sessionId,
    });
    const session = normalizePersistedSession(result.session);

    if (!session) {
      removeCachedStudySession(sessionId);
      return null;
    }

    return cacheStudySession(session);
  } catch {
    return localSession;
  }
}

export async function submitReview(input: SubmitReviewInput): Promise<SubmitReviewResult> {
  const runtime = getServiceRuntimeInfo();

  if (runtime.mode === "mock" || isMockRecordId(input.cardId)) {
    return advancePersistedStudySession(input);
  }

  const validation = validateReviewSession(input);

  if (validation.error || !validation.session || !validation.currentCard) {
    return (
      validation.error ?? {
        status: "failure",
        stage: "session_lookup",
        message: "学习 session 不存在，请重新开始。",
      }
    );
  }

  if (getSessionMode(validation.session) === "today-review") {
    return advancePersistedStudySession(input, {
      nextDuePreview: "正式复习计划保持不变",
      stageIndex: validation.currentCard.stageIndex,
      needsSameDayPass: input.rating === "1" || input.rating === "2",
      sameDayRequeueRequired: input.rating === "1" || input.rating === "2",
      sameDayRequeueOffset: input.rating === "1" ? 4 : input.rating === "2" ? 8 : 0,
    });
  }

  if (input.simulateFailure) {
    return {
      status: "failure",
      stage: "mock_submit",
      message: "模拟提交失败，请稍后重试。",
    };
  }

  try {
    const result = await callCloudService<{ nextDuePreview?: string; stageIndex?: number; needsSameDayPass?: boolean; sameDayRequeueRequired?: boolean; sameDayRequeueOffset?: number }>("submitReview", {
      sessionId: input.sessionId,
      cardId: input.cardId,
      rating: Number(input.rating),
      ownerId: validation.session.ownerId,
    });

    const localResult = advancePersistedStudySession(input, {
      nextDuePreview: result.nextDuePreview,
      stageIndex: result.stageIndex,
      needsSameDayPass: result.needsSameDayPass,
      sameDayRequeueRequired: result.sameDayRequeueRequired,
      sameDayRequeueOffset: result.sameDayRequeueOffset,
    });

    if (localResult.status === "failure") {
      return localResult;
    }

    return {
      status: "success",
      nextDuePreview: localResult.nextDuePreview ?? result.nextDuePreview,
      stageIndex: result.stageIndex,
      needsSameDayPass: result.needsSameDayPass,
      sameDayRequeueRequired: result.sameDayRequeueRequired,
      sameDayRequeueOffset: result.sameDayRequeueOffset,
    };
  } catch (error) {
    return {
      status: "failure",
      stage: "persist_review",
      message: error instanceof Error ? error.message : "评分提交失败，请稍后重试。",
    };
  }
}

export async function getStudyCompletion(sessionId: string): Promise<StudyCompletionSummary | null> {
  const session = await getStudySession(sessionId);
  return session ? getStudyCompletionFromSession(session) : null;
}

export async function importCsv(input: ImportCsvInput) {
  const runtime = getServiceRuntimeInfo();
  const { rows: parsedRows, rowFailures: initialFailures } = parseImportRows(input);

  if (initialFailures.length > 0 && parsedRows.length === 0) {
    return {
      batchId: `batch_${uuidv4().slice(0, 8)}`,
      createdCount: 0,
      failedCount: initialFailures.length,
      rowFailures: initialFailures,
    };
  }

  if (runtime.mode === "mock") {
    return importMockCsvPersisted(input);
  }

  if (input.simulateFailure) {
    return importMockCsv(input);
  }

  try {
    const rowBatches = chunkImportRows(parsedRows, input.fileName, input.defaultDeckName);
    const aggregatedResult: ImportCsvResult = {
      batchId: `batch_${uuidv4().slice(0, 8)}`,
      createdCount: 0,
      failedCount: 0,
      rowFailures: [],
    };

    for (const batchRows of rowBatches) {
      const batchResult = await callCloudService<ImportCsvResult>("importCsv", {
        fileName: input.fileName,
        rows: batchRows,
        defaultDeckName: input.defaultDeckName ?? "",
      });

      aggregatedResult.createdCount += batchResult.createdCount;
      aggregatedResult.failedCount += batchResult.failedCount;
      aggregatedResult.rowFailures?.push(...(batchResult.rowFailures ?? []));
    }

    notifyDataChanged();

    return aggregatedResult;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "云端导入失败，请稍后重试。",
    );
  }
}

const MANUAL_CONFUSIONS_KEY = "animal-farm:manual-confusions";

function readMockManualConfusions(): ConfusionGroup[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(MANUAL_CONFUSIONS_KEY);

    return raw ? (JSON.parse(raw) as ConfusionGroup[]) : [];
  } catch {
    return [];
  }
}

function writeMockManualConfusions(groups: ConfusionGroup[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(MANUAL_CONFUSIONS_KEY, JSON.stringify(groups));
  } catch {
    // ignore
  }
}

export async function createManualConfusionGroup(
  sourceCardId: string,
  targetCardIds: string[],
): Promise<{ groupId: string }> {
  const runtime = getServiceRuntimeInfo();

  if (runtime.mode === "mock") {
    const existing = readMockManualConfusions();
    // TODO: include custom cards (readCustomCards) in the lookup
    const allCards = getAllMockCards();
    const sourceCard = allCards.find((c) => c.id === sourceCardId);

    if (!sourceCard) {
      throw new Error("主卡片不存在");
    }

    const targetCards = targetCardIds
      .map((id) => allCards.find((c) => c.id === id))
      .filter(Boolean) as Card[];

    const deck = mockDecks.find((d) => d.id === sourceCard.deckId);

    const newGroup: ConfusionGroup = {
      cardId: sourceCard.id,
      front: sourceCard.front,
      back: sourceCard.back,
      deckName: deck?.name ?? "",
      lowRatingCount: 0,
      lastReviewedAt: null,
      source: "manual",
      confusions: targetCards.map((card) => {
        const similarityScore = calculateMultiDimensionalSimilarity(
          sourceCard,
          card,
        ).total;
        const targetDeck = mockDecks.find((d) => d.id === card.deckId);

        return {
          cardId: card.id,
          front: card.front,
          back: card.back,
          deckName: targetDeck?.name ?? "",
          lowRatingCount: 0,
          lastReviewedAt: null,
          similarityScore,
        };
      }),
    };

    writeMockManualConfusions([...existing, newGroup]);

    return { groupId: sourceCardId };
  }

  try {
    const result = await callCloudService<{ groupId: string }>("createManualConfusionGroup", {
      sourceCardId,
      targetCardIds,
    });

    return result;
  } catch (error) {

    throw new Error(error instanceof Error ? error.message : "创建易混分组失败");
  }
}

export async function getManualConfusionGroups(): Promise<ConfusionPageData> {
  const runtime = getServiceRuntimeInfo();

  if (runtime.mode === "mock") {
    return {
      groups: readMockManualConfusions(),
      dataMode: runtime.mode,
      isFallback: runtime.isFallback,
    };
  }

  try {
    const result = await callCloudService<Omit<ConfusionPageData, "dataMode" | "isFallback">>(
      "getManualConfusionGroups",
    );

    return {
      ...result,
      dataMode: runtime.mode,
      isFallback: false,
    };
  } catch (error) {
    return {
      groups: [],
      dataMode: runtime.mode,
      isFallback: true,
    };
  }
}

export async function createAutoConfusionGroups(
  groups: CreateAutoConfusionGroupsInput["groups"],
): Promise<CreateAutoConfusionGroupsResult> {
  const runtime = getServiceRuntimeInfo();

  if (runtime.mode === "mock") {
    let createdCount = 0;
    for (const group of groups) {
      if (group.targetCardIds.length > 0) {
        try {
          await createManualConfusionGroup(
            group.sourceCardId,
            group.targetCardIds,
          );
          createdCount++;
        } catch {
          // Skip failing groups, continue with the rest
        }
      }
    }
    return { createdCount };
  }

  const result = await callCloudService<CreateAutoConfusionGroupsResult>(
    "createAutoConfusionGroups",
    { groups },
  );

  return result;
}

export async function getAllCards(): Promise<Card[]> {
  const runtime = getServiceRuntimeInfo();

  if (runtime.mode === "mock") {
    return getAllMockCards();
  }

  try {
    const result = await callCloudService<Card[]>("getAllCards");

    return result;
  } catch (error) {

    // Fallback: fetch all decks then cards from each deck
    try {
      const deckList = await callCloudService<{ decks: Deck[] }>("getDeckListData");
      const deckIds = deckList.decks.map((d) => d.id);

      if (deckIds.length === 0) {
        return getAllMockCards();
      }

      const detailResults = await Promise.all(
        deckIds.map((deckId) =>
          callCloudService<{ cards: Card[] }>("getDeckDetailData", { deckId }).catch(() => ({ cards: [] })),
        ),
      );

      const allCards: Card[] = [];

      for (const result of detailResults) {
        allCards.push(...result.cards);
      }

      return allCards.length > 0 ? allCards : getAllMockCards();
    } catch {
      return getAllMockCards();
    }
  }
}

function getAllMockCards(): Card[] {
  const cards: Card[] = [];

  for (const deck of mockDecks) {
    cards.push(...getCardsByDeckId(deck.id));
  }

  return cards;
}
