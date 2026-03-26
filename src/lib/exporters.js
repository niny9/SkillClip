import { slugify } from "./utils.js";

function trimText(value) {
  return String(value || "").trim();
}

function joinLines(lines = []) {
  return lines.filter(Boolean).join("\n");
}

function getPrimaryTitle(asset, kind = "asset") {
  if (asset?.name) return asset.name;
  if (asset?.sourceTitle) return asset.sourceTitle;
  if (asset?.selectedText) return asset.selectedText.slice(0, 40);
  if (kind === "conversation") return "原始素材";
  if (kind === "skill") return "可复用技能";
  if (kind === "variant") return "优化版本";
  return "SkillClip 资产";
}

function getExt(format) {
  return format === "json" ? "json" : "md";
}

export function buildExportFileName(asset, kind = "asset", format = "markdown") {
  const base = slugify(getPrimaryTitle(asset, kind));
  return `skillclip-${kind}-${base || Date.now()}.${getExt(format)}`;
}

function renderTurns(turns = []) {
  if (!Array.isArray(turns) || !turns.length) {
    return "_暂无对话轮次_";
  }

  return turns.map((turn, index) => joinLines([
    `### 第 ${index + 1} 轮 · ${turn.role === "assistant" ? "AI" : "用户"}`,
    trimText(turn.text)
  ])).join("\n\n");
}

function renderWorkflowPrompts(prompts = []) {
  if (!Array.isArray(prompts) || !prompts.length) {
    return "_暂无工作流 Prompt_";
  }

  return prompts.map((item, index) => joinLines([
    `### 第 ${index + 1} 条 · ${item.title || `工作流步骤 ${index + 1}`}`,
    trimText(item.prompt)
  ])).join("\n\n");
}

function renderSteps(steps = []) {
  if (!Array.isArray(steps) || !steps.length) {
    return "_暂无步骤_";
  }

  return steps.map((step, index) => `${index + 1}. ${trimText(step)}`).join("\n");
}

function renderList(title, items = []) {
  const normalized = Array.isArray(items) ? items.filter(Boolean) : [];
  return joinLines([
    `## ${title}`,
    normalized.length ? normalized.map((item) => `- ${trimText(item)}`).join("\n") : "_暂无_"
  ]);
}

function collectAssetTags(asset, kind = "asset") {
  const tags = [];
  if (kind) tags.push(kind);
  if (asset?.sourcePlatform) tags.push(asset.sourcePlatform);
  if (asset?.scenario) tags.push(asset.scenario);
  if (asset?.captureMode) tags.push(asset.captureMode);
  if (Array.isArray(asset?.tags)) tags.push(...asset.tags);
  if (Array.isArray(asset?.userTags)) tags.push(...asset.userTags);
  if (Array.isArray(asset?.inferredTags)) tags.push(...asset.inferredTags);

  return Array.from(new Set(tags.filter(Boolean).map((tag) => trimText(tag)).filter(Boolean)));
}

function collectAliases(asset, kind = "asset") {
  const aliases = [];
  if (asset?.name) aliases.push(asset.name);
  if (asset?.title) aliases.push(asset.title);
  if (asset?.optimizedTitle) aliases.push(asset.optimizedTitle);
  if (asset?.sourceTitle) aliases.push(asset.sourceTitle);
  if (asset?.scenario) aliases.push(`${asset.scenario} 技能`);
  if (kind === "conversation" && asset?.selectedText) {
    aliases.push(asset.selectedText.slice(0, 24));
  }

  return Array.from(new Set(aliases.filter(Boolean).map((item) => trimText(item)).filter(Boolean)));
}

function renderFrontmatter(asset, kind = "asset") {
  const tags = collectAssetTags(asset, kind);
  const aliases = collectAliases(asset, kind);
  const sourceTurnCount = Array.isArray(asset?.turns) ? asset.turns.length : 0;
  const lines = [
    "---",
    `title: "${trimText(getPrimaryTitle(asset, kind)).replaceAll("\"", "\\\"")}"`,
    `kind: "${kind}"`,
    asset.sourcePlatform ? `platform: "${trimText(asset.sourcePlatform)}"` : "",
    asset.scenario ? `scenario: "${trimText(asset.scenario).replaceAll("\"", "\\\"")}"` : "",
    asset.useWhen ? `use_when: "${trimText(asset.useWhen).replaceAll("\"", "\\\"")}"` : "",
    asset.captureMode ? `capture_mode: "${trimText(asset.captureMode)}"` : "",
    asset.capturedAt ? `captured_at: "${asset.capturedAt}"` : "",
    `exported_at: "${new Date().toISOString()}"`,
    asset.sourceUrl ? `source_url: "${trimText(asset.sourceUrl).replaceAll("\"", "\\\"")}"` : "",
    aliases.length ? `aliases: [${aliases.map((alias) => `"${alias.replaceAll("\"", "\\\"")}"`).join(", ")}]` : "",
    sourceTurnCount ? `source_turn_count: ${sourceTurnCount}` : "",
    tags.length ? `tags: [${tags.map((tag) => `"${tag.replaceAll("\"", "\\\"")}"`).join(", ")}]` : "",
    "---"
  ].filter(Boolean);

  return lines.join("\n");
}

