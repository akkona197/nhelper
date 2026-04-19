// Parse a free-form message into structured task suggestions using Lovable AI.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
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
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_tasks",
                description: "Trả về danh sách task được trích xuất.",
                parameters: {
                  type: "object",
                  properties: {
                    tasks: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          description: { type: "string" },
                          priority: {
                            type: "string",
                            enum: ["low", "medium", "high"],
                          },
                          estimate_minutes: { type: "number" },
                          deadline: {
                            type: ["string", "null"],
                            description: "ISO 8601 hoặc null",
                          },
                        },
                        required: [
                          "title",
                          "priority",
                          "estimate_minutes",
                        ],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["tasks"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "extract_tasks" },
          },
        }),
      },
    );

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("AI gateway error", resp.status, txt);
      if (resp.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Đã đụng giới hạn AI, thử lại sau ít phút nhé.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (resp.status === 402) {
        return new Response(
          JSON.stringify({
            error:
              "Hết credit AI. Vào Settings → Workspace → Usage để nạp thêm.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let tasks: unknown[] = [];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        tasks = parsed.tasks ?? [];
      } catch (e) {
        console.error("parse arguments failed", e);
      }
    }

    return new Response(JSON.stringify({ tasks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-tasks error", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
