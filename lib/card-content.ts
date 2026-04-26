export interface ParsedCardBack {
  pos: string;
  meanings: string[];
}

export interface ParsedCardNote {
  sentence: string;
  contextMeaning: string;
  source: string;
  raw: string;
}

export function parseCardBack(back: string): ParsedCardBack {
  const trimmed = back.trim();
  const match = trimmed.match(/^(phr\.v\.|n\.|v\.|adj\.|adv\.)\s*(.*)$/i);
  const pos = match?.[1] ?? "";
  const body = (match?.[2] ?? trimmed).trim();

  const numbered = body
    .split(/(?=[①②③④⑤])/)
    .map((item) => item.replace(/^[①②③④⑤]\s*/, "").trim())
    .filter(Boolean);

  if (numbered.length > 0) {
    return { pos, meanings: numbered };
  }

  const splitBySemicolon = body
    .split("；")
    .map((item) => item.trim())
    .filter(Boolean);

  return { pos, meanings: splitBySemicolon.length > 0 ? splitBySemicolon : [body] };
}

export function parseCardNote(note?: string | null): ParsedCardNote | null {
  if (!note) {
    return null;
  }

  const parts = note
    .split("｜")
    .map((item) => item.trim())
    .filter(Boolean);

  const sentence = parts.find((item) => item.startsWith("句子意思："))?.replace("句子意思：", "").trim() ?? "";
  const contextMeaning =
    parts.find((item) => item.startsWith("句中义："))?.replace("句中义：", "").trim() ?? "";
  const source = parts.find((item) => item.startsWith("出处："))?.replace("出处：", "").trim() ?? "";

  return {
    sentence,
    contextMeaning,
    source,
    raw: note,
  };
}
