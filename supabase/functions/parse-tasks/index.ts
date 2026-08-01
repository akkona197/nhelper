// Parse a free-form message into structured task suggestions using Google Gemini.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MODEL = "gemini-2.0-flash";

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
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
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

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      },
    );

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("Gemini error", resp.status, txt);
      if (resp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Đã đụng giới hạn AI, thử lại sau ít phút nhé." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    let tasks: unknown[] = [];
    if (text) {
      try {
        const parsed = JSON.parse(text);
        tasks = parsed.tasks ?? [];
      } catch (e) {
        console.error("parse Gemini output failed", e, text);
      }
    }

    return new Response(JSON.stringify({ tasks }), {
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
