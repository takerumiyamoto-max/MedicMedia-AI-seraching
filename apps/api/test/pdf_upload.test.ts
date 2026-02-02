import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp } from "../src/app";
import type { Env } from "../src/env";

function minimalPdfBuffer() {
  const s =
    "%PDF-1.4\n" +
    "1 0 obj\n<<>>\nendobj\n" +
    "trailer\n<<>>\n%%EOF\n";
  return Buffer.from(s, "utf-8");
}

describe("PDF upload", () => {
  it("POST /pdfs should upload pdf and return meta", async () => {
    const env: Env = {
      PORT: 3001,
      HOST: "0.0.0.0",
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      UPLOAD_DIR: "uploads",
      MAX_UPLOAD_MB: 20,
    };

    const app = buildApp(env);
    await app.ready(); // ✅ 重要

    const res = await request(app.server) // ✅ app じゃなく app.server
      .post("/pdfs")
      .attach("file", minimalPdfBuffer(), { filename: "sample.pdf" });

    expect(res.status).toBe(201);
    expect(res.body.pdf_id).toBeTruthy();
    expect(res.body.filename).toBe("sample.pdf");

    await app.close();
  });
});