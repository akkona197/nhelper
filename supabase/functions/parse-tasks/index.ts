// Parse a free-form message into structured task suggestions using Cloudflare Workers AI.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 70B fp8-fast lam chinh (chat luong tot, van nhanh); 8B du phong neu loi.
const MODELS = [
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/meta/llama-3.1-8b-instruct",
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

    const systemPrompt = `Bạn là trợ lý bóc tách công việc từ tin nhắn/email mà người khác giao. Người dùng dán vào một đoạn văn (tiếng Việt hoặc Anh). Trích xuất các ĐẦU VIỆC cần làm và CHỈ trả về JSON đúng schema.

CÁCH GOM/TÁCH (quan trọng nhất):
- Mỗi ĐẦU VIỆC cụ thể (một deliverable) = ĐÚNG 1 task. Ví dụ "làm slide SUP" và "chuẩn bị meeting MNG" là 2 task khác nhau.
- KHÔNG tách một đầu việc thành nhiều task chỉ vì nó được viết trên nhiều dòng. Các dòng mô tả/điều kiện của cùng một việc phải gộp vào description của task đó.
- KHÔNG gộp nhiều đầu việc khác nhau vào chung 1 task.
- Các dòng chỉ là NHÃN hoặc THÔNG TIN (ví dụ "Kênh Chat:", "Chat Log:", "PIC:", tên người, đường link, tiêu đề tuần như "W32") KHÔNG phải là task. Đưa các chi tiết này vào description của task liên quan, tuyệt đối không tạo task riêng cho chúng.
- Nếu một dòng chỉ là thông tin chung/tiêu đề, không có hành động cần làm thì bỏ qua.

TỪNG TRƯỜNG:
- title: động từ + đối tượng, ngắn gọn (vd "Làm slide SUP tuần W32").
- description: gộp đủ ngữ cảnh quan trọng (kênh, người phụ trách, link, điều kiện). Nếu thông tin thiếu thì để ngắn gọn, KHÔNG bịa thêm.
- priority: "high" nếu có "gấp/urgent/asap/trước hạn...", "low" nếu "khi nào rảnh/khi tiện", còn lại "medium".
- estimate_minutes: ước lượng thời gian (15, 30, 60, 90, 120...).
- deadline: chuỗi ISO 8601 có offset, hoặc null. Suy ra từ "thứ 4", "trước thứ 6", "ngày mai 5h chiều", "cuối tuần này"... Mốc thời gian hiện tại: ${referenceTime}. Nếu chỉ có ngày, đặt 18:00. Không rõ thì để null.
- Nếu không có việc rõ ràng, trả {"tasks": []}.

VÍ DỤ:
Input:
"""
Nghĩa gửi tasklist tuần W32:
Thứ 4: Slide SUP - các PIC check report W31 & input lên slide SUP
Kênh Chat: QA CH
Chat Log: Oanh Nguyễn
Thứ 6: chuẩn bị meeting MNG, gửi tài liệu trước 5h chiều
"""
Output:
{"tasks":[
  {"title":"Làm slide SUP tuần W32","description":"Các PIC check report W31 và input lên slide SUP. Kênh: QA CH, chat log: Oanh Nguyễn.","priority":"medium","estimate_minutes":60,"deadline":null},
  {"title":"Chuẩn bị meeting MNG","description":"Chuẩn bị và gửi tài liệu trước 5h chiều thứ 6.","priority":"high","estimate_minutes":60,"deadline":null}
]}`;

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