export function buildAssetMarkdown(asset, kind = "asset") {
  if (kind === "conversation") {
    const isFlow = asset.captureMode === "whole_flow" || asset.captureMode === "recent_turns";
    return joinLines([
      renderFrontmatter(asset, kind),
      "",
      `# ${getPrimaryTitle(asset, kind)}`,
      "",
      `- 类型：${isFlow ? "整段工作流" : "单条 Prompt"}`,
      `- 平台：${asset.sourcePlatform || "other"}`,
      `- 方式：${asset.captureMode || "selection"}`,
      asset.sourceUrl ? `- 来源链接：${asset.sourceUrl}` : "",
      asset.capturedAt ? `- 保存时间：${asset.capturedAt}` : "",
      "",
      "## 原始内容",
      trimText(asset.selectedText || ""),
      "",
      "## 对话时间线",
      renderTurns(asset.turns || [])
    ]);
  }

  return joinLines([
    renderFrontmatter(asset, kind),
    "",
    `# ${getPrimaryTitle(asset, kind)}`,
    "",
    `- 类型：${kind === "skill" ? "可复用技能" : kind === "variant" ? "优化版本" : "技能草稿"}`,
    asset.scenario ? `- 使用场景：${asset.scenario}` : "",
    asset.useWhen ? `- 适用场景：${asset.useWhen}` : "",
    asset.notFor ? `- 不适用：${asset.notFor}` : "",
    asset.goal ? `- 目标：${asset.goal}` : "",
    asset.outputFormat ? `- 输出格式：${asset.outputFormat}` : "",
    "",
    renderList("成功标准", asset.successCriteria || []),
    "",
    "## 执行步骤",
    renderSteps(asset.steps || []),
    "",
    "## 工作流 Prompt",
    renderWorkflowPrompts(asset.workflowPrompts || []),
    "",
    "## 运行手册",
    trimText(asset.promptTemplate || "_暂无运行手册_")
  ]);
}

export function buildAssetJson(asset, kind = "asset") {
  return JSON.stringify({
    kind,
    exportedAt: new Date().toISOString(),
    asset
  }, null, 2);
}

export function buildAssetExportContent(asset, kind = "asset", format = "markdown") {
  if (format === "json") {
    return buildAssetJson(asset, kind);
  }
  return buildAssetMarkdown(asset, kind);
}

export function buildObsidianUri({ asset, kind = "asset", format = "markdown", vault = "", folder = "" }) {
  const content = buildAssetExportContent(asset, kind, format === "json" ? "json" : "markdown");
  const title = getPrimaryTitle(asset, kind);
  const filePath = folder ? `${folder}/${title}` : title;
  const params = new URLSearchParams();
  if (vault) {
    params.set("vault", vault);
  }
  params.set("file", filePath);
  params.set("content", content);
  return `obsidian://new?${params.toString()}`;
}

export function resolveObsidianFolder(baseFolder = "", kind = "asset", organizeByKind = true) {
  if (!organizeByKind) {
    return baseFolder || "";
  }

  const suffixMap = {
    conversation: "原始素材",
    draft: "技能草稿",
    skill: "可复用技能",
    variant: "优化版本"
  };
  const suffix = suffixMap[kind] || "其他资产";
  return baseFolder ? `${baseFolder}/${suffix}` : suffix;
}

function sliceNotionText(text, max = 1800) {
  return trimText(text).slice(0, max) || "暂无内容";
}

