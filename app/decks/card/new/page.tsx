"use client";

import { Suspense, useEffect, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { StateCard } from "@/components/ui/StateCard";
import { createCard, getDeckDetailData } from "@/lib/data-service";
import { buildDeckDetailHref } from "@/lib/routes";
import { getServiceRuntimeInfo } from "@/lib/service-config";
import { sleep } from "@/lib/utils";

function NewDeckCardPageContent() {
  const router = useRouter();
  const runtime = getServiceRuntimeInfo();
  const searchParams = useSearchParams();
  const deckId = searchParams.get("deckId") ?? "";

  const [deckName, setDeckName] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [phonetic, setPhonetic] = useState("");
  const [example, setExample] = useState("");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    if (!deckId) {
      setDeckName("");
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const result = await getDeckDetailData(deckId);

        if (!isMounted) {
          return;
        }

        setDeckName(result.deck?.name ?? "");
        setIsFallback(result.isFallback);
        setIsLoading(false);
      })();
    }, 120);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [deckId]);

  if (isLoading) {
    return (
      <StateCard
        tone="loading"
        title="正在准备卡片表单"
        description="马上载入牌组上下文，方便你继续录入内容。"
      />
    );
  }

  if (!deckId || !deckName) {
    return (
      <StateCard
        tone="error"
        title="无法新建卡片"
        description="当前牌组不存在，请先回到牌组列表确认路径是否正确。"
      />
    );
  }

  const handleSubmit = async (submitMode: "stay" | "exit") => {
    if (!front.trim() || !back.trim()) {
      setErrorMessage("正面和释义都需要填写。");
      setMessage("");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setMessage("");

    await sleep(420);

    try {
      const result = await createCard({
        deckId,
        front,
        back,
        phonetic,
        example,
        note,
      });

      setIsSaving(false);
      setMessage(
        result.isFallback
          ? `已保存到“${deckName}”，当前使用 fallback 数据源。`
          : `已保存到“${deckName}”。`,
      );

      if (submitMode === "stay") {
        setFront("");
        setBack("");
        setPhonetic("");
        setExample("");
        setNote("");
        return;
      }

      await sleep(420);
      router.push(buildDeckDetailHref(deckId));
    } catch {
      setIsSaving(false);
      setErrorMessage("保存失败，请稍后重试。");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--text-main)]">新增卡片</h1>
        <p className="mt-2 text-[var(--text-muted)]">当前牌组：{deckName}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-[var(--bg-card)] px-3 py-1 text-[var(--text-muted)]">
            数据源：{runtime.mode}
          </span>
          {runtime.isFallback || isFallback ? (
            <span className="rounded-full bg-warning/10 px-3 py-1 text-warning">
              当前可能回退到 mock 数据
            </span>
          ) : null}
        </div>
      </div>

      <Card className="space-y-5 p-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--text-main)]">英文正面</label>
          <Input value={front} onChange={(event) => setFront(event.target.value)} placeholder="例如：composure" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--text-main)]">中文释义（可写多个义项）</label>
          <Textarea
            value={back}
            onChange={(event) => setBack(event.target.value)}
            placeholder="例如：v. ① 融化 ② 熔化 ③ （感情）软化"
            className="min-h-[140px]"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--text-main)]">音标</label>
          <Input value={phonetic} onChange={(event) => setPhonetic(event.target.value)} placeholder="例如：/kəmˈpəʊʒər/" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--text-main)]">例句</label>
          <Textarea
            value={example}
            onChange={(event) => setExample(event.target.value)}
            placeholder="可选，用于学习页背面展示"
            className="min-h-[120px]"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--text-main)]">语境说明</label>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="例如：句子意思：……｜句中义：这个词在这里表示……｜出处：Chapter II"
            className="min-h-[100px]"
          />
        </div>

        {errorMessage ? (
          <StateCard tone="error" title="内容还不完整" description={errorMessage} />
        ) : null}
        {message ? <StateCard tone="empty" title="卡片已保存" description={message} /> : null}

        <div className="flex flex-col gap-3 md:flex-row">
          <Button
            onClick={() => {
              void handleSubmit("exit");
            }}
            isLoading={isSaving}
            className="md:flex-1"
          >
            {isSaving ? "正在保存..." : "保存并返回牌组"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              void handleSubmit("stay");
            }}
            disabled={isSaving}
            className="md:flex-1"
          >
            保存并继续添加
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function NewDeckCardPage() {
  return (
    <Suspense
      fallback={
        <StateCard
          tone="loading"
          title="正在准备卡片表单"
          description="马上载入牌组上下文，方便你继续录入内容。"
        />
      }
    >
      <NewDeckCardPageContent />
    </Suspense>
  );
}
