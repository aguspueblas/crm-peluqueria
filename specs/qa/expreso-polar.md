# QA — Expreso Polar: Escenarios de conversación

Checklist manual para validar el agente en WhatsApp (sandbox Twilio).
Antes de cada grupo de pruebas: limpiar el historial del negocio desde la DB o via endpoint admin.

**Leyenda:**
- `[ ]` — pendiente de probar
- `[x]` — aprobado
- `[!]` — falla detectada (anotar detalle debajo)

---

## Preparación

- [ ] Limpiar historial de Expreso Polar en Railway antes de cada sesión de pruebas
- [ ] Confirmar que el número sandbox de Twilio está asignado a Expreso Polar
- [ ] Confirmar que Jonathan Javier tiene horarios cargados y activos

---

## 1. Saludo inicial

| # | Acción del cliente | Resultado esperado |
|---|---|---|
| 1.1 | No escribe nada (primera apertura del chat) | El agente saluda: "¡Hola! Bienvenido a Expreso Polar ¿En qué te podemos ayudar?" |
| 1.2 | El cliente arranca directo: "quiero instalar un aire" | El agente saluda Y en el mismo mensaje pregunta los datos del Bloque 1 (frigorías, tipo de lugar, barrio cerrado) |

---

## 2. Instalación / Desinstalación — Casa

### Flujo completo (golden path)

| # | Acción del cliente | Resultado esperado |
|---|---|---|
| 2.1 | "quiero instalar un aire" | Bloque 1: pregunta frigorías + tipo de lugar + barrio cerrado en un solo mensaje |
| 2.2 | "3.000 frigorías, en una casa, no es barrio cerrado" | Bloque 2: pregunta ubicación unidad exterior (altura > 4m), cantidad de equipos, materiales — todo en un mensaje |
| 2.3 | "la unidad va en la pared, a unos 2 metros, es 1 solo equipo, sí quiero cotizar materiales" | Ofrece 3 slots de días distintos (get_next_slots) |
| 2.4 | Elige un slot: "el martes" | Pide dirección: "Para cerrar el turno, ¿me pasás la dirección?" |
| 2.5 | Da la dirección: "Mitre 450, Tigre" | Si no tiene nombre registrado: pide nombre. Si ya tiene nombre: muestra confirmación final con dirección real |
| 2.6 | Da nombre (si se pidió): "Jorge" | Muestra confirmación final: "Anotamos el turno para el martes a las Xhs — instalación en Mitre 450, Tigre. ¿Confirmamos?" |
| 2.7 | "sí" / "dale" | Llama a create_appointment. Responde solo después de obtener el ID |
| 2.8 | (create_appointment exitoso) | Confirma turno + pide seña: $10.000, transferencia o Mercado Pago, comprobante por acá |

### Variantes — Casa

| # | Variante | Resultado esperado |
|---|---|---|
| 2.A | Unidad exterior a más de 4 metros | Informa adicional: "Trabajar a esa altura tiene un adicional que confirmamos antes de agendar. ¿Seguimos?" + registra en observaciones |
| 2.B | Barrio cerrado | Pregunta si el seguro tiene cláusula de no repetición. Si sí → registra en observaciones |
| 2.C | Más de 3 equipos | "Ese trabajo nos lleva el día completo. Te recomendamos agendarlo para un sábado. ¿Te viene bien?" |

---

## 3. Instalación / Desinstalación — Departamento

| # | Acción del cliente | Resultado esperado |
|---|---|---|
| 3.1 | "quiero instalar un split en mi depto" | Bloque 1: frigorías + tipo de lugar (depto) + barrio cerrado |
| 3.2 | "2.500 frigorías, depto, no barrio cerrado" | Bloque 2: pregunta acceso unidad exterior (vacío, balcón, pulmón, ventana) + cantidad de equipos |
| 3.3 | "está en el balcón, 1 equipo" | Ofrece 3 slots de días distintos |
| 3.4 | Elige un slot | Pide dirección |
| 3.5 | Da dirección y nombre si no tiene | Muestra confirmación final con dirección real (no placeholder) |
| 3.6 | Confirma | Llama create_appointment → confirma + pide seña |

---

