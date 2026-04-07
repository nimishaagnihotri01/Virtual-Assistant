export const getSpeechRecognitionCtor = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export const hasSpeechRecognitionSupport = () => Boolean(getSpeechRecognitionCtor());

export const getSpeechSynthesisInstance = () => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  return window.speechSynthesis;
};

export const hasSpeechSynthesisSupport = () => Boolean(getSpeechSynthesisInstance());

const scoreAssistantVoice = (voice) => {
  let score = 0;

  if (!voice) {
    return score;
  }

  if (voice.default) {
    score += 1;
  }

  if (voice.localService) {
    score += 4;
  }

  if (/^en(-|_)?IN$/i.test(voice.lang)) {
    score += 6;
  } else if (/^en(-|_)?(US|GB|AU)$/i.test(voice.lang)) {
    score += 5;
  } else if (/^en/i.test(voice.lang)) {
    score += 3;
  }

  if (/(google|microsoft|zira|aria|jenny|guy|samantha|serena|neural|natural)/i.test(voice.name)) {
    score += 4;
  }

  return score;
};

export const selectAssistantVoice = (voices = []) => (
  [...voices]
    .sort((firstVoice, secondVoice) => scoreAssistantVoice(secondVoice) - scoreAssistantVoice(firstVoice))[0]
  || null
);

export const normalizeSpeechText = (text = "") => (
  text
    .replace(/\s+/g, " ")
    .replace(/\s*[\u2022*-]\s*/g, ", ")
    .replace(/[;:|]+/g, ", ")
    .replace(/\. (?=[A-Z])/g, ", ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim()
);

export const getSpeechRecognitionErrorMessage = (errorCode) => {
  switch (errorCode) {
    case "audio-capture":
      return "No microphone was detected. Connect a mic and try again.";
    case "network":
      return "Voice recognition had a network issue. Please try again.";
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow microphone permission for this site.";
    case "no-speech":
      return "I didn't hear anything. Try speaking a little louder.";
    default:
      return "Voice input stopped unexpectedly. Please try again.";
  }
};
