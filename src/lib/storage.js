import { STORAGE_KEYS } from "./constants.js";

async function getBucket(key) {
  const result = await chrome.storage.local.get([key]);
  return result[key] || [];
}

async function setBucket(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

export async function getSettings() {
  const result = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS]);
  return {
    validationMode: "local",
    apiBaseUrl: "",
    apiModel: "",
    apiKey: "",
    ...(result[STORAGE_KEYS.SETTINGS] || {})
  };
}

export async function updateSettings(nextSettings) {
  const current = await getSettings();
  const merged = { ...current, ...nextSettings };
  await setBucket(STORAGE_KEYS.SETTINGS, merged);
  return merged;
}

export async function getAllState() {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.CONVERSATIONS,
    STORAGE_KEYS.DRAFTS,
    STORAGE_KEYS.SKILLS,
    STORAGE_KEYS.VARIANTS,
    STORAGE_KEYS.SETTINGS
  ]);

  return {
    conversations: result[STORAGE_KEYS.CONVERSATIONS] || [],
    drafts: result[STORAGE_KEYS.DRAFTS] || [],
    skills: result[STORAGE_KEYS.SKILLS] || [],
    variants: result[STORAGE_KEYS.VARIANTS] || [],
    settings: {
      validationMode: "local",
      apiBaseUrl: "",
      apiModel: "",
      apiKey: "",
      ...(result[STORAGE_KEYS.SETTINGS] || {})
    }
  };
}

export async function insertConversation(item) {
  const bucket = await getBucket(STORAGE_KEYS.CONVERSATIONS);
  bucket.unshift(item);
  await setBucket(STORAGE_KEYS.CONVERSATIONS, bucket);
  return item;
}

export async function insertDraft(item) {
  const bucket = await getBucket(STORAGE_KEYS.DRAFTS);
  bucket.unshift(item);
  await setBucket(STORAGE_KEYS.DRAFTS, bucket);
  return item;
}

export async function insertSkill(item) {
  const bucket = await getBucket(STORAGE_KEYS.SKILLS);
  bucket.unshift(item);
  await setBucket(STORAGE_KEYS.SKILLS, bucket);
  return item;
}

export async function insertVariant(item) {
  const bucket = await getBucket(STORAGE_KEYS.VARIANTS);
  bucket.unshift(item);
  await setBucket(STORAGE_KEYS.VARIANTS, bucket);
  return item;
}

export async function removeDraft(id) {
  const bucket = await getBucket(STORAGE_KEYS.DRAFTS);
  const next = bucket.filter((item) => item.id !== id);
  await setBucket(STORAGE_KEYS.DRAFTS, next);
}

export async function archiveConversation(id) {
  const bucket = await getBucket(STORAGE_KEYS.CONVERSATIONS);
  const next = bucket.map((item) => (
    item.id === id
      ? { ...item, archivedAt: new Date().toISOString() }
      : item
  ));
  await setBucket(STORAGE_KEYS.CONVERSATIONS, next);
  return next.find((item) => item.id === id) || null;
}

export async function archiveDraft(id) {
  const bucket = await getBucket(STORAGE_KEYS.DRAFTS);
  const next = bucket.map((item) => (
    item.id === id
      ? { ...item, archivedAt: new Date().toISOString(), status: "archived" }
      : item
  ));
  await setBucket(STORAGE_KEYS.DRAFTS, next);
  return next.find((item) => item.id === id) || null;
}

export async function updateDraft(id, updater) {
  const bucket = await getBucket(STORAGE_KEYS.DRAFTS);
  const next = bucket.map((item) => (item.id === id ? updater(item) : item));
  await setBucket(STORAGE_KEYS.DRAFTS, next);
  return next.find((item) => item.id === id) || null;
}

export async function updateSkill(id, updater) {
  const bucket = await getBucket(STORAGE_KEYS.SKILLS);
  const next = bucket.map((skill) => (skill.id === id ? updater(skill) : skill));
  await setBucket(STORAGE_KEYS.SKILLS, next);
  return next.find((skill) => skill.id === id) || null;
}

export async function archiveSkill(id) {
  return updateSkill(id, (skill) => ({
    ...skill,
    status: "archived",
    updatedAt: new Date().toISOString()
  }));
}

export async function findDraftById(id) {
  const bucket = await getBucket(STORAGE_KEYS.DRAFTS);
  return bucket.find((item) => item.id === id) || null;
}

export async function findSkillById(id) {
  const bucket = await getBucket(STORAGE_KEYS.SKILLS);
  return bucket.find((item) => item.id === id) || null;
}

export async function seedDemoSkillIfNeeded() {
  const skills = await getBucket(STORAGE_KEYS.SKILLS);
  if (skills.length > 0) {
    return;
  }

  await insertSkill({
    id: "skill_demo_prd",
    kind: "skill",
    status: "validated",
    name: "Product PRD Draft",
    slug: "product-prd-draft",
    scenario: "Turn product ideas into a structured PRD",
    goal: "Generate a concise product requirements draft",
    userIntent: "Write a PRD from a raw feature idea",
    inputs: [
      {
        key: "feature",
        label: "Feature",
        required: true,
        description: "The product idea or feature to define"
      },
      {
        key: "audience",
        label: "Audience",
        required: false,
        description: "Target users or stakeholders"
      }
    ],
    constraints: [
      "Be concrete and execution-ready",
      "Call out MVP scope and success metrics"
    ],
    steps: [
      "Summarize the feature idea",
      "Define user problem and target audience",
      "Break down MVP scope, non-goals, and risks",
      "Recommend success metrics"
    ],
    promptTemplate: [
      "Help me write a product PRD.",
      "",
      "Feature: {{feature}}",
      "Audience: {{audience}}",
      "",
      "Please return:",
      "1. Problem",
      "2. Users",
      "3. MVP scope",
      "4. Non-goals",
      "5. Risks",
      "6. Metrics"
    ].join("\n"),
    outputFormat: "Structured PRD sections",
    example: "Feature: AI skill compiler extension for Chrome",
    tags: ["product", "writing"],
    sourceConversationIds: [],
    preferredForPlatforms: [],
    preferredForModels: [],
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export async function resetAllState() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.CONVERSATIONS]: [],
    [STORAGE_KEYS.DRAFTS]: [],
    [STORAGE_KEYS.SKILLS]: [],
    [STORAGE_KEYS.VARIANTS]: [],
    [STORAGE_KEYS.SETTINGS]: {}
  });
}