## 4. Instalación / Desinstalación — Comercio

| # | Acción del cliente | Resultado esperado |
|---|---|---|
| 4.1 | "necesito instalar un equipo en mi local" | Bloque 1: frigorías + tipo de lugar (comercio) + barrio cerrado |
| 4.2 | "4.000 frigorías, comercio, no barrio cerrado" | Bloque 2: pregunta si puede ir en horario comercial o fuera de horario + cantidad de equipos |
| 4.3 | "fuera de horario, 1 equipo" | "Trabajamos de noche para locales que no pueden recibirnos de día." + ofrece 3 slots |
| 4.4 | Elige slot | Pide dirección |
| 4.5 | Da dirección | Confirmación final con dirección real → create_appointment → seña |

---

## 5. Mantenimiento

### Flujo completo

| # | Acción del cliente | Resultado esperado |
|---|---|---|
| 5.1 | "necesito hacer el mantenimiento del aire" | Bloque 1: frigorías + tipo de lugar + barrio cerrado |
| 5.2 | "3.000 frigorías, casa" | Bloque 2: pregunta unidad exterior a más de 4m |
| 5.3 | "no, está a 2 metros" | Ofrece 3 slots de días distintos |
| 5.4 | Elige slot | Pide dirección |
| 5.5 | Da dirección y nombre | Confirmación final → confirma → create_appointment → seña |

### Variantes — Mantenimiento

| # | Variante | Resultado esperado |
|---|---|---|
| 5.A | El cliente pregunta qué incluye el mantenimiento | Explica en detalle solo cuando lo pide. No en el saludo ni en la oferta |
| 5.B | Comercio fuera de horario | Misma lógica que instalación: observaciones "Horario nocturno" |

---

## 6. Reparación

### Flujo completo

| # | Acción del cliente | Resultado esperado |
|---|---|---|
| 6.1 | "el aire no enfría" / "hace ruido raro" | Bloque 1: "¿Qué está pasando con el equipo? Contanos un poco más." — no interrumpe con opciones |
| 6.2 | Describe síntomas libremente | Bloque 2: pregunta tipo de lugar (casa/depto/comercio) |
| 6.3 | "en casa" | Antes de ofrecer turnos: explica visita técnica con costo (precio de Reparación - Visita). "¿Agendamos la visita?" |
| 6.4 | "sí" | Ofrece 3 slots de días distintos |
| 6.5 | Elige slot | Pide dirección |
| 6.6 | Da dirección y nombre | Confirmación final con síntomas + dirección real → create_appointment → seña |

---

## 7. Precio

| # | Acción del cliente | Resultado esperado |
|---|---|---|
| 7.1 | "¿cuánto sale la instalación?" (antes de dar frigorías) | No da precio. Informa que la cotización depende de las frigorías: "Necesitamos saber las frigorías del equipo para darte el precio." |
| 7.2 | Pregunta precio después de dar frigorías | Dice el precio del servicio correspondiente |
| 7.3 | Pregunta precio de un servicio que no tiene precio en DB | "El precio lo coordinamos con vos directamente, ¿te parece si te contactamos?" + llama notify_admin |

---

## 8. Cotización de materiales

| # | Acción del cliente | Resultado esperado |
|---|---|---|
| 8.1 | "sí, quiero cotizar los materiales" durante instalación | Registra en observaciones. NO da precio ni explicación en el momento |
| 8.2 | "¿por qué los materiales no están incluidos?" | **Pendiente confirmar con Jonatan** — por ahora: llama notify_admin con el motivo |

---

## 9. Disponibilidad

| # | Escenario | Resultado esperado |
|---|---|---|
| 9.1 | get_next_slots devuelve 3+ slots en días distintos | Muestra exactamente 3 opciones, una por día |
| 9.2 | Hay múltiples slots el mismo día | Solo muestra el primero de ese día; los demás días se cubren con los siguientes |
| 9.3 | El cliente pide un día específico: "¿tenés el jueves?" | Llama get_availability con la fecha del jueves. Muestra los slots de ese día |
| 9.4 | get_next_slots devuelve lista vacía | Avisa que no hay disponibilidad + llama notify_admin + "En cuanto se libere un espacio te avisamos" |
| 9.5 | El cliente pide un día sin disponibilidad | "No tenemos ese día disponible. Las opciones más cercanas son: [slots]" |

