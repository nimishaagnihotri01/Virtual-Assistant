import User from "../models/user.model.js"
import bcrypt from "bcryptjs"
import genToken from "../config/token.js"
const isProduction = process.env.NODE_ENV === "production";

const authCookieOptions = {
  httpOnly: true,
  maxAge: 10 * 24 * 60 * 60 * 1000,
  sameSite: isProduction ? "none" : "lax",
  secure: isProduction,
};

const sanitizeUser = (user) => {
  const safeUser = user.toObject();
  delete safeUser.password;
  return safeUser;
};

const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);

export const signup = async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password?.trim();

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    const token = genToken(user._id);
    res.cookie("token", token, authCookieOptions);

    return res.status(201).json(sanitizeUser(user));
  } catch (error) {
    console.error("Sign up error:", error);
    return res.status(500).json({ message: "Unable to sign up right now" });
  }
}

export const login = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password?.trim();

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Email does not exist" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = genToken(user._id);
    res.cookie("token", token, authCookieOptions);

    return res.status(200).json(sanitizeUser(user));
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Unable to sign in right now" });
  }
}

export const logout = async (_req, res) => {
  try {
    res.clearCookie("token", authCookieOptions);
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ message: "Unable to log out right now" });
  }
};
