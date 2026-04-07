import axios from "axios";

const modelCooldowns = new Map();
const modelFailures = new Map();
const responseCache = new Map();
let lastSuccessfulModel = "";
let lastQuotaWarningAt = 0;

const DEFAULT_QUOTA_COOLDOWN_MS = 30 * 1000;
const MAX_QUOTA_COOLDOWN_MS = 5 * 60 * 1000;
const WARNING_THROTTLE_MS = 30 * 1000;
const RESPONSE_CACHE_TTL_MS = 10 * 60 * 1000;

const isQuotaError = (error) => (
  error?.response?.status === 429
  || error?.response?.data?.error?.status === "RESOURCE_EXHAUSTED"
);

const isRetryableError = (error) => (
  error?.code === "ECONNABORTED"
  || !error?.response
  || error?.response?.status >= 500
);

const parseRetryAfterMs = (error) => {
  const retryAfterHeader = Number(error?.response?.headers?.["retry-after"]);
  if (!Number.isNaN(retryAfterHeader) && retryAfterHeader > 0) {
    return Math.min(retryAfterHeader * 1000, MAX_QUOTA_COOLDOWN_MS);
  }

  const errorMessage = error?.response?.data?.error?.message || "";
  const retryMatch = errorMessage.match(/Please retry in\s+([\d.]+)s/i);

  if (retryMatch?.[1]) {
    const retrySeconds = Number(retryMatch[1]);
    if (!Number.isNaN(retrySeconds) && retrySeconds > 0) {
      return Math.min(Math.ceil(retrySeconds * 1000), MAX_QUOTA_COOLDOWN_MS);
    }
  }

  return DEFAULT_QUOTA_COOLDOWN_MS;
};

const buildGeminiError = (message, extras = {}) => {
  const requestError = new Error(message);
  Object.assign(requestError, extras);
  return requestError;
};

const wait = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const parseConfiguredModel = (apiUrl = "") => {
  const match = apiUrl.match(/\/models\/([^:]+):generateContent/i);
  return match?.[1] || "";
};

const buildModelCandidates = () => {
  const configuredModel = parseConfiguredModel(process.env.GEMINI_API_URL || "");
  const envModels = (process.env.GEMINI_MODELS || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  const candidates = [
    lastSuccessfulModel,
    ...envModels,
    "gemini-flash-lite-latest",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    configuredModel,
    "gemini-2.0-flash",
  ].filter(Boolean);

  return [...new Set(candidates)];
};

const buildApiUrl = (model, apiKey) => (
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
);

const buildCacheKey = (command, assistantName, userName, recentHistory) => (
  JSON.stringify({
    command: command.trim().toLowerCase(),
    assistantName,
    userName,
    recentHistory,
  })
);

const markModelCooldown = (model, retryAfterMs) => {
  modelCooldowns.set(model, Date.now() + retryAfterMs);
  modelFailures.set(model, {
    status: 429,
    code: "RESOURCE_EXHAUSTED",
    retryAfterMs,
    model,
  });

  if (Date.now() - lastQuotaWarningAt > WARNING_THROTTLE_MS) {
    console.warn(
      `Gemini model "${model}" quota exhausted. Trying another model for ${Math.ceil(retryAfterMs / 1000)}s.`,
    );
    lastQuotaWarningAt = Date.now();
  }
};

const getModelFailure = (model) => {
  const cooldownUntil = modelCooldowns.get(model) || 0;
  if (cooldownUntil > Date.now()) {
    return modelFailures.get(model) || {
      status: 429,
      code: "RESOURCE_EXHAUSTED",
      retryAfterMs: cooldownUntil - Date.now(),
      model,
    };
  }

  return null;
};

const requestWithModel = async (model, apiKey, requestBody) => {
  let finalError;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await axios.post(
        buildApiUrl(model, apiKey),
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 12000,
        },
      );

      modelCooldowns.delete(model);
      modelFailures.delete(model);
      lastSuccessfulModel = model;
      return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (error) {
      finalError = error;

      if (isQuotaError(error)) {
        const retryAfterMs = parseRetryAfterMs(error);
        markModelCooldown(model, retryAfterMs);
        throw buildGeminiError("Gemini request failed", {
          status: 429,
          code: "RESOURCE_EXHAUSTED",
          retryAfterMs,
          model,
          details: error.response?.data,
        });
      }

      if (attempt < 2 && isRetryableError(error)) {
        await wait(500 * attempt);
        continue;
      }

      break;
    }
  }

  throw buildGeminiError("Gemini request failed", {
    status: finalError?.response?.status,
    model,
    details: finalError?.response?.data,
    cause: finalError,
  });
};

const geminiResponse = async (command, assistantName, userName, history = []) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const safeAssistantName = assistantName || "Assistant";
  const safeUserName = userName || "the creator";
  const recentHistory = history.slice(-3);

  if (!apiKey) {
    throw new Error("Gemini API credentials are missing");
  }

  const cacheKey = buildCacheKey(command, safeAssistantName, safeUserName, recentHistory);
  const cachedEntry = responseCache.get(cacheKey);

  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    return cachedEntry.value;
  }

  const recentHistoryText = recentHistory.length
    ? `Recent user prompts:\n- ${recentHistory.join("\n- ")}\n`
    : "";

  const prompt = `You are a powerful virtual assistant named ${safeAssistantName}, created by ${safeUserName}.
Answer the user's message directly and helpfully.
Return JSON only with this exact shape:
{"type":"general","userinput":"string","response":"string"}

Rules:
- type must always be "general".
- response must answer the user's actual question directly.
- Do not redirect the user to Google or YouTube unless they explicitly asked for those actions, and explicit actions are already handled before you.
- If the user asks your name, answer "My name is ${safeAssistantName}."
- If the user asks who created you, answer "${safeUserName} created me."
- Keep userinput close to the original request without the assistant name.
- Keep the response concise but informative, usually 2 to 4 sentences.
${recentHistoryText}User: ${command}`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: 220,
      responseMimeType: "application/json",
    },
  };

  const modelCandidates = buildModelCandidates();
  let lastError = null;

  for (const model of modelCandidates) {
    const modelFailure = getModelFailure(model);
    if (modelFailure) {
      lastError = buildGeminiError("Gemini request failed", modelFailure);
      continue;
    }

    try {
      const responseText = await requestWithModel(model, apiKey, requestBody);

      if (!responseText.trim()) {
        continue;
      }

      responseCache.set(cacheKey, {
        value: responseText,
        expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
      });

      return responseText;
    } catch (error) {
      lastError = error;
      if (error?.status === 429) {
        continue;
      }

      console.error("Gemini API error:", {
        model,
        status: error?.status,
        message: error?.cause?.message || error?.message,
        details: error?.details || null,
      });
    }
  }

  throw buildGeminiError("Gemini request failed", {
    status: lastError?.status,
    code: lastError?.code,
    retryAfterMs: lastError?.retryAfterMs,
    model: lastError?.model,
    details: lastError?.details,
  });
};

export default geminiResponse;
