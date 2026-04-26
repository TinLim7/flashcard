"use client";

import { useEffect, useMemo, useState } from "react";

import { Check, Search } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { parseCardBack } from "@/lib/card-content";
import { getAllCards, getDeckListData } from "@/lib/data-service";
import type { Card, Deck } from "@/lib/types";

interface CardSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  sourceCardId?: string;
  onConfirm: (selectedCardIds: string[]) => void;
  title?: string;
  confirmLabel?: string;
  minSelection?: number;
}

export function CardSelector({
  isOpen,
  onClose,
  sourceCardId,
  onConfirm,
  title = "选择易混卡片",
  confirmLabel = "确认标记",
  minSelection = 1,
}: CardSelectorProps) {
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setIsLoading(true);

    void Promise.all([getAllCards(), getDeckListData()]).then(([cards, deckData]) => {
      setAllCards(cards);
      setDecks(deckData.decks);
      setIsLoading(false);
    });
  }, [isOpen]);

  const deckMap = useMemo(() => {
    const map = new Map<string, string>();

    decks.forEach((d) => map.set(d.id, d.name));

    return map;
  }, [decks]);

  const availableCards = useMemo(() => {
    if (sourceCardId) {
      return allCards.filter((c) => c.id !== sourceCardId);
    }

    return allCards;
  }, [allCards, sourceCardId]);

  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableCards;
    }

    const q = searchQuery.toLowerCase();

    return availableCards.filter((c) => {
      const parsed = parseCardBack(c.back);

      return (
        c.front.toLowerCase().includes(q) ||
        (c.phonetic?.toLowerCase().includes(q) ?? false) ||
        parsed.meanings.some((m) => m.toLowerCase().includes(q))
      );
    });
  }, [availableCards, searchQuery]);

  const toggleCard = (cardId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }

      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds));
    setSelectedIds(new Set());
    setSearchQuery("");
    onClose();
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    setSearchQuery("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} className="max-w-lg">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            size={16}
          />
          <Input
            placeholder="搜索单词、音标或释义..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-[var(--text-muted)]">正在加载卡片...</div>
        ) : filteredCards.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--text-muted)]">没有找到匹配的卡片</div>
        ) : (
          <div className="max-h-[44vh] space-y-2 overflow-y-auto pr-1">
            {filteredCards.map((card) => {
              const parsed = parseCardBack(card.back);
              const isSelected = selectedIds.has(card.id);
              const deckName = deckMap.get(card.deckId) ?? "";

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => toggleCard(card.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-[var(--border-color)] bg-[var(--bg-body)] hover:border-primary/30 hover:bg-[var(--bg-card)]"
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-white"
                        : "border-[var(--border-color)] bg-[var(--bg-card)]"
                    }`}
                  >
                    {isSelected ? <Check size={13} strokeWidth={3} /> : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text-main)]">{card.front}</span>
                      {card.phonetic ? (
                        <span className="font-mono text-xs text-[var(--text-muted)]">{card.phonetic}</span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="truncate text-xs text-[var(--text-muted)]">
                        {parsed.meanings[0] ?? card.back}
                      </span>
                      {deckName ? (
                        <span className="shrink-0 rounded-full bg-[var(--bg-card)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                          {deckName}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[var(--border-color)] pt-4">
          <span className="text-sm text-[var(--text-muted)]">
            已选择 <span className="font-bold text-[var(--text-main)]">{selectedIds.size}</span> 张
          </span>
          <Button onClick={handleConfirm} disabled={selectedIds.size < minSelection}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
