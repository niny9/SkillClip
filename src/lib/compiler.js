import { createId, dedupe, nowIso, slugify, titleFromText } from "./utils.js";
import { validateSkillAsset } from "./validator.js";

function extractVariablesFromText(text) {
  const matches = text.match(/\{[a-zA-Z0-9_]+\}|\[[^\]]+\]|"[^"]+"|'[^']+'/g) || [];
  const inferred = matches
    .map((match) => match.replace(/[{}[\]"']/g, "").trim())
    .filter(Boolean)
    .slice(0, 5);

  return dedupe(inferred).map((key) => ({
    key: key.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    label: key,
    required: true,
    description: "从当前素材中自动识别出的变量"
  }));
}

function inferScenarioInputs(scenario) {
  if (scenario === "Podcast interview planning") {
    return [
      { key: "topic", label: "Topic", required: true, description: "Podcast topic or discussion theme" },
      { key: "guest", label: "Guest", required: false, description: "Guest background or profile" },
      { key: "audience", label: "Audience", required: false, description: "Intended listeners" },
      { key: "tone", label: "Tone", required: false, description: "Desired interview style or tone" }
    ];
  }
  if (scenario === "Interview outline generation") {
    return [
      { key: "topic", label: "Topic", required: true, description: "Interview topic or subject" },
      { key: "goal", label: "Goal", required: false, description: "What the interview should uncover" },
      { key: "audience", label: "Audience", required: false, description: "Who the outline is for" }
    ];
  }
  if (scenario === "Product PRD writing") {
    return [
      { key: "product_idea", label: "Product Idea", required: true, description: "Rough feature or product concept" },
      { key: "target_user", label: "Target User", required: false, description: "Primary user group" },
      { key: "constraints", label: "Constraints", required: false, description: "Important business or product constraints" }
    ];
  }
  if (scenario === "Marketing copy generation") {
    return [
      { key: "product", label: "Product", required: true, description: "Product, feature, or offer" },
      { key: "audience", label: "Audience", required: false, description: "Target audience" },
      { key: "channel", label: "Channel", required: false, description: "Where the copy will be used" },
      { key: "tone", label: "Tone", required: false, description: "Desired tone" }
    ];
  }
  if (scenario === "SQL debugging") {
    return [
      { key: "query", label: "Query", required: true, description: "SQL query to debug" },
      { key: "error_message", label: "Error Message", required: false, description: "Observed SQL error or issue" },
      { key: "schema", label: "Schema", required: false, description: "Relevant schema or table structure" }
    ];
  }
  return [
    { key: "topic", label: "Topic", required: true, description: "Core task or topic" }
  ];
}

function mergeInputs(...groups) {
  const byKey = new Map();
  groups.flat().forEach((item) => {
    if (!item?.key) {
      return;
    }
    if (!byKey.has(item.key)) {
      byKey.set(item.key, item);
    }
  });
  return Array.from(byKey.values());
}

function inferSkillName(payload, scenario) {
  const firstUserTurn = (payload.turns || []).find((turn) => turn.role === "user" && turn.text)?.text || "";
  const raw = payload.selectedText || firstUserTurn || payload.title || "";
  const clean = raw
    .replace(/\s+/g, " ")
    .replace(/[：:，,。.？?！!]/g, " ")
    .trim();

  if (scenario === "Podcast interview planning") {
    return "播客访谈提纲技能";
  }
  if (scenario === "Interview outline generation") {
    return "访谈提纲整理技能";
  }
  if (scenario === "Product PRD writing") {
    return "产品 PRD 生成技能";
  }
  if (scenario === "Marketing copy generation") {
    return "营销文案生成技能";
  }
  if (scenario === "SQL debugging") {
    return "SQL 排错技能";
  }

  const candidate = clean.split(" ").filter(Boolean).slice(0, 6).join(" ");
  if (candidate) {
    return titleFromText(candidate, "通用工作流技能").replace(/[,:;，。]+$/g, "");
  }
  return "通用工作流技能";
}

function inferPromptName(scenario, text = "") {
  if (scenario === "Podcast interview planning") {
    return "播客访谈提纲 Prompt";
  }
  if (scenario === "Interview outline generation") {
    return "访谈提纲整理 Prompt";
  }
  if (scenario === "Product PRD writing") {
    return "产品 PRD Prompt";
  }
  if (scenario === "Marketing copy generation") {
    return "营销文案 Prompt";
  }
  if (scenario === "SQL debugging") {
    return "SQL 排错 Prompt";
  }

  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[：:，,。.？?！!]/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");

  return clean ? `${clean} Prompt` : "通用优化 Prompt";
}

function parseStructuredPromptSections(prompt = "") {
  const lines = String(prompt || "").split("\n");
  const sections = { body: [] };
  let current = "body";

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (/^#\s*(ROLE|角色)$/i.test(trimmed)) {
      current = "role";
      sections[current] = [];
      return;
    }
    if (/^#\s*(TASK|任务)$/i.test(trimmed)) {
      current = "task";
      sections[current] = [];
      return;
    }
    if (/^#\s*(CONTEXT|上下文)$/i.test(trimmed)) {
      current = "context";
      sections[current] = [];
      return;
    }
    if (/^#\s*(REQUIREMENTS|要求)$/i.test(trimmed)) {
      current = "requirements";
      sections[current] = [];
      return;
    }
    if (/^#\s*(OUTPUT FORMAT|输出格式)$/i.test(trimmed)) {
      current = "output";
      sections[current] = [];
      return;
    }
    if (trimmed) {
      sections[current] ||= [];
      sections[current].push(trimmed);
    }
  });

  return {
    role: (sections.role || []).join(" "),
    task: (sections.task || []).join(" "),
    context: (sections.context || []).join(" "),
    requirements: (sections.requirements || []).join("\n"),
    output: (sections.output || []).join(" "),
    body: (sections.body || []).join(" ")
  };
}

