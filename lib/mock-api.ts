import { v4 as uuidv4 } from "uuid";

import { buildStudyQueue, getStudyCompletionSummary, ratingCopy } from "@/lib/mock-data";
import type {
  ImportCsvInput,
  ImportCsvResult,
  PairDeviceInput,
  PairDeviceResult,
  StudyCompletionSummary,
  StudySession,
  StudySessionResult,
  SubmitReviewInput,
  SubmitReviewResult,
} from "@/lib/types";

const SESSION_STORAGE_KEY = "animal-farm-study-sessions";

let sessionCache: Record<string, StudySession> = {};

function canUseStorage() {
  return typeof window !== "undefined";
}

function readSessions() {
  if (!canUseStorage()) {
    return sessionCache;
  }

  const rawValue = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (!rawValue) {
    return sessionCache;
  }

  try {
    const parsed = JSON.parse(rawValue) as Record<string, StudySession>;
    sessionCache = parsed;
    return parsed;
  } catch {
    return sessionCache;
  }
}

function writeSessions(nextSessions: Record<string, StudySession>) {
  sessionCache = nextSessions;

  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSessions));
}

export function createStudySession(selectedDeckIds: string[] = []): StudySessionResult {
  const cards = buildStudyQueue(selectedDeckIds);
  const sessionId = `ses_${uuidv4().slice(0, 8)}`;

  const queueCounts = cards.reduce(
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

  const nextSession: StudySession = {
    id: sessionId,
    mode: "formal",
    deckScope: selectedDeckIds.length > 0 ? "selected" : "all",
    selectedDeckIds,
    queueCounts,
    cards,
    currentIndex: 0,
    completedCount: 0,
    revisitCount: 0,
    startedAt: new Date().toISOString(),
  };

  const sessions = readSessions();

  writeSessions({
    ...sessions,
    [sessionId]: nextSession,
  });

  return {
    sessionId,
    queueCounts,
  };
}

export function getStudySession(sessionId: string) {
  const sessions = readSessions();
  return sessions[sessionId] ?? null;
}

export function submitReview(input: SubmitReviewInput): SubmitReviewResult {
  const sessions = readSessions();
  const session = sessions[input.sessionId];

  if (!session) {
    return {
      status: "failure",
      stage: "session_lookup",
      message: "学习 session 不存在，请重新开始。",
    };
  }

  const currentCard = session.cards[session.currentIndex];

  if (!currentCard || currentCard.id !== input.cardId) {
    return {
      status: "failure",
      stage: "card_lookup",
      message: "当前卡片状态已过期，请刷新学习页。",
    };
  }

  if (input.simulateFailure) {
    return {
      status: "failure",
      stage: "mock_submit",
      message: "模拟提交失败，请稍后重试。",
    };
  }

  const nextSession: StudySession = {
    ...session,
    currentIndex: session.currentIndex + 1,
    completedCount: session.completedCount + 1,
    revisitCount: session.revisitCount ?? 0,
  };

  writeSessions({
    ...sessions,
    [input.sessionId]: nextSession,
  });

  return {
    status: "success",
    nextDuePreview: ratingCopy[input.rating] ?? "稍后复习",
    stageIndex: input.rating === "1" || input.rating === "2" ? 0 : input.rating === "3" ? 1 : 2,
    needsSameDayPass: input.rating === "1" || input.rating === "2",
    sameDayRequeueRequired: input.rating === "1" || input.rating === "2",
    sameDayRequeueOffset: input.rating === "1" ? 4 : input.rating === "2" ? 8 : 0,
  };
}

export function getStudyCompletion(sessionId: string): StudyCompletionSummary | null {
  const session = getStudySession(sessionId);

  if (!session) {
    return null;
  }

  return getStudyCompletionSummary(
    session.id,
    session.completedCount,
    session.queueCounts,
    session.cards.length,
  );
}

export function importCsv(input: ImportCsvInput): ImportCsvResult {
  const batchId = `batch_${uuidv4().slice(0, 8)}`;
  const trimmedRows = input.rows.filter((row) => row.trim().length > 0);

  if (input.simulateFailure) {
    return {
      batchId,
      createdCount: Math.max(trimmedRows.length - 2, 0),
      failedCount: Math.min(trimmedRows.length, 2),
      rowFailures: [
        {
          rowNumber: 2,
          errorCode: "missing_translation",
          message: "缺少释义列，无法生成卡片。",
        },
        {
          rowNumber: 4,
          errorCode: "duplicate_entry",
          message: "与当前牌组已有词条重复。",
        },
      ].filter((failure) => failure.rowNumber <= trimmedRows.length + 1),
    };
  }

  return {
    batchId,
    createdCount: trimmedRows.length,
    failedCount: 0,
    rowFailures: [],
  };
}

export function pairDevice(input: PairDeviceInput): PairDeviceResult {
  if (input.simulateFailure || input.pairCode.trim().length < 6) {
    return {
      paired: false,
      stage: "pair_code_validation",
      message: "配对码无效或已过期，请重新生成后再试。",
    };
  }

  return {
    paired: true,
    deviceLabel: "MacBook Air - 本地开发环境",
  };
}
