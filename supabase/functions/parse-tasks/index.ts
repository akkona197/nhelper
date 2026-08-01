// Parse a free-form message into structured task suggestions using Google Gemini.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Thử lần lượt các model tới khi trúng model có free tier ở tài khoản của bạn.
const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-1.5-flash",
  "gemini-2.0-flash",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, now } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const referenceTime = now || new Date().toISOString();

    const systemPrompt = `Bạn là trợ lý phân loại task. Người dùng dán vào một đoạn tin nhắn (có thể tiếng Việt hoặc Anh). Bạn phải trích xuất các công việc cần làm.

Quy tắc:
- Mỗi task: title ngắn gọn rõ hành động, description tóm tắt ngữ cảnh.
- priority: "high" nếu có "gấp/urgent/asap/trước...", "low" nếu "khi nào rảnh/khi tiện", còn lại "medium".
- estimate_minutes: ước lượng thời gian thực hiện (15, 30, 60, 90, 120...).
- deadline (ISO 8601 với offset, hoặc null): suy ra từ "trước thứ 6", "ngày mai 5h chiều", "cuối tuần này"... Mốc thời gian hiện tại: ${referenceTime}. Nếu chỉ có ngày, đặt 18:00.
- Nếu không có task rõ ràng, trả mảng rỗng.`;

    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            tasks: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING" },
                  description: { type: "STRING" },
                  priority: { type: "STRING", enum: ["low", "medium", "high"] },
                  estimate_minutes: { type: "NUMBER" },
                  deadline: { type: "STRING", nullable: true },
                },
                required: ["title", "priority", "estimate_minutes"],
              },
            },
          },
          required: ["tasks"],
        },
      },
    });

    let data: any = null;
    let lastStatus = 0;
    let lastText = "";
    let usedModel = "";

    for (const model of MODELS) {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body },
      );
      if (resp.ok) {
        data = await resp.json();
        usedModel = model;
        break;
      }
      lastStatus = resp.status;
      lastText = await resp.text();
      console.error("Gemini error", model, resp.status, lastText);
      // 429 (hết quota model này) hoặc 404 (model không có) -> thử model kế tiếp
      if (resp.status !== 429 && resp.status !== 404) break;
    }

    if (!data) {
      const msg = lastStatus === 429
        ? "Tất cả model đều hết hạn mức free của Gemini. Kiểm tra lại API key (nên dùng tài khoản Google cá nhân có free tier)."
        : "AI service error";
      return new Response(JSON.stringify({ error: msg, detail: lastText.slice(0, 500) }), {
        status: lastStatus || 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    let tasks: unknown[] = [];
    if (text) {
      try {
        tasks = JSON.parse(text).tasks ?? [];
      } catch (e) {
        console.error("parse Gemini output failed", e, text);
      }
    }

    return new Response(JSON.stringify({ tasks, model: usedModel }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-tasks error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
