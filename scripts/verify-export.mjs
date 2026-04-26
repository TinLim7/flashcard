import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const projectRoot = process.cwd();
const outDir = path.join(projectRoot, "out");
const requiredPages = [
  "index.html",
  "study.html",
  path.join("study", "session.html"),
  "settings.html",
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readFile(relativePath) {
  const filePath = path.join(outDir, relativePath);
  assert(fs.existsSync(filePath), `缺少导出文件：${relativePath}`);
  return fs.readFileSync(filePath, "utf8");
}

function extractInlineScripts(content) {
  const matches = content.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g);
  return Array.from(matches, (match) => match[1]).filter((script) => script.trim().length > 0);
}

function verifyInlineScripts(relativePath, content) {
  const scripts = extractInlineScripts(content);

  scripts.forEach((script, index) => {
    try {
      new vm.Script(script, { filename: `${relativePath}#inline-${index + 1}` });
    } catch (error) {
      throw new Error(
        `内联脚本语法检查失败：${relativePath}#inline-${index + 1}\n${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });
}

function main() {
  assert(fs.existsSync(outDir), "未找到 out 目录，请先执行 npm run build 或 npm run build:prod。");

  requiredPages.forEach((relativePath) => {
    const content = readFile(relativePath);
    assert(!content.includes("\\?v="), `检测到坏转义缓存参数：${relativePath}`);
    verifyInlineScripts(relativePath, content);
  });

  console.log(`Verified exported pages: ${requiredPages.join(", ")}`);
}

main();
