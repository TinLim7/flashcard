export type ReviewRating = "1" | "2" | "3" | "4";
export type QueueKind = "review" | "new";
export type DeckScope = "all" | "selected";
export type CardStatus = "new" | "learning" | "review" | "suspended";
export type SchedulingState = "new" | "learning" | "review" | "relearning" | "suspended";
export type DataMode = "mock" | "cloudflare";
export type SessionMode = "formal" | "today-review";
export type StudySessionStatus = "active" | "completed";

export interface Deck {
  id: string;
  name: string;
  description: string;
  dueCount: number;
  newCount: number;
  totalCount: number;
  lastStudiedLabel: string;
  tags: string[];
}

export interface Card {
  id: string;
  deckId: string;
  front: string;
  phonetic?: string;
  back: string;
  example?: string;
  note?: string;
  status?: CardStatus;
  nextDueAt?: string | null;
  stageIndex?: number;
  introducedAt?: string | null;
  lastRating?: ReviewRating | null;
  needsSameDayPass?: boolean;
}

export interface SessionCard extends Card {
  queue: QueueKind;
  position: number;
  revisitStep?: number;
  revisitAfterCards?: number;
}

export interface StudySession {
  id: string;
  status?: StudySessionStatus;
  mode: SessionMode;
  deckScope: DeckScope;
  selectedDeckIds: string[];
  ownerId?: string;
  queueCounts: {
    review: number;
    new: number;
  };
  cards: SessionCard[];
  currentIndex: number;
  completedCount: number;
  revisitCount: number;
  startedAt: string;
  completedAt?: string | null;
  updatedAt?: string;
}

export interface FrontendLogContext {
  trace_id?: string;
  session_id?: string;
  device_id?: string;
  owner_id?: string;
  route?: string;
  action?: string;
  result?: string;
  deck_id?: string;
  card_id?: string;
  batch_id?: string;
  pair_code_id?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface HomeStats {
  reviews: number;
  newCards: number;
  completed: number;
  total: number;
  streak: number;
  estMinutes: number;
  todayNewLimit: number;
  todayNewIntroduced: number;
  todayReviewedCount: number;
}

export interface StudySessionResult {
  sessionId: string;
  queueCounts: {
    review: number;
    new: number;
  };
}

export interface SubmitReviewInput {
  sessionId: string;
  cardId: string;
  rating: ReviewRating;
  simulateFailure?: boolean;
}

export interface SubmitReviewResult {
  status: "success" | "failure";
  nextDuePreview?: string;
  stageIndex?: number;
  needsSameDayPass?: boolean;
  sameDayRequeueRequired?: boolean;
  sameDayRequeueOffset?: number;
  message?: string;
  stage?: string;
}

export interface CsvRowFailure {
  rowNumber: number;
  errorCode: string;
  message: string;
}

export interface ImportCsvInput {
  fileName: string;
  rows: string[];
  defaultDeckName?: string;
  simulateFailure?: boolean;
}

export interface ImportCsvResult {
  batchId: string;
  createdCount: number;
  failedCount: number;
  rowFailures?: CsvRowFailure[];
}

export interface StatsHighlight {
  label: string;
  value: string;
  hint: string;
}

export interface WeeklyActivityPoint {
  day: string;
  count: number;
}

export interface WeakCardStat {
  cardId: string;
  front: string;
  deckName: string;
  lowRatingCount: number;
  lastReviewedAt: string | null;
}

export interface ConfusionCandidate {
  cardId: string;
  front: string;
  back: string;
  deckName: string;
  lowRatingCount: number;
  lastReviewedAt: string | null;
  similarityScore: number;
}

export interface ConfusionGroup {
  cardId: string;
  front: string;
  back: string;
  deckName: string;
  lowRatingCount: number;
  lastReviewedAt: string | null;
  source: "auto" | "manual";
  confusions: ConfusionCandidate[];
}

export interface PairDeviceInput {
  pairCode: string;
  pairCodeId: string;
  simulateFailure?: boolean;
}

export interface PairDeviceResult {
  paired: boolean;
  deviceLabel?: string;
  message?: string;
  stage?: string;
}

export interface StudyCompletionSummary {
  sessionId: string;
  sessionMode: SessionMode;
  completedCount: number;
  reviewCount: number;
  newCount: number;
  remainingCount: number;
}

export interface CreateDeckInput {
  name: string;
  description?: string;
  tags?: string[];
}

export interface CreateDeckResult {
  deck: Deck;
  dataMode: DataMode;
  isFallback: boolean;
}

export interface CreateCardInput {
  deckId: string;
  front: string;
  back: string;
  phonetic?: string;
  example?: string;
  note?: string;
}

export interface CreateCardResult {
  card: Card;
  dataMode: DataMode;
  isFallback: boolean;
}

export interface DeleteDeckResult {
  deleted: boolean;
  deckId: string;
  dataMode: DataMode;
  isFallback: boolean;
}

export interface DeleteDeckInput {
  deckId: string;
}

export interface CardScheduling {
  cardId: string;
  state: SchedulingState;
  dueAt: string | null;
  stability: number | null;
  difficulty: number | null;
  retrievability: number | null;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  lastReviewedAt: string | null;
  stageIndex: number;
  introducedAt: string | null;
  lastRating: ReviewRating | null;
  needsSameDayPass: boolean;
}

export interface ReviewLog {
  id: string;
  cardId: string;
  reviewedAt: string;
  rating: number;
  scheduledDaysBefore: number;
  scheduledDaysAfter: number;
}

export interface DevicePairing {
  id: string;
  pairCode: string;
  expiresAt: string;
  usedAt: string | null;
  deviceLabel: string;
}

export interface PairedDeviceSummary {
  id: string;
  deviceLabel: string;
  pairedAt: string;
  lastSeenAt: string | null;
}

export interface GeneratePairCodeInput {
  deviceLabel: string;
}

export interface GeneratePairCodeResult {
  pairingId: string;
  pairCode: string;
  expiresAt: string;
  deviceLabel: string;
  dataMode: DataMode;
  isFallback: boolean;
}

export interface PairingOverview {
  devices: PairedDeviceSummary[];
  activePairCode: GeneratePairCodeResult | null;
  dataMode: DataMode;
  isFallback: boolean;
}

export interface HomePageData {
  stats: HomeStats;
  recentDecks: Deck[];
  dataMode: DataMode;
  isFallback: boolean;
}

export interface StudyEntryData {
  stats: HomeStats;
  decks: Deck[];
  dataMode: DataMode;
  isFallback: boolean;
}

export interface DeckListData {
  decks: Deck[];
  dataMode: DataMode;
  isFallback: boolean;
}

export interface DeckDetailData {
  deck: Deck | null;
  cards: Card[];
  dataMode: DataMode;
  isFallback: boolean;
}

export interface StatsPageData {
  highlights: StatsHighlight[];
  weeklyActivity: WeeklyActivityPoint[];
  weakCards: WeakCardStat[];
  dataMode: DataMode;
  isFallback: boolean;
}

export interface ConfusionPageData {
  groups: ConfusionGroup[];
  dataMode: DataMode;
  isFallback: boolean;
}

export interface ServiceRuntimeInfo {
  mode: DataMode;
  requestedMode: DataMode;
  isFallback: boolean;
  reason?: string;
}

export interface CreateAutoConfusionGroupsInput {
  groups: {
    sourceCardId: string;
    targetCardIds: string[];
  }[];
}

export interface CreateAutoConfusionGroupsResult {
  createdCount: number;
}

export type AutoConfusionGroup = CreateAutoConfusionGroupsInput["groups"][number];
