import { useEffect, useState } from "react";
import api from "../lib/api.js";
import { userDataContext as UserDataContext } from "./userDataContext.js";

const createDraft = () => ({
  assistantName: "",
  imageUrl: "",
  imageSource: "",
  imageFile: null,
  imageLabel: "",
});

export default function UserContext({ children }) {
  const [userData, setUserData] = useState(null);
  const [assistantDraft, setAssistantDraft] = useState(createDraft);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;

    const loadCurrentUser = async () => {
      try {
        const { data } = await api.get("/user/current");

        if (!active) {
          return;
        }

        setUserData(data);
        setAssistantDraft({
          assistantName: data.assistantName ?? "",
          imageUrl: data.assistantImage ?? "",
          imageSource: data.assistantImage ? "saved" : "",
          imageFile: null,
          imageLabel: data.assistantName ? `${data.assistantName} avatar` : "",
        });
      } catch {
        if (active) {
          setUserData(null);
        }
      } finally {
        if (active) {
          setAuthReady(true);
        }
      }
    };

    void loadCurrentUser();

    return () => {
      active = false;
    };
  }, []);

  const refreshUser = async () => {
    try {
      const { data } = await api.get("/user/current");
      setUserData(data);
      setAssistantDraft({
        assistantName: data.assistantName ?? "",
        imageUrl: data.assistantImage ?? "",
        imageSource: data.assistantImage ? "saved" : "",
        imageFile: null,
        imageLabel: data.assistantName ? `${data.assistantName} avatar` : "",
      });
      return data;
    } catch {
      setUserData(null);
      return null;
    }
  };

  const logout = async () => {
    try {
      await api.get("/auth/logout");
    } finally {
      setUserData(null);
      setAssistantDraft(createDraft());
    }
  };

  return (
    <UserDataContext.Provider
      value={{
        authReady,
        userData,
        setUserData,
        refreshUser,
        assistantDraft,
        setAssistantDraft,
        logout,
      }}
    >
      {children}
    </UserDataContext.Provider>
  );
}
