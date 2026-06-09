# TODOS

Deferred work captured during plan reviews. Each item has enough context to pick up in 3 months.

---

## AgendAI — post-MVP / deferred

### TODO-1: Rate limit store separado en webhook AgendAI
**What:** Instanciar un `rateLimitStore` propio en `src/webhook/agendai.js` en vez de compartirlo con el handler de clientes.
**Why:** El webhook de clientes y el de AgendAI hoy compartirían el mismo Map en memoria, lo que los acopla. No es un bug real (son Maps separados por módulo si se instancian ahí), pero vale asegurarlo explícitamente.
**How to apply:** 3 líneas — copiar el patrón de `handler.js` y agregar `const rateLimitStore = new Map()` en el módulo de AgendAI.
**Depends on:** Nada — independiente del resto de AgendAI.

---

### TODO-2: N+1 en admin-prompt.js para admins con múltiples negocios
**What:** `admin-prompt.js` hace queries separadas por cada negocio del admin para obtener servicios y profesionales. Con 5+ negocios son 10+ queries por mensaje.
**Why:** En MVP (1-2 negocios por admin) es irrelevante. Cuando escale, el system prompt tarda notablemente más.
**How to apply:** Reemplazar el loop de queries con un único Sequelize eager loading:
```js
AdminUser.findOne({
  where: { id: adminId },
  include: [{ model: Business, include: [Service, Professional] }]
})
```
**Depends on:** Que primero haya admins con 5+ negocios en producción — no urgente hasta entonces.

---
