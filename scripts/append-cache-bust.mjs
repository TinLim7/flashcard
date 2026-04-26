import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const outDir = path.join(projectRoot, "out");
const buildIdPath = path.join(projectRoot, ".next", "BUILD_ID");

function readBuildTag() {
  try {
    return fs.readFileSync(buildIdPath, "utf8").trim();
  } catch {
    return String(Date.now());
  }
}

function walkFiles(dir, collector = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkFiles(absolutePath, collector);
      continue;
    }

    if (entry.name.endsWith(".html") || entry.name.endsWith(".txt")) {
      collector.push(absolutePath);
    }
  }

  return collector;
}

function appendVersionToStaticAssetUrls(content, versionTag) {
  const appendVersion = (assetPath, existingQuery = "") => {
    if (assetPath.includes("?v=") || existingQuery.includes("v=")) {
      return `${assetPath}${existingQuery}`;
    }

    return existingQuery
      ? `${assetPath}${existingQuery}&v=${versionTag}`
      : `${assetPath}?v=${versionTag}`;
  };

  let patched = content.replace(
    /((?:\\)?["']|\/)((?:\/|static\/)_next\/static\/[^"'?)\s\\]+)(\?[^"' )\\]*)?((?:\\)?["']|\/)/g,
    (fullMatch, prefix, assetPath, existingQuery = "", suffix) =>
      `${prefix}${appendVersion(assetPath, existingQuery)}${suffix}`,
  );

  patched = patched.replace(
    /((?:\\)?["'])(static\/(?:chunks|css)\/[^"'?)\s\\]+|static\/[^"'?)\s\\]+\/(?:_buildManifest|_ssgManifest)\.js)(\?[^"' )\\]*)?((?:\\)?["'])/g,
    (fullMatch, prefix, assetPath, existingQuery = "", suffix) =>
      `${prefix}${appendVersion(assetPath, existingQuery)}${suffix}`,
  );

  return patched;
}

function main() {
  if (!fs.existsSync(outDir)) {
    throw new Error(`未找到 out 目录：${outDir}`);
  }

  const versionTag = readBuildTag();
  const targetFiles = walkFiles(outDir);

  for (const filePath of targetFiles) {
    const original = fs.readFileSync(filePath, "utf8");
    const patched = appendVersionToStaticAssetUrls(original, versionTag);

    if (patched !== original) {
      fs.writeFileSync(filePath, patched, "utf8");
    }
  }

  console.log(
    `Appended cache-busting query parameter to ${targetFiles.length} exported file(s) with build tag ${versionTag}.`,
  );
}

main();
