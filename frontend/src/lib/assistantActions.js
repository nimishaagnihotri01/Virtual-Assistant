const actionablePromptPattern = /\b(open|search|play|youtube|google|instagram|facebook|weather|calculator)\b/i;

const actionableTypes = new Set([
  "calculator_open",
  "google_open",
  "google_search",
  "youtube_open",
  "youtube_search",
  "youtube_play",
  "instagram_open",
  "facebook_open",
  "weather_show",
]);

const buildSearchUrl = (baseUrl, query) => {
  const trimmedQuery = query?.trim();
  return trimmedQuery ? `${baseUrl}${encodeURIComponent(trimmedQuery)}` : baseUrl.replace(/[?&]$/, "");
};

const openUrl = (preparedWindow, url) => {
  if (!url) {
    closePreparedWindow(preparedWindow);
    return false;
  }

  if (preparedWindow && !preparedWindow.closed) {
    preparedWindow.location.replace(url);
    preparedWindow.focus();
    return true;
  }

  const nextWindow = window.open(url, "_blank", "noopener,noreferrer");

  if (nextWindow) {
    nextWindow.focus();
    return true;
  }

  try {
    window.location.assign(url);
    return true;
  } catch {
    return false;
  }
};

const closePreparedWindow = (preparedWindow) => {
  if (preparedWindow && !preparedWindow.closed) {
    preparedWindow.close();
  }
};

const launchCalculator = (preparedWindow) => {
  const targetWindow = preparedWindow && !preparedWindow.closed
    ? preparedWindow
    : window.open("", "_blank");

  if (!targetWindow) {
    return false;
  }

  try {
    targetWindow.location.href = "calculator:";
    targetWindow.focus();

    window.setTimeout(() => {
      try {
        if (!targetWindow.closed && targetWindow.location.href === "about:blank") {
          targetWindow.location.replace("https://www.google.com/search?q=calculator");
        }
      } catch {
        // Ignore cross-origin/custom protocol follow-up issues.
      }
    }, 1200);

    return true;
  } catch {
    targetWindow.location.href = "https://www.google.com/search?q=calculator";
    return true;
  }
};

export const shouldPrepareActionWindow = (prompt) => actionablePromptPattern.test(prompt);

export const executeAssistantAction = (reply, preparedWindow) => {
  if (!reply?.type || !actionableTypes.has(reply.type)) {
    closePreparedWindow(preparedWindow);
    return null;
  }

  let didOpen = false;

  switch (reply.type) {
    case "calculator_open":
      didOpen = launchCalculator(preparedWindow);
      break;
    case "google_open":
      didOpen = openUrl(preparedWindow, "https://www.google.com/");
      break;
    case "google_search":
      didOpen = openUrl(
        preparedWindow,
        buildSearchUrl("https://www.google.com/search?q=", reply.userinput),
      );
      break;
    case "youtube_open":
      didOpen = openUrl(preparedWindow, "https://www.youtube.com/");
      break;
    case "youtube_search":
    case "youtube_play":
      didOpen = openUrl(
        preparedWindow,
        buildSearchUrl("https://www.youtube.com/results?search_query=", reply.userinput),
      );
      break;
    case "instagram_open":
      didOpen = openUrl(preparedWindow, "https://www.instagram.com/");
      break;
    case "facebook_open":
      didOpen = openUrl(preparedWindow, "https://www.facebook.com/");
      break;
    case "weather_show":
      didOpen = openUrl(
        preparedWindow,
        buildSearchUrl("https://www.google.com/search?q=", reply.userinput || "weather"),
      );
      break;
    default:
      closePreparedWindow(preparedWindow);
      return null;
  }

  if (didOpen) {
    return null;
  }

  return "The browser blocked the assistant action. Allow popups for this site and try again.";
};
