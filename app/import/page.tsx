"use client";

import { useRef, useState } from "react";

import { v4 as uuidv4 } from "uuid";
import { Download, FileSpreadsheet, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { StateCard } from "@/components/ui/StateCard";
import { importCsv } from "@/lib/data-service";
import { importSampleRows } from "@/lib/mock-data";
import { logger } from "@/lib/logger";
import { getServiceRuntimeInfo } from "@/lib/service-config";
import type { ImportCsvResult } from "@/lib/types";
import { sleep } from "@/lib/utils";

export default function ImportPage() {
  const runtime = getServiceRuntimeInfo();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("animal-farm.csv");
  const [defaultDeckName, setDefaultDeckName] = useState("Animal Farm 导入词库");
  const [rawRows, setRawRows] = useState(importSampleRows.join("\n"));
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<ImportCsvResult | null>(null);

  const rows = rawRows.split("\n");

  const handleSelectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const text = await file.text();
    setFileName(file.name);
    setRawRows(text);
    setResult(null);
    setErrorMessage("");
  };

  const downloadTemplate = () => {
    const template =
      "front_text,back_text,phonetic,example_text,note,deck_name\nubiquitous,adj. 普遍存在的,/juːˈbɪkwɪtəs/,Coffee shops are ubiquitous in the city.,,Animal Farm 导入词库";
    const blob = new Blob([template], { type: "text/csv;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "flashcard-import-template.csv";
    link.click();
    URL.revokeObjectURL(objectUrl);
  };

  const handleImport = async () => {
    if (!fileName.trim()) {
      setErrorMessage("请先填写一个文件名，方便日志区分导入批次。");
      setResult(null);
      return;
    }

    setIsImporting(true);
    setErrorMessage("");
    setResult(null);

    const traceId = uuidv4();
    const batchId = `batch_${uuidv4().slice(0, 8)}`;

    logger.log("import.csv.batch.start", {
      trace_id: traceId,
      batch_id: batchId,
      route: "/import",
      action: "submit_import",
      result: "pending",
      file_name: fileName,
    });

    await sleep(520);

    try {
      const nextResult = await importCsv({
        fileName,
        rows,
        defaultDeckName,
      });

      nextResult.rowFailures?.forEach((failure) => {
        logger.log("import.csv.row.failure", {
          trace_id: traceId,
          batch_id: nextResult.batchId,
          route: "/import",
          action: "submit_import",
          result: "failure",
          row_number: failure.rowNumber,
          error_code: failure.errorCode,
          message: failure.message,
        });
      });

      logger.log("import.csv.batch.complete", {
        trace_id: traceId,
        batch_id: nextResult.batchId,
        route: "/import",
        action: "submit_import",
        result: nextResult.failedCount > 0 ? "partial" : "success",
        created_count: nextResult.createdCount,
        failed_count: nextResult.failedCount,
      });

      setResult(nextResult);
      setIsImporting(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "导入失败，请稍后重试。";

      logger.log("import.csv.batch.complete", {
        trace_id: traceId,
        batch_id: batchId,
        route: "/import",
        action: "submit_import",
        result: "failure",
        error_message: message,
      });

      setErrorMessage(message);
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--text-main)]">导入 CSV 词库</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          当前会优先尝试走统一 service 导入，并把批次开始、逐行失败和批次完成事件打到结构化日志里。
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

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="space-y-5 p-6">
          <div className="flex flex-col gap-3 md:flex-row">
            <Button variant="secondary" onClick={downloadTemplate} className="md:w-auto">
              <Download className="mr-2" size={18} />
              下载模板
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                void handleSelectFile(event);
              }}
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              className="md:w-auto"
            >
              <FileSpreadsheet className="mr-2" size={18} />
              选择 CSV 文件
            </Button>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text-main)]">文件名</label>
            <Input value={fileName} onChange={(event) => setFileName(event.target.value)} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text-main)]">默认牌组名</label>
            <Input
              value={defaultDeckName}
              onChange={(event) => setDefaultDeckName(event.target.value)}
              placeholder="当 CSV 没有 deck_name 列时使用"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text-main)]">CSV 内容预览</label>
            <Textarea
              value={rawRows}
              onChange={(event) => setRawRows(event.target.value)}
              className="min-h-[260px] font-mono text-sm"
            />
          </div>
          {errorMessage ? (
            <StateCard tone="error" title="导入尚未开始" description={errorMessage} />
          ) : null}

          <Button
            onClick={() => {
              void handleImport();
            }}
            isLoading={isImporting}
          >
            <UploadCloud className="mr-2" size={18} />
            {isImporting ? "正在导入..." : "开始导入"}
          </Button>
        </Card>

        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <FileSpreadsheet size={18} />
              </div>
              <div>
                <h2 className="font-bold text-[var(--text-main)]">导入说明</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  支持两种简化格式：无表头的 `front,back,example`，或带表头的
                  `front_text,back_text,phonetic,example_text,note,deck_name`。
                </p>
              </div>
            </div>
          </Card>

          {!result ? (
            <StateCard
              tone="empty"
              title="还没有导入结果"
              description="点击开始导入后，这里会展示创建数量、失败数量和失败行说明。"
            />
          ) : (
            <Card className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-[var(--text-main)]">批次结果</h2>
                <span className="rounded-full bg-[var(--bg-body)] px-3 py-1 text-xs text-[var(--text-muted)]">
                  {result.batchId}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-success/10 p-4">
                  <div className="text-sm text-[var(--text-muted)]">成功创建</div>
                  <div className="mt-2 text-2xl font-bold text-success">{result.createdCount}</div>
                </div>
                <div className="rounded-2xl bg-danger/10 p-4">
                  <div className="text-sm text-[var(--text-muted)]">失败行数</div>
                  <div className="mt-2 text-2xl font-bold text-danger">{result.failedCount}</div>
                </div>
              </div>
              {result.rowFailures && result.rowFailures.length > 0 ? (
                <div className="space-y-3">
                  {result.rowFailures.map((failure) => (
                    <div
                      key={`${failure.rowNumber}-${failure.errorCode}`}
                      className="rounded-2xl border border-danger/20 bg-danger/5 p-4 text-sm"
                    >
                      <div className="font-medium text-danger">
                        第 {failure.rowNumber} 行 · {failure.errorCode}
                      </div>
                      <div className="mt-1 text-[var(--text-muted)]">{failure.message}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <StateCard
                  tone="empty"
                  title="没有失败行"
                  description="本次导入没有发现缺字段、非法表头或重复词条。"
                />
              )}
            </Card>
          )}
        </div>
      </div>

    </div>
  );
}
