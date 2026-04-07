import api from "./api.js";

const getAssistantAvatarUrl = (cacheKey = "") => {
  const baseUrl = String(api.defaults.baseURL || "").replace(/\/$/, "");
  const suffix = cacheKey ? `?t=${encodeURIComponent(cacheKey)}` : "";
  return `${baseUrl}/user/avatar${suffix}`;
};

export default getAssistantAvatarUrl;
