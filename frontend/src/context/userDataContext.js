import { createContext } from "react";

const createDraft = () => ({
  assistantName: "",
  imageUrl: "",
  imageSource: "",
  imageFile: null,
  imageLabel: "",
});

export const userDataContext = createContext({
  authReady: false,
  userData: null,
  setUserData: () => undefined,
  refreshUser: async () => null,
  assistantDraft: createDraft(),
  setAssistantDraft: () => undefined,
  logout: async () => undefined,
});
