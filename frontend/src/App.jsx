import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sendAssistantMessage, signInUser, signUpUser } from "./lib/api";
import { usePersistentUser } from "./hooks/usePersistentUser";

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
};

const DEFAULT_PROFILE = {
  name: "Nova",
  image: "",
};

const PROFILE_STORAGE_PREFIX = "virtual-assistant.profile.v2";
const MESSAGE_LIMIT = 12;
const MAX_SPEECH_CHARS = 900;
const VOICE_LOAD_TIMEOUT_MS = 1500;
const TTS_LOG_PREFIX = "[TTS]";

const ASSISTANT_IMAGES = [
  {
    id: "nova",
    label: "Nova",
    image: "/avatars/1.jpg",
  },
  {
    id: "aura",
    label: "Aura",
    image: "/avatars/2.jpg",
  },
  {
    id: "pixel",
    label: "Pixel",
    image: "/avatars/3.jpg",
  },
];

function getProfileStorageKey(user) {
  return user?.id ? `${PROFILE_STORAGE_PREFIX}.${user.id}` : null;
}

function loadAssistantProfile(user) {
  const storageKey = getProfileStorageKey(user);

  if (!storageKey || typeof window === "undefined") {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(storageKey);

    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue);

    if (!parsedValue?.name || !parsedValue?.image) {
      return null;
    }

    return parsedValue;
  } catch {
    return null;
  }
}

function saveAssistantProfile(user, profile) {
  const storageKey = getProfileStorageKey(user);

  if (!storageKey || typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(profile));
}

function getSpeechRecognition() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function createMessage(role, content, name) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    name,
    content,
    timestamp: new Date().toISOString(),
  };
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function replaceControlCharacters(text) {
  return Array.from(text, (character) => {
    const codePoint = character.codePointAt(0);

    return codePoint < 32 || codePoint === 127 ? " " : character;
  }).join("");
}

function toSpeakableText(text) {
  if (typeof text !== "string") {
    return "";
  }

  const safeText = replaceControlCharacters(text)
    .replaceAll("\uFFFD", " ")
    .replace(/\s+/g, " ")
    .trim();

  if (safeText.length <= MAX_SPEECH_CHARS) {
    return safeText;
  }

  return `${safeText.slice(0, MAX_SPEECH_CHARS)}.`;
}

function describeVoice(voice) {
  if (!voice) {
    return "browser default voice";
  }

  return `${voice.name} (${voice.lang || "unknown language"}, ${
    voice.localService ? "local" : "remote"
  })`;
}

function AmbientField() {
  return (
    <div className="ambient-field" aria-hidden="true">
      <span className="ai-core-bg" />
      <span className="neural-web" />
      <span className="circuit-grid" />
    </div>
  );
}

