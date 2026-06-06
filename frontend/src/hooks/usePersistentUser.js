import { useEffect, useState } from "react";

const STORAGE_KEY = "virtual-assistant.user.v1";

function loadStoredUser() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);

    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue);

    if (!parsedValue || typeof parsedValue.email !== "string") {
      return null;
    }

    return parsedValue;
  } catch {
    return null;
  }
}

export function usePersistentUser() {
  const [user, setUser] = useState(loadStoredUser);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (user) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
  }, [user]);

  return {
    user,
    setUser,
  };
}
