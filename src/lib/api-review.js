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
            "name, whatItDoes, scenario, useWhen, notFor, goal, inputs, workflowPrompts, promptTemplate, outputFormat, steps, successCriteria.",
            "name must be concise, specific, and usually within 3-10 words.",
            "whatItDoes must explain the reusable capability in one sentence.",
            "useWhen must say when the skill should be used.",
            "notFor must say when it should not be used.",
            "goal must describe the user outcome.",
            "inputs must be an array of { key, label, required, description }.",
            "workflowPrompts must be an array of { title, prompt, sourceTurnIds } with concise optimized prompts.",
            "Each workflow prompt should read like a high-quality reusable prompt, not copied chat text.",
            "workflowPrompts should correspond to the meaningful user turns in order whenever possible.",
            "steps should align with workflowPrompts instead of repeating the raw chat.",
            "promptTemplate must be a structured Markdown runbook with sections such as IDENTITY and PURPOSE, INPUTS, STEPS, and OUTPUT INSTRUCTIONS.",
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
  const workflowPrompts = normalizeWorkflowPrompts(parsed.workflowPrompts, fallbackDraft.workflowPrompts);
  const steps = normalizeSteps(parsed.steps, workflowPrompts, fallbackDraft.steps);

  return {
    ...fallbackDraft,
    name: parsed.name || fallbackDraft.name,
    whatItDoes: parsed.whatItDoes || fallbackDraft.whatItDoes,
    scenario: parsed.scenario || fallbackDraft.scenario,
    useWhen: parsed.useWhen || fallbackDraft.useWhen,
    notFor: parsed.notFor || fallbackDraft.notFor,
    goal: parsed.goal || fallbackDraft.goal,
    inputs: Array.isArray(parsed.inputs) && parsed.inputs.length ? parsed.inputs : fallbackDraft.inputs,
    workflowPrompts,
    promptTemplate: parsed.promptTemplate || fallbackDraft.promptTemplate,
    outputFormat: parsed.outputFormat || fallbackDraft.outputFormat,
    steps,
    stepSources: buildStepSourcesFromWorkflowPrompts(workflowPrompts, steps, fallbackDraft.stepSources || []),
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

function normalizeWorkflowPrompts(items, fallback = []) {
  if (!Array.isArray(items) || !items.length) {
    return fallback || [];
  }

  return items
    .map((item, index) => ({
      title: String(item?.title || `步骤提示词 ${index + 1}`).trim(),
      prompt: String(item?.prompt || "").trim(),
      sourceTurnIds: Array.isArray(item?.sourceTurnIds)
        ? item.sourceTurnIds.map((id) => String(id)).filter(Boolean)
        : []
    }))
    .filter((item) => item.prompt);
}

function normalizeSteps(items, workflowPrompts = [], fallback = []) {
  if (Array.isArray(items) && items.length) {
    return items.map((item) => String(item).trim()).filter(Boolean);
  }

  if (workflowPrompts.length) {
    return workflowPrompts.map((item) => `${item.title}：执行这一段优化后的工作流 Prompt。`);
  }

  return fallback || [];
}

function buildStepSourcesFromWorkflowPrompts(workflowPrompts = [], steps = [], fallback = []) {
  if (!workflowPrompts.length) {
    return fallback || [];
  }

  return workflowPrompts.map((item, index) => ({
    step: steps[index] || item.title || `步骤 ${index + 1}`,
    sourceTurnIds: item.sourceTurnIds || [],
    sourcePreview: String(item.prompt || "").slice(0, 220)
  }));
}

export async function optimizePromptWithApi(conversation, settings) {
  if (!settings.apiBaseUrl || !settings.apiModel || !settings.apiKey) {
    return null;
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
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "You rewrite a raw user prompt into a clearer, stronger, reusable AI prompt.",
            "Return strict JSON with keys: optimizedTitle, optimizedPrompt, scenario.",
            "optimizedTitle must be short and concise.",
            "optimizedPrompt must preserve intent but improve structure and clarity.",
            "optimizedPrompt must be Markdown with sections: ROLE, TASK, CONTEXT, REQUIREMENTS, OUTPUT FORMAT.",
            "Do not simply paraphrase the original request. Reframe it as a reusable high-quality prompt.",
            "scenario must summarize the use case in one short phrase."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            title: conversation.sourceTitle,
            platform: conversation.sourcePlatform,
            selectedText: conversation.selectedText,
            turns: conversation.turns || []
          })
        }
      ]
    })
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content || "";
  const parsed = parseJsonResponse(rawContent);
  return {
    optimizedTitle: parsed.optimizedTitle || "",
    optimizedPrompt: parsed.optimizedPrompt || "",
    scenario: parsed.scenario || ""
  };
}

export async function optimizeWorkflowPromptWithApi(asset, workflowPrompt, settings) {
  if (!settings.apiBaseUrl || !settings.apiModel || !settings.apiKey) {
    return null;
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
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "You improve one workflow prompt inside a reusable AI skill.",
            "Return strict JSON with keys: optimizedTitle, optimizedPrompt.",
            "optimizedTitle must stay concise and step-like.",
            "optimizedPrompt must be a stronger, more reusable version of the workflow prompt.",
            "Keep the prompt structured and practical."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            skillName: asset.name,
            scenario: asset.scenario,
            useWhen: asset.useWhen,
            promptTitle: workflowPrompt.title,
            prompt: workflowPrompt.prompt,
            outputFormat: asset.outputFormat
          })
        }
      ]
    })
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content || "";
  const parsed = parseJsonResponse(rawContent);
  return {
    optimizedTitle: parsed.optimizedTitle || workflowPrompt.title || "",
    optimizedPrompt: parsed.optimizedPrompt || workflowPrompt.prompt || ""
  };
}

