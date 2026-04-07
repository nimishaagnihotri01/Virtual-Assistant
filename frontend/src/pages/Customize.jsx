import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { userDataContext } from "../context/userDataContext.js";
import {
  getAssistantDraftSelection,
  getUploadedImageDetails,
  getUploadValidationMessage,
} from "../lib/getAssistantDraftSelection.js";
import robotOptions from "../lib/robotOptions.js";

const getSelectionSummary = (selection, uploadDetails) => {
  if (selection.isUploadSelected) {
    return uploadDetails
      ? `Your own portrait is ready to go. ${uploadDetails} will be carried into the final setup step.`
      : "Your own image is selected, so the assistant will keep a custom identity from the start.";
  }

  if (selection.isPresetSelected && selection.selectedRobot) {
    return selection.selectedRobot.description;
  }

  if (selection.isSavedSelected && selection.hasSavedAvatar) {
    return "Your current saved avatar is ready to be reused without changing anything else.";
  }

  return "Choose a portrait below to preview the assistant in a sharper, more cinematic setup flow.";
};

export default function Customize() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { assistantDraft, setAssistantDraft, userData } = useContext(userDataContext);
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadPreview, setUploadPreview] = useState("");

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
  const uploadDetails = getUploadedImageDetails(assistantDraft.imageFile);
  const selectedPresetId = selection.isPresetSelected ? selection.selectedRobot?.id || "" : "";
  const selectionSummary = getSelectionSummary(selection, uploadDetails);

  const handlePresetSelect = (robot) => {
    setAssistantDraft((current) => ({
      ...current,
      imageSource: "preset",
      imageUrl: robot.src,
      imageFile: null,
      imageLabel: robot.name,
    }));
    setErrorMessage("");
  };

  const handleUseSavedAvatar = () => {
    if (!selection.hasSavedAvatar) {
      return;
    }

    setAssistantDraft((current) => ({
      ...current,
      imageSource: "saved",
      imageUrl: userData.assistantImage,
      imageFile: null,
      imageLabel: userData.assistantName ? `${userData.assistantName} avatar` : "Saved avatar",
    }));
    setErrorMessage("");
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const validationMessage = getUploadValidationMessage(file);

    if (validationMessage) {
      setErrorMessage(validationMessage);
      event.target.value = "";
      return;
    }

    setAssistantDraft((current) => ({
      ...current,
      imageSource: "upload",
      imageUrl: "",
      imageFile: file,
      imageLabel: file.name,
    }));
    setErrorMessage("");
    event.target.value = "";
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!selection.hasSelectedImage) {
      setErrorMessage("Pick a robot card or upload an image from your system to continue.");
      return;
    }

    navigate("/customize2");
  };

  const previewModeLabel = selection.isUploadSelected
    ? "Custom upload"
    : selection.isPresetSelected
      ? selection.selectedRobot?.tag || "Preset selected"
      : selection.isSavedSelected
        ? "Current saved avatar"
        : "Awaiting selection";

  return (
    <main className="flow-dark-shell avatar-shell avatar-shell--selection">
      <div className="flow-dark-backdrop" />
      <div className="flow-dark-backdrop flow-dark-backdrop--dense" />

      <section className="flow-dark-grid avatar-stage-grid">
        <article className="flow-stage-card flow-stage-card--hero avatar-hero-card">
          <div className="avatar-hero-topline">
            <span className="flow-step">Step 1 of 2</span>
            <span className="flow-chip">Curated Portraits</span>
          </div>

          <h1 className="flow-title">Choose the face of your assistant.</h1>
          <p className="flow-copy">
            Pick a preset or upload your own image, then move straight into naming with a live
            preview of the assistant identity.
          </p>

          <div className="avatar-signal-row">
            <div className="avatar-signal-card">
              <strong>{robotOptions.length}</strong>
              <span>HD robot presets</span>
            </div>
            <div className="avatar-signal-card">
              <strong>2</strong>
              <span>step setup flow</span>
            </div>
            <div className="avatar-signal-card">
              <strong>{selection.hasSavedAvatar ? "Saved" : "Fresh"}</strong>
              <span>{selection.hasSavedAvatar ? "avatar available" : "profile state"}</span>
            </div>
          </div>

          <div className="selection-preview-card avatar-preview-card">
            <div className="selection-preview-visual avatar-preview-visual">
              {selection.selectedPreview ? (
                <img
                  src={selection.selectedPreview}
                  alt={assistantDraft.imageLabel || "Selected assistant avatar"}
                  style={{ objectPosition: selection.selectedRobot?.objectPosition || "center center" }}
                  referrerPolicy="no-referrer"
                />
              ) : selection.hasSelectedImage ? (
                <span>Loading</span>
              ) : (
                <div className="avatar-preview-empty">
                  <span className="avatar-preview-empty-mark">AI</span>
                  <strong>Preview your assistant</strong>
                  <p>Pick a robot portrait or upload your own image to light up this stage.</p>
                </div>
              )}
              <div className="avatar-preview-sheen" />
              <span className="avatar-preview-mode">{previewModeLabel}</span>
              {selection.isUploadSelected && uploadDetails ? (
                <span className="avatar-preview-filetag">{uploadDetails}</span>
              ) : null}
            </div>

            <div className="selection-preview-copy avatar-preview-copy">
              <span className="flow-chip">Selected Avatar</span>
              <h2>{assistantDraft.imageLabel || "No image selected yet"}</h2>
              <p>{selectionSummary}</p>

              <div className="avatar-preview-meta">
                <div className="avatar-preview-meta-card">
                  <span>Visual mood</span>
                  <strong>{selection.selectedRobot?.mood || (selection.isUploadSelected ? "Custom look" : selection.isSavedSelected ? "Saved profile" : "Unassigned")}</strong>
                </div>
                <div className="avatar-preview-meta-card">
                  <span>Next step</span>
                  <strong>Name the assistant</strong>
                </div>
                <div className="avatar-preview-meta-card">
                  <span>Selection state</span>
                  <strong>{selection.hasSelectedImage ? "Ready to continue" : "Choose a portrait"}</strong>
                </div>
              </div>
            </div>
          </div>
        </article>

        <form className="flow-stage-card flow-stage-card--choices avatar-gallery-card" onSubmit={handleSubmit}>
          <div className="flow-section-head avatar-section-head">
            <div>
              <span className="flow-chip">Robot Gallery</span>
              <h2>Pick a preset or upload a custom image.</h2>
            </div>
            <p className="avatar-section-copy">
              Every portrait is ready to use, and you can switch back to your saved avatar anytime.
            </p>
          </div>

          <div className="avatar-toolbar">
            <p className="avatar-toolbar-note">
              {selection.hasSavedAvatar
                ? "Your saved avatar is still available."
                : "Pick one look, then continue to naming."}
            </p>

            {selection.hasSavedAvatar ? (
              <button
                className={`text-button text-button--dark avatar-saved-button ${
                  selection.isSavedSelected ? "is-active" : ""
                }`}
                type="button"
                onClick={handleUseSavedAvatar}
                aria-pressed={selection.isSavedSelected}
              >
                Use Current Avatar
              </button>
            ) : null}
          </div>

          <div className="robot-grid avatar-robot-grid">
            {robotOptions.map((robot) => {
              const isSelected = selectedPresetId === robot.id;

              return (
                <button
                  key={robot.id}
                  className={`robot-card avatar-robot-card ${isSelected ? "is-selected" : ""}`}
                  type="button"
                  onClick={() => handlePresetSelect(robot)}
                  aria-pressed={isSelected}
                >
                  <div className="robot-card-art avatar-robot-art">
                    <img
                      src={robot.src}
                      alt={robot.name}
                      style={{ objectPosition: robot.objectPosition || "center center" }}
                    />
                    <div className="avatar-robot-overlay" />
                    <span className="avatar-robot-badge">{robot.tag}</span>
                    {isSelected ? <span className="avatar-selection-marker">Selected</span> : null}
                  </div>

                  <div className="robot-card-copy avatar-robot-copy">
                    <div className="avatar-robot-heading">
                      <strong>{robot.name}</strong>
                      <span>{robot.mood}</span>
                    </div>
                    <p>{robot.description}</p>
                  </div>
                </button>
              );
            })}

            <button
              className={`robot-card robot-card--upload avatar-robot-card avatar-robot-card--upload ${
                selection.isUploadSelected ? "is-selected" : ""
              }`}
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-pressed={selection.isUploadSelected}
            >
              <div className="robot-card-art robot-card-art--upload avatar-upload-art">
                <span className="upload-plus">+</span>
              </div>
              <div className="robot-card-copy avatar-robot-copy">
                <div className="avatar-robot-heading">
                  <strong>Upload Your Own</strong>
                  <span>Custom portrait</span>
                </div>
                <p>Open your local files and use any image that better matches your assistant identity.</p>
              </div>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            onClick={(event) => {
              event.currentTarget.value = "";
            }}
            hidden
          />

          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

          <div className="flow-actions">
            <button className="primary-button dark-button" type="submit">
              Continue to Naming
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
