import axios from "axios";
import uploadOnCloudinary from "../config/cloudinary.js";
import geminiResponse from "../gemini.js";
import User from "../models/user.model.js";
import buildLocalAssistantResponse, { detectLocalAssistantAction } from "../utils/assistantFallback.js";

const assistantRequestTracker = new Map();
const MIN_ASSISTANT_REQUEST_INTERVAL_MS = 2000;

const parseAssistantResponse = (result, fallbackInput) => {
  if (typeof result !== "string") {
    return null;
  }

  const cleanedResult = result.replace(/```json|```/gi, "").trim();
  const jsonMatch = cleanedResult.match(/{[\s\S]*}/);

  if (!jsonMatch) {
    return null;
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    type: parsed.type || "general",
    userinput: parsed.userinput || fallbackInput,
    response: parsed.response || "I am ready to help.",
    source: "gemini",
  };
};

export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Get current user error:", error);
    return res.status(500).json({ message: "Unable to fetch the current user" });
  }
}

export const updateAssistant = async (req, res) => {
  try {
    const assistantName = req.body.assistantName?.trim();
    const imageUrl = req.body.imageUrl?.trim();

    if (!assistantName) {
      return res.status(400).json({ message: "Assistant name is required" });
    }

    const existingUser = await User.findById(req.userId).select("assistantImage");
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    let assistantImage = imageUrl || existingUser.assistantImage;

    if (req.file) {
      assistantImage = await uploadOnCloudinary(req.file.path);
    }

    if (!assistantImage) {
      return res.status(400).json({ message: "Assistant image is required" });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { assistantName, assistantImage },
      { new: true, runValidators: true },
    ).select("-password");

    return res.status(200).json(user);
  } catch (error) {
    console.error("Update assistant error:", error);
    return res.status(500).json({ message: "Unable to update assistant details" });
  }
}

export const getAssistantAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("assistantImage");

    if (!user?.assistantImage) {
      return res.status(404).json({ message: "Assistant image not found" });
    }

    const imageUrl = new URL(user.assistantImage);
    if (!["http:", "https:"].includes(imageUrl.protocol)) {
      return res.status(400).json({ message: "Assistant image URL is invalid" });
    }

    const imageResponse = await axios.get(imageUrl.toString(), {
      responseType: "stream",
      timeout: 10000,
    });

    if (imageResponse.headers["content-type"]) {
      res.setHeader("Content-Type", imageResponse.headers["content-type"]);
    }

    res.setHeader("Cache-Control", "private, max-age=3600");
    imageResponse.data.pipe(res);
  } catch (error) {
    console.error("Get assistant avatar error:", error.message);
    return res.status(502).json({ message: "Unable to load assistant image" });
  }
}


export const askToAssistant = async (req, res) => {
  try {
    const command = req.body.command?.trim();

    if (!command) {
      return res.status(400).json({ message: "Command is required" });
    }

    const now = Date.now();
    const previousRequestAt = assistantRequestTracker.get(req.userId) || 0;
    const retryAfterMs = MIN_ASSISTANT_REQUEST_INTERVAL_MS - (now - previousRequestAt);

    if (retryAfterMs > 0) {
      return res.status(429).json({
        message: `Please wait ${Math.ceil(retryAfterMs / 1000)} second${retryAfterMs > 1000 ? "s" : ""} before sending another request.`,
        retryAfterMs,
      });
    }

    assistantRequestTracker.set(req.userId, now);

    const user = await User.findById(req.userId).select("name assistantName history");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let assistantReply;

    const localAction = detectLocalAssistantAction(
      command,
      user.assistantName || "Assistant",
      user.name || "User",
    );

    if (localAction) {
      assistantReply = {
        ...localAction,
        source: "local",
      };
    } else {
      try {
        const result = await geminiResponse(
          command,
          user.assistantName || "Assistant",
          user.name || "User",
          user.history || [],
        );
        assistantReply = parseAssistantResponse(result, command);
      } catch (error) {
        if (error?.status !== 429) {
          console.warn("Falling back to local assistant handler:", error.message);
        }
        assistantReply = buildLocalAssistantResponse(
          command,
          user.assistantName || "Assistant",
          user.name || "User",
          error,
        );
        assistantReply = {
          ...assistantReply,
          source: "fallback",
        };
      }
    }

    if (!assistantReply) {
      assistantReply = buildLocalAssistantResponse(
        command,
        user.assistantName || "Assistant",
        user.name || "User",
      );
      assistantReply = {
        ...assistantReply,
        source: "fallback",
      };
    }

    await User.findByIdAndUpdate(req.userId, {
      $push: { history: { $each: [command], $slice: -20 } },
    });

    return res.status(200).json({
      ...assistantReply,
    });
  } catch (error) {
    console.error("Ask assistant error:", error);
    return res.status(500).json({ message: "Unable to process assistant request" });
  }
}
