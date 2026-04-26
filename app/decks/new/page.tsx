"use client";

import { useState } from "react";

import { Layers, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { StateCard } from "@/components/ui/StateCard";
import { createDeck } from "@/lib/data-service";
import { buildDeckDetailHref } from "@/lib/routes";
import { getServiceRuntimeInfo } from "@/lib/service-config";
import { sleep } from "@/lib/utils";

export default function NewDeckPage() {
  const router = useRouter();
  const runtime = getServiceRuntimeInfo();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) {
      setErrorMessage("牌组名称不能为空。");
      setMessage("");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setMessage("");

    await sleep(480);

    try {
      const result = await createDeck({
        name,
        description,
        tags: tags.split(","),
      });

      setIsSaving(false);
      setMessage(
        result.isFallback
          ? `已创建牌组“${result.deck.name}”，当前使用 fallback 数据源。`
          : `已创建牌组“${result.deck.name}”。`,
      );

      await sleep(420);
      router.push(buildDeckDetailHref(result.deck.id));
    } catch {
      setIsSaving(false);
      setErrorMessage("创建失败，请稍后重试。");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--text-main)]">新建牌组</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          先把基本信息补齐，当前会优先尝试通过统一 service 写入数据源。
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-[var(--bg-card)] px-3 py-1 text-[var(--text-muted)]">
            数据源：{runtime.mode}
          </span>
          {runtime.isFallback ? (
            <span className="rounded-full bg-warning/10 px-3 py-1 text-warning">
              {runtime.reason}
            </span>
          ) : null}
        </div>
      </div>

      <Card className="space-y-5 p-6">
        <div className="grid gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text-main)]">牌组名称</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：Animal Farm 精读词汇" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text-main)]">描述</label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="一句话说明这个牌组适合什么学习场景"
              className="min-h-[140px]"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text-main)]">标签</label>
            <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="用逗号分隔，例如：精读,文学,高频词" />
          </div>
        </div>

        {errorMessage ? (
          <StateCard tone="error" title="暂时无法保存" description={errorMessage} />
        ) : null}
        {message ? <StateCard tone="empty" title="牌组已创建" description={message} /> : null}

        <Button onClick={handleSubmit} isLoading={isSaving}>
          <Layers className="mr-2" size={18} />
          {isSaving ? "正在创建..." : "创建牌组"}
        </Button>
      </Card>

      <Card className="border-dashed p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="font-bold text-[var(--text-main)]">下一阶段可接入的能力</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              牌组封面、共享模板和更完整的导入向导都可以继续沿这页扩展。
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
