import { useContext, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { userDataContext } from "../context/userDataContext.js";
import api from "../lib/api.js";
import getErrorMessage from "../lib/getErrorMessage.js";
import { getAssistantDraftSelection } from "../lib/getAssistantDraftSelection.js";

const nameSuggestions = ["Nova Prime", "Axis Echo", "Astra Vector", "Halo Core"];

const getFileExtension = (blobType, imageUrl) => {
  const extensionsByType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };

  if (extensionsByType[blobType]) {
    return extensionsByType[blobType];
  }

  try {
    const pathname = new URL(imageUrl, window.location.origin).pathname;
    const detectedExtension = pathname.split(".").pop()?.trim().toLowerCase();

    if (detectedExtension) {
      return detectedExtension;
    }
  } catch {
    // Ignore invalid URL parsing and fall back to PNG.
  }

  return "png";
};

const buildPresetFile = async (imageUrl, imageLabel) => {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error("Unable to load the selected robot image.");
  }

  const blob = await response.blob();
  const safeName = (imageLabel || "assistant-avatar")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const extension = getFileExtension(blob.type, imageUrl);

  return new File([blob], `${safeName || "assistant-avatar"}.${extension}`, {
    type: blob.type || "image/png",
  });
};

export default function Customize2() {
  const navigate = useNavigate();
  const { assistantDraft, setAssistantDraft, setUserData, userData } = useContext(userDataContext);
  const [assistantName, setAssistantName] = useState(
    assistantDraft.assistantName || userData?.assistantName || "",
  );
  const [uploadPreview, setUploadPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (assistantDraft.imageSource !== "upload" || !assistantDraft.imageFile) {
      setUploadPreview("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(assistantDraft.imageFile);
    setUploadPreview(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [assistantDraft.imageFile, assistantDraft.imageSource]);

  const selection = getAssistantDraftSelection(
    assistantDraft,
    userData,
    uploadPreview,
  );
  const previewStyleLabel = selection.isUploadSelected
    ? "Custom portrait"
    : selection.isSavedSelected
      ? "Saved identity"
      : selection.selectedRobot?.tag || "Preset portrait";

  if (!selection.hasSelectedImage) {
    return <Navigate to="/customize" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedName = assistantName.trim();
    if (!trimmedName) {
      setErrorMessage("Give your assistant a name before moving to the final screen.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const formData = new FormData();
    formData.append("assistantName", trimmedName);

    try {
      if (assistantDraft.imageSource === "upload" && assistantDraft.imageFile) {
        formData.append("assistantImage", assistantDraft.imageFile);
      } else if (assistantDraft.imageSource === "preset" && assistantDraft.imageUrl) {
        const presetFile = await buildPresetFile(
          assistantDraft.imageUrl,
          assistantDraft.imageLabel,
        );
        formData.append("assistantImage", presetFile);
      }

      const { data } = await api.post("/user/update", formData);
      setUserData(data);
      setAssistantDraft({
        assistantName: data.assistantName ?? "",
        imageUrl: data.assistantImage ?? "",
        imageSource: data.assistantImage ? "saved" : "",
        imageFile: null,
        imageLabel: data.assistantName ? `${data.assistantName} avatar` : "",
      });
      navigate("/");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to save your assistant setup."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flow-dark-shell flow-dark-shell--name avatar-shell avatar-shell--identity">
      <div className="flow-dark-backdrop flow-dark-backdrop--dense" />

      <section className="name-stage-layout identity-stage-layout">
        <article className="name-preview-card identity-preview-card">
          <div className="identity-preview-head">
            <span className="flow-step">Step 2 of 2</span>
            <span className="flow-chip">Launch Profile</span>
          </div>

          <div className="identity-preview-shell">
            <div className="name-preview-orbit" />
            <div className="name-preview-avatar identity-preview-avatar">
              {selection.selectedPreview ? (
                <img
                  src={selection.selectedPreview}
                  alt={assistantDraft.imageLabel || "Selected assistant avatar"}
                  style={{ objectPosition: selection.selectedRobot?.objectPosition || "center center" }}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="name-preview-fallback">Loading</span>
              )}
              <span className="identity-preview-badge">{previewStyleLabel}</span>
            </div>

            <div className="identity-data-grid">
              <div className="identity-data-card">
                <span>Portrait mood</span>
                <strong>{selection.selectedRobot?.mood || (selection.isUploadSelected ? "Custom visual" : "Saved profile")}</strong>
              </div>
              <div className="identity-data-card">
                <span>Ready for</span>
                <strong>Chat, voice, actions</strong>
              </div>
            </div>
          </div>

          <div className="name-preview-copy identity-preview-copy">
            <span className="flow-chip">Selected Design</span>
            <h2>{assistantDraft.imageLabel || "Chosen Avatar"}</h2>
            <p>
              This portrait will carry into the final assistant experience. All that is left is the name.
            </p>
          </div>
        </article>

        <form className="name-form-card identity-form-card" onSubmit={handleSubmit}>
          <span className="flow-chip">Identity Setup</span>
          <h1 className="flow-title flow-title--dark">Name your assistant.</h1>
          <p className="flow-copy flow-copy--dark">
            The visual is set. Choose a name, review the live preview, and launch.
          </p>

          <div className="identity-live-preview">
            <span>Live preview</span>
            <strong>{assistantName.trim() || "Your assistant name"}</strong>
            <p>
              {selection.selectedRobot
                ? `${selection.selectedRobot.name} portrait selected and ready for launch.`
                : selection.isSavedSelected
                  ? "Your saved portrait is selected and ready for launch."
                  : "Custom portrait selected and ready for launch."}
            </p>
          </div>

          <div className="identity-suggestion-head">
            <span className="flow-chip">Quick Names</span>
            <p>Tap one to fill the field instantly, or type your own.</p>
          </div>

          <div className="name-suggestion-row identity-suggestion-grid">
            {nameSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                className="name-suggestion identity-suggestion"
                type="button"
                onClick={() => {
                  setAssistantName(suggestion);
                  setErrorMessage("");
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <label className="field field--dark">
            <div className="identity-label-row">
              <span className="field-label field-label--dark">Assistant name</span>
              <span className="identity-helper">{assistantName.trim().length}/30</span>
            </div>
            <input
              className="input input--dark"
              type="text"
              value={assistantName}
              onChange={(event) => {
                setAssistantName(event.target.value);
                setErrorMessage("");
              }}
              placeholder="Nova Prime"
              maxLength={30}
              required
            />
          </label>

          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

          <div className="flow-actions">
            <Link className="secondary-button secondary-button--dark" to="/customize">
              Back
            </Link>
            <button className="primary-button dark-button" type="submit" disabled={loading}>
              {loading ? "Launching..." : "Launch Assistant"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
