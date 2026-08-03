// Parse a free-form message into structured task suggestions using Cloudflare Workers AI.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Model nhe/nhanh lam chinh, 70B lam du phong (chi dung neu 8B loi).
const MODELS = [
  "@cf/meta/llama-3.1-8b-instruct-fast",
  "@cf/meta/llama-3.1-8b-instruct",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
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

    const ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID");
    const CF_API_TOKEN = Deno.env.get("CF_API_TOKEN");
    if (!ACCOUNT_ID || !CF_API_TOKEN) {
      return new Response(
        JSON.stringify({ error: "CF_ACCOUNT_ID / CF_API_TOKEN chua duoc cau hinh" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const referenceTime = now || new Date().toISOString();

    const systemPrompt = `Bạn là trợ lý phân loại task. Người dùng dán vào một đoạn tin nhắn (tiếng Việt hoặc Anh). Trích xuất các công việc cần làm và CHỈ trả về JSON đúng schema.

Quy tắc:
- Mỗi task: title ngắn gọn rõ hành động, description tóm tắt ngữ cảnh.
- priority: "high" nếu có "gấp/urgent/asap/trước...", "low" nếu "khi nào rảnh/khi tiện", còn lại "medium".
- estimate_minutes: ước lượng thời gian (15, 30, 60, 90, 120...).
- deadline: chuỗi ISO 8601 có offset, hoặc null. Suy ra từ "trước thứ 6", "ngày mai 5h chiều", "cuối tuần này"... Mốc thời gian hiện tại: ${referenceTime}. Nếu chỉ có ngày, đặt 18:00.
- Nếu không có task rõ ràng, trả {"tasks": []}.`;

    const jsonSchema = {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              priority: { type: "string", enum: ["low", "medium", "high"] },
              estimate_minutes: { type: "number" },
              deadline: { type: ["string", "null"] },
            },
            required: ["title", "priority", "estimate_minutes"],
          },
        },
      },
      required: ["tasks"],
    };

    const body = JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      response_format: { type: "json_schema", json_schema: jsonSchema },
      max_tokens: 2048,
      temperature: 0.2,
    });

    let parsed: any = null;
    let lastStatus = 0;
    let lastText = "";
    let usedModel = "";

    for (const model of MODELS) {
      const resp = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${model}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CF_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body,
        },
      );

      const raw = await resp.text();
      if (!resp.ok) {
        lastStatus = resp.status;
        lastText = raw;
        console.error("Cloudflare AI error", model, resp.status, raw);
        continue; // thu model ke tiep
      }

      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        lastText = raw;
        console.error("Cloudflare AI non-JSON", model, raw);
        continue;
      }

      if (data?.success === false) {
        lastText = raw;
        console.error("Cloudflare AI success=false", model, raw);
        continue;
      }

      // result.response co the la object (khi dung json_schema) hoac string.
      const out = data?.result?.response;
      try {
        parsed = typeof out === "string" ? JSON.parse(out) : out;
      } catch (e) {
        console.error("parse CF output failed", model, e, out);
        continue;
      }
      if (parsed) {
        usedModel = model;
        break;
      }
    }

    if (!parsed) {
      return new Response(
        JSON.stringify({
          error: "AI service error",
          detail: lastText.slice(0, 500),
        }),
        {
          status: lastStatus || 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];

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
