// Botmother reference module — universal JSON-RPC 2.0 servisi (zero dependency).
// Bitta HTTP endpoint /rpc (describe + node.execute) + /health.
// Engine noma'lum node turini shu modulга yuboradi: POST /rpc {jsonrpc,method,params,id}.
//
// Yangi modul yozish = manifestlarni (describe) + node.execute mantig'ini o'zgartirish.

"use strict";
const http = require("http");

const PORT = process.env.PORT || 8100;
const AUTH_TOKEN = process.env.MODULE_AUTH_TOKEN || ""; // bo'sh = autentifikatsiya tekshirilmaydi

// ---------------------------------------------------------------------------
// 1) Node manifestlari — constructor manifest formatida (faqat STANDART field type).
//    Node turlari modul id bilan namespace qilinadi: "demo.Echo".
// ---------------------------------------------------------------------------
const MODULE = { id: "demo", name: "Demo Module", version: "0.1.0" };

const NODES = [
  {
    type: "demo.Echo",
    status: "runtime",
    category: "integrations",
    titleKey: "module.demo.echo.title",
    titleFallback: "Echo",
    descriptionKey: "module.demo.echo.desc",
    descriptionFallback: "Kiritilgan matnni o'zgaruvchiga yozadi",
    iconName: "sparkles",
    colorToken: "blue",
    size: { width: 300, minHeight: 120 },
    sidebar: { enabled: true, groupId: "integrations", sortOrder: 100, elementType: "demo.Echo" },
    handles: [{ preset: "target-default" }, { preset: "source-default" }],
    content: [
      {
        type: "text",
        key: "input",
        label: "Matn",
        placeholder: "{{message.text}} yoki literal",
        helpText: "Natija echo_output o'zgaruvchisiga yoziladi",
      },
    ],
    defaults: { input: "{{message.text}}" },
    producesState: ["echo_output"],
    trigger: false,
  },
  {
    type: "demo.Upper",
    status: "runtime",
    category: "integrations",
    titleKey: "module.demo.upper.title",
    titleFallback: "Katta harf",
    descriptionKey: "module.demo.upper.desc",
    descriptionFallback: "Matnni KATTA harfga aylantiradi",
    iconName: "sparkles",
    colorToken: "violet",
    size: { width: 300, minHeight: 120 },
    sidebar: { enabled: true, groupId: "integrations", sortOrder: 101, elementType: "demo.Upper" },
    handles: [{ preset: "target-default" }, { preset: "source-default" }],
    content: [{ type: "text", key: "text", label: "Matn", placeholder: "salom" }],
    defaults: { text: "" },
    producesState: ["upper_output"],
    trigger: false,
  },
  // TRIGGER node — event-match: xabar matnida kalit so'z bo'lsa fire bo'ladi.
  {
    type: "demo.OnKeyword",
    status: "runtime",
    category: "triggers",
    titleKey: "module.demo.onkeyword.title",
    titleFallback: "Kalit so'z kelganda",
    descriptionKey: "module.demo.onkeyword.desc",
    descriptionFallback: "Xabarda berilgan kalit so'z bo'lsa ishga tushadi",
    iconName: "sparkles",
    colorToken: "amber",
    size: { width: 300, minHeight: 110 },
    sidebar: { enabled: true, groupId: "triggers", sortOrder: 90, elementType: "demo.OnKeyword" },
    handles: [{ preset: "source-default" }],
    content: [{ type: "text", key: "keyword", label: "Kalit so'z", placeholder: "salom" }],
    defaults: { keyword: "" },
    trigger: true,
    triggerMode: "event-match", // engine trigger.match orqali so'raydi
  },
];

// ---------------------------------------------------------------------------
// 2) node.execute mantig'i — har node turi uchun.
//    params: { type, data, context, chat_id }
//    qaytaradi: { context_updates, exit_output?, error? }
// ---------------------------------------------------------------------------
const EXECUTORS = {
  "demo.Echo": ({ data }) => ({
    context_updates: { echo_output: String(data.input ?? "") },
    exit_output: "",
  }),
  "demo.Upper": ({ data }) => ({
    context_updates: { upper_output: String(data.text ?? "").toUpperCase() },
    exit_output: "",
  }),
};

// ---------------------------------------------------------------------------
// 2b) trigger.match mantig'i — event-match triggerlar uchun.
//    params: { type, data, update, context } → { matched, context_updates? }
// ---------------------------------------------------------------------------
const TRIGGERS = {
  "demo.OnKeyword": ({ data, update }) => {
    const text = (update && update.message && update.message.text) || "";
    const kw = String(data.keyword ?? "").trim();
    const matched = kw !== "" && text.toLowerCase().includes(kw.toLowerCase());
    return { matched, context_updates: matched ? { matched_keyword: kw } : {} };
  },
};

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 dispatch
// ---------------------------------------------------------------------------
function handleRpc(req) {
  const { method, params, id } = req;
  const reply = (result) => ({ jsonrpc: "2.0", id, result });
  const fail = (code, message, data) => ({ jsonrpc: "2.0", id, error: { code, message, data } });

  if (method === "describe") {
    return reply({ module: MODULE, nodes: NODES });
  }
  if (method === "node.execute") {
    const fn = EXECUTORS[params && params.type];
    if (!fn) return fail(-32601, `unknown node type: ${params && params.type}`);
    try {
      return reply(fn(params || {}));
    } catch (e) {
      return fail(-32000, e && e.message ? e.message : "execute failed");
    }
  }
  if (method === "trigger.match") {
    const fn = TRIGGERS[params && params.type];
    if (!fn) return reply({ matched: false });
    try {
      return reply(fn(params || {}));
    } catch (e) {
      return fail(-32000, e && e.message ? e.message : "match failed");
    }
  }
  return fail(-32601, `method not found: ${method}`);
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, module: MODULE.id }));
  }
  if (req.method === "POST" && req.url === "/rpc") {
    if (AUTH_TOKEN) {
      const auth = req.headers["authorization"] || "";
      if (auth !== `Bearer ${AUTH_TOKEN}`) {
        res.writeHead(401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "unauthorized" } }));
      }
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let parsed;
      try {
        parsed = JSON.parse(body || "{}");
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }));
      }
      const out = handleRpc(parsed);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(out));
    });
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, () => {
  console.log(`[demo-module] JSON-RPC 2.0 listening on :${PORT} (/rpc, /health)`);
});

// build trigger

// retrigger 2
