import getAssistantAvatarUrl from "./getAssistantAvatarUrl.js";
import robotOptions from "./robotOptions.js";

export const IMAGE_UPLOAD_LIMIT_BYTES = 8 * 1024 * 1024;

const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

export const getUploadValidationMessage = (file) => {
  if (!file) {
    return "Choose an image file to continue.";
  }

  if (typeof file.type !== "string" || !file.type.startsWith("image/")) {
    return "Please choose a valid image file.";
  }

  if (file.size > IMAGE_UPLOAD_LIMIT_BYTES) {
    return `Choose an image smaller than ${formatFileSize(IMAGE_UPLOAD_LIMIT_BYTES)}.`;
  }

  return "";
};

export const getUploadedImageDetails = (file) => {
  if (!file) {
    return "";
  }

  const typeLabel = file.type?.replace("image/", "").toUpperCase() || "IMAGE";
  return `${typeLabel} | ${formatFileSize(file.size)}`;
};

export const getAssistantDraftSelection = (assistantDraft, userData, uploadPreview = "") => {
  const hasSavedAvatar = Boolean(userData?.assistantImage);
  const selectedRobot = assistantDraft.imageSource === "preset"
    ? robotOptions.find((robot) => robot.src === assistantDraft.imageUrl) || null
    : null;
  const isUploadSelected = assistantDraft.imageSource === "upload" && Boolean(assistantDraft.imageFile);
  const isPresetSelected = assistantDraft.imageSource === "preset" && Boolean(selectedRobot);
  const isSavedSelected = assistantDraft.imageSource === "saved" && hasSavedAvatar;
  const hasSelectedImage = isUploadSelected || isPresetSelected || isSavedSelected;

  const selectedPreview = isUploadSelected
    ? uploadPreview
    : isSavedSelected
      ? getAssistantAvatarUrl(userData?.updatedAt)
      : isPresetSelected
        ? selectedRobot.src
        : "";

  return {
    hasSavedAvatar,
    selectedRobot,
    isUploadSelected,
    isPresetSelected,
    isSavedSelected,
    hasSelectedImage,
    selectedPreview,
  };
};