export async function optimizeWorkflowTurnsWithApi(payload, settings) {
  if (!settings.apiBaseUrl || !settings.apiModel || !settings.apiKey) {
    return [];
  }

  const userTurns = (payload.turns || [])
    .filter((turn) => turn?.role === "user" && turn?.text)
    .slice(0, 8)
    .map((turn, index) => ({
      id: turn.id || `turn_${index + 1}`,
      text: turn.text
    }));

  if (!userTurns.length) {
    return [];
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
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "You convert a multi-turn AI conversation into reusable workflow prompts.",
            "Return strict JSON with one key: workflowPrompts.",
            "workflowPrompts must be an array of { title, prompt, sourceTurnIds }.",
            "Create one workflow prompt for each meaningful user turn, in order.",
            "Each prompt must be optimized, concise, and reusable.",
            "Do not copy the raw chat wording unless necessary.",
            "Each prompt should use a strong structure suitable for repeated use."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            title: payload.title,
            platform: payload.platform,
            selectedText: payload.selectedText,
            userTurns
          })
        }
      ]
    })
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content || "";
  const parsed = parseJsonResponse(rawContent);
  return normalizeWorkflowPrompts(parsed.workflowPrompts, []);
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

export async function runSkillCheck(asset, settings) {
  if (!settings.apiBaseUrl || !settings.apiModel || !settings.apiKey) {
    return {
      ok: false,
      mode: "local",
      summary: "API mode is not configured, so live skill check could not run.",
      outputPreview: "",
      issues: ["Configure API Base URL, model, and key to run a live skill check."],
      checkedAt: nowIso()
    };
  }

  const endpoint = `${settings.apiBaseUrl.replace(/\/$/, "")}/chat/completions`;
  const sampleInputs = buildSampleInputs(asset.inputs || []);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.apiModel,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "You are testing whether a structured AI skill can produce a usable output.",
            "First, execute the skill using the provided inputs.",
            "Then return strict JSON with keys: ok, summary, outputPreview, issues, promptChecks.",
            "ok must be boolean.",
            "summary must be one short sentence.",
            "outputPreview must contain the generated output preview as plain text.",
            "issues must be an array of short strings.",
            "promptChecks must be an array of { title, ok, summary, issues } that evaluates each workflow prompt individually."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            name: asset.name,
            goal: asset.goal,
            useWhen: asset.useWhen,
            inputs: sampleInputs,
            steps: asset.steps,
            workflowPrompts: asset.workflowPrompts || [],
            outputFormat: asset.outputFormat,
            successCriteria: asset.successCriteria,
            promptTemplate: asset.promptTemplate
          })
        }
      ]
    })
  });

  if (!response.ok) {
    return {
      ok: false,
      mode: "api",
      summary: `Skill check request failed with status ${response.status}.`,
      outputPreview: "",
      issues: [`Skill check API request failed with status ${response.status}.`],
      checkedAt: nowIso()
    };
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content || "";
  const parsed = parseJsonResponse(rawContent);

  return {
    ok: Boolean(parsed.ok),
    mode: "api",
    summary: parsed.summary || "Skill check completed.",
    outputPreview: parsed.outputPreview || "",
    issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    promptChecks: Array.isArray(parsed.promptChecks) ? parsed.promptChecks : [],
    checkedAt: nowIso()
  };
}

export async function runWorkflowPromptCheck(asset, workflowPrompt, settings) {
  if (!settings.apiBaseUrl || !settings.apiModel || !settings.apiKey) {
    return {
      ok: false,
      summary: "API mode is not configured, so single prompt check could not run.",
      issues: ["Configure API Base URL, model, and key to run a workflow prompt check."]
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
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "You evaluate one workflow prompt inside a larger AI skill.",
            "Return strict JSON with keys: ok, summary, issues.",
            "ok must be boolean.",
            "summary must be one short sentence.",
            "issues must be an array of short strings."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            skillName: asset.name,
            scenario: asset.scenario,
            promptTitle: workflowPrompt.title,
            prompt: workflowPrompt.prompt,
            outputFormat: asset.outputFormat,
            successCriteria: asset.successCriteria
          })
        }
      ]
    })
  });

  if (!response.ok) {
    return {
      ok: false,
      summary: `Workflow prompt check failed with status ${response.status}.`,
      issues: [`Workflow prompt check API request failed with status ${response.status}.`]
    };
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content || "";
  const parsed = parseJsonResponse(rawContent);
  return {
    ok: Boolean(parsed.ok),
    summary: parsed.summary || "Workflow prompt check completed.",
    issues: Array.isArray(parsed.issues) ? parsed.issues : []
  };
}

function buildSampleInputs(inputs) {
  return (inputs || []).map((input) => ({
    key: input.key,
    label: input.label,
    value: sampleValueForInput(input)
  }));
}

function sampleValueForInput(input) {
  const label = `${input.label || input.key || ""}`.toLowerCase();
  if (label.includes("topic")) {
    return "AI product strategy";
  }
  if (label.includes("guest")) {
    return "founder of an AI startup";
  }
  if (label.includes("audience")) {
    return "product managers and AI builders";
  }
  if (label.includes("tone")) {
    return "clear and practical";
  }
  return `sample_${input.key || "value"}`;
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
