import { nowIso } from "./utils.js";

export function validateSkillAsset(asset, settings = {}) {
  const mode = settings.validationMode || "local";

  if (mode === "api") {
    return {
      mode: "api",
      status: "pending_setup",
      score: null,
      issues: [
        "API validation mode is configured but not fully enabled yet.",
        "Local heuristic validation is still recommended as the fallback."
      ],
      checkedAt: nowIso()
    };
  }

  return runLocalValidation(asset);
}

function runLocalValidation(asset) {
  const issues = [];
  let score = 100;

  if (!asset.name || asset.name.trim().length < 4) {
    issues.push("Name is too short.");
    score -= 12;
  }

  if (!asset.useWhen || asset.useWhen.trim().length < 8) {
    issues.push("Use When is missing or too vague.");
    score -= 16;
  }

  if (!asset.promptTemplate || asset.promptTemplate.trim().length < 12) {
    issues.push("Run prompt is short. Review whether the steps are detailed enough.");
    score -= 8;
  }

  if (!asset.steps || asset.steps.length < 2) {
    issues.push("Skill should have at least 2 clear steps.");
    score -= 14;
  }

  if (!asset.outputFormat || asset.outputFormat.trim().length < 5) {
    issues.push("Output format is missing.");
    score -= 10;
  }

  if (!asset.successCriteria || asset.successCriteria.length < 2) {
    issues.push("Success criteria should contain at least 2 checks.");
    score -= 12;
  }

  if (!asset.sourceConversationIds || asset.sourceConversationIds.length === 0) {
    issues.push("No source conversation is linked.");
    score -= 8;
  }

  if (!asset.inputs || asset.inputs.length === 0) {
    issues.push("No inputs were extracted. Review manually.");
    score -= 6;
  }

  const normalizedScore = Math.max(0, score);
  return {
    mode: "local",
    status: normalizedScore >= 75 ? "strong" : normalizedScore >= 55 ? "needs_review" : "weak",
    score: normalizedScore,
    issues,
    checkedAt: nowIso()
  };
}
