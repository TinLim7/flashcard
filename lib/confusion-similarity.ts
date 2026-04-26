import { parseCardBack } from "./card-content";
import type { Card } from "./types";

export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1,
            );
    }
  }
  return matrix[b.length][a.length];
}

export function levenshteinSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLength = Math.max(a.length, b.length);
  return maxLength === 0 ? 1 : 1 - distance / maxLength;
}

function extractConsonants(phonetic: string): string {
  return phonetic
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/[aeiou]/g, "");
}

function lcsLength(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export function phoneticSkeletonSimilarity(
  a?: string,
  b?: string,
): number {
  if (!a || !b) return 0;
  const skeletonA = extractConsonants(a);
  const skeletonB = extractConsonants(b);
  const maxLen = Math.max(skeletonA.length, skeletonB.length);
  if (maxLen === 0) return 0;
  return lcsLength(skeletonA, skeletonB) / maxLen;
}

const STOP_WORDS = new Set([
  "的", "了", "是", "在", "和", "与", "或", "等", "之", "为", "有", "被", "从", "到", "以", "及", "其", "这", "那",
]);

function extractMeaningKeywords(meaningText: string): string[] {
  const words = meaningText
    .split(/[,;，；/|·\s]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  return words.slice(0, 5);
}

export function meaningJaccardSimilarity(
  aBack: string,
  bBack: string,
): number {
  const wordsA = extractMeaningKeywords(
    parseCardBack(aBack).meanings.join(" "),
  );
  const wordsB = extractMeaningKeywords(
    parseCardBack(bBack).meanings.join(" "),
  );
  const intersection = wordsA.filter((w) => wordsB.includes(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

export interface SimilarityBreakdown {
  spelling: number;
  phonetic: number;
  meaning: number;
  total: number;
  isConfusionCandidate: boolean;
}

export function calculateMultiDimensionalSimilarity(
  a: Card,
  b: Card,
): SimilarityBreakdown {
  const spelling = levenshteinSimilarity(a.front, b.front);
  const phonetic = phoneticSkeletonSimilarity(a.phonetic, b.phonetic);
  const meaning = meaningJaccardSimilarity(a.back, b.back);
  const total = spelling * 0.5 + phonetic * 0.3 + meaning * 0.2;

  const dimensionsAboveThreshold = [
    spelling > 0.5,
    phonetic > 0.5,
    meaning > 0.5,
  ].filter(Boolean).length;

  return {
    spelling,
    phonetic,
    meaning,
    total,
    isConfusionCandidate: total >= 0.65 && dimensionsAboveThreshold >= 2,
  };
}