function markdownToNotionBlocks(markdown) {
  const lines = String(markdown || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks = lines.slice(0, 80).map((line) => {
    const richText = [{ type: "text", text: { content: sliceNotionText(line) } }];
    if (line.startsWith("## ")) {
      return {
        object: "block",
        type: "heading_2",
        heading_2: { rich_text: [{ type: "text", text: { content: sliceNotionText(line.slice(3)) } }] }
      };
    }
    if (line.startsWith("# ")) {
      return {
        object: "block",
        type: "heading_1",
        heading_1: { rich_text: [{ type: "text", text: { content: sliceNotionText(line.slice(2)) } }] }
      };
    }
    if (/^\d+\.\s/.test(line)) {
      return {
        object: "block",
        type: "numbered_list_item",
        numbered_list_item: { rich_text: [{ type: "text", text: { content: sliceNotionText(line.replace(/^\d+\.\s/, "")) } }] }
      };
    }
    if (line.startsWith("- ")) {
      return {
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: [{ type: "text", text: { content: sliceNotionText(line.slice(2)) } }] }
      };
    }
    return {
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: richText }
    };
  });

  return blocks.length
    ? blocks
    : [{
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: "暂无内容" } }]
      }
    }];
}

function findNotionPropertyName(databaseInfo, predicate) {
  const entries = Object.entries(databaseInfo?.properties || {});
  const found = entries.find(([name, value]) => predicate(name, value));
  return found ? found[0] : null;
}

function buildNotionTextValue(value, max = 300) {
  return {
    rich_text: [{ type: "text", text: { content: sliceNotionText(value, max) } }]
  };
}

function buildNotionSelectOrText(property, value, max = 120) {
  if (property?.type === "select") {
    return { select: { name: sliceNotionText(value, max) } };
  }
  return buildNotionTextValue(value, max);
}

function buildNotionMultiSelectOrText(property, values = [], max = 60) {
  const normalized = Array.isArray(values)
    ? values.map((value) => sliceNotionText(value, max)).filter(Boolean)
    : [];
  if (!normalized.length) {
    return null;
  }
  if (property?.type === "multi_select") {
    return { multi_select: normalized.slice(0, 10).map((value) => ({ name: value })) };
  }
  return buildNotionTextValue(normalized.join(" | "), 600);
}

