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

// Modul hujjati (markdown) — describe bilan birga olinadi va backend'da saqlanadi.
const DOCS = `# Demo Module

Botmother tashqi modul namunasi. JSON-RPC 2.0 kontraktini ko'rsatadi.

## Node turlari

### \`demo.Echo\` (action)
Kiritilgan matnni o'zgaruvchiga yozadi.
- **Kirish:** \`input\` — matn (\`{{message.text}}\` yoki literal)
- **Chiqish:** \`echo_output\` o'zgaruvchisi

### \`demo.Upper\` (action)
Matnni KATTA harfga aylantiradi.
- **Kirish:** \`text\` — matn
- **Chiqish:** \`upper_output\` o'zgaruvchisi

### \`demo.AuthHeader\` (action, credential)
Tanlangan credential'dan HTTP auth header quradi (credential ishlatishga namuna).
- **Kirish:** \`api_credential\` — credential (manifestda \`type: "credential"\`)
- **Chiqish:** \`auth_header\` (maskalangan), \`cred_type\` o'zgaruvchilari
- Engine credential_id'ni o'zi resolve qiladi va decrypted sirni \`node.execute\` paytida \`params.credentials.api_credential = {type_key, mode, data}\` sifatida uzatadi. Modulga qo'shimcha token kerak emas.

### \`demo.SetVariable\` (action, dinamik state)
Foydalanuvchi o'zgaruvchi NOMINI o'zi kiritadi, modul o'sha nomli o'zgaruvchiga qiymat yozadi.
- **Kirish:** \`variable_name\` — o'zgaruvchi nomi; \`value\` — qiymat (\`{{message.text}}\` kabi shablon mumkin)
- **Chiqish:** \`{{<variable_name>}}\` — kiritilgan nomli o'zgaruvchi
- Engine \`value\`dagi \`{{...}}\` ni resolve qilib modulga beradi; modul \`context_updates[variable_name] = value\` qaytaradi. Shu tariqa modul oddiy node'lar kabi state'ga dinamik yozadi.

### \`demo.OnKeyword\` (trigger)
Xabar matnida kalit so'z bo'lsa flow'ni ishga tushiradi (event-match).
- **Sozlama:** \`keyword\` — kalit so'z
- **Chiqish:** \`matched_keyword\` o'zgaruvchisi

## Misol
1. \`Kalit so'z kelganda\` (keyword: \`salom\`) → \`Echo\` (input: \`{{message.text}}\`) → \`Matn yuborish\` (\`{{echo_output}}\`)
2. Bot "salom" so'zli xabar kelganda ishlaydi va matnni qaytaradi.
`;

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
    size: { width: 200 },
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
    size: { width: 200 },
    sidebar: { enabled: true, groupId: "integrations", sortOrder: 101, elementType: "demo.Upper" },
    handles: [{ preset: "target-default" }, { preset: "source-default" }],
    content: [{ type: "text", key: "text", label: "Matn", placeholder: "salom" }],
    defaults: { text: "" },
    producesState: ["upper_output"],
    trigger: false,
  },
  // CREDENTIAL ishlatadigan node — manifestda `credential` field so'raydi.
  // Engine credential_id'ni resolve qilib, decrypted sirni node.execute'da
  // params.credentials[field_key] = {type_key, mode, data} sifatida uzatadi.
  {
    type: "demo.AuthHeader",
    status: "runtime",
    category: "integrations",
    titleKey: "module.demo.authheader.title",
    titleFallback: "Auth header (credential)",
    descriptionKey: "module.demo.authheader.desc",
    descriptionFallback: "Tanlangan credential'dan HTTP auth header quradi",
    iconName: "credit-card",
    colorToken: "emerald",
    size: { width: 200 },
    sidebar: { enabled: true, groupId: "integrations", sortOrder: 102, elementType: "demo.AuthHeader" },
    handles: [{ preset: "target-default" }, { preset: "source-default" }],
    content: [
      { type: "credential", key: "api_credential", label: "Credential", required: true },
      { type: "text", key: "note", label: "Izoh", placeholder: "ixtiyoriy" },
    ],
    defaults: { api_credential: "", note: "" },
    producesState: ["auth_header", "cred_type"],
    trigger: false,
  },
  // DINAMIK STATE node — foydalanuvchi o'zgaruvchi NOMINI o'zi kiritadi, modul
  // o'sha nomli o'zgaruvchiga qiymat yozadi. Engine {{...}} ni resolve qilib beradi,
  // shuning uchun value sifatida {{message.text}} kabi shablon ishlatish mumkin.
  {
    type: "demo.SetVariable",
    status: "runtime",
    category: "integrations",
    titleKey: "module.demo.setvariable.title",
    titleFallback: "O'zgaruvchiga yozish",
    descriptionKey: "module.demo.setvariable.desc",
    descriptionFallback: "Kiritilgan nomli o'zgaruvchiga qiymat saqlaydi",
    iconName: "database",
    colorToken: "emerald",
    size: { width: 200 },
    sidebar: { enabled: true, groupId: "integrations", sortOrder: 103, elementType: "demo.SetVariable" },
    handles: [{ preset: "target-default" }, { preset: "source-default" }],
    content: [
      {
        type: "text",
        key: "variable_name",
        label: "O'zgaruvchi nomi",
        placeholder: "masalan: user_choice",
        helpText: "Qiymat shu nomli o'zgaruvchiga yoziladi (keyin {{user_choice}})",
      },
      {
        type: "text",
        key: "value",
        label: "Qiymat",
        placeholder: "{{message.text}} yoki literal matn",
        helpText: "{{...}} bilan boshqa o'zgaruvchilarni ishlatish mumkin",
      },
    ],
    defaults: { variable_name: "", value: "{{message.text}}" },
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
    size: { width: 200 },
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
  // Dinamik kalit: foydalanuvchi kiritgan variable_name nomli o'zgaruvchiga
  // value yoziladi. Engine value'dagi {{...}} ni allaqachon resolve qilgan.
  "demo.SetVariable": ({ data }) => {
    const name = String(data.variable_name ?? "").trim();
    if (!name) {
      return { context_updates: {}, exit_output: "" };
    }
    return { context_updates: { [name]: String(data.value ?? "") }, exit_output: "" };
  },
  // Engine resolve qilib bergan credential sirini ishlatadi.
  // credentials.api_credential = { type_key, mode, data: {...} }
  "demo.AuthHeader": ({ credentials }) => {
    const cred = (credentials && credentials.api_credential) || null;
    if (!cred) {
      return { context_updates: { auth_header: "", cred_type: "" }, exit_output: "" };
    }
    const d = cred.data || {};
    let header = "";
    switch (cred.mode) {
      case "bearer":
        header = `Bearer ${d.token || d.api_key || ""}`;
        break;
      case "basic":
        header = `Basic ${Buffer.from(`${d.username || ""}:${d.password || ""}`).toString("base64")}`;
        break;
      case "header":
        header = String(d.value || "");
        break;
      default:
        header = String(d.api_key || d.token || "");
    }
    // Sirni flow context'iga to'liq oqizmaymiz — maskalaymiz (demo amaliyoti).
    const masked = header.length > 12 ? `${header.slice(0, 12)}…` : header;
    return {
      context_updates: { auth_header: masked, cred_type: cred.type_key || "" },
      exit_output: "",
    };
  },
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
  if (method === "docs") {
    return reply({ markdown: DOCS });
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
