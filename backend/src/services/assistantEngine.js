import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-3.5-flash";
const MAX_HISTORY_ITEMS = 10;
const MAX_HISTORY_CHARS = 1600;

let geminiClient;

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
}

function getGeminiClient() {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    return null;
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
    });
  }

  return geminiClient;
}

function normalize(message) {
  return message.toLowerCase().replace(/\s+/g, " ").trim();
}

function includesAny(message, terms) {
  return terms.some((term) => message.includes(term));
}

function sanitizeAssistantName(assistantName) {
  return assistantName?.trim().slice(0, 40) || "Nova";
}

function toGeminiContents(history, message) {
  const cleanHistory = history
    .filter((entry) => entry && typeof entry.content === "string")
    .slice(-MAX_HISTORY_ITEMS)
    .map((entry) => ({
      role: entry.role === "assistant" ? "model" : "user",
      parts: [
        {
          text: entry.content.trim().slice(0, MAX_HISTORY_CHARS),
        },
      ],
    }))
    .filter((entry) => entry.parts[0].text);

  const lastMessage = cleanHistory.at(-1);

  if (lastMessage?.role === "user" && lastMessage.parts[0].text === message) {
    return cleanHistory;
  }

  return [
    ...cleanHistory,
    {
      role: "user",
      parts: [
        {
          text: message,
        },
      ],
    },
  ];
}

function buildInstructions(assistantName) {
  return [
    `You are ${assistantName}, a helpful virtual assistant inside a voice-first web app.`,
    "Answer naturally: be accurate, useful, and conversational.",
    "Keep replies concise enough for speech, but give enough detail to be genuinely helpful.",
    "If the user asks for code, steps, explanations, writing, ideas, or debugging help, answer directly.",
    "Do not mention that you are a local fallback, API wrapper, or language model unless the user asks.",
    "When you are uncertain, say so briefly and suggest the next best step.",
  ].join(" ");
}

function getLocalTimeReply(assistantName) {
  const now = new Date();
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(now);

  return `It is ${time}. ${assistantName} is ready.`;
}

function getLocalDateReply() {
  const today = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  return `Today is ${today}.`;
}

function createLocalReply({ message, history = [], assistantName }) {
  const normalizedMessage = normalize(message);
  let content;

  if (includesAny(normalizedMessage, ["hello", "hi ", "hey", "good morning", "good evening"])) {
    content = `Hi. I am ${assistantName}. Ask me anything and I will try to help.`;
  } else if (includesAny(normalizedMessage, ["your name", "who are you"])) {
    content = `I am ${assistantName}, your customized assistant.`;
  } else if (includesAny(normalizedMessage, ["time", "current time"])) {
    content = getLocalTimeReply(assistantName);
  } else if (includesAny(normalizedMessage, ["date", "today", "day is it"])) {
    content = getLocalDateReply();
  } else {
    content =
      "I can answer much better when Gemini is connected. Add a GEMINI_API_KEY in the backend .env file, then restart the backend.";
  }

  if (history.length > 4 && !content.includes("conversation")) {
    content = `${content} I am keeping the recent conversation in mind.`;
  }

  return {
    id: `assistant-${Date.now()}`,
    role: "assistant",
    toneLabel: "Local fallback",
    content,
    provider: "local",
    timestamp: new Date().toISOString(),
  };
}

async function createGeminiReply({ message, history, assistantName }) {
  const client = getGeminiClient();

  if (!client) {
    return createLocalReply({ message, history, assistantName });
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const response = await client.models.generateContent({
    model,
    contents: toGeminiContents(history, message),
    config: {
      systemInstruction: buildInstructions(assistantName),
    },
  });

  const content = response.text?.trim();

  if (!content) {
    throw new Error("Gemini returned an empty response.");
  }

  return {
    id: `assistant-${Date.now()}`,
    role: "assistant",
    toneLabel: "Gemini",
    content,
    provider: "gemini",
    model,
    timestamp: new Date().toISOString(),
  };
}

export async function createAssistantReply({ message, history = [], assistantName = "Nova" }) {
  const cleanName = sanitizeAssistantName(assistantName);

  try {
    return await createGeminiReply({
      message: message.trim(),
      history,
      assistantName: cleanName,
    });
  } catch (error) {
    console.error("Gemini assistant request failed:", error.message);

    return {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      toneLabel: "Connection issue",
      content:
        "I could not connect to Gemini right now. Check your backend GEMINI_API_KEY, restart the backend, and try again.",
      provider: "gemini-error",
      timestamp: new Date().toISOString(),
    };
  }
}
