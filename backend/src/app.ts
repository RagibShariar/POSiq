import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import routes from "./routes";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
if (env.nodeEnv === "development") {
  app.use(morgan("dev"));
}

app.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok", uptime: process.uptime() } });
});

app.use("/api/v1", routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
