# Spec: WhatsApp Webhook Layer

## Responsabilidad

Recibir mensajes entrantes de WhatsApp, normalizarlos a un formato común,
identificar el negocio receptor, y enviar respuestas. Es la única capa que
conoce el proveedor (Twilio o Meta). El resto del sistema no sabe de dónde
vienen los mensajes.

---

## Decisión de arquitectura: Adapter Pattern

Para que migrar de Twilio a Meta sea cambiar una línea de configuración,
cada proveedor implementa el mismo contrato:

```js
// Contrato que todo provider debe cumplir
{
  parseIncoming(req) → NormalizedMessage | null,
  send(to, from, text) → Promise<void>,
  setupRouter(router) → void   // monta rutas específicas del provider (ej: GET /webhook para Meta)
}
```

El `WebhookHandler` central recibe el `NormalizedMessage` y nunca sabe
qué proveedor lo originó.

### NormalizedMessage

```js
{
  from:       "5491134567890",   // teléfono del cliente (sin prefijo whatsapp:)
  to:         "5491187654321",   // teléfono del negocio (= negocio.whatsapp_number)
  body:       "hola quiero turno",
  senderName: "Juan Pérez"       // nombre del perfil de WhatsApp
}
```

---

## Estructura de archivos

```
src/
  webhook/
    index.js              — monta el router del provider activo
    handler.js            — lógica central provider-agnóstica
    providers/
      twilio.js           — implementa el contrato para Twilio
      meta.js             — implementa el contrato para Meta (futuro)
```

---

## Provider: Twilio

### Webhook entrante (POST)

Twilio envía un `application/x-www-form-urlencoded` a la URL configurada.

Campos relevantes:
```
From=whatsapp%3A%2B5491134567890   → from = "5491134567890"
To=whatsapp%3A%2B5491187654321    → to   = "5491187654321"
Body=hola+quiero+turno            → body
ProfileName=Juan+P%C3%A9rez       → senderName
```

**parseIncoming:**
```js
function parseIncoming(req) {
  const { From, To, Body, ProfileName } = req.body;
  if (!From || !To || !Body) return null;
  return {
    from:       From.replace('whatsapp:', ''),
    to:         To.replace('whatsapp:', ''),
    body:       Body,
    senderName: ProfileName ?? 'Cliente',
  };
}
```

### Enviar respuesta

```js
// Twilio SDK
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

async function send(to, from, text) {
  await client.messages.create({
    from: `whatsapp:${from}`,
    to:   `whatsapp:${to}`,
    body: text,
  });
}
```

### Seguridad

Twilio firma cada request con HMAC-SHA1 en el header `X-Twilio-Signature`.
Validar con `twilio.validateRequest()` antes de procesar.

```js
const valid = twilio.validateRequest(
  TWILIO_AUTH_TOKEN,
  req.headers['x-twilio-signature'],
  TWILIO_WEBHOOK_URL,
  req.body
);
if (!valid) return res.status(403).end();
```

---

## Provider: Meta WhatsApp Cloud API (futuro)

### Webhook entrante (POST)

Meta envía JSON con estructura anidada:

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "metadata": {
          "display_phone_number": "5491187654321"
        },
        "contacts": [{ "profile": { "name": "Juan Pérez" }, "wa_id": "5491134567890" }],
        "messages": [{ "from": "5491134567890", "text": { "body": "hola" }, "type": "text" }]
      }
    }]
  }]
}
```

**parseIncoming:**
```js
function parseIncoming(req) {
  const value = req.body?.entry?.[0]?.changes?.[0]?.value;
  if (!value?.messages) return null;          // puede ser status update, no mensaje
  const msg = value.messages[0];
  if (msg.type !== 'text') return null;       // MVP: solo texto
  return {
    from:       msg.from,
    to:         value.metadata.display_phone_number,
    body:       msg.text.body,
    senderName: value.contacts?.[0]?.profile?.name ?? 'Cliente',
  };
}
```

### Verificación de webhook (GET)

Meta envía un GET para verificar la URL antes de activar el webhook:

```js
router.get('/webhook', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});
```

### Enviar respuesta

```js
async function send(to, from, text) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${META_PHONE_NUMBER_ID}/messages`,
    { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } },
    { headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` } }
  );
}
```

---

## WebhookHandler central (handler.js)

```js
async function handleIncoming(normalizedMessage) {
  const { from, to, body, senderName } = normalizedMessage;

  // 1. Rate limiting: máx 5 mensajes/min por número de teléfono
  if (isRateLimited(from)) return;

  // 2. Identificar negocio por número de WhatsApp
  const negocio = await Negocio.findOne({ where: { whatsapp_number: to, activo: true } });
  if (!negocio) return;   // número no registrado, ignorar

  // 3. Delegar al agente de IA
  const reply = await agentRunner.run({ negocio, from, senderName, message: body });

  // 4. Enviar respuesta por el mismo provider
  await provider.send(from, to, reply);
}
```

---

## Variables de entorno requeridas

```
# Twilio (MVP)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx
TWILIO_WEBHOOK_URL=https://tu-dominio.com/webhook/whatsapp

# Meta (futuro)
META_ACCESS_TOKEN=EAAxxxxxxx
META_PHONE_NUMBER_ID=123456789
META_VERIFY_TOKEN=tu_verify_token_secreto
META_APP_SECRET=xxxxxxx
```

---

## Ruta en Express

```
POST /webhook/whatsapp   — recibe mensajes de Twilio (o Meta)
GET  /webhook/whatsapp   — verificación de Meta (solo cuando se migre)
```

El provider activo se configura con la variable:
```
WHATSAPP_PROVIDER=twilio   # o "meta"
```

---

## Fuera de scope (MVP)
- Mensajes de media (imagen, audio, documentos) — solo texto
- Read receipts / typing indicators
- Templates de WhatsApp para mensajes proactivos (recordatorios)
- Rate limiting por número de teléfono
