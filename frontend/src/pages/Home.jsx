import { useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { userDataContext } from "../context/userDataContext.js";
import { executeAssistantAction, shouldPrepareActionWindow } from "../lib/assistantActions.js";
import api from "../lib/api.js";
import {
  getSpeechRecognitionCtor,
  getSpeechRecognitionErrorMessage,
  getSpeechSynthesisInstance,
  hasSpeechRecognitionSupport,
  hasSpeechSynthesisSupport,
  normalizeSpeechText,
  selectAssistantVoice,
} from "../lib/browserVoice.js";
import getAssistantAvatarUrl from "../lib/getAssistantAvatarUrl.js";
import getErrorMessage from "../lib/getErrorMessage.js";

const quickPrompts = [
  "What time is it?",
  "Open calculator",
  "Open YouTube",
  "Play lo-fi music on YouTube",
];
const VOICE_PLAYBACK_LEAD_IN_MS = 40;
const VOICE_SYNTHESIS_PRIMER_TEXT = "assistant";

const createSpeechUtterance = (text, preferredVoice, overrides = {}) => {
  const utterance = new SpeechSynthesisUtterance(text);

  utterance.lang = preferredVoice?.lang || "en-US";
  utterance.rate = preferredVoice?.localService ? 1.03 : 1.08;
  utterance.pitch = 1;
  utterance.volume = 1;

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  Object.assign(utterance, overrides);

  return utterance;
};

const getIdleVoiceStatus = (hasMicSupport, hasVoiceReplySupport, voiceRepliesEnabled) => {
  if (hasMicSupport) {
    return voiceRepliesEnabled
      ? "Microphone ready. Voice replies are on."
      : "Microphone ready. Voice replies are off.";
  }

  if (hasVoiceReplySupport) {
    return voiceRepliesEnabled
      ? "Type your message. Voice replies are on."
      : "Type your message. Voice replies are off.";
  }

  return "Type your message or use a quick action below.";
};

const getAssistantStatusCopy = ({
  loading,
  isListening,
  isSpeaking,
  hasMicSupport,
}) => {
  if (loading) {
    return "Processing your request now.";
  }

  if (isListening) {
    return "Listening for your voice request.";
  }

  if (isSpeaking) {
    return "Reading the response out loud.";
  }

  if (hasMicSupport) {
    return "Write below, or press Talk with an empty box to speak.";
  }

  return "Write something below or tap a quick action to talk.";
};

export default function Home() {
  const { logout, refreshUser, userData } = useContext(userDataContext);
  const [command, setCommand] = useState("");
  const [assistantReply, setAssistantReply] = useState(null);
  const [lastPrompt, setLastPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const hasMicSupport = hasSpeechRecognitionSupport();
  const hasVoiceReplySupport = hasSpeechSynthesisSupport();
  const [availableVoices, setAvailableVoices] = useState([]);
  const [voiceRepliesEnabled, setVoiceRepliesEnabled] = useState(hasVoiceReplySupport);
  const [voiceStatus, setVoiceStatus] = useState(
    getIdleVoiceStatus(hasMicSupport, hasVoiceReplySupport, hasVoiceReplySupport),
  );
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");
  const submitTranscriptRef = useRef(false);
  const loadingRef = useRef(false);
  const handleAskRef = useRef(null);
  const activeUtteranceRef = useRef(null);
  const lastSpokenPlaybackIdRef = useRef("");
  const speechPrimedRef = useRef(false);
  const voiceStartTimerRef = useRef(null);

  loadingRef.current = loading;
  const preferredVoice = selectAssistantVoice(availableVoices);

  const stopSpeaking = () => {
    const speechSynthesis = getSpeechSynthesisInstance();

    if (!speechSynthesis) {
      return;
    }

    if (voiceStartTimerRef.current) {
      window.clearTimeout(voiceStartTimerRef.current);
      voiceStartTimerRef.current = null;
    }

    activeUtteranceRef.current = null;

    if (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel();
    }

    setIsSpeaking(false);
  };

  const primeSpeechSynthesis = () => {
    if (speechPrimedRef.current) {
      return;
    }

    const speechSynthesis = getSpeechSynthesisInstance();

    if (!speechSynthesis) {
      return;
    }

    if (speechSynthesis.speaking || speechSynthesis.pending) {
      speechPrimedRef.current = true;
      return;
    }

    try {
      const primerUtterance = createSpeechUtterance(
        VOICE_SYNTHESIS_PRIMER_TEXT,
        preferredVoice,
        {
          volume: 0,
          rate: preferredVoice?.localService ? 1.18 : 1.24,
        },
      );

      if (speechSynthesis.paused) {
        speechSynthesis.resume();
      }

      speechSynthesis.speak(primerUtterance);
      speechPrimedRef.current = true;
    } catch {
      // Ignore primer failures and let normal speech playback continue.
    }
  };

  const handleAsk = async (nextCommand) => {
    if (loadingRef.current) {
      return;
    }

    const prompt = (typeof nextCommand === "string" ? nextCommand : command).trim();

    if (!prompt) {
      setErrorMessage("Type a message first, then press Talk.");
      textareaRef.current?.focus();
      return;
    }

    const preparedWindow = shouldPrepareActionWindow(prompt) ? window.open("", "_blank") : null;

    stopSpeaking();
    primeSpeechSynthesis();
    setLoading(true);
    setErrorMessage("");
    setLastPrompt(prompt);
    setCommand("");
    setVoiceStatus("Sending your request...");

    try {
      const { data } = await api.post("/user/ask", { command: prompt });
      setAssistantReply({
        ...data,
        playbackId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });

      const actionError = executeAssistantAction(data, preparedWindow);
      if (actionError) {
        setErrorMessage(actionError);
      }

      setVoiceStatus(
        data?.response && voiceRepliesEnabled && hasVoiceReplySupport
          ? "Preparing a voice reply..."
          : getIdleVoiceStatus(hasMicSupport, hasVoiceReplySupport, voiceRepliesEnabled),
      );

      void refreshUser();
    } catch (error) {
      if (preparedWindow && !preparedWindow.closed) {
        preparedWindow.close();
      }

      setErrorMessage(getErrorMessage(error, "Unable to reach the assistant right now."));
      setVoiceStatus(getIdleVoiceStatus(hasMicSupport, hasVoiceReplySupport, voiceRepliesEnabled));
    } finally {
      setLoading(false);
    }
  };

  handleAskRef.current = handleAsk;

  useEffect(() => {
    if (!hasVoiceReplySupport) {
      return undefined;
    }

    const speechSynthesis = getSpeechSynthesisInstance();

    if (!speechSynthesis) {
      return undefined;
    }

    const updateVoices = () => {
      setAvailableVoices(speechSynthesis.getVoices());
    };

    updateVoices();

    if (typeof speechSynthesis.addEventListener === "function") {
      speechSynthesis.addEventListener("voiceschanged", updateVoices);

      return () => {
        speechSynthesis.removeEventListener("voiceschanged", updateVoices);
      };
    }

    const previousHandler = speechSynthesis.onvoiceschanged;
    speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (speechSynthesis.onvoiceschanged === updateVoices) {
        speechSynthesis.onvoiceschanged = previousHandler || null;
      }
    };
  }, [hasVoiceReplySupport]);

  useEffect(() => {
    if (!hasMicSupport) {
      return undefined;
    }

    const SpeechRecognition = getSpeechRecognitionCtor();

    if (!SpeechRecognition) {
      return undefined;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      transcriptRef.current = "";
      setIsListening(true);
      setErrorMessage("");
      setVoiceStatus("Listening...");
    };

    recognition.onresult = (event) => {
      let finalTranscript = transcriptRef.current;
      let interimTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript?.trim();

        if (!transcript) {
          continue;
        }

        if (event.results[index].isFinal) {
          finalTranscript = `${finalTranscript} ${transcript}`.trim();
        } else {
          interimTranscript = `${interimTranscript} ${transcript}`.trim();
        }
      }

      transcriptRef.current = finalTranscript;

      const nextTranscript = `${finalTranscript} ${interimTranscript}`.trim();
      setCommand(nextTranscript);

      if (nextTranscript) {
        setVoiceStatus("Capturing your request...");
      }
    };

    recognition.onerror = (event) => {
      submitTranscriptRef.current = false;
      setIsListening(false);
      setVoiceStatus(getIdleVoiceStatus(hasMicSupport, hasVoiceReplySupport, voiceRepliesEnabled));
      setErrorMessage(getSpeechRecognitionErrorMessage(event.error));
    };

    recognition.onend = () => {
      setIsListening(false);

      const finalTranscript = transcriptRef.current.trim();

      if (submitTranscriptRef.current) {
        submitTranscriptRef.current = false;

        if (finalTranscript) {
          setVoiceStatus("Sending your request...");
          void handleAskRef.current?.(finalTranscript);
          return;
        }

        setVoiceStatus(getIdleVoiceStatus(hasMicSupport, hasVoiceReplySupport, voiceRepliesEnabled));
        setErrorMessage("I didn't catch that. Try speaking again.");
        return;
      }

      setVoiceStatus(getIdleVoiceStatus(hasMicSupport, hasVoiceReplySupport, voiceRepliesEnabled));
    };

    recognitionRef.current = recognition;

    return () => {
      submitTranscriptRef.current = false;
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [hasMicSupport, hasVoiceReplySupport, voiceRepliesEnabled]);

  useEffect(() => {
    if (!assistantReply?.response || !voiceRepliesEnabled) {
      return undefined;
    }

    if (assistantReply.playbackId === lastSpokenPlaybackIdRef.current) {
      return undefined;
    }

    const speechSynthesis = getSpeechSynthesisInstance();

    if (!speechSynthesis) {
      return undefined;
    }

    const speechText = normalizeSpeechText(assistantReply.response);

    if (!speechText) {
      return undefined;
    }

    const utterance = createSpeechUtterance(speechText, preferredVoice);

    activeUtteranceRef.current = utterance;
    lastSpokenPlaybackIdRef.current = assistantReply.playbackId;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setVoiceStatus("Speaking the response...");
    };

    utterance.onend = () => {
      if (activeUtteranceRef.current === utterance) {
        activeUtteranceRef.current = null;
      }
      setIsSpeaking(false);
      setVoiceStatus(getIdleVoiceStatus(hasMicSupport, hasVoiceReplySupport, voiceRepliesEnabled));
    };

    utterance.onerror = () => {
      if (activeUtteranceRef.current === utterance) {
        activeUtteranceRef.current = null;
      }
      setIsSpeaking(false);
      setVoiceStatus(getIdleVoiceStatus(hasMicSupport, hasVoiceReplySupport, voiceRepliesEnabled));
    };

    if (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel();
    }

    voiceStartTimerRef.current = window.setTimeout(() => {
      voiceStartTimerRef.current = null;

      if (activeUtteranceRef.current !== utterance) {
        return;
      }

      if (speechSynthesis.paused) {
        speechSynthesis.resume();
      }

      speechSynthesis.speak(utterance);
    }, VOICE_PLAYBACK_LEAD_IN_MS);

    return () => {
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;

      if (voiceStartTimerRef.current) {
        window.clearTimeout(voiceStartTimerRef.current);
        voiceStartTimerRef.current = null;
      }

      if (activeUtteranceRef.current === utterance) {
        activeUtteranceRef.current = null;
      }
    };
  }, [assistantReply, hasMicSupport, hasVoiceReplySupport, preferredVoice, voiceRepliesEnabled]);

  useEffect(() => {
    if (voiceRepliesEnabled) {
      return;
    }

    stopSpeaking();
    setVoiceStatus(getIdleVoiceStatus(hasMicSupport, hasVoiceReplySupport, false));
  }, [hasMicSupport, hasVoiceReplySupport, voiceRepliesEnabled]);

  useEffect(() => () => {
    stopSpeaking();
  }, []);

  const startVoiceCapture = () => {
    if (loading) {
      return;
    }

    if (!recognitionRef.current) {
      setErrorMessage("Voice input is not available in this browser. Type your request instead.");
      return;
    }

    stopSpeaking();
    primeSpeechSynthesis();
    submitTranscriptRef.current = true;
    transcriptRef.current = "";
    setCommand("");
    setErrorMessage("");
    setVoiceStatus("Starting microphone...");

    try {
      recognitionRef.current.start();
    } catch {
      setVoiceStatus("Microphone is already active.");
    }
  };

  const stopVoiceCapture = () => {
    if (!recognitionRef.current) {
      return;
    }

    submitTranscriptRef.current = true;
    setVoiceStatus("Finishing your message...");
    recognitionRef.current.stop();
  };

  const handleTalkClick = () => {
    if (isListening) {
      stopVoiceCapture();
      return;
    }

    if (command.trim()) {
      void handleAsk();
      return;
    }

    startVoiceCapture();
  };

  const handleComposerKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleAsk();
    }
  };

  const handleVoiceRepliesToggle = () => {
    if (!hasVoiceReplySupport) {
      setErrorMessage("Voice replies are not available in this browser.");
      return;
    }

    if (voiceRepliesEnabled) {
      stopSpeaking();
    }

    if (!voiceRepliesEnabled) {
      primeSpeechSynthesis();
    }

    setVoiceRepliesEnabled((currentValue) => !currentValue);
    setVoiceStatus(getIdleVoiceStatus(hasMicSupport, hasVoiceReplySupport, !voiceRepliesEnabled));
  };

  const talkButtonLabel = loading ? "Thinking..." : isListening ? "Stop" : command.trim() ? "Send" : "Talk";
  const assistantStatusCopy = getAssistantStatusCopy({
    loading,
    isListening,
    isSpeaking,
    hasMicSupport,
  });

  return (
    <main className="neo-stage-shell">
      <div className="neo-stage-glow neo-stage-glow--left" />
      <div className="neo-stage-glow neo-stage-glow--right" />

      <header className="neo-stage-nav">
        <span className="neo-stage-badge">Assistant Live</span>
        <div className="neo-stage-navlinks">
          <Link className="neo-stage-link" to="/customize">
            Change Avatar
          </Link>
          <button className="neo-stage-link" type="button" onClick={() => void logout()}>
            Sign Out
          </button>
        </div>
      </header>

      <section className="neo-stage-center">
        <article className="neo-portrait-card">
          <div className="neo-portrait-frame">
            {userData?.assistantImage ? (
              <img
                className="neo-portrait-image"
                src={getAssistantAvatarUrl(userData?.updatedAt)}
                alt={userData.assistantName}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="neo-portrait-fallback">{userData?.assistantName?.charAt(0) || "A"}</div>
            )}
            <div className={`neo-voice-line ${loading || isListening || isSpeaking ? "is-active" : ""}`} />
          </div>

          <h1 className="neo-assistant-name">{userData?.assistantName || "Assistant"}</h1>
          <p className="neo-assistant-copy">{assistantStatusCopy}</p>

          <button className="neo-talk-button" type="button" onClick={handleTalkClick} disabled={loading}>
            {talkButtonLabel}
          </button>

          <p className="neo-voice-status">{voiceStatus}</p>
        </article>

        <section className="neo-composer-card">
          <div className="neo-composer-head">
            <label className="neo-composer-label" htmlFor="assistant-command">
              Ask anything
            </label>
            <button
              className="neo-voice-toggle"
              type="button"
              onClick={handleVoiceRepliesToggle}
              aria-pressed={voiceRepliesEnabled}
              disabled={!hasVoiceReplySupport}
            >
              {voiceRepliesEnabled ? "Voice Reply On" : "Voice Reply Off"}
            </button>
          </div>

          <textarea
            ref={textareaRef}
            id="assistant-command"
            className="neo-composer-textarea"
            value={command}
            onKeyDown={handleComposerKeyDown}
            onChange={(event) => {
              setCommand(event.target.value);
              setErrorMessage("");
            }}
            placeholder="Write a message for your assistant..."
            rows={4}
          />

          <p className="neo-composer-help">
            {hasMicSupport
              ? "Press Talk with an empty box to speak, or type and press Enter to send."
              : "Voice input is unavailable here, so use text or a quick prompt below."}
          </p>

          <div className="neo-prompt-row">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                className="neo-prompt-pill"
                type="button"
                onClick={() => void handleAsk(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        </section>

        {errorMessage ? <p className="error-banner error-banner--dark neo-error-banner">{errorMessage}</p> : null}

        <section className="neo-response-card">
          <div className="neo-response-head">
            <span className="neo-stage-badge">Response</span>
            {assistantReply?.type ? <span className="neo-response-type">{assistantReply.type}</span> : null}
          </div>

          {assistantReply ? (
            <div className="neo-response-body">
              <p className="neo-response-text">{assistantReply.response}</p>
              <div className="neo-response-meta">
                <span>Prompt: {lastPrompt || assistantReply.userinput}</span>
                <span>Owner: {userData?.name}</span>
              </div>
            </div>
          ) : (
            <p className="neo-response-placeholder">
              Your assistant reply will appear here after you press Talk.
            </p>
          )}
        </section>
      </section>
    </main>
  );
}
