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

function inferStepSources(turns = [], steps = [], scenario = "") {
  if (scenario === "Podcast interview planning" || scenario === "Interview outline generation") {
    return steps.map((step) => buildStepSourceMatch(step, turns, 2));
  }

  return steps.map((step) => buildStepSourceMatch(step, turns, 2));
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
  const name = titleFromText(selectedText, payload.title || "Untitled Skill Draft");
  const scenario = inferScenario(payload);
  const inputs = extractVariablesFromText(selectedText);
  const steps = inferSteps(payload.turns, scenario, selectedText);
  const stepSources = inferStepSources(payload.turns || [], steps, scenario);
  const outputFormat = inferOutputFormat(scenario);

  const draft = {
    id: createId("draft"),
    kind: "skill_draft",
    status: "preview",
    name,
    whatItDoes: `Auto-draft a reusable method from the captured conversation for ${scenario.toLowerCase()}.`,
    scenario,
    useWhen: inferUseWhen(scenario, selectedText),
    notFor: inferNotFor(scenario),
    goal: inferGoal(scenario, payload.platform),
    userIntent: titleFromText(selectedText, "Reuse this AI workflow"),
    inputs,
    constraints: [
      "Preserve the original task intent",
      "Keep the output reusable across AI tools"
    ],
    steps,
    stepSources,
    promptTemplate: buildPromptTemplate(selectedText, inputs),
    outputFormat,
    successCriteria: inferSuccessCriteria(outputFormat),
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

function buildPromptTemplate(selectedText, inputs) {
  if (!selectedText) {
    return "Help me apply this skill to {{topic}} with a clear structured output.";
  }

  let template = selectedText;
  inputs.forEach((input) => {
    const pattern = new RegExp(escapeRegExp(input.label), "ig");
    template = template.replace(pattern, `{{${input.key}}}`);
  });

  if (inputs.length === 0) {
    template += "\n\nReturn the result in a clear, structured format.";
  }

  return template;
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
    preferredForPlatforms: skill.preferredForPlatforms || [],
    preferredForModels: skill.preferredForModels || [],
    usageCount: 0,
    successSignals: [],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}