function compactWorkflowPromptForRunbook(item, index, previous = null) {
  const sections = parseStructuredPromptSections(item?.prompt || "");
  const previousSections = previous ? parseStructuredPromptSections(previous.prompt || "") : null;
  const lines = [];

  if (sections.task) {
    lines.push(`核心动作：${sections.task}`);
  }

  if (sections.context && sections.context !== previousSections?.context) {
    lines.push(`补充上下文：${sections.context}`);
  }

  const requirementLines = String(sections.requirements || "")
    .split("\n")
    .map((line) => line.replace(/^-+\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 4);
  if (requirementLines.length) {
    lines.push("本步要求：");
    requirementLines.forEach((line) => lines.push(`- ${line}`));
  }

  if (sections.output && sections.output !== previousSections?.output && index === 0) {
    lines.push(`统一输出要求：${sections.output}`);
  }

  if (!lines.length) {
    lines.push(String(item?.prompt || "").slice(0, 220));
  }

  return lines.join("\n");
}

function deriveWorkflowPromptLabel(text = "", scenario = "") {
  const sections = parseStructuredPromptSections(text);
  const source = sections.task || sections.context || sections.body || text;
  const clean = String(source || "")
    .replace(/^[-#\s]+/g, "")
    .replace(/[：:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (scenario === "Podcast interview planning") {
    if (/嘉宾|人物|背景|guest/i.test(clean)) return "补充嘉宾背景和人物信息，让访谈更具体";
    if (/开场|opening|破冰/i.test(clean)) return "设计开场和破冰问题，让对话自然进入主题";
    if (/追问|follow-up|深入/i.test(clean)) return "补充追问问题，把对话继续往深处推进";
    if (/总结|结尾|closing/i.test(clean)) return "设计结尾问题和收束方式，方便主持人收尾";
    if (/目标|主题|方向/i.test(clean)) return "先明确访谈目标、主题和这期内容的核心方向";
  }
  return inferWorkflowActionTitle(clean, scenario, 0);
}

export function optimizePromptLocally(conversation) {
  const baseText = conversation.selectedText || conversation.turns?.find((turn) => turn.role === "user")?.text || "";
  const payload = {
    platform: conversation.sourcePlatform,
    selectedText: baseText,
    turns: conversation.turns || [],
    title: conversation.sourceTitle
  };
  const scenario = inferScenario(payload);
  const optimizedPrompt = optimizePromptText(baseText, scenario);
  const optimizedTitle = inferPromptName(scenario, baseText);

  return {
    scenario,
    optimizedPrompt,
    optimizedTitle
  };
}

export function optimizeWorkflowPromptLocally(prompt, scenario = "") {
  const optimizedPrompt = optimizePromptText(prompt?.prompt || prompt?.text || "", scenario);
  return {
    optimizedTitle: inferWorkflowPromptTitle(prompt?.prompt || prompt?.text || "", 0, scenario),
    optimizedPrompt,
    scenario
  };
}

function inferScenario({ platform, selectedText, turns, title }) {
  const base = [selectedText, title, ...(turns || []).map((turn) => turn.text)]
    .join(" ")
    .toLowerCase();

  if (base.includes("podcast") || base.includes("播客") || base.includes("访谈") || base.includes("interview outline")) {
    return "Podcast interview planning";
  }
  if (base.includes("提纲") || base.includes("outline") || base.includes("questions")) {
    return "Interview outline generation";
  }
  if (base.includes("sql")) {
    return "SQL debugging";
  }
  if (base.includes("prd") || base.includes("product requirement")) {
    return "Product PRD writing";
  }
  if (base.includes("title") || base.includes("xiaohongshu")) {
    return "Marketing copy generation";
  }
  if (platform === "claude" || platform === "chatgpt") {
    return "General AI workflow";
  }

  return "Reusable AI workflow";
}

function inferOutputFormat(scenario) {
  if (scenario === "Podcast interview planning" || scenario === "Interview outline generation") {
    return "按部分组织的访谈提纲，包含主问题和追问";
  }
  if (scenario === "Product PRD writing") {
    return "结构化 PRD 小节";
  }
  if (scenario === "Marketing copy generation") {
    return "多个标题或文案版本";
  }
  return "结构化结果";
}

function inferPromptOutputFormat(scenario) {
  if (scenario === "Podcast interview planning" || scenario === "Interview outline generation") {
    return "Markdown 提纲，包含分段、小标题、主问题和追问";
  }
  if (scenario === "Product PRD writing") {
    return "带清晰标题的 Markdown PRD";
  }
  if (scenario === "Marketing copy generation") {
    return "若干条清晰且可直接使用的文案选项";
  }
  if (scenario === "SQL debugging") {
    return "分步骤诊断说明和修正后的 SQL";
  }
  return "简洁、结构化的 Markdown 结果";
}

function inferGoal(scenario, platform) {
  if (scenario === "Podcast interview planning") {
    return "把粗糙的播客主题或嘉宾信息整理成可直接使用的访谈方案。";
  }
  if (scenario === "Interview outline generation") {
    return "把零散主题整理成结构清晰、顺序自然的访谈提纲。";
  }
  if (scenario === "Product PRD writing") {
    return "把模糊的产品想法整理成简洁但可执行的 PRD 草稿。";
  }
  if (scenario === "Marketing copy generation") {
    return "生成格式清晰、后续可以反复复用的营销文案。";
  }
  return `把从${platform || "AI 平台"}捕获到的原始对话整理成可复用的工作流。`;
}

function inferWhatItDoes(scenario) {
  if (scenario === "Podcast interview planning") {
    return "把粗糙的播客选题或嘉宾信息整理成可复用的访谈工作流。";
  }
  if (scenario === "Interview outline generation") {
    return "把零散想法整理成可复用的访谈提纲工作流。";
  }
  if (scenario === "Product PRD writing") {
    return "把模糊的功能想法整理成可复用的 PRD 撰写工作流。";
  }
  if (scenario === "Marketing copy generation") {
    return "把营销需求整理成可复用的文案生成工作流。";
  }
  if (scenario === "SQL debugging") {
    return "把 SQL 问题整理成可复用的排错工作流。";
  }
  return "把捕获到的 AI 对话整理成可复用的工作流。";
}

function inferUseWhen(scenario, selectedText = "") {
  if (scenario === "Podcast interview planning") {
    return "当你需要从一个播客主题、嘉宾背景或粗糙想法出发，快速整理出可直接使用的访谈提纲时使用。";
  }
  if (scenario === "Interview outline generation") {
    return "当你想把零散笔记整理成更清晰的问题流程或访谈提纲时使用。";
  }
  return `当你需要处理“${scenario}”相关任务，并希望把当前 prompt 或对话沉淀成可重复执行的方法时使用。`;
}

function inferNotFor(scenario) {
  if (scenario === "Podcast interview planning" || scenario === "Interview outline generation") {
    return "不适合用在需要实时事实核查、外部检索，或直接产出成稿文章的场景。";
  }
  return `不适合用在与“${scenario}”无关，或强依赖实时外部检索的场景。`;
}

function inferSteps(turns, scenario, selectedText = "") {
  const userTurns = (turns || []).filter((turn) => turn.role === "user").slice(0, 4);
  const assistantTurns = (turns || []).filter((turn) => turn.role === "assistant").slice(0, 3);
  const steps = [];

  if (scenario === "Podcast interview planning" || scenario === "Interview outline generation") {
    return [
      "Summarize the episode topic, guest, or core discussion goal.",
      "Clarify the audience and the key takeaway the interview should deliver.",
      "Ask for a structured outline with opening, main sections, and closing.",
      "Generate layered questions: warm-up, core questions, and follow-up questions.",
      "Return the outline in a format that can be used directly in a recording or prep doc."
    ];
  }

  if (userTurns[0]) {
    steps.push(`Clarify the task goal: ${titleFromText(userTurns[0].text, "Task goal")}`);
  }

  if (userTurns[1]) {
    steps.push(`Add constraints or context: ${titleFromText(userTurns[1].text, "Constraints")}`);
  }

  if (assistantTurns[0]) {
    steps.push(`Follow the response pattern: ${titleFromText(assistantTurns[0].text, "Response pattern")}`);
  }

  if (assistantTurns[1]) {
    steps.push(`Polish the output structure: ${titleFromText(assistantTurns[1].text, "Output structure")}`);
  }

  if (steps.length === 0) {
    steps.push("Describe the task clearly");
    steps.push("Provide constraints, context, and desired output");
    steps.push("Ask for a structured answer");
  }

  return steps;
}

function inferWorkflowPrompts(turns = [], scenario = "", selectedText = "") {
  const userTurns = turns.filter((turn) => turn.role === "user" && turn.text).slice(0, 6);
  if (!userTurns.length && selectedText) {
    return [{
      title: inferWorkflowPromptTitle(selectedText, 0, scenario),
      prompt: optimizePromptText(selectedText, scenario),
      sourceTurnIds: []
    }];
  }

  return userTurns.map((turn, index) => ({
    title: inferWorkflowPromptTitle(turn.text, index, scenario),
    prompt: optimizePromptText(turn.text, scenario),
    sourceTurnIds: turn.id ? [turn.id] : []
  }));
}

function inferWorkflowPromptTitle(text, index, scenario) {
  if (scenario === "Podcast interview planning") {
    if (index === 0) {
      return "先明确这期播客的主题、目标和讨论方向";
    }
    if (index === 1) {
      return "再补充嘉宾背景、冲突点和访谈约束";
    }
    if (/开场|破冰|opening/i.test(text)) {
      return "设计开场和破冰问题，让对话自然进入主题";
    }
    if (/追问|深入|follow[- ]?up/i.test(text)) {
      return "补充追问问题，把对话继续往深处推进";
    }
    if (/结尾|收尾|closing/i.test(text)) {
      return "整理结尾问题和收束方式，方便主持人收尾";
    }
    return `继续完善访谈问题设计的第 ${index + 1} 步`;
  }

  if (scenario === "Interview outline generation") {
    if (index === 0) {
      return "先确定这份提纲要解决的核心主题和输出范围";
    }
    if (index === 1) {
      return "再补充提纲结构、顺序和组织要求";
    }
    return `继续优化提纲内容的第 ${index + 1} 步`;
  }

  if (scenario === "Product PRD writing") {
    return index === 0 ? "先明确产品问题、目标用户和要解决的场景" : `继续细化 PRD 内容的第 ${index + 1} 步`;
  }

  return deriveWorkflowPromptLabel(text, scenario) || `继续完成这条工作流的第 ${index + 1} 步`;
}

function optimizePromptText(text, scenario) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) {
    return "";
  }

  const role = inferPromptRole(scenario);
  const task = inferPromptTask(scenario);
  const requirements = inferPromptRequirements(scenario);
  const outputFormat = inferPromptOutputFormat(scenario);

  return [
    "# 角色",
    role,
    "",
    "# 任务",
    task,
    "",
    "# 上下文",
    clean,
    "",
    "# 要求",
    requirements.map((item) => `- ${item}`).join("\n"),
    "",
    "# 输出格式",
    outputFormat
  ].join("\n");
}

function inferPromptRole(scenario) {
  if (scenario === "Podcast interview planning") {
    return "你是一位专业的播客制作人与访谈策划顾问。";
  }
  if (scenario === "Interview outline generation") {
    return "你是一位擅长把零散想法整理成可执行访谈流程的对话设计师。";
  }
  if (scenario === "Product PRD writing") {
    return "你是一位资深产品经理，擅长把模糊想法整理成清晰的 PRD。";
  }
  if (scenario === "Marketing copy generation") {
    return "你是一位资深增长文案专家，擅长产出可复用的营销文案。";
  }
  if (scenario === "SQL debugging") {
    return "你是一位资深数据工程师，擅长清晰定位并修复 SQL 问题。";
  }
  return "你是一位擅长把粗糙需求整理成高质量可复用结果的 AI 助手。";
}

function inferPromptTask(scenario) {
  if (scenario === "Podcast interview planning") {
    return "把原始素材整理成主持人可以直接使用的播客访谈提纲。";
  }
  if (scenario === "Interview outline generation") {
    return "把原始素材整理成结构清晰、节奏自然的访谈提纲。";
  }
  if (scenario === "Product PRD writing") {
    return "把原始素材整理成简洁但可执行的 PRD 草稿。";
  }
  if (scenario === "Marketing copy generation") {
    return "把原始素材整理成适合目标场景的高质量文案方案。";
  }
  if (scenario === "SQL debugging") {
    return "解释 SQL 问题、定位根因，并给出修正后的查询。";
  }
  return "把原始素材整理成清晰、可复用的结果，而不是一次性回答。";
}

function inferWorkflowActionTitle(text = "", scenario = "", index = 0) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return `继续完成这条工作流的第 ${index + 1} 步`;
  }

  if (/先|首先/.test(normalized)) {
    return "先明确当前任务的目标、范围和预期输出";
  }
  if (/背景|约束|限制|补充|context|constraint/i.test(normalized)) {
    return "再补充关键背景、限制条件和判断标准";
  }
  if (/改|优化|重写|调整|更具体|更清晰|polish|refine/i.test(normalized)) {
    return "再基于已有结果继续优化表达、结构和细节";
  }
  if (/总结|整理|输出|给我一版|生成|写出|产出/i.test(normalized)) {
    return "最后整理成一份结构清晰、可以直接使用的结果";
  }
  if (/验证|检查|review|check/i.test(normalized)) {
    return "再检查当前结果是否满足要求并补齐缺口";
  }

  if (scenario === "Reusable AI workflow" || scenario === "General AI workflow") {
    return `继续推进这条工作流的第 ${index + 1} 步`;
  }

  return `继续完成“${scenario}”的第 ${index + 1} 步`;
}

function inferPromptRequirements(scenario) {
  if (scenario === "Podcast interview planning") {
    return [
      "结构要方便主持人现场使用，层次清晰。",
      "包含开场、核心环节、追问设计和收尾部分。",
      "优先使用具体、能推动对话深入的问题，避免空泛表达。"
    ];
  }
  if (scenario === "Interview outline generation") {
    return [
      "问题顺序要从热身逐步推进到深入讨论。",
      "各部分之间过渡自然。",
      "适当加入能继续深挖的追问。"
    ];
  }
  if (scenario === "Product PRD writing") {
    return [
      "表达要具体，便于后续执行。",
      "清楚区分目标、范围、非目标和成功指标。",
      "避免空泛的产品黑话。"
    ];
  }
  if (scenario === "Marketing copy generation") {
    return [
      "提供多个版本，而不是只给一条。",
      "每个版本在角度或语气上要有区分。",
      "优先保证清晰和实用，不要空洞夸张。"
    ];
  }
  if (scenario === "SQL debugging") {
    return [
      "清楚指出最可能的报错点。",
      "先解释原因，再给出修正方案。",
      "能给出修正 SQL 时，直接给出。"
    ];
  }
  return [
    "先确认用户目标，再开始输出。",
    "保持结构清晰，方便后续复用。",
    "优先追求清晰，不要堆砌冗长表达。"
  ];
}

function inferStepSources(turns = [], steps = [], scenario = "") {
  if (scenario === "Podcast interview planning" || scenario === "Interview outline generation") {
    return steps.map((step) => buildStepSourceMatch(step, turns, 2));
  }

  return steps.map((step) => buildStepSourceMatch(step, turns, 2));
}

export function createStepsFromWorkflowPrompts(workflowPrompts = [], scenario = "") {
  if (!Array.isArray(workflowPrompts) || workflowPrompts.length === 0) {
    return [];
  }

  return workflowPrompts.map((item, index) => {
    const title = item?.title || `步骤 ${index + 1}`;
    const sections = parseStructuredPromptSections(item?.prompt || "");
    const context = (sections.context || sections.body || "").replace(/\s+/g, " ").trim();
    if (scenario === "Podcast interview planning") {
      if (index === 0) {
        return "先明确访谈主题、核心冲突和这期内容最想回答的问题。";
      }
      if (index === workflowPrompts.length - 1) {
        return "最后把问题整理成主持人可以直接拿来录制前准备的提纲。";
      }
    }

    if (/背景|约束|限制|嘉宾|对象/i.test(context)) {
      return "补充关键背景、对象信息和限制条件，让后续输出更贴合真实场景。";
    }
    if (/改|优化|重写|深入|具体|更像|调整/i.test(context)) {
      return "基于上一轮结果继续优化内容，增强细节、结构或表达质量。";
    }
    if (/总结|整理|输出|生成|提纲|方案|结果/i.test(context)) {
      return "整理并输出一版结构化结果，确保内容可以直接复用或继续迭代。";
    }

    return `完成“${title}”这一步，并把结果推进到下一步可继续使用的状态。`;
  });
}

function createStepSourcesFromWorkflowPrompts(workflowPrompts = []) {
  return workflowPrompts.map((item, index) => ({
    step: item?.title || `步骤 ${index + 1}`,
    sourceTurnIds: Array.isArray(item?.sourceTurnIds) ? item.sourceTurnIds : [],
    sourcePreview: String(item?.prompt || "").slice(0, 220)
  }));
}

function scoreWorkflowPrompt(item, scenario = "") {
  const text = String(item?.prompt || "");
  let score = 60;
  const issues = [];

  if (text.length >= 180) {
    score += 10;
  } else {
    issues.push("这条 Prompt 偏短，结构可能还不够完整。");
  }

  if (/^# (ROLE|角色)/m.test(text)) {
    score += 8;
  } else {
    issues.push("缺少“角色”部分。");
  }

  if (/^# (TASK|任务)/m.test(text)) {
    score += 8;
  } else {
    issues.push("缺少“任务”部分。");
  }

  if (/^# (REQUIREMENTS|要求)/m.test(text)) {
    score += 6;
  } else {
    issues.push("缺少“要求”部分。");
  }

  if (/^# (OUTPUT FORMAT|输出格式)/m.test(text)) {
    score += 6;
  } else {
    issues.push("缺少“输出格式”部分。");
  }

  if (Array.isArray(item?.sourceTurnIds) && item.sourceTurnIds.length) {
    score += 6;
  } else {
    issues.push("没有关联到原始来源轮次。");
  }

  if (scenario === "Podcast interview planning" && /访谈|播客|问题|follow-up|追问/i.test(text)) {
    score += 6;
  }

  const normalizedScore = Math.max(0, Math.min(100, score));
  return {
    score: normalizedScore,
    priority: normalizedScore >= 88 ? "high" : normalizedScore >= 72 ? "medium" : "needs_work",
    issues
  };
}

function enrichWorkflowPrompts(workflowPrompts = [], scenario = "") {
  const deduped = dedupeWorkflowPrompts(workflowPrompts).map((item, index) => ({
    ...item,
    order: index + 1,
    quality: scoreWorkflowPrompt(item, scenario)
  }));

  return finalizeWorkflowPromptTitles(deduped, scenario);
}

function dedupeWorkflowPrompts(items = []) {
  const result = [];

  items.forEach((item) => {
    const prompt = String(item?.prompt || "").trim();
    if (!prompt) {
      return;
    }

    const duplicate = result.find((existing) => isWorkflowPromptDuplicate(existing.prompt, prompt));
    if (duplicate) {
      duplicate.sourceTurnIds = dedupe([
        ...(duplicate.sourceTurnIds || []),
        ...(item.sourceTurnIds || [])
      ]);
      return;
    }

    result.push({
      ...item,
      prompt
    });
  });

  return result;
}

function finalizeWorkflowPromptTitles(items = [], scenario = "") {
  const usedTitles = new Map();
  return items.map((item, index) => {
    const baseTitle = deriveWorkflowPromptLabel(item.prompt || item.title || "", scenario)
      || item.title
      || `步骤 ${index + 1}`;
    const count = usedTitles.get(baseTitle) || 0;
    usedTitles.set(baseTitle, count + 1);
    return {
      ...item,
      title: count === 0 ? baseTitle : `${baseTitle}（补充 ${count + 1}）`
    };
  });
}

function isWorkflowPromptDuplicate(left, right) {
  const leftTokens = tokenizeForMatch(left);
  const rightTokens = tokenizeForMatch(right);
  if (!leftTokens.length || !rightTokens.length) {
    return false;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const overlap = leftTokens.filter((token) => rightSet.has(token)).length;
  const ratio = overlap / Math.max(leftSet.size, rightSet.size);
  return ratio >= 0.72;
}

export function buildSkillStructureFromWorkflowPrompts({
  workflowPrompts = [],
  scenario = "Reusable AI workflow",
  selectedText = "",
  payload = {}
}) {
  const enrichedWorkflowPrompts = enrichWorkflowPrompts(workflowPrompts, scenario);
  const inputs = mergeInputs(
    inferScenarioInputs(scenario),
    extractVariablesFromText(selectedText),
    ...enrichedWorkflowPrompts.map((item) => extractVariablesFromText(item?.prompt || ""))
  );
  const steps = createStepsFromWorkflowPrompts(enrichedWorkflowPrompts, scenario);
  const stepSources = createStepSourcesFromWorkflowPrompts(enrichedWorkflowPrompts);
  const outputFormat = inferOutputFormat(scenario);

  return {
    scenario,
    inputs,
    steps,
    stepSources,
    workflowPrompts: enrichedWorkflowPrompts,
    promptTemplate: buildPromptTemplate(selectedText, inputs, enrichedWorkflowPrompts),
    outputFormat,
    useWhen: inferUseWhen(scenario, selectedText),
    notFor: inferNotFor(scenario),
    goal: inferGoal(scenario, payload.platform),
    whatItDoes: inferWhatItDoes(scenario)
  };
}

function buildStepSourceMatch(step, turns, limit = 2) {
  const rankedTurns = (turns || [])
    .map((turn) => ({
      turn,
      score: scoreStepAgainstTurn(step, turn?.text || "")
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.turn);

  if (!rankedTurns.length) {
    const fallbackTurn = turns[0];
    return {
      step,
      sourceTurnIds: fallbackTurn?.id ? [fallbackTurn.id] : [],
      sourcePreview: fallbackTurn?.text?.slice(0, 220) || ""
    };
  }

  return {
    step,
    sourceTurnIds: dedupe(rankedTurns.map((turn) => turn.id).filter(Boolean)),
    sourcePreview: rankedTurns.map((turn) => turn.text).join(" | ").slice(0, 220)
  };
}

function scoreStepAgainstTurn(step, text) {
  const stepTokens = tokenizeForMatch(step);
  const turnTokens = new Set(tokenizeForMatch(text));
  if (!stepTokens.length || !turnTokens.size) {
    return 0;
  }

  let score = 0;
  stepTokens.forEach((token) => {
    if (turnTokens.has(token)) {
      score += token.length > 5 ? 3 : 1;
    }
  });
  return score;
}

function tokenizeForMatch(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ")
    .split(/\s+/)
    .filter((token) => token && token.length >= 2);
}

function inferSuccessCriteria(outputFormat) {
  return [
    "输出遵循约定结构。",
    "输出忠实反映原始目标和语境。",
    `结果可以直接作为${outputFormat}使用。`
  ];
}

export function compileSkillDraft(payload, settings = {}) {
  const selectedText = payload.selectedText || summarizeTurnsForDraft(payload.turns) || payload.turns?.[0]?.text || "";
  const scenario = inferScenario(payload);
  const name = inferSkillName(payload, scenario);
  const workflowPrompts = Array.isArray(payload.workflowPromptsOverride) && payload.workflowPromptsOverride.length
    ? payload.workflowPromptsOverride
    : inferWorkflowPrompts(payload.turns || [], scenario, selectedText);
  const built = buildSkillStructureFromWorkflowPrompts({
    workflowPrompts,
    scenario,
    selectedText,
    payload
  });
  const steps = built.steps.length
    ? built.steps
    : inferSteps(payload.turns, scenario, selectedText);
  const stepSources = built.stepSources.length
    ? built.stepSources
    : inferStepSources(payload.turns || [], steps, scenario);

  const draft = {
    id: createId("draft"),
    kind: "skill_draft",
    status: "preview",
    name,
    whatItDoes: built.whatItDoes,
    scenario,
    useWhen: built.useWhen,
    notFor: built.notFor,
    goal: built.goal,
    userIntent: titleFromText(selectedText, "Reuse this AI workflow"),
    inputs: built.inputs,
    constraints: [
      "Preserve the original task intent",
      "Keep the output reusable across AI tools"
    ],
    steps,
    stepSources,
    workflowPrompts,
    promptTemplate: built.promptTemplate,
    outputFormat: built.outputFormat,
    successCriteria: inferSuccessCriteria(built.outputFormat),
    example: selectedText,
    preferredForPlatforms: payload.platforms?.length
      ? payload.platforms
      : [payload.platform].filter(Boolean),
    sourceConversationIds: payload.conversationIds?.length
      ? payload.conversationIds
      : [payload.conversationId].filter(Boolean),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  return {
    ...draft,
    validation: validateSkillAsset(draft, settings)
  };
}

function summarizeTurnsForDraft(turns = []) {
  const relevantTurns = turns
    .filter((turn) => turn?.text)
    .slice(0, 6)
    .map((turn) => `${turn.role || "unknown"}: ${turn.text}`);
  return relevantTurns.join("\n\n").slice(0, 2400);
}

function buildPromptTemplate(selectedText, inputs, workflowPrompts = []) {
  const inputSection = inputs.length
    ? inputs.map((input) => `- ${input.label}：{{${input.key}}}`).join("\n")
    : "- 主题：{{topic}}";

  if (workflowPrompts.length) {
    return [
      "# SOP 概览",
      "按照下面的标准操作流程执行任务，确保输出可直接复用，而不是一次性回答。",
      "",
      "# 前置输入",
      inputSection,
      "",
      "# 前置条件",
      "- 先确认输入信息完整，尤其是核心主题、对象和输出要求。",
      "- 如果上下文不完整，先补齐关键约束再执行。",
      "",
      "# 标准操作步骤",
      workflowPrompts
        .map((item, index) => `## 第 ${index + 1} 步：${item.title}\n${compactWorkflowPromptForRunbook(item, index, workflowPrompts[index - 1])}`)
        .join("\n\n"),
      "",
      "# 失败回退",
      "- 如果某一步信息不足，先指出缺失项，再基于已有信息给出可执行的临时版本。",
      "- 如果原始素材冲突，优先保留用户最新、最明确的要求。",
      "",
      "# 最终产出",
      "只输出最终需要交付的结构化结果，不要重复解释整个流程。",
      "",
      "# 最终检查",
      "- 确保输出结构完整",
      "- 确保内容可直接使用",
      "- 确保不要遗漏关键约束"
    ].join("\n");
  }

  if (!selectedText) {
    return [
      "# SOP 概览",
      "根据输入执行这条技能，并返回结构清晰、可直接使用的结果。",
      "",
      "# 前置输入",
      inputSection,
      "",
      "# 前置条件",
      "- 确认输入内容足够支持生成结果。",
      "",
      "# 标准操作步骤",
      "## 第 1 步\n理解任务并确认目标。",
      "",
      "## 第 2 步\n执行技能方法并组织结果。",
      "",
      "# 失败回退",
      "- 如果输入不完整，先指出缺失信息，再输出临时版本。",
      "",
      "# 最终产出",
      "输出清晰、结构化、可直接使用的结果。",
      "",
      "# 最终检查",
      "- 确保结果可直接使用。"
    ].join("\n");
  }

  let template = selectedText;
  inputs.forEach((input) => {
    const pattern = new RegExp(escapeRegExp(input.label), "ig");
    template = template.replace(pattern, `{{${input.key}}}`);
  });

  return [
    "# SOP 概览",
    "按照以下方法处理输入，并输出结构化结果。",
    "",
    "# 前置输入",
    inputSection,
    "",
    "# 前置条件",
    "- 先确认输入信息完整。",
    "",
    "# 任务定义",
    template,
    "",
    "# 失败回退",
    "- 如果信息不完整，先指出缺失项，再给出当前可执行版本。",
    "",
    "# 最终产出",
    "请直接返回结构清晰、可以交付的结果。",
    "",
    "# 最终检查",
    "- 确保结果结构完整。"
  ].join("\n");
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function promoteDraftToSkill(draft, settings = {}) {
  const skill = {
    id: createId("skill"),
    kind: "skill",
    status: "validated",
    name: draft.name,
    slug: slugify(draft.name),
    whatItDoes: draft.whatItDoes,
    scenario: draft.scenario,
    useWhen: draft.useWhen,
    notFor: draft.notFor,
    goal: draft.goal,
    userIntent: draft.userIntent,
    inputs: draft.inputs,
    constraints: draft.constraints,
    steps: draft.steps,
    stepSources: draft.stepSources || [],
    workflowPrompts: draft.workflowPrompts || [],
    promptTemplate: draft.promptTemplate,
    outputFormat: draft.outputFormat,
    successCriteria: draft.successCriteria,
    example: draft.example,
    tags: [],
    sourceConversationIds: draft.sourceConversationIds,
    preferredForPlatforms: draft.preferredForPlatforms || [],
    preferredForModels: [],
    usageCount: 0,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  return {
    ...skill,
    validation: validateSkillAsset(skill, settings)
  };
}

export function createVariantFromSkill(skill) {
  return {
    id: createId("variant"),
    kind: "skill_variant",
    baseSkillId: skill.baseSkillId || skill.id,
    name: `${skill.name} Variant`,
    changeSummary: "Forked from validated skill for further iteration",
    scenarioOverride: skill.scenario,
    promptTemplate: skill.promptTemplate,
    constraints: skill.constraints,
    steps: skill.steps,
    stepSources: skill.stepSources || [],
    workflowPrompts: skill.workflowPrompts || [],
    preferredForPlatforms: skill.preferredForPlatforms || [],
    preferredForModels: skill.preferredForModels || [],
    usageCount: 0,
    successSignals: [],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}