export function buildNotionDatabaseProperties(asset, kind = "asset", databaseInfo = {}) {
  const properties = {};
  const titlePropName = findNotionPropertyName(databaseInfo, (_name, value) => value?.type === "title");
  if (titlePropName) {
    properties[titlePropName] = {
      title: [
        {
          type: "text",
          text: {
            content: sliceNotionText(getPrimaryTitle(asset, kind), 120)
          }
        }
      ]
    };
  }

  const scenarioPropName = findNotionPropertyName(databaseInfo, (name, value) => (
    /scenario|场景/i.test(name) && (value?.type === "rich_text" || value?.type === "select")
  ));
  if (scenarioPropName && asset.scenario) {
    properties[scenarioPropName] = buildNotionSelectOrText(databaseInfo.properties[scenarioPropName], asset.scenario, 300);
  }

  const platformPropName = findNotionPropertyName(databaseInfo, (name, value) => (
    /platform|平台/i.test(name) && (value?.type === "rich_text" || value?.type === "select")
  ));
  if (platformPropName && asset.sourcePlatform) {
    properties[platformPropName] = buildNotionSelectOrText(databaseInfo.properties[platformPropName], asset.sourcePlatform, 120);
  }

  const kindPropName = findNotionPropertyName(databaseInfo, (name, value) => (
    /kind|类型/i.test(name) && (value?.type === "rich_text" || value?.type === "select")
  ));
  if (kindPropName) {
    properties[kindPropName] = buildNotionSelectOrText(databaseInfo.properties[kindPropName], kind, 80);
  }

  const statusValue = kind === "skill"
    ? "validated"
    : kind === "draft"
      ? "draft"
      : kind === "variant"
        ? "variant"
        : "captured";
  const statusPropName = findNotionPropertyName(databaseInfo, (name, value) => (
    /status|状态/i.test(name) && (value?.type === "rich_text" || value?.type === "select")
  ));
  if (statusPropName) {
    properties[statusPropName] = buildNotionSelectOrText(databaseInfo.properties[statusPropName], statusValue, 80);
  }

  const createdAtValue = asset.capturedAt || asset.createdAt || asset.updatedAt || new Date().toISOString();
  const createdAtPropName = findNotionPropertyName(databaseInfo, (name, value) => (
    /created|captured|时间|日期/i.test(name) && value?.type === "date"
  ));
  if (createdAtPropName && createdAtValue) {
    properties[createdAtPropName] = {
      date: { start: createdAtValue }
    };
  }

  const sourceUrlPropName = findNotionPropertyName(databaseInfo, (name, value) => (
    /url|link|链接/i.test(name) && (value?.type === "url" || value?.type === "rich_text")
  ));
  if (sourceUrlPropName && asset.sourceUrl) {
    properties[sourceUrlPropName] = databaseInfo.properties[sourceUrlPropName].type === "url"
      ? { url: sliceNotionText(asset.sourceUrl, 1800) }
      : buildNotionTextValue(asset.sourceUrl, 600);
  }

  const tagValues = collectAssetTags(asset, kind);
  const tagsPropName = findNotionPropertyName(databaseInfo, (name, value) => (
    /tags|标签/i.test(name) && (value?.type === "multi_select" || value?.type === "rich_text")
  ));
  if (tagsPropName && tagValues.length) {
    properties[tagsPropName] = buildNotionMultiSelectOrText(databaseInfo.properties[tagsPropName], tagValues, 60);
  }

  const summaryValue = trimText(asset.whatItDoes || asset.goal || asset.selectedText || asset.promptTemplate || "").slice(0, 500);
  const summaryPropName = findNotionPropertyName(databaseInfo, (name, value) => (
    /summary|摘要|概述|overview/i.test(name) && (value?.type === "rich_text" || value?.type === "title")
  ));
  if (summaryPropName && summaryValue) {
    properties[summaryPropName] = databaseInfo.properties[summaryPropName].type === "title"
      ? {
        title: [
          {
            type: "text",
            text: { content: sliceNotionText(summaryValue, 120) }
          }
        ]
      }
      : buildNotionTextValue(summaryValue, 500);
  }

  const goalPropName = findNotionPropertyName(databaseInfo, (name, value) => (
    /goal|目标/i.test(name) && (value?.type === "rich_text" || value?.type === "select")
  ));
  if (goalPropName && asset.goal) {
    properties[goalPropName] = buildNotionSelectOrText(databaseInfo.properties[goalPropName], asset.goal, 500);
  }

  const outputFormatPropName = findNotionPropertyName(databaseInfo, (name, value) => (
    /output|输出/i.test(name) && (value?.type === "rich_text" || value?.type === "select")
  ));
  if (outputFormatPropName && asset.outputFormat) {
    properties[outputFormatPropName] = buildNotionSelectOrText(databaseInfo.properties[outputFormatPropName], asset.outputFormat, 300);
  }

  const aliasesPropName = findNotionPropertyName(databaseInfo, (name, value) => (
    /aliases|别名/i.test(name) && (value?.type === "multi_select" || value?.type === "rich_text")
  ));
  const aliases = collectAliases(asset, kind);
  if (aliasesPropName && aliases.length) {
    properties[aliasesPropName] = buildNotionMultiSelectOrText(databaseInfo.properties[aliasesPropName], aliases, 80);
  }

  const turnCountPropName = findNotionPropertyName(databaseInfo, (name, value) => (
    /turn|轮次|对话数/i.test(name) && (value?.type === "number" || value?.type === "rich_text")
  ));
  const turnCount = Array.isArray(asset?.turns) ? asset.turns.length : 0;
  if (turnCountPropName && turnCount) {
    properties[turnCountPropName] = databaseInfo.properties[turnCountPropName].type === "number"
      ? { number: turnCount }
      : buildNotionTextValue(String(turnCount), 40);
  }

  return properties;
}

export function buildNotionPagePayload({
  asset,
  kind = "asset",
  parentType = "page",
  parentPageId = "",
  databaseId = "",
  databaseInfo = null
}) {
  const title = getPrimaryTitle(asset, kind);
  const markdown = buildAssetMarkdown(asset, kind);
  const parent = parentType === "database"
    ? {
      type: "database_id",
      database_id: databaseId
    }
    : {
      type: "page_id",
      page_id: parentPageId
    };
  const databaseProps = parentType === "database"
    ? buildNotionDatabaseProperties(asset, kind, databaseInfo || {})
    : {};
  return {
    parent,
    properties: {
      ...(parentType === "database"
        ? databaseProps
        : {
          title: {
            title: [
              {
                type: "text",
                text: {
                  content: sliceNotionText(title, 120)
                }
              }
            ]
          }
        })
    },
    children: markdownToNotionBlocks(markdown)
  };
}