---

## 10. Seña

| # | Escenario | Resultado esperado |
|---|---|---|
| 10.1 | Turno creado exitosamente | Pide seña de $10.000. Menciona transferencia o Mercado Pago. Comprobante por el chat |
| 10.2 | Cliente manda comprobante (imagen o texto con monto) | Llama notify_admin "posible comprobante de seña". Responde que recibieron y confirman en 24hs |
| 10.3 | Cliente dice que solo tiene efectivo / no puede pagar digital | No insiste. Llama notify_admin. "Sin problema, el equipo se pone en contacto" |

---

## 11. Nombre del cliente

| # | Escenario | Resultado esperado |
|---|---|---|
| 11.1 | Cliente sin nombre registrado | Pide nombre UNA SOLA VEZ: "¿A nombre de quién hacemos la reserva?" + llama update_client |
| 11.2 | Cliente con nombre ya registrado | No vuelve a pedir el nombre. Lo usa internamente sin mencionarlo en ningún mensaje |
| 11.3 | El nombre no aparece en la confirmación ni en ningún mensaje al cliente | La confirmación muestra servicio + dirección, nunca el nombre del cliente |

---

## 12. Casos borde — Frigorías

| # | Escenario | Resultado esperado |
|---|---|---|
| 12.1 | El cliente no sabe las frigorías | "¿Recordás la marca y modelo? Con eso lo buscamos." |
| 12.2 | Tampoco sabe la marca/modelo | Llama notify_admin "No se pudieron determinar las frigorías". Responde: "No hay problema, el equipo se va a contactar para ayudarte." |

---

## 13. Identificación del servicio

| # | Escenario | Resultado esperado |
|---|---|---|
| 13.1 | El cliente no deja claro qué necesita después de 2 intercambios | Llama notify_admin "No se pudo identificar el servicio necesario". Responde que alguien del equipo se contacta |
| 13.2 | El cliente pide algo fuera del catálogo (ej: "¿instalan calefactores?") | No inventa servicio. Llama notify_admin y deriva si aplica |

---

## 14. Notify admin / Derivación

| # | Escenario | Resultado esperado |
|---|---|---|
| 14.1 | Cliente pregunta algo que el agente no puede responder | Llama notify_admin antes de responder. Sigue respondiendo (NO deja de contestar) |
| 14.2 | Cliente dice "quiero hablar con una persona" | "Enseguida te contacta alguien del equipo." + llama delegate_to_admin + deja de responder |
| 14.3 | Cliente hace una queja o reclamo | Llama notify_admin. Responde con empatía. Sigue disponible |

---

## 15. Tono y estilo

| # | Verificar | Resultado esperado |
|---|---|---|
| 15.1 | El agente NO usa "Perfecto" como muletilla | Ningún mensaje empieza con "Perfecto" |
| 15.2 | El agente NO usa frases de call center | Sin "procederé a", "lamentablemente", "¿desea que...?" |
| 15.3 | Mensajes cortos y directos | Ningún mensaje supera 4-5 líneas sin razón |
| 15.4 | El agente NO revela que es una IA | Si el cliente pregunta, no confirma ni niega ser un bot |
| 15.5 | Primera persona del plural | "anotamos", "te confirmamos", "estamos pendientes" |
| 15.6 | El precio NO aparece en el saludo | El primer mensaje no menciona precios |

---

## 16. Regla crítica de creación de turno

| # | Verificar | Resultado esperado |
|---|---|---|
| 16.1 | El agente NO confirma el turno antes de llamar a create_appointment | Solo confirma después de recibir el ID válido |
| 16.2 | El agente NO responde nada entre el "sí" del cliente y el resultado de create_appointment | No hay mensaje intermedio entre confirmación y resultado |
| 16.3 | Si create_appointment falla | "Tuvimos un problema técnico. ¿Lo intentamos de nuevo?" |

---

## 17. Historial de ejecución

| Fecha | Escenarios aprobados | Fallas detectadas | Notas |
|---|---|---|---|
| — | — | — | Pendiente primera ejecución |
