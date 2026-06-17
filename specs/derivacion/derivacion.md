# Spec: Flujo de derivación al administrador

## Problema

Cuando el agente de clientes no puede resolver una consulta, hoy ocurre lo siguiente:
1. El bot llama `delegate_to_admin` con un `reason` genérico
2. `notifyDelegation` envía un WhatsApp **desde el número del negocio** al admin con poco contexto
3. El bot hace un "turno final" y le dice algo al cliente (ej: "te derivo a un asesor")
4. El admin recibe un mensaje suelto, sin hilo, desde el número del negocio

**Problemas concretos:**
- La notificación llega desde el número del negocio, no desde AgendAI → no hay hilo unificado para el admin
- El `reason` es genérico, el admin no tiene contexto real de qué pasó
- El bot sigue hablando al cliente después de derivar (turno final innecesario)

---

## Solución propuesta

### Flujo nuevo

```
Cliente → bot no puede resolver
              ↓
   Bot llama delegate_to_admin(reason: "resumen completo de la situación")
              ↓
   [CÓDIGO] notificación sale por número de AgendAI
   [CÓDIGO] notificación inyectada en admin_conversaciones (hilo unificado)
   [CÓDIGO] no hay "turno final" — bot queda en silencio
              ↓
   Jonatan recibe en AgendAI:
     "⚠️ Expreso Polar — intervención necesaria
      Cliente: Juan García (+5491155556666)
      [resumen escrito por el agente]"
              ↓
   Jonatan contacta al cliente directamente desde su WhatsApp personal
   (fuera del sistema — la conversación del cliente queda marcada como 'derivada')
```

### Separación código / prompt

**Cambios de código (universales, aplican a todos los negocios):**

1. `notifyDelegation` envía desde `AGENDAI_WHATSAPP_FROM` en vez del número del negocio
2. La notificación se inyecta en `admin_conversaciones` como mensaje del sistema, para que Jonatan tenga contexto cuando abra AgendAI
3. `run-loop.js`: el "turno final" (`if (delegated)`) se elimina o se controla con un parámetro `skipFinalTurn`
4. El contenido de la notificación incluye: nombre del cliente, teléfono, y el `reason` completo

**Cambios de prompt (por negocio, cada dueño decide):**

- Qué decirle al cliente cuando se deriva ("Te contactamos pronto" / silencio / mensaje custom)
- Las condiciones para llamar `delegate_to_admin` (cuándo escalar)
- La instrucción de escribir un `reason` rico y completo al llamar la tool

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/agent/tools.js` | `delegate_to_admin` schema: +`clientName`, +`clientPhone`, `reason` más descriptivo |
| `src/agent/run-loop.js` | Parámetro `finalTurnOnDelegate = false`; silencia el bot tras derivar |
| `src/agent/runner.js` | Usa `getAdmins()`; inyecta en `admin_conversaciones`; pasa `clientName`/`clientPhone` a `notifyDelegation` |
| `src/services/admin.service.js` | Nueva función `getAdmins(businessId)` → `[{id, telefono}]` |
| `src/services/notifications.service.js` | `notifyDelegation` usa solo `AGENDAI_WHATSAPP_FROM`; acepta `clientName` |
| `src/webhook/handler.js` | Guard `if (reply)` antes de `provider.send` (reply puede ser null tras derivar) |
| `src/webhook/agendai.js` | Remover logs de debug |
| Prompts de cada negocio | Instrucción de `reason` rico + comportamiento post-derivación |

---

## Casos de uso

1. Cliente pregunta algo fuera del scope del negocio (ej: zona de cobertura no cubierta)
2. Cliente quiere negociar precio o condiciones especiales
3. Cliente tiene una queja o reclamo
4. Cliente pide algo que requiere coordinación manual (ej: urgencia, visita inmediata)

---

## Decisiones de arquitectura (plan-eng-review 2026-06-17)

| Decisión | Elección | Razón |
|---|---|---|
| D1 — Dónde inyectar en admin_conversaciones | `runner.js onSpecialTool` | Mantiene SRP: notifications.service solo envía mensajes externos |
| D2 — Campos del tool delegate_to_admin | Agregar `clientName` + `clientPhone` explícitos | Notificación confiable sin parsear el historial |
| D3 — Turno final tras delegación | Parámetro `finalTurnOnDelegate = false` | Flexible: default silencio, configurable por runner si se necesita |

**Inyección en admin_conversaciones:** se inyecta como par `user/assistant` para mantener alternación correcta en la API de Anthropic. El admin ve el contexto al abrir AgendAI.
