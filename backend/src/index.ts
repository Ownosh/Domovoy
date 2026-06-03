import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { migrate } from "./db/migrate";
import authRoutes from "./routes/auth";
import buildingsRoutes from "./routes/buildings";
import newsRoutes from "./routes/news";
import votesRoutes from "./routes/votes";
import neighborAdsRoutes from "./routes/neighborAds";
import appealsRoutes from "./routes/appeals";
import ratingsRoutes from "./routes/ratings";
import districtRoutes from "./routes/district";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL ?? "*" }));
app.use(express.json());

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Слишком много запросов, попробуйте позже" },
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/buildings", buildingsRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/votes", votesRoutes);
app.use("/api/neighbor-ads", neighborAdsRoutes);
app.use("/api/appeals", appealsRoutes);
app.use("/api/ratings", ratingsRoutes);
app.use("/api/district", districtRoutes);

app.get("/health", (_req, res) => res.json({ ok: true }));

migrate()
    .then(() => {
        app.listen(PORT, () => console.log(`Server running on :${PORT}`));
    })
    .catch((err) => {
        console.error("Migration failed:", err);
        process.exit(1);
    });
