import http from "k6/http";
import { check, sleep } from "k6";

/**
 * Постепенный рост нагрузки до отказа — ищем предел системы.
 * Запускайте только на staging / отдельной БД, не на проде с реальными пользователями.
 */
const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:3001";

export const options = {
    stages: [
        { duration: "1m", target: 20 },
        { duration: "2m", target: 50 },
        { duration: "2m", target: 100 },
        { duration: "2m", target: 150 },
        { duration: "1m", target: 0 },
    ],
    thresholds: {
        http_req_failed: ["rate<0.1"],
    },
};

export default function () {
    const res = http.get(`${BASE_URL}/health`);
    check(res, { "health ok": (r) => r.status === 200 });
    sleep(0.05);
}
