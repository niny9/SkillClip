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

function inferSteps(turns) {
  const userTurns = (turns || []).filter((turn) => turn.role === "user").slice(0, 4);
  const assistantTurns = (turns || []).filter((turn) => turn.role === "assistant").slice(0, 3);
  const steps = [];

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

function inferUseWhen(scenario) {
  return `Use this skill when you need help with ${scenario.toLowerCase()} and want a repeatable result.`;
}

function inferNotFor(scenario) {
  return `Do not use this skill when the task is unrelated to ${scenario.toLowerCase()} or requires live external verification.`;
}

function inferSuccessCriteria(outputFormat) {
  return [
    "The output follows the requested structure.",
    "The answer reflects the original user intent.",
    `The result is usable as a ${outputFormat.toLowerCase()}.`
  ];
}

export function compileSkillDraft(payload, settings = {}) {
  const selectedText = payload.selectedText || payload.turns?.[0]?.text || "";
  const name = titleFromText(selectedText, payload.title || "Untitled Skill Draft");
  const scenario = inferScenario(payload);
  const inputs = extractVariablesFromText(selectedText);
  const steps = inferSteps(payload.turns);
  const outputFormat = "Structured response";

  const draft = {
    id: createId("draft"),
    kind: "skill_draft",
    status: "preview",
    name,
    whatItDoes: `Auto-draft a reusable method from the captured conversation for ${scenario.toLowerCase()}.`,
    scenario,
    useWhen: inferUseWhen(scenario),
    notFor: inferNotFor(scenario),
    goal: `Draft a reusable workflow based on the captured conversation from ${payload.platform || "an AI tool"}`,
    userIntent: titleFromText(selectedText, "Reuse this AI workflow"),
    inputs,
    constraints: [
      "Preserve the original task intent",
      "Keep the output reusable across AI tools"
    ],
    steps,
    promptTemplate: buildPromptTemplate(selectedText, inputs),
    outputFormat,
    successCriteria: inferSuccessCriteria(outputFormat),
    example: selectedText,
    sourceConversationIds: [payload.conversationId],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  return {
    ...draft,
    validation: validateSkillAsset(draft, settings)
  };
}

function buildPromptTemplate(selectedText, inputs) {
  if (!selectedText) {
    return "Help me apply this skill to {{topic}} with a clear structured output.";
  }

  let template = selectedText;
  inputs.forEach((input) => {
    const pattern = new RegExp(input.label, "ig");
    template = template.replace(pattern, `{{${input.key}}}`);
  });

  if (inputs.length === 0) {
    template += "\n\nReturn the result in a clear, structured format.";
  }

  return template;
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
    promptTemplate: draft.promptTemplate,
    outputFormat: draft.outputFormat,
    successCriteria: draft.successCriteria,
    example: draft.example,
    tags: [],
    sourceConversationIds: draft.sourceConversationIds,
    preferredForPlatforms: [],
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
    preferredForPlatforms: skill.preferredForPlatforms || [],
    preferredForModels: skill.preferredForModels || [],
    usageCount: 0,
    successSignals: [],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}
