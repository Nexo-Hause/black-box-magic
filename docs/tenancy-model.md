# Modelo de Tenencia — Black Box Magic

> Documento de diseño formal. Fuente de verdad de la jerarquía multi-tenant.
> Entrada de WS-MT (ver `docs/roadmap-2026-05.md`). Versión 1.0 — 2026-05-18.
> Este doc define **qué** se construye; el **cómo** ejecutable vive en `spec/04-ws-mt-multitenant.md`.

---

## 1. Modelo de negocio (decidido)

**B2B2B.** BBM vende capacidad de análisis visual. No la vende directo al cliente final;
la vende a través de **cuentas** que la revenden o la consumen para sus propios clientes.

- **Ubiqo** es una **cuenta `reseller`**: revende BBM a FOTL y ~12 prospectos de Evidence.
- **FOTL** es un **cliente final** bajo la cuenta Ubiqo.
- BBM puede tener otras cuentas a futuro (resellers distintos, o cuentas `direct` que
  consumen para sí mismas). Eso es **schema-ready, lógica diferida** (ver §6).

---

## 2. Jerarquía (2 niveles)

```
Cuenta (account)            type: 'reseller' | 'direct'
  └─ Cliente final (client) 1 cuenta → N clientes
       └─ Datos             planogramas, incidencias, capturas, configs
```

- Una **cuenta** agrupa clientes y posee la credencial de Evidence con la que se
  descargan fotos (token cifrado por cuenta).
- Un **cliente** es la entidad cuyos datos se aíslan (FOTL ve solo lo de FOTL).
- Todo dato de negocio (`bbm_incidences`, `bbm_ubiqo_captures`, `bbm_planograms`,
  `bbm_client_configs`) cuelga de un cliente, y por transitividad de una cuenta.

---

## 3. Roles (3, todos en el MVP)

| Rol | Quién (MVP) | Ve | Implementado en MVP |
|-----|-------------|----|---------------------|
| `bbm_admin` | Equipo BBM (Gonzalo) | **Todo** — todas las cuentas y clientes | Sí |
| `reseller_admin` | Ubiqo (Enrique) | **Todos los clientes de su cuenta** (FOTL + futuros prospectos bajo Ubiqo) | Sí |
| `client_user` | FOTL (Carlos) | **Solo su cliente** (FOTL) | Sí |

- El rol y el scope (`account_id`, `client_id`) se resuelven en el **verify de la
  sesión**, no se confían desde el request.
- `reseller_admin` necesita un **selector de cliente** en el dashboard (su cuenta
  tiene N clientes). `client_user` no tiene selector (un solo cliente). `bbm_admin`
  tiene selector de cuenta + cliente.

---

## 4. Entidades canónicas (decidido: tablas, no columnas pegadas)

> Razón: el aislamiento de datos se construye sobre una base limpia, no se retrofitea.
> La migración 008 es provisional (DROP+recrear OK, sin datos prod) → la ventana barata
> para introducir tenencia canónica es **ahora**, antes de tener datos de producción.

### `bbm_accounts`
| Columna | Tipo | Nota |
|---|---|---|
| `id` | UUID PK | |
| `type` | TEXT NOT NULL | `'reseller'` \| `'direct'` |
| `name` | TEXT NOT NULL | "Ubiqo" |
| `evidence_api_token` | TEXT | Cifrado con el patrón AES-256-GCM de `src/lib/ubiqo/crypto.ts` (mismo patrón que `decryptFirma`). Nullable (cuentas `direct` sin Evidence). |
| `created_at` | TIMESTAMPTZ | |

**Seed MVP:** una fila — Ubiqo (`type='reseller'`).

### `bbm_clients`
| Columna | Tipo | Nota |
|---|---|---|
| `id` | UUID PK | |
| `account_id` | UUID FK → `bbm_accounts(id)` NOT NULL | |
| `client_key` | TEXT UNIQUE NOT NULL | reconcilia con `bbm_planograms.client_key` y `bbm_client_configs.client_id` existentes |
| `name` | TEXT NOT NULL | "Fruit of the Loom" |
| `created_at` | TIMESTAMPTZ | |

**Seed MVP:** una fila — FOTL bajo la cuenta Ubiqo. `client_key` = el valor ya usado
en `bbm_planograms` para FOTL (reconciliar contra el dato real al migrar, no inventar).

### `bbm_users` (reemplaza `DASHBOARD_ALLOWED_EMAILS`)
| Columna | Tipo | Nota |
|---|---|---|
| `email` | TEXT PK | normalizado lowercase |
| `role` | TEXT NOT NULL | `'bbm_admin'` \| `'reseller_admin'` \| `'client_user'` |
| `account_id` | UUID FK → `bbm_accounts(id)` | NULL para `bbm_admin` (ve todo) |
| `client_id` | UUID FK → `bbm_clients(id)` | solo para `client_user`; NULL para los otros |
| `created_at` | TIMESTAMPTZ | |

