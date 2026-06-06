import cors from "cors";
import express from "express";
import assistantRouter from "./routes/assistant.js";
import authRouter from "./routes/auth.js";

const app = express();

app.use(
  cors({
    origin: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "virtual-assistant-api",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRouter);
app.use("/api/assistant", assistantRouter);

app.use((_request, response) => {
  response.status(404).json({
    error: "Route not found.",
  });
});

app.use((error, _request, response, _next) => {
  const statusCode = error.statusCode ?? 500;

  response.status(statusCode).json({
    error: statusCode === 500 ? "Something went wrong on the server." : error.message,
  });
});

export default app;
