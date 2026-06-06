import { Router } from "express";
import { createAssistantReply } from "../services/assistantEngine.js";

const router = Router();

function validateHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((entry) => entry && typeof entry.content === "string" && typeof entry.role === "string")
    .slice(-12)
    .map((entry) => ({
      role: entry.role,
      content: entry.content.trim().slice(0, 2000),
    }));
}

router.post("/chat", async (request, response, next) => {
  try {
    const message = typeof request.body?.message === "string" ? request.body.message.trim() : "";
    const assistantName =
      typeof request.body?.assistantName === "string"
        ? request.body.assistantName.trim().slice(0, 40)
        : "Nova";

    if (!message) {
      const error = new Error("A message is required.");
      error.statusCode = 400;
      throw error;
    }

    if (message.length > 2000) {
      const error = new Error("Messages must be 2000 characters or fewer.");
      error.statusCode = 400;
      throw error;
    }

    const history = validateHistory(request.body?.history);
    const assistantMessage = await createAssistantReply({ message, history, assistantName });

    response.json({
      message: assistantMessage,
      meta: {
        receivedHistoryItems: history.length,
        provider: assistantMessage.provider,
        model: assistantMessage.model,
        processedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