export default function App() {
  const { user, setUser } = usePersistentUser();
  const [authMode, setAuthMode] = useState("login");
  const [formValues, setFormValues] = useState(EMPTY_FORM);
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [flowStep, setFlowStep] = useState("auth");
  const [selectedImage, setSelectedImage] = useState(ASSISTANT_IMAGES[0].image);
  const [assistantName, setAssistantName] = useState(DEFAULT_PROFILE.name);
  const [assistantProfile, setAssistantProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [textDraft, setTextDraft] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechVoices, setSpeechVoices] = useState([]);
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const currentSpeechKeyRef = useRef("");
  const speechRequestIdRef = useRef(0);
  const voiceLoadPromiseRef = useRef(null);

  const cancelSpeech = useCallback((reason, { updateUi = true } = {}) => {
    speechRequestIdRef.current += 1;
    currentSpeechKeyRef.current = "";
    utteranceRef.current = null;

    if (typeof window !== "undefined" && window.speechSynthesis) {
      console.info(`${TTS_LOG_PREFIX} cancel`, {
        reason,
        speaking: window.speechSynthesis.speaking,
        pending: window.speechSynthesis.pending,
        paused: window.speechSynthesis.paused,
      });
      window.speechSynthesis.cancel();
    }

    if (updateUi) {
      setIsSpeaking(false);
    }
  }, []);

  const activeProfile = assistantProfile ?? {
    name: assistantName.trim() || DEFAULT_PROFILE.name,
    image: selectedImage,
  };

  const currentStatus = useMemo(() => {
    if (isListening) {
      return "Listening";
    }

    if (isSpeaking) {
      return "Speaking";
    }

    if (isThinking) {
      return "Thinking";
    }

    return "Ready";
  }, [isListening, isSpeaking, isThinking]);

  const latestAssistantMessage = useMemo(
    () => messages.findLast((message) => message.role === "assistant"),
    [messages],
  );

  useEffect(() => {
    if (!user) {
      setAssistantProfile(null);
      setFlowStep("auth");
      setMessages([]);
      return;
    }

    const storedProfile = loadAssistantProfile(user);

    if (storedProfile) {
      setAssistantProfile(storedProfile);
      setSelectedImage(storedProfile.image);
      setAssistantName(storedProfile.name);
      setFlowStep("assistant");
      setMessages([
        createMessage(
          "assistant",
          `Hi ${user.name}. I am ${storedProfile.name}. Tap the mic or type a message to talk to me.`,
          storedProfile.name,
        ),
      ]);
      return;
    }

    setAssistantProfile(null);
    setSelectedImage(ASSISTANT_IMAGES[0].image);
    setAssistantName(DEFAULT_PROFILE.name);
    setFlowStep("image");
    setMessages([]);
  }, [user]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      cancelSpeech("app-unmount", { updateUi: false });
    };
  }, [cancelSpeech]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return undefined;
    }

    const updateVoices = (source = "voiceschanged") => {
      const voices = window.speechSynthesis.getVoices();
      console.info(`${TTS_LOG_PREFIX} voices updated`, {
        source,
        count: voices.length,
        voices: voices.map(describeVoice),
      });
      setSpeechVoices(voices);
    };

    const handleVoicesChanged = () => updateVoices();

    updateVoices("initial");
    window.speechSynthesis.addEventListener?.("voiceschanged", handleVoicesChanged);
    window.speechSynthesis.onvoiceschanged = handleVoicesChanged;

    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", handleVoicesChanged);

      if (window.speechSynthesis.onvoiceschanged === handleVoicesChanged) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let animationFrame = 0;

    const updateParallax = (event) => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const x = event.clientX / window.innerWidth - 0.5;
        const y = event.clientY / window.innerHeight - 0.5;
        const rootStyle = document.documentElement.style;

        rootStyle.setProperty("--parallax-ambient-x", `${(-x * 18).toFixed(2)}px`);
        rootStyle.setProperty("--parallax-ambient-y", `${(-y * 14).toFixed(2)}px`);
        rootStyle.setProperty("--parallax-core-x", `${(-x * 42).toFixed(2)}px`);
        rootStyle.setProperty("--parallax-core-y", `${(-y * 34).toFixed(2)}px`);
        rootStyle.setProperty("--parallax-neural-x", `${(x * 24).toFixed(2)}px`);
        rootStyle.setProperty("--parallax-neural-y", `${(y * 18).toFixed(2)}px`);
        rootStyle.setProperty("--parallax-grid-x", `${(-x * 10).toFixed(2)}px`);
        rootStyle.setProperty("--parallax-grid-y", `${(-y * 8).toFixed(2)}px`);
        rootStyle.setProperty("--parallax-panel-x", `${(x * 2).toFixed(2)}px`);
        rootStyle.setProperty("--parallax-panel-y", `${(y * 1.5).toFixed(2)}px`);
        rootStyle.setProperty("--parallax-stage-x", `${(x * 3).toFixed(2)}px`);
        rootStyle.setProperty("--parallax-stage-y", `${(y * 2).toFixed(2)}px`);
        rootStyle.setProperty("--parallax-chat-x", `${(-x * 2).toFixed(2)}px`);
        rootStyle.setProperty("--parallax-chat-y", `${(-y * 1.5).toFixed(2)}px`);
        rootStyle.setProperty("--parallax-avatar-x", `${(x * 7).toFixed(2)}px`);
        rootStyle.setProperty("--parallax-avatar-y", `${(y * 5).toFixed(2)}px`);
      });
    };

    window.addEventListener("pointermove", updateParallax, { passive: true });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("pointermove", updateParallax);
      [
        "--parallax-ambient-x",
        "--parallax-ambient-y",
        "--parallax-core-x",
        "--parallax-core-y",
        "--parallax-neural-x",
        "--parallax-neural-y",
        "--parallax-grid-x",
        "--parallax-grid-y",
        "--parallax-panel-x",
        "--parallax-panel-y",
        "--parallax-stage-x",
        "--parallax-stage-y",
        "--parallax-chat-x",
        "--parallax-chat-y",
        "--parallax-avatar-x",
        "--parallax-avatar-y",
      ].forEach((propertyName) => {
        document.documentElement.style.removeProperty(propertyName);
      });
    };
  }, []);

  function updateFormValue(field, value) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  }

  function switchAuthMode(nextMode) {
    setAuthMode(nextMode);
    setAuthError("");
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthError("");
    setIsAuthenticating(true);

    try {
      const payload =
        authMode === "signup" ? await signUpUser(formValues) : await signInUser(formValues);

      setUser(payload.user);
      setFormValues(EMPTY_FORM);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsAuthenticating(false);
    }
  }

  function handleImageUpload(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setVoiceError("Please choose an image file.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setSelectedImage(reader.result);
        setVoiceError("");
      }
    };

    reader.readAsDataURL(file);
  }

  function handleSaveProfile(event) {
    event.preventDefault();

    const profile = {
      name: assistantName.trim() || DEFAULT_PROFILE.name,
      image: selectedImage,
    };

    saveAssistantProfile(user, profile);
    setAssistantProfile(profile);
    setFlowStep("assistant");
    setMessages([
      createMessage(
        "assistant",
        `Done. I am ${profile.name}, your voice assistant. You can speak or type to me.`,
        profile.name,
      ),
    ]);
  }

  function getPreferredVoice(voices) {
    const availableVoices = voices.length > 0 ? voices : speechVoices;
    const englishIndiaVoices = availableVoices.filter(
      (voice) => voice.lang?.toLowerCase() === "en-in",
    );
    const englishVoices = availableVoices.filter((voice) =>
      voice.lang?.toLowerCase().startsWith("en-"),
    );

    return (
      englishIndiaVoices.find((voice) => voice.localService) ||
      englishIndiaVoices[0] ||
      englishVoices.find((voice) => voice.localService) ||
      englishVoices[0] ||
      availableVoices.find((voice) => voice.localService) ||
      availableVoices[0] ||
      null
    );
  }

  async function ensureVoicesLoaded() {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return [];
    }

    const existingVoices = window.speechSynthesis.getVoices();

    if (existingVoices.length > 0) {
      setSpeechVoices(existingVoices);
      return existingVoices;
    }

    if (voiceLoadPromiseRef.current) {
      return voiceLoadPromiseRef.current;
    }

    console.info(`${TTS_LOG_PREFIX} waiting for voices`);

    voiceLoadPromiseRef.current = new Promise((resolve) => {
      let timeoutId;
      let previousVoicesChangedHandler = null;

      const finish = (voices, source) => {
        window.clearTimeout(timeoutId);
        window.speechSynthesis.removeEventListener?.("voiceschanged", handleVoicesChanged);

        if (
          !window.speechSynthesis.removeEventListener &&
          window.speechSynthesis.onvoiceschanged === handleVoicesChanged
        ) {
          window.speechSynthesis.onvoiceschanged = previousVoicesChangedHandler;
        }

        console.info(`${TTS_LOG_PREFIX} voices ready`, {
          source,
          count: voices.length,
          voices: voices.map(describeVoice),
        });
        setSpeechVoices(voices);
        resolve(voices);
      };

      const handleVoicesChanged = () => {
        const voices = window.speechSynthesis.getVoices();

        if (voices.length > 0) {
          finish(voices, "voiceschanged");
        }
      };

      timeoutId = window.setTimeout(() => {
        finish(window.speechSynthesis.getVoices(), "timeout");
      }, VOICE_LOAD_TIMEOUT_MS);

      if (window.speechSynthesis.addEventListener) {
        window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
      } else {
        previousVoicesChangedHandler = window.speechSynthesis.onvoiceschanged;
        window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
      }
    }).finally(() => {
      voiceLoadPromiseRef.current = null;
    });

    return voiceLoadPromiseRef.current;
  }

  async function speakReply(text, { showError = true } = {}) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      if (showError) {
        setVoiceError("Voice replies are not available in this browser.");
      }

      return;
    }

    const cleanText = toSpeakableText(text);

    if (!cleanText) {
      console.warn(`${TTS_LOG_PREFIX} skipped empty or invalid text`, {
        receivedType: typeof text,
        text,
      });
      return;
    }

    const speechKey = cleanText;

    if (
      currentSpeechKeyRef.current === speechKey &&
      (window.speechSynthesis.speaking || window.speechSynthesis.pending)
    ) {
      console.info(`${TTS_LOG_PREFIX} skipped duplicate speech request`, {
        characters: cleanText.length,
      });
      return;
    }

    const requestId = speechRequestIdRef.current + 1;
    speechRequestIdRef.current = requestId;
    currentSpeechKeyRef.current = speechKey;
    setVoiceError("");

    console.info(`${TTS_LOG_PREFIX} preparing speech`, {
      requestId,
      characters: cleanText.length,
      truncated: typeof text === "string" && text.trim().length > cleanText.length,
      speaking: window.speechSynthesis.speaking,
      pending: window.speechSynthesis.pending,
      paused: window.speechSynthesis.paused,
    });

    const voices = await ensureVoicesLoaded();

    if (speechRequestIdRef.current !== requestId) {
      console.info(`${TTS_LOG_PREFIX} abandoned stale speech request`, { requestId });
      return;
    }

    const preferredVoice = getPreferredVoice(voices);

    const clearActiveSpeech = (utterance) => {
      if (speechRequestIdRef.current === requestId && utteranceRef.current === utterance) {
        utteranceRef.current = null;
        currentSpeechKeyRef.current = "";
        setIsSpeaking(false);
      }
    };

    const startUtterance = (voice, { isFallback = false } = {}) => {
      const startedAt = window.performance.now();
      const utterance = new SpeechSynthesisUtterance(cleanText);

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || "en-US";
      }

      utterance.rate = 0.96;
      utterance.pitch = 1;
      utterance.onstart = () => {
        if (speechRequestIdRef.current !== requestId) {
          return;
        }

        utteranceRef.current = utterance;
        setIsSpeaking(true);
        setVoiceError("");
        console.info(`${TTS_LOG_PREFIX} started`, {
          requestId,
          voice: describeVoice(voice),
          fallback: isFallback,
        });
      };
      utterance.onend = (event) => {
        const elapsedMs = Math.round(window.performance.now() - startedAt);
        console.info(`${TTS_LOG_PREFIX} ended`, {
          requestId,
          voice: describeVoice(voice),
          fallback: isFallback,
          charIndex: event.charIndex,
          elapsedMs,
        });
        clearActiveSpeech(utterance);
      };
      utterance.onerror = (event) => {
        const errorName = event.error || "unknown";
        const retryableVoiceError =
          voice && ["audio-busy", "synthesis-failed", "voice-unavailable"].includes(errorName);

        console.error(`${TTS_LOG_PREFIX} error`, {
          requestId,
          error: errorName,
          voice: describeVoice(voice),
          fallback: isFallback,
          charIndex: event.charIndex,
          elapsedMs: Math.round(window.performance.now() - startedAt),
        });

        if (speechRequestIdRef.current !== requestId) {
          return;
        }

        if (errorName === "canceled" || errorName === "interrupted") {
          clearActiveSpeech(utterance);
          return;
        }

        if (retryableVoiceError && !isFallback) {
          console.warn(`${TTS_LOG_PREFIX} retrying with browser default voice`, {
            requestId,
            failedVoice: describeVoice(voice),
          });
          window.setTimeout(() => {
            if (speechRequestIdRef.current === requestId) {
              startUtterance(null, { isFallback: true });
            }
          }, 100);
          return;
        }

        clearActiveSpeech(utterance);

        if (showError) {
          setVoiceError(`Voice playback failed: ${errorName}. Try again or choose another browser voice.`);
        }
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.cancel();

      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      console.info(`${TTS_LOG_PREFIX} speak`, {
        requestId,
        voice: describeVoice(voice),
        fallback: isFallback,
      });

      try {
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error(`${TTS_LOG_PREFIX} speak threw`, {
          requestId,
          voice: describeVoice(voice),
          fallback: isFallback,
          error,
        });
        clearActiveSpeech(utterance);

        if (voice && !isFallback) {
          startUtterance(null, { isFallback: true });
          return;
        }

        if (showError) {
          setVoiceError("Voice playback failed before it could start.");
        }
      }
    };

    startUtterance(preferredVoice);
  }

  function handleSpeakLatestReply() {
    const replyText =
      latestAssistantMessage?.content ||
      `Hi. I am ${activeProfile.name}. Ask me anything and I will answer by voice.`;

    speakReply(replyText, { showError: true });
  }

  async function askAssistant(prompt) {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt || !assistantProfile) {
      return;
    }

    const userMessage = createMessage("user", trimmedPrompt, "You");
    const history = [...messages, userMessage].slice(-MESSAGE_LIMIT).map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setMessages((currentMessages) => [...currentMessages, userMessage].slice(-MESSAGE_LIMIT));
    setIsThinking(true);
    setVoiceError("");

    try {
      const response = await sendAssistantMessage({
        message: trimmedPrompt,
        history,
        assistantName: assistantProfile.name,
      });

      const assistantMessage = {
        ...response.message,
        name: assistantProfile.name,
      };

      setMessages((currentMessages) => [...currentMessages, assistantMessage].slice(-MESSAGE_LIMIT));
      speakReply(assistantMessage.content, { showError: false });
    } catch (error) {
      const fallbackMessage = createMessage(
        "assistant",
        "I could not reach the assistant service. Start the backend and try again.",
        assistantProfile.name,
      );

      setMessages((currentMessages) => [...currentMessages, fallbackMessage].slice(-MESSAGE_LIMIT));
      setVoiceError(error.message);
      speakReply(fallbackMessage.content, { showError: false });
    } finally {
      setIsThinking(false);
      setLiveTranscript("");
    }
  }

  function handleTextSubmit(event) {
    event.preventDefault();

    if (isThinking || isListening) {
      return;
    }

    const trimmedDraft = textDraft.trim();

    if (!trimmedDraft) {
      return;
    }

    setTextDraft("");
    askAssistant(trimmedDraft);
  }

  function startListening() {
    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      setVoiceError("Voice recognition is not available in this browser.");
      return;
    }

    if (isListening || isThinking) {
      return;
    }

    cancelSpeech("start-listening");

    const recognition = new SpeechRecognition();
    let finalTranscript = "";

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setLiveTranscript("");
      setVoiceError("");
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript;

        if (event.results[index].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setLiveTranscript((finalTranscript || interimTranscript).trim());
    };

    recognition.onerror = (event) => {
      setVoiceError(event.error === "no-speech" ? "I did not hear anything." : "Voice input stopped.");
    };

    recognition.onend = () => {
      setIsListening(false);

      const spokenPrompt = finalTranscript.trim();

      if (spokenPrompt) {
        askAssistant(spokenPrompt);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
  }

  function handleLogout() {
    recognitionRef.current?.abort();
    cancelSpeech("logout");
    setUser(null);
    setAuthError("");
    setFormValues(EMPTY_FORM);
  }

  function handleResetProfile() {
    const storageKey = getProfileStorageKey(user);

    if (storageKey) {
      window.localStorage.removeItem(storageKey);
    }

    setAssistantProfile(null);
    setSelectedImage(ASSISTANT_IMAGES[0].image);
    setAssistantName(DEFAULT_PROFILE.name);
    cancelSpeech("reset-profile");
    setFlowStep("image");
  }

  if (!user || flowStep === "auth") {
    const isSignup = authMode === "signup";

    return (
      <main className="auth-screen">
        <AmbientField />
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="app-mark">VA</div>
          <p className="eyebrow">Virtual Assistant</p>
          <h1 id="auth-title">Login or sign up</h1>

          <div className="mode-switch" role="tablist" aria-label="Authentication mode">
            <button
              className={authMode === "login" ? "is-active" : ""}
              type="button"
              onClick={() => switchAuthMode("login")}
            >
              Login
            </button>
            <button
              className={authMode === "signup" ? "is-active" : ""}
              type="button"
              onClick={() => switchAuthMode("signup")}
            >
              Sign up
            </button>
          </div>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            {isSignup ? (
              <label className="field">
                <span>Name</span>
                <input
                  autoComplete="name"
                  onChange={(event) => updateFormValue("name", event.target.value)}
                  placeholder="Your name"
                  type="text"
                  value={formValues.name}
                />
              </label>
            ) : null}

            <label className="field">
              <span>Email</span>
              <input
                autoComplete="email"
                onChange={(event) => updateFormValue("email", event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={formValues.email}
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                autoComplete={isSignup ? "new-password" : "current-password"}
                onChange={(event) => updateFormValue("password", event.target.value)}
                placeholder="Minimum 8 characters"
                type="password"
                value={formValues.password}
              />
            </label>

            {authError ? <p className="form-error">{authError}</p> : null}

            <button className="primary-button" disabled={isAuthenticating} type="submit">
              {isAuthenticating ? "Please wait" : isSignup ? "Create account" : "Login"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (flowStep === "image") {
    return (
      <main className="setup-screen">
        <AmbientField />
        <section className="setup-panel" aria-labelledby="image-title">
          <div className="setup-header">
            <div>
              <p className="eyebrow">Customize</p>
              <h1 id="image-title">Choose assistant image</h1>
            </div>
            <button className="text-button" type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>

          <div className="setup-preview">
            <span className="holo-ring holo-ring-one" aria-hidden="true" />
            <span className="holo-ring holo-ring-two" aria-hidden="true" />
            <span className="holo-ring holo-ring-three" aria-hidden="true" />
            <img alt="Selected assistant" src={selectedImage} />
          </div>

          <div className="avatar-grid">
            {ASSISTANT_IMAGES.map((avatar) => (
              <button
                className={`avatar-option ${selectedImage === avatar.image ? "is-selected" : ""}`}
                key={avatar.id}
                type="button"
                onClick={() => setSelectedImage(avatar.image)}
              >
                <img alt={avatar.label} src={avatar.image} />
                <span>{avatar.label}</span>
              </button>
            ))}

            <label className="upload-option">
              <input accept="image/*" type="file" onChange={handleImageUpload} />
              <span>Upload image</span>
            </label>
          </div>

          {voiceError ? <p className="form-error">{voiceError}</p> : null}

          <button className="primary-button" type="button" onClick={() => setFlowStep("name")}>
            Next
          </button>
        </section>
      </main>
    );
  }

  if (flowStep === "name") {
    return (
      <main className="setup-screen">
        <AmbientField />
        <section className="setup-panel" aria-labelledby="name-title">
          <div className="setup-header">
            <div>
              <p className="eyebrow">Customize</p>
              <h1 id="name-title">Name your assistant</h1>
            </div>
            <button className="text-button" type="button" onClick={() => setFlowStep("image")}>
              Back
            </button>
          </div>

          <form className="name-form" onSubmit={handleSaveProfile}>
            <div className="name-preview">
              <span className="holo-ring holo-ring-one" aria-hidden="true" />
              <span className="holo-ring holo-ring-two" aria-hidden="true" />
              <img alt="Assistant preview" src={selectedImage} />
            </div>
            <label className="field">
              <span>Assistant name</span>
              <input
                autoComplete="off"
                maxLength={24}
                onChange={(event) => setAssistantName(event.target.value)}
                placeholder="Nova"
                type="text"
                value={assistantName}
              />
            </label>
            <button className="primary-button" type="submit">
              Done
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className={`assistant-screen status-${currentStatus.toLowerCase()}`}>
      <AmbientField />
      <header className="assistant-topbar">
        <div className="assistant-identity">
          <img alt={activeProfile.name} src={activeProfile.image} />
          <div>
            <p>{activeProfile.name}</p>
            <span>{currentStatus}</span>
          </div>
        </div>

        <div className="topbar-actions">
          <button className="text-button" type="button" onClick={handleResetProfile}>
            Customize
          </button>
          <button className="text-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <section
        className={`voice-stage ${isListening ? "is-listening" : ""} ${
          isSpeaking ? "is-speaking" : ""
        } ${isThinking ? "is-thinking" : ""}`}
        aria-live="polite"
      >
        <span className="stage-orbit stage-orbit-one" aria-hidden="true" />
        <span className="stage-orbit stage-orbit-two" aria-hidden="true" />
        <span className="stage-scanline" aria-hidden="true" />
        <button
          aria-label={`Play ${activeProfile.name}'s latest reply`}
          className={`assistant-avatar speaker-logo ${isListening ? "is-listening" : ""} ${
            isSpeaking ? "is-speaking" : ""
          }`}
          disabled={isThinking}
          title={`Play ${activeProfile.name}'s latest reply`}
          type="button"
          onClick={handleSpeakLatestReply}
        >
          <span className="holo-ring holo-ring-one" aria-hidden="true" />
          <span className="holo-ring holo-ring-two" aria-hidden="true" />
          <span className="holo-ring holo-ring-three" aria-hidden="true" />
          <img alt={activeProfile.name} src={activeProfile.image} />
          <span className="speaker-mark" aria-hidden="true">
            <span className="speaker-cone" />
            <span className="speaker-wave speaker-wave-one" />
            <span className="speaker-wave speaker-wave-two" />
          </span>
        </button>

        <h1>{activeProfile.name}</h1>
        <p className="status-line">{liveTranscript || currentStatus}</p>

        <button
          className={`mic-button ${isListening ? "is-recording" : ""}`}
          disabled={isThinking}
          type="button"
          onClick={isListening ? stopListening : startListening}
        >
          <span className="mic-icon" />
          {isListening ? "Stop" : "Speak"}
        </button>

        <form className="text-composer" onSubmit={handleTextSubmit}>
          <input
            aria-label={`Message ${activeProfile.name}`}
            disabled={isThinking || isListening}
            onChange={(event) => setTextDraft(event.target.value)}
            placeholder={isListening ? "Listening..." : `Type to ${activeProfile.name}`}
            type="text"
            value={textDraft}
          />
          <button className="send-button" disabled={isThinking || isListening} type="submit">
            Send
          </button>
        </form>

        {voiceError ? <p className="form-error voice-error">{voiceError}</p> : null}
      </section>

      <section className="conversation-panel" aria-label="Conversation">
        {messages.length === 0 ? (
          <div className="chat-empty-state" aria-hidden="true">
            <span className="empty-core" />
            <p>AI link standing by</p>
          </div>
        ) : null}
        {messages.map((message) => (
          <article
            className={`voice-message ${message.role === "user" ? "is-user" : "is-assistant"}`}
            key={message.id}
          >
            <div className="message-meta">
              <span>{message.role === "user" ? "You" : activeProfile.name}</span>
              <time>{formatTime(message.timestamp)}</time>
            </div>
            <p>{message.content}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
