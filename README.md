# Botmother Demo Module (reference)

Botmother **tashqi module** namunasi — universal **JSON-RPC 2.0** kontraktini ko'rsatadi. Engine noma'lum node turini shu modulга yuboradi.

## Nima beradi
- `demo.Echo` — kiritilgan matnni `echo_output` o'zgaruvchisiga yozadi.
- `demo.Upper` — matnni KATTA harfga aylantirib `upper_output` ga yozadi.

## Ishga tushirish (lokal)
```bash
node server.js          # :8100 da /rpc va /health
# yoki
docker build -t demo-module . && docker run -p 8100:8100 demo-module
```

## JSON-RPC kontrakt
`POST /rpc`, `Content-Type: application/json`, ixtiyoriy `Authorization: Bearer <MODULE_AUTH_TOKEN>`.

**describe** — node manifestlari (constructor formatida):
```json
{"jsonrpc":"2.0","id":1,"method":"describe","params":{}}
→ {"result":{"module":{"id":"demo",...},"nodes":[<NodeManifest>...]}}
```

**node.execute** — node business logic:
```json
{"jsonrpc":"2.0","id":2,"method":"node.execute",
 "params":{"type":"demo.Echo","data":{"input":"salom"},"context":{...},"chat_id":123}}
→ {"result":{"context_updates":{"echo_output":"salom"},"exit_output":""}}
```

`GET /health` → `200 {"ok":true}`.

## Yangi modul yozish
1. `module.yaml` — id/name/version, runtime (port, Dockerfile), `provides.nodes`.
2. `server.js` — `NODES` (constructor manifest formati, FAQAT standart field type) + `EXECUTORS` (har node turi uchun `node.execute`).
3. Node turlarini modul id bilan namespace qil: `<moduleId>.<NodeName>`.

> Triggerlar (`trigger.match` + push) FAZA 2'da qo'shiladi.

## Tez sinov
```bash
curl -s localhost:8100/rpc -d '{"jsonrpc":"2.0","id":1,"method":"describe"}' | jq
curl -s localhost:8100/rpc -d '{"jsonrpc":"2.0","id":2,"method":"node.execute","params":{"type":"demo.Upper","data":{"text":"salom"}}}' | jq
```
