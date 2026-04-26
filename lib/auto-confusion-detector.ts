import { getAllCards, createAutoConfusionGroups } from "./data-service";
import { calculateMultiDimensionalSimilarity } from "./confusion-similarity";
import type { AutoConfusionGroup, Card } from "./types";

export interface AutoDetectResult {
  createdCount: number;
}

export async function autoDetectConfusions(
  newCards: Card[],
): Promise<AutoDetectResult> {
  if (newCards.length === 0) {
    return { createdCount: 0 };
  }

  // Note: getAllCards may fall back to mock data if cloud service is unavailable.
  const allCards = await getAllCards();
  const candidates: AutoConfusionGroup[] = [];

  // O(N * M) complexity; acceptable for typical deck sizes.
  // Consider chunking if decks grow beyond a few thousand cards.
  for (const newCard of newCards) {
    const scores = allCards
      .filter(
        (c) =>
          c.id !== newCard.id && c.deckId === newCard.deckId,
      )
      .map((c) => ({
        cardId: c.id,
        breakdown: calculateMultiDimensionalSimilarity(newCard, c),
      }))
      .filter((s) => s.breakdown.isConfusionCandidate)
      .sort((a, b) => b.breakdown.total - a.breakdown.total)
      .slice(0, 3);

    if (scores.length > 0) {
      candidates.push({
        sourceCardId: newCard.id,
        targetCardIds: scores.map((s) => s.cardId),
      });
    }
  }

  if (candidates.length === 0) {
    return { createdCount: 0 };
  }

  const result = await createAutoConfusionGroups(candidates);
  return result;
}