**Seed MVP:** Gonzalo (`bbm_admin`), Enrique (`reseller_admin`, account=Ubiqo),
Carlos (`client_user`, client=FOTL). Emails reales se confirman al migrar (no inventar).

### Columnas de tenencia en tablas de datos
- `bbm_incidences`: agregar `account_id UUID`, `client_id UUID` (FK, NOT NULL tras backfill).
- `bbm_ubiqo_captures`: agregar `account_id UUID`, `client_id UUID` (FK, NOT NULL tras backfill).
- `bbm_planograms.client_key` y `bbm_client_configs.client_id` ya son nivel cliente:
  se mantienen y se reconcilian contra `bbm_clients` (no se borran columnas).

---

## 5. Enforcement (decidido: app-layer primario, RLS defensa en profundidad)

**El service-role key de Supabase bypasea RLS** (ver `.claude/rules/supabase.md`).
Por lo tanto el aislamiento NO puede depender solo de RLS.

1. **Primario — helper centralizado de scoping (app-layer).** Toda lectura de datos
   del dashboard pasa por un único helper que recibe la sesión resuelta (`role`,
   `account_id`, `client_id`) y agrega el filtro de tenencia a la query. Ninguna
   query del dashboard consulta Supabase sin pasar por el helper.
2. **Defensa en profundidad — RLS.** Policies por `account_id`/`client_id` encima,
   por si una query futura olvida el helper. No es la barrera primaria.
3. **Estampado en ingest.** El ingest deriva `client_id`/`account_id` de la cadena
   `form_id → bbm_planogram_assignments → planogram → client → account` y los
   **estampa en la fila** al crearla. Los datos nacen con tenencia, no se infiere
   al leer.

**Superficie de leak = prioridad máxima de tests.** Suite de aislamiento obligatoria:
`client_user` NO ve otro cliente · `reseller_admin` SÍ ve los suyos y NO los de otra
cuenta · `bbm_admin` ve todo. Es el criterio de cierre de WS-MT.

---

## 6. Schema-ready vs implementado en el MVP

| Capacidad | Schema soporta | Lógica en MVP |
|---|---|---|
| Cuenta `reseller` (Ubiqo) con N clientes | Sí | **Sí** |
| 3 roles con scoping | Sí | **Sí** |
| Aislamiento de datos por cliente | Sí | **Sí** |
| Múltiples cuentas | Sí (FK + helper genérico) | No — solo Ubiqo seedeada |
| Cuentas `direct` (consumo propio) | Sí (`type='direct'`) | No |
| Onboarding de cuentas/clientes (UI) | Sí | No — seed manual SQL |
| Billing/cuota por cuenta | No | No — backlog |
| Rotación de token por cuenta | Sí (`evidence_api_token` por fila) | No — token único en env todavía |
| Fairness de cola por tenant | — | Entra con BullMQ (WS1), no aquí |

**Regla de diseño:** el esquema y el helper se escriben **genéricos para N cuentas/
clientes**; solo se *seedea* y se *expone* lo del MVP (Ubiqo→FOTL). Agregar una
cuenta nueva post-MVP = INSERT + seed de usuarios, sin recrear esquema ni migrar datos.

---

## 7. Impacto en auth existente

- `src/lib/cookie.ts` (`signCookie`/`verifyCookie`, HMAC timing-safe) **se extiende,
  no se reescribe**: tras verificar la cookie, resolver `role`+scope desde `bbm_users`
  por email.
- `DASHBOARD_ALLOWED_EMAILS` (hoy en `planogram/upload|list|status` + `demo/share`)
  **se reemplaza** por lookup en `bbm_users`: un email sin fila = 403. El helper de
  scoping sustituye al check plano `isAllowedEmail()`.
- `src/lib/onboarding/auth.ts` (JWT jose) es auth separada de onboarding — **no se
  toca** en WS-MT.

---

## 8. Riesgos residuales

- **Reconciliación `client_key`:** el valor real de FOTL en `bbm_planograms` debe
  leerse del dato, no asumirse. Si hay más de un `client_key` FOTL (caballeros/damas),
  decidir 1 cliente con N planogramas (correcto) vs N clientes (incorrecto) → 1 cliente.
- **Backfill NOT NULL:** agregar `client_id` NOT NULL a tablas con datos requiere
  backfill antes del constraint. Como 008 es provisional sin datos prod, se recrea
  limpio (sin backfill) — confirmar "sin datos prod" al ejecutar, no asumir.
- **RLS no es barrera primaria:** si el helper se omite en una query futura, RLS es
  la única red. Lint/review debe rechazar queries directas a tablas de datos fuera
  del helper.
