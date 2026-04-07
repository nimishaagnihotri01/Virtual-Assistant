const getCurrentDate = () => new Date();

const formatTime = () => getCurrentDate().toLocaleTimeString("en-IN", {
  hour: "numeric",
  minute: "2-digit",
});

const formatDate = () => getCurrentDate().toLocaleDateString("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const formatDay = () => getCurrentDate().toLocaleDateString("en-IN", {
  weekday: "long",
});

const formatMonth = () => getCurrentDate().toLocaleDateString("en-IN", {
  month: "long",
});

const matchesSiteOpenRequest = (normalizedCommand, sitePattern) => (
  new RegExp(`\\b(?:open|launch|start|go to|take me to)\\s+(?:the\\s+)?(?:${sitePattern})\\b`).test(normalizedCommand)
);

const stripAssistantName = (command, assistantName) => {
  if (!assistantName) {
    return command.trim();
  }

  const escapedName = assistantName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return command.replace(new RegExp(`\\b${escapedName}\\b[:,]?`, "ig"), "").trim();
};

const extractSearchQuery = (command, patterns) => {
  for (const pattern of patterns) {
    const match = command.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return command.trim();
};

const buildGeneralFallback = (cleanedCommand, error) => ({
  type: "general",
  userinput: cleanedCommand,
  response: error?.status === 429
    ? "I am temporarily unable to answer detailed questions right now. Please try again in a moment."
    : "I am having trouble reaching the AI service right now. Please try again in a moment.",
});

const detectLocalAssistantAction = (command, assistantName, userName) => {
  const cleanedCommand = stripAssistantName(command, assistantName);
  const normalized = cleanedCommand.toLowerCase();

  if (/^(hi|hello|hey|hey there)\b/.test(normalized)) {
    return {
      type: "general",
      userinput: cleanedCommand,
      response: "Hello. How can I help you today?",
    };
  }

  if (/\b(thanks|thank you)\b/.test(normalized)) {
    return {
      type: "general",
      userinput: cleanedCommand,
      response: "You are welcome.",
    };
  }

  if (/who (made|created|built) you|who is your creator/.test(normalized)) {
    return {
      type: "general",
      userinput: cleanedCommand,
      response: `${userName} created me.`,
    };
  }

  if (/what(?:'s| is)? your name|tell me your name|who are you/.test(normalized)) {
    return {
      type: "general",
      userinput: cleanedCommand,
      response: `My name is ${assistantName}.`,
    };
  }

  if (/what(?:'s| is)? my name|who am i/.test(normalized)) {
    return {
      type: "general",
      userinput: cleanedCommand,
      response: `Your name is ${userName}.`,
    };
  }

  if (/\bwhat(?:'s| is)?(?: the)? time\b|\bwhat time is it\b|\bcurrent time\b|\btime now\b/.test(normalized)) {
    return {
      type: "get_time",
      userinput: cleanedCommand,
      response: `It is ${formatTime()}.`,
    };
  }

  if (/\bwhat(?:'s| is)?(?: the)? date\b|\bwhat is today's date\b|\btoday'?s date\b|\bdate today\b/.test(normalized)) {
    return {
      type: "get_date",
      userinput: cleanedCommand,
      response: `Today's date is ${formatDate()}.`,
    };
  }

  if (/\bwhat day is it\b|\bwhich day is it\b|\btoday is what day\b|\bwhat is today'?s day\b/.test(normalized)) {
    return {
      type: "get_day",
      userinput: cleanedCommand,
      response: `Today is ${formatDay()}.`,
    };
  }

  if (/\bcurrent month\b|\bwhat month is it\b|\bwhich month is it\b/.test(normalized)) {
    return {
      type: "get_month",
      userinput: cleanedCommand,
      response: `It is ${formatMonth()}.`,
    };
  }

  if (normalized.includes("calculator")) {
    return {
      type: "calculator_open",
      userinput: cleanedCommand,
      response: "Opening the calculator.",
    };
  }

  if (normalized.includes("instagram")) {
    return {
      type: "instagram_open",
      userinput: cleanedCommand,
      response: "Opening Instagram.",
    };
  }

  if (normalized.includes("facebook")) {
    return {
      type: "facebook_open",
      userinput: cleanedCommand,
      response: "Opening Facebook.",
    };
  }

  if (normalized.includes("weather")) {
    return {
      type: "weather_show",
      userinput: cleanedCommand,
      response: "Showing the weather forecast.",
    };
  }

  if (matchesSiteOpenRequest(normalized, "youtube|you tube")) {
    return {
      type: "youtube_open",
      userinput: cleanedCommand,
      response: "Opening YouTube.",
    };
  }

  if (matchesSiteOpenRequest(normalized, "google")) {
    return {
      type: "google_open",
      userinput: cleanedCommand,
      response: "Opening Google.",
    };
  }

  if (/(play|listen|start).+\bon youtube\b/.test(normalized) || /^play\b/.test(normalized)) {
    return {
      type: "youtube_play",
      userinput: extractSearchQuery(cleanedCommand, [
        /play\s+(.+?)\s+on\s+youtube/i,
        /play\s+(.+)/i,
      ]),
      response: "Playing it on YouTube.",
    };
  }

  if (/\b(search youtube for|search on youtube for|find on youtube|look up on youtube)\b/.test(normalized)) {
    return {
      type: "youtube_search",
      userinput: extractSearchQuery(cleanedCommand, [
        /search youtube for\s+(.+)/i,
        /search on youtube for\s+(.+)/i,
        /find on youtube\s+(.+)/i,
        /look up on youtube\s+(.+)/i,
      ]),
      response: "Searching YouTube now.",
    };
  }

  if (/\b(search google for|search on google for|find on google|look up on google|google search)\b/.test(normalized)) {
    return {
      type: "google_search",
      userinput: extractSearchQuery(cleanedCommand, [
        /search google for\s+(.+)/i,
        /search on google for\s+(.+)/i,
        /find on google\s+(.+)/i,
        /look up on google\s+(.+)/i,
        /google search\s+(.+)/i,
      ]),
      response: "Searching Google now.",
    };
  }

  return null;
};

const buildLocalAssistantResponse = (command, assistantName, userName, error = null) => {
  const localAction = detectLocalAssistantAction(command, assistantName, userName);

  if (localAction) {
    return localAction;
  }

  const cleanedCommand = stripAssistantName(command, assistantName);
  return buildGeneralFallback(cleanedCommand, error);
};

export { detectLocalAssistantAction };
export default buildLocalAssistantResponse;
