import { nowIso } from "./utils.js";

export async function extractSkillDraftWithApi(payload, fallbackDraft, settings) {
  if (!settings.apiBaseUrl || !settings.apiModel || !settings.apiKey) {
    return fallbackDraft;
  }

  const endpoint = `${settings.apiBaseUrl.replace(/\/$/, "")}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.apiModel,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: [
            "You extract a reusable AI skill from prompts and multi-turn conversations.",
            "A raw prompt is not yet a skill. Convert it into a reusable workflow.",
            "Return strict JSON with keys:",
            "name, whatItDoes, scenario, useWhen, notFor, goal, inputs, promptTemplate, outputFormat, steps, successCriteria.",
            "useWhen must say when the skill should be used.",
            "notFor must say when it should not be used.",
            "goal must describe the user outcome.",
            "inputs must be an array of { key, label, required, description }.",
            "steps must be an array of short strings.",
            "successCriteria must be an array of short strings.",
            "Keep the result practical, reusable, and more structured than the original prompt."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            title: payload.title,
            platform: payload.platform,
            selectedText: payload.selectedText,
            turns: payload.turns
          })
        }
      ]
    })
  });

  if (!response.ok) {
    return fallbackDraft;
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content || "";
  const parsed = parseJsonResponse(rawContent);

  return {
    ...fallbackDraft,
    name: parsed.name || fallbackDraft.name,
    whatItDoes: parsed.whatItDoes || fallbackDraft.whatItDoes,
    scenario: parsed.scenario || fallbackDraft.scenario,
    useWhen: parsed.useWhen || fallbackDraft.useWhen,
    notFor: parsed.notFor || fallbackDraft.notFor,
    goal: parsed.goal || fallbackDraft.goal,
    inputs: Array.isArray(parsed.inputs) && parsed.inputs.length ? parsed.inputs : fallbackDraft.inputs,
    promptTemplate: parsed.promptTemplate || fallbackDraft.promptTemplate,
    outputFormat: parsed.outputFormat || fallbackDraft.outputFormat,
    steps: Array.isArray(parsed.steps) && parsed.steps.length ? parsed.steps : fallbackDraft.steps,
    successCriteria: Array.isArray(parsed.successCriteria) && parsed.successCriteria.length
      ? parsed.successCriteria
      : fallbackDraft.successCriteria,
    extraction: {
      mode: "api",
      provider: settings.apiProvider || "custom",
      model: settings.apiModel,
      extractedAt: nowIso()
    }
  };
}

export async function reviewSkillWithApi(asset, settings) {
  if (!settings.apiBaseUrl || !settings.apiModel || !settings.apiKey) {
    return {
      mode: "api",
      status: "pending_setup",
      score: null,
      issues: [
        "API validation mode is enabled, but API configuration is incomplete."
      ],
      checkedAt: nowIso()
    };
  }

  const endpoint = `${settings.apiBaseUrl.replace(/\/$/, "")}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.apiModel,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: [
            "You evaluate whether a structured AI skill is reusable and well-defined.",
            "Return strict JSON with keys: status, score, issues.",
            "status must be one of: strong, needs_review, weak.",
            "score must be 0-100.",
            "issues must be an array of short strings."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            name: asset.name,
            scenario: asset.scenario,
            useWhen: asset.useWhen,
            notFor: asset.notFor,
            goal: asset.goal,
            inputs: asset.inputs,
            steps: asset.steps,
            promptTemplate: asset.promptTemplate,
            outputFormat: asset.outputFormat,
            successCriteria: asset.successCriteria
          })
        }
      ]
    })
  });

  if (!response.ok) {
    return {
      mode: "api",
      status: "weak",
      score: null,
      issues: [`API request failed with status ${response.status}.`],
      checkedAt: nowIso()
    };
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content || "";
  const parsed = parseJsonResponse(rawContent);

  return {
    mode: "api",
    status: parsed.status || "needs_review",
    score: typeof parsed.score === "number" ? parsed.score : null,
    issues: Array.isArray(parsed.issues) ? parsed.issues : ["API returned an unexpected format."],
    checkedAt: nowIso()
  };
}

export async function testApiConnection(settings) {
  if (!settings.apiBaseUrl || !settings.apiModel || !settings.apiKey) {
    return {
      ok: false,
      message: "Missing API Base URL, model, or API key."
    };
  }

  const endpoint = `${settings.apiBaseUrl.replace(/\/$/, "")}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.apiModel,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: "Reply with the single word: connected"
        }
      ]
    })
  });

  if (!response.ok) {
    return {
      ok: false,
      message: `Connection failed with status ${response.status}.`
    };
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  return {
    ok: true,
    message: `Connection success. Model responded: ${String(text).slice(0, 80)}`
  };
}

function parseJsonResponse(content) {
  try {
    return JSON.parse(content);
  } catch (error) {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (innerError) {
        return {};
      }
    }
    return {};
  }
}
