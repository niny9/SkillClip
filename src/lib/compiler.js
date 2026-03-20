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
    description: "Inferred variable from the captured conversation"
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
    return "Interview outline with sections and follow-up questions";
  }
  if (scenario === "Product PRD writing") {
    return "Structured PRD sections";
  }
  if (scenario === "Marketing copy generation") {
    return "Headline options and copy variants";
  }
  return "Structured response";
}

function inferPromptOutputFormat(scenario) {
  if (scenario === "Podcast interview planning" || scenario === "Interview outline generation") {
    return "Markdown outline with sections, main questions, and follow-up questions";
  }
  if (scenario === "Product PRD writing") {
    return "Markdown PRD with clear section headers";
  }
  if (scenario === "Marketing copy generation") {
    return "A small set of strong options in bullets";
  }
  if (scenario === "SQL debugging") {
    return "Step-by-step diagnosis and corrected SQL";
  }
  return "A concise, structured Markdown response";
}

function inferGoal(scenario, platform) {
  if (scenario === "Podcast interview planning") {
    return "Turn a raw topic or guest brief into a usable podcast interview plan";
  }
  if (scenario === "Interview outline generation") {
    return "Turn a topic into a structured outline with better sequencing";
  }
  if (scenario === "Product PRD writing") {
    return "Turn a rough product idea into a concise PRD draft";
  }
  if (scenario === "Marketing copy generation") {
    return "Generate reusable marketing copy with a clear format";
  }
  return `Draft a reusable workflow based on the captured conversation from ${platform || "an AI tool"}`;
}

function inferWhatItDoes(scenario) {
  if (scenario === "Podcast interview planning") {
    return "Turns a rough topic or guest brief into a reusable podcast interview workflow.";
  }
  if (scenario === "Interview outline generation") {
    return "Turns scattered notes into a reusable interview-outline workflow.";
  }
  if (scenario === "Product PRD writing") {
    return "Turns a rough feature idea into a reusable PRD drafting workflow.";
  }
  if (scenario === "Marketing copy generation") {
    return "Turns a marketing need into a reusable copy-generation workflow.";
  }
  if (scenario === "SQL debugging") {
    return "Turns a broken query or debugging request into a reusable SQL troubleshooting workflow.";
  }
  return "Turns a captured AI conversation into a reusable workflow.";
}

function inferUseWhen(scenario, selectedText = "") {
  if (scenario === "Podcast interview planning") {
    return "Use this skill when you need to prepare a podcast or interview outline from a topic, guest brief, or rough idea.";
  }
  if (scenario === "Interview outline generation") {
    return "Use this skill when you want AI to turn rough notes into a clearer question flow or outline.";
  }
  return `Use this skill when you need help with ${scenario.toLowerCase()} and want a repeatable result based on the captured prompt or flow.`;
}

function inferNotFor(scenario) {
  if (scenario === "Podcast interview planning" || scenario === "Interview outline generation") {
    return "Do not use this skill when you need factual research, live verification, or a final polished article instead of an interview plan.";
  }
  return `Do not use this skill when the task is unrelated to ${scenario.toLowerCase()} or requires live external verification.`;
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
      return "定义访谈目标";
    }
    if (index === 1) {
      return "补充嘉宾与约束";
    }
    return `访谈问题设计 ${index + 1}`;
  }

  if (scenario === "Interview outline generation") {
    if (index === 0) {
      return "确定提纲主题";
    }
    if (index === 1) {
      return "补充结构要求";
    }
    return `提纲优化 ${index + 1}`;
  }

  if (scenario === "Product PRD writing") {
    return index === 0 ? "定义产品问题" : `PRD 细化 ${index + 1}`;
  }

  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[：:，,。.？?！!]/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 5)
    .join(" ");

  return clean || `步骤提示词 ${index + 1}`;
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
    "# ROLE",
    role,
    "",
    "# TASK",
    task,
    "",
    "# CONTEXT",
    clean,
    "",
    "# REQUIREMENTS",
    requirements.map((item) => `- ${item}`).join("\n"),
    "",
    "# OUTPUT FORMAT",
    outputFormat
  ].join("\n");
}

function inferPromptRole(scenario) {
  if (scenario === "Podcast interview planning") {
    return "You are an expert podcast producer and interview strategist.";
  }
  if (scenario === "Interview outline generation") {
    return "You are an expert conversation designer who turns rough notes into a usable interview flow.";
  }
  if (scenario === "Product PRD writing") {
    return "You are a senior product manager who turns rough ideas into clear PRD drafts.";
  }
  if (scenario === "Marketing copy generation") {
    return "You are a senior growth copywriter who creates sharp, reusable marketing copy.";
  }
  if (scenario === "SQL debugging") {
    return "You are a senior data engineer who diagnoses and fixes SQL issues clearly.";
  }
  return "You are an expert AI assistant that turns rough requests into reusable, high-signal outputs.";
}

function inferPromptTask(scenario) {
  if (scenario === "Podcast interview planning") {
    return "Turn the source material into a podcast interview outline that is directly usable by a host.";
  }
  if (scenario === "Interview outline generation") {
    return "Turn the source material into a structured interview outline with a natural flow.";
  }
  if (scenario === "Product PRD writing") {
    return "Turn the source material into a concise but execution-ready PRD draft.";
  }
  if (scenario === "Marketing copy generation") {
    return "Turn the source material into strong copy options tailored to the target use case.";
  }
  if (scenario === "SQL debugging") {
    return "Explain the SQL issue, identify the root cause, and provide a corrected query.";
  }
  return "Turn the source material into a clear, reusable output instead of a one-off response.";
}

