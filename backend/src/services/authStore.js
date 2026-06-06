import { createHash, randomUUID } from "node:crypto";

const usersByEmail = new Map();

const DEMO_USER = {
  name: "Demo User",
  email: "demo@virtualassistant.dev",
  password: "demo12345",
};

function createStatusError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function hashPassword(password) {
  return createHash("sha256").update(password).digest("hex");
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

function seedDemoUser() {
  if (usersByEmail.has(DEMO_USER.email)) {
    return;
  }

  usersByEmail.set(DEMO_USER.email, {
    id: randomUUID(),
    name: DEMO_USER.name,
    email: DEMO_USER.email,
    passwordHash: hashPassword(DEMO_USER.password),
  });
}

seedDemoUser();

export function registerUser({ email, name, password }) {
  const normalizedEmail = normalizeEmail(email);

  if (usersByEmail.has(normalizedEmail)) {
    throw createStatusError(409, "An account with this email already exists.");
  }

  const user = {
    id: randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
  };

  usersByEmail.set(normalizedEmail, user);

  return sanitizeUser(user);
}

export function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const user = usersByEmail.get(normalizedEmail);

  if (!user || user.passwordHash !== hashPassword(password)) {
    throw createStatusError(401, "Invalid email or password.");
  }

  return sanitizeUser(user);
}

