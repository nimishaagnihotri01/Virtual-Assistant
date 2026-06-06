import { Router } from "express";
import { loginUser, registerUser } from "../services/authStore.js";

const router = Router();

function createStatusError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function assertValidPassword(password) {
  if (typeof password !== "string" || password.trim().length < 8) {
    throw createStatusError(400, "Password must be at least 8 characters long.");
  }
}

router.post("/signup", (request, response, next) => {
  try {
    const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
    const email = typeof request.body?.email === "string" ? request.body.email.trim() : "";
    const password = typeof request.body?.password === "string" ? request.body.password : "";

    if (!name || name.length < 2) {
      throw createStatusError(400, "Please enter a valid full name.");
    }

    if (!validateEmail(email)) {
      throw createStatusError(400, "Please enter a valid email address.");
    }

    assertValidPassword(password);

    const user = registerUser({ name, email, password });

    response.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

router.post("/login", (request, response, next) => {
  try {
    const email = typeof request.body?.email === "string" ? request.body.email.trim() : "";
    const password = typeof request.body?.password === "string" ? request.body.password : "";

    if (!validateEmail(email)) {
      throw createStatusError(400, "Please enter a valid email address.");
    }

    assertValidPassword(password);

    const user = loginUser({ email, password });

    response.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;