function inferPromptRequirements(scenario) {
  if (scenario === "Podcast interview planning") {
    return [
      "Keep the structure host-friendly and easy to follow live.",
      "Include opening, core sections, follow-up questions, and a closing segment.",
      "Prefer specific and conversation-driving questions over generic filler."
    ];
  }
  if (scenario === "Interview outline generation") {
    return [
      "Organize questions from warm-up to deep discussion.",
      "Make transitions between sections feel natural.",
      "Include follow-up questions where depth is useful."
    ];
  }
  if (scenario === "Product PRD writing") {
    return [
      "Write in a concrete and execution-ready way.",
      "Separate goals, scope, non-goals, and success metrics clearly.",
      "Avoid vague product jargon."
    ];
  }
  if (scenario === "Marketing copy generation") {
    return [
      "Give multiple options instead of a single line.",
      "Keep each option distinct in tone or angle.",
      "Optimize for clarity and usefulness over hype."
    ];
  }
  if (scenario === "SQL debugging") {
    return [
      "Show the likely failure point clearly.",
      "Explain the reasoning before presenting the fix.",
      "Return corrected SQL when possible."
    ];
  }
  return [
    "Clarify the user goal before answering.",
    "Keep the response structured and reusable.",
    "Optimize for clarity, not verbosity."
  ];
}

function inferStepSources(turns = [], steps = [], scenario = "") {
  if (scenario === "Podcast interview planning" || scenario === "Interview outline generation") {
    return steps.map((step) => buildStepSourceMatch(step, turns, 2));
  }

  return steps.map((step) => buildStepSourceMatch(step, turns, 2));
}

function createStepsFromWorkflowPrompts(workflowPrompts = [], scenario = "") {
  if (!Array.isArray(workflowPrompts) || workflowPrompts.length === 0) {
    return [];
  }

  return workflowPrompts.map((item, index) => {
    const title = item?.title || `步骤 ${index + 1}`;
    if (scenario === "Podcast interview planning") {
      if (index === 0) {
        return `明确访谈目标和核心话题：${title}`;
      }
      if (index === workflowPrompts.length - 1) {
        return `整理可直接使用的访谈输出：${title}`;
      }
    }
    return `${title}：执行这一段优化后的工作流 Prompt。`;
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
    issues.push("Prompt is short and may need more structure.");
  }

  if (/^# ROLE/m.test(text)) {
    score += 8;
  } else {
    issues.push("Missing ROLE section.");
  }

  if (/^# TASK/m.test(text)) {
    score += 8;
  } else {
    issues.push("Missing TASK section.");
  }

  if (/^# REQUIREMENTS/m.test(text)) {
    score += 6;
  } else {
    issues.push("Missing REQUIREMENTS section.");
  }

  if (/^# OUTPUT FORMAT/m.test(text)) {
    score += 6;
  } else {
    issues.push("Missing OUTPUT FORMAT section.");
  }

  if (Array.isArray(item?.sourceTurnIds) && item.sourceTurnIds.length) {
    score += 6;
  } else {
    issues.push("No linked source turn.");
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
  return workflowPrompts.map((item, index) => ({
    ...item,
    order: index + 1,
    quality: scoreWorkflowPrompt(item, scenario)
  }));
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
    "The output follows the requested structure.",
    "The answer reflects the original user intent.",
    `The result is usable as a ${outputFormat.toLowerCase()}.`
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
    ? inputs.map((input) => `- ${input.label}: {{${input.key}}}`).join("\n")
    : "- topic: {{topic}}";

  if (workflowPrompts.length) {
    return [
      "# IDENTITY and PURPOSE",
      "Use the following workflow to complete the task in a reusable, structured way.",
      "",
      "# INPUTS",
      inputSection,
      "",
      "# STEPS",
      workflowPrompts
        .map((item, index) => `## Step ${index + 1}: ${item.title}\n${item.prompt}`)
        .join("\n\n"),
      "",
      "# OUTPUT INSTRUCTIONS",
      "Return a structured result that follows the requested format and is ready to use without extra rewriting."
    ].join("\n");
  }

  if (!selectedText) {
    return [
      "# IDENTITY and PURPOSE",
      "Apply this skill to the provided input and return a clear, structured result.",
      "",
      "# INPUTS",
      inputSection,
      "",
      "# STEPS",
      "## Step 1\nUnderstand the task and clarify the goal.",
      "",
      "## Step 2\nApply the skill method to the provided input.",
      "",
      "# OUTPUT INSTRUCTIONS",
      "Return a clear, structured response."
    ].join("\n");
  }

  let template = selectedText;
  inputs.forEach((input) => {
    const pattern = new RegExp(escapeRegExp(input.label), "ig");
    template = template.replace(pattern, `{{${input.key}}}`);
  });

  return [
    "# IDENTITY and PURPOSE",
    "Apply the following reusable method to the provided input.",
    "",
    "# INPUTS",
    inputSection,
    "",
    "# TASK",
    template,
    "",
    "# OUTPUT INSTRUCTIONS",
    "Return the result in a clear, structured format."
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
