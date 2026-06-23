import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { migrate } from "./db/migrate";
import { startMaintenanceScheduler } from "./db/maintenance";
import authRoutes from "./routes/auth";
import buildingsRoutes from "./routes/buildings";
import newsRoutes from "./routes/news";
import votesRoutes from "./routes/votes";
import neighborAdsRoutes from "./routes/neighborAds";
import appealsRoutes from "./routes/appeals";
import ratingsRoutes from "./routes/ratings";
import districtRoutes from "./routes/district";
import imagekitRoutes from "./routes/imagekit";
import notificationsRoutes from "./routes/notifications";
import verificationRoutes from "./routes/verification";
import filesRoutes from "./routes/files";
import apartmentsRoutes from "./routes/apartments";
import { isModerationEnabled } from "./utils/moderation";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../Domovoy_admin/backend/.env") });

const app = express();
const PORT = process.env.PORT ?? 3001;
const ADMIN_API = process.env.ADMIN_API_ENABLED !== "0";

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: process.env.FRONTEND_URL ?? "*" }));
app.use(express.json({ limit: "10mb" }));

// Раздача загруженных файлов
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

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
app.use("/api/imagekit", imagekitRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/apartments", apartmentsRoutes);

app.get("/health", (_req, res) => res.json({ ok: true, adminApi: ADMIN_API }));

async function mountAdminApi(application: express.Express): Promise<void> {
    const adminModulePath = path.resolve(__dirname, "../../../Domovoy_admin/backend/src/registerAdminRoutes");
    const { registerAdminRoutes } = require(adminModulePath) as {
        registerAdminRoutes: (app: express.Express) => Promise<void>;
    };
    await registerAdminRoutes(application);
}

async function start() {
    await migrate();
    if (ADMIN_API) {
        await mountAdminApi(app);
        console.log("[server] Admin API mounted (auth, news, appeals, …)");
    }
    startMaintenanceScheduler();
    app.listen(PORT, () => {
        console.log(`[server] Mobile API: http://localhost:${PORT}/api`);
        if (ADMIN_API) console.log(`[server] Admin API:  http://localhost:${PORT}`);
        const modFlag = process.env.MODERATION_ENABLED?.trim().toLowerCase();
        const modOff = modFlag === "0" || modFlag === "false" || modFlag === "off";
        console.log(isModerationEnabled()
            ? "[moderation] Yandex GPT включена"
            : modOff
                ? "[moderation] отключена (MODERATION_ENABLED=0)"
                : "[moderation] YANDEX_API_KEY не задан — проверка отключена");
    });
}

start().catch((err) => {
    console.error("Server failed to start:", err);
    process.exit(1);
});
