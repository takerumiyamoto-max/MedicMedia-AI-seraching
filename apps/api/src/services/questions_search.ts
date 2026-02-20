// apps/api/src/services/questions_search.ts
import fs from "node:fs/promises";
import path from "node:path";
import type { Env } from "../env";
import type { AutoSearchHit } from "./auto_search";
import { ApiError } from "./api_error";

type QuestionRow = {
  question_code: string;
  rbc_id?: string;
  rbc_name?: string;
  environment?: string;
  body_statement?: string;
  choice_1?: string;
  choice_2?: string;
  choice_3?: string;
  choice_4?: string;
  choice_5?: string;
  answer?: string;
  comment?: string;
  _blob: string; // 検索用結合文字列
};

let cache: { csvPathAbs: string; rows: QuestionRow[] } | null = null;

function parseCsvSimple(raw: string): { header: string[]; rows: string[][] } {
  // 最小：単純なカンマ区切り前提（本文にカンマ/改行がある本格CSVなら後でcsv-parse推奨）
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = lines[0].split(",").map((s) => s.trim());
  const rows = lines.slice(1).map((line) => line.split(","));
  return { header, rows };
}

async function loadQuestions(env: Env): Promise<QuestionRow[]> {
  const csvPathAbs = path.resolve(process.cwd(), env.QUESTIONS_CSV_PATH);
  if (cache?.csvPathAbs === csvPathAbs) return cache.rows;

  let raw: string;
  try {
    raw = await fs.readFile(csvPathAbs, "utf-8");
  } catch (e: any) {
    throw new ApiError("NOT_FOUND", "questions csv not found", 404, {
      path: env.QUESTIONS_CSV_PATH,
      abs: csvPathAbs,
      err: e?.code,
    });
  }

  const { header, rows } = parseCsvSimple(raw);
  const idx = (name: string) => header.indexOf(name);

  const iCode = idx("question_code");
  if (iCode < 0) {
    throw new ApiError("VALIDATION_ERROR", "CSV must have column: question_code", 400, { header });
  }

  const iRbcId = idx("rbc_id");
  const iRbcName = idx("rbc_name");
  const iEnv = idx("environment");
  const iBody = idx("body_statement");
  const iC1 = idx("choice_1");
  const iC2 = idx("choice_2");
  const iC3 = idx("choice_3");
  const iC4 = idx("choice_4");
  const iC5 = idx("choice_5");
  const iAns = idx("answer");
  const iCom = idx("comment");

  const out: QuestionRow[] = rows.map((cols) => {
    const question_code = (cols[iCode] ?? "").trim();

    const rbc_id = iRbcId >= 0 ? (cols[iRbcId] ?? "").trim() : "";
    const rbc_name = iRbcName >= 0 ? (cols[iRbcName] ?? "").trim() : "";
    const environment = iEnv >= 0 ? (cols[iEnv] ?? "").trim() : "";
    const body_statement = iBody >= 0 ? (cols[iBody] ?? "").trim() : "";

    const choice_1 = iC1 >= 0 ? (cols[iC1] ?? "").trim() : "";
    const choice_2 = iC2 >= 0 ? (cols[iC2] ?? "").trim() : "";
    const choice_3 = iC3 >= 0 ? (cols[iC3] ?? "").trim() : "";
    const choice_4 = iC4 >= 0 ? (cols[iC4] ?? "").trim() : "";
    const choice_5 = iC5 >= 0 ? (cols[iC5] ?? "").trim() : "";

    const answer = iAns >= 0 ? (cols[iAns] ?? "").trim() : "";
    const comment = iCom >= 0 ? (cols[iCom] ?? "").trim() : "";

    // 検索対象にしたい文字を結合（大文字小文字を潰す）
    const blob = [
      question_code,
      rbc_id,
      rbc_name,
      environment,
      body_statement,
      choice_1,
      choice_2,
      choice_3,
      choice_4,
      choice_5,
      answer,
      comment,
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();

    return {
      question_code,
      rbc_id,
      rbc_name,
      environment,
      body_statement,
      choice_1,
      choice_2,
      choice_3,
      choice_4,
      choice_5,
      answer,
      comment,
      _blob: blob,
    };
  });

  cache = { csvPathAbs, rows: out };
  return out;
}

function scoreRow(row: QuestionRow, query: string, keywords: string[]): number {
  const blob = row._blob;
  let score = 0;

  const q = query.toLowerCase().trim();
  if (q && blob.includes(q)) score += 5;

  for (const kw of keywords) {
    const k = kw.toLowerCase().trim();
    if (!k) continue;
    if (blob.includes(k)) score += 2;
  }

  // body_statement がマッチしたら少しだけ加点
  const body = (row.body_statement ?? "").toLowerCase();
  for (const kw of keywords) {
    const k = kw.toLowerCase().trim();
    if (k && body.includes(k)) score += 1;
  }

  return score;
}

export async function searchQuestionsAuto(
  _uploadDirAbs: string,
  env: Env,
  input: { query: string; keywords: string[]; top_k: number }
): Promise<AutoSearchHit[]> {
  const rows = await loadQuestions(env);

  const scored = rows
    .map((r) => ({ r, s: scoreRow(r, input.query, input.keywords) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, input.top_k);

  return scored.map(({ r, s }) => ({
    question_id: r.question_code, // AutoSearchHit は question_id なのでここに詰める
    title: r.body_statement?.slice(0, 60) || r.question_code,
    snippet: [
      r.environment ? `【状況】${r.environment}` : "",
      r.body_statement ? `【問題】${r.body_statement}` : "",
      r.choice_1 ? `A. ${r.choice_1}` : "",
      r.choice_2 ? `B. ${r.choice_2}` : "",
      r.choice_3 ? `C. ${r.choice_3}` : "",
      r.choice_4 ? `D. ${r.choice_4}` : "",
      r.choice_5 ? `E. ${r.choice_5}` : "",
      r.answer ? `【正答】${r.answer}` : "",
      r.comment ? `【解説】${r.comment}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    score: s,
    meta: {
      rbc_id: r.rbc_id,
      rbc_name: r.rbc_name,
      question_code: r.question_code,
    },
  }));
}