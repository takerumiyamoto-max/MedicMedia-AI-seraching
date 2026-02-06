const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") || "http://0.0.0.0:3001";

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  // Fastifyが空を返す可能性も一応ケア
  const data = text ? JSON.parse(text) : null;

  return data as T;
}