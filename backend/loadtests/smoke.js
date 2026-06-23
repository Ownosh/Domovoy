import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:3001";

export const options = {
    vus: Number(__ENV.VUS || 5),
    duration: __ENV.DURATION || "30s",
    thresholds: {
        http_req_failed: ["rate<0.01"],
        http_req_duration: ["p(95)<200"],
    },
};

export default function () {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
        "health status 200": (r) => r.status === 200,
        "health ok": (r) => r.json("ok") === true,
    });
    sleep(0.1);
}
