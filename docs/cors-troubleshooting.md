# Diagnóstico rápido de CORS e conectividade da API

Quando o formulário de criação de expedição retorna a mensagem "Servidor indisponível ou bloqueio de CORS", normalmente o navegador interrompeu a requisição real por falha no *preflight* ou por problemas de HTTPS/origem. Os comandos abaixo ajudam a identificar rapidamente o ponto de falha e aplicar os ajustes necessários no backend ou no proxy.

## 1. Teste o preflight (OPTIONS)

```bash
curl -i -X OPTIONS https://SEU_API/api/expeditions \
  -H "Origin: https://nicolascavalcanti.github.io" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization"
```

**Esperado** (status 200/204 + cabeçalhos CORS completos):

```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://nicolascavalcanti.github.io
Access-Control-Allow-Methods: GET,POST,OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Vary: Origin
```

Se vier 301/302/4xx/5xx aqui, o problema está no preflight.

## 2. Teste a requisição real (POST)

```bash
curl -i -X POST https://SEU_API/api/expeditions \
  -H "Origin: https://nicolascavalcanti.github.io" \
  -H "Content-Type: application/json" \
  -d '{"trailId":"tr_1","title":"Teste","description":"desc","startDate":"2025-11-20T08:00:00.000Z","endDate":"2025-11-22T18:00:00.000Z","pricePerPerson":100,"maxPeople":10}'
```

O backend deve responder com `201` (ou o status configurado para criação) e repetir pelo menos `Access-Control-Allow-Origin`.

## 3. Ajustes prontos por stack

### Node/Express
```js
import express from "express";
const app = express();
app.use(express.json());

const ORIGIN = "https://nicolascavalcanti.github.io"; // origem exata

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204); // responde o preflight
  next();
});

app.post("/api/expeditions", (req, res) => {
  return res.status(201).json({ id: "exp_" + Date.now() });
});

app.listen(3000);
```

### FastAPI
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
origins = ["https://nicolascavalcanti.github.io"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/expeditions")
def create_exp(data: dict):
    return {"id": "exp_123"}
```

### Flask
```python
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(
    app,
    resources={r"/api/*": {"origins": "https://nicolascavalcanti.github.io"}},
    supports_credentials=False,
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

@app.route("/api/expeditions", methods=["POST", "OPTIONS"])
def create_exp():
    if request.method == "OPTIONS":
        return ("", 204)
    return jsonify({"id": "exp_123"}), 201
```

### Cloudflare Workers
```js
export default {
  async fetch(req, env) {
    const ORIGIN = "https://nicolascavalcanti.github.io";
    const cors = {
      "Access-Control-Allow-Origin": ORIGIN,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Vary": "Origin",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(req.url);
    if (url.pathname === "/api/expeditions" && req.method === "POST") {
      return new Response(JSON.stringify({ id: "exp_" + Date.now() }), {
        status: 201,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    return new Response("Not found", { status: 404, headers: cors });
  },
};
```

### Nginx
```
location /api/ {
    if ($request_method = OPTIONS) {
        add_header Access-Control-Allow-Origin "https://nicolascavalcanti.github.io";
        add_header Access-Control-Allow-Methods "GET,POST,OPTIONS,PUT,DELETE";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization";
        add_header Vary "Origin";
        return 204;
    }
    add_header Access-Control-Allow-Origin "https://nicolascavalcanti.github.io";
    add_header Vary "Origin";
    proxy_pass http://backend_upstream;
}
```

## 4. Armadilhas comuns para revisar

- **Redirects**: evite 301/302 no endpoint (diferença entre `/api/expeditions` e `/api/expeditions/`, `www` vs. sem `www`).
- **Origem incorreta**: o GitHub Pages está em `https://nicolascavalcanti.github.io` (sem `www`).
- **HTTPS obrigatório**: chamadas `http://` serão bloqueadas por mixed content.
- **Credenciais/cookies**: se precisar de `credentials: 'include'`, configure `Access-Control-Allow-Credentials: true` e não use `*` em `Allow-Origin`.
- **Headers customizados**: qualquer header enviado pelo cliente deve estar em `Access-Control-Allow-Headers`.
- **URL relativa no front**: em GitHub Pages use sempre a URL absoluta da API (ex.: `https://api.seu-dominio.com/api/...`).

## 5. Mock rápido para validar o frontend

Para confirmar que o frontend está funcionando, use um endpoint com CORS configurado corretamente:

```bash
curl -i -X OPTIONS https://httpbin.org/post \
  -H "Origin: https://nicolascavalcanti.github.io" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
```

Se o front funcionar apontando para esse mock, o problema está no backend real.
