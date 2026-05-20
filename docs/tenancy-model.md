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
| `client_key` | TEXT UNIQUE NOT NULL | **slug canónico del cliente** (ej. `'fotl'`). NO es FK a `bbm_planograms.client_key` (esa columna es legacy y puede tener varios valores por cliente — ver §8). |
| `name` | TEXT NOT NULL | "Fruit of the Loom" |
| `created_at` | TIMESTAMPTZ | |

**Seed MVP:** una fila — FOTL bajo la cuenta Ubiqo, `client_key='fotl'` (slug
canónico nuevo, NO uno de los `bbm_planograms.client_key` legacy). El mapeo de los
`client_key` legacy de FOTL (`fotl_caballeros`, `fotl_damas`) al `client_id` de
esta fila se hace por backfill (ver §8 + spec/04 Tarea 1). El slug exacto se
confirma al migrar; el nombre legible es libre.

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
- **`bbm_planograms`: agregar `client_id UUID` (FK → `bbm_clients(id)`, NOT NULL
  tras backfill).** Es la corrección clave: sin esta columna el helper de scoping
  NO puede filtrar planogramas y `list/route.ts` filtra leak. El backfill mapea
  `bbm_planograms.client_key` legacy → `client_id` (ver §8). `client_key` se
  conserva como atributo legacy/display, **deja de ser la clave de tenencia**.
- `bbm_client_configs.client_id` (TEXT): **fuera de scope de WS-MT** — lo consume
  el flujo de onboarding (`src/lib/onboarding/auth.ts`, auth separada por JWT que
  NO se toca). Se reconcilia/scopea en un workstream posterior si onboarding se
  expone multi-tenant; documentado como diferido, no como olvido.
- **Toda lectura tenant-scoped filtra por `client_id` (UUID), nunca por
  `client_key`.** El helper `scopedQuery` opera sobre `client_id` en las 3 tablas
  (`bbm_incidences`, `bbm_ubiqo_captures`, `bbm_planograms`).

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
| Alta/baja de usuarios (`bbm_users`) | Sí | **No — SQL manual en el MVP, UI diferida.** Agregar un usuario (ej. nuevo prospecto Ubiqo) = INSERT. Decisión deliberada, no falta de scope. |
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

## 8. Decisiones cerradas (post-auditoría 2026-05-18) + riesgos residuales

### Decisión cerrada — FOTL = 1 cliente, N planogramas

`bbm_planograms` ya tiene 2 `client_key` para FOTL (`fotl_caballeros`,
`fotl_damas`). **Decisión:** FOTL es **1 solo cliente** (`bbm_clients` con
`client_key='fotl'`) con **N planogramas** (uno caballeros, uno damas, etc.). Los
`client_key` legacy de `bbm_planograms` NO son clientes distintos.

Implicación de esquema (corrige el crítico de aislamiento):
- `bbm_planograms` recibe `client_id UUID FK` (ver §4). El **backfill** mapea cada
  `client_key` legacy al `client_id` correcto: `fotl_caballeros` → FOTL,
  `fotl_damas` → FOTL (ambos al mismo `client_id`).
- `bbm_clients.client_key` es un slug canónico por cliente, **no** se reconcilia
  1:1 contra `bbm_planograms.client_key`. La relación planograma↔cliente es por
  `client_id`, no por matching de strings.
- El valor canónico del slug y el mapeo legacy→client_id se confirman contra el
  dato real al hacer el seed/backfill (spec/04 Tarea 1), **no se inventan**.

### Riesgos residuales

- **`pick_pending_*` no son tenant-scoped:** las RPC (`008:74-130`) toman la
  siguiente fila por `status` sin filtrar tenant. No es leak de lectura al usuario
  (las lecturas del dashboard van por `scopedQuery`); el procesador estampa
  `client_id` en la fila al ingestar (WS-MT Tarea 5) y resuelve el contexto desde
  esa fila. Las RPC se **retiran en el cierre de WS1** (el worker BullMQ hace el
  pick). Hasta entonces: aceptable, documentado, no bloquea el MVP.
- **Backfill NOT NULL:** agregar `client_id` NOT NULL a tablas con datos requiere
  backfill antes del constraint. Como 008 es provisional sin datos prod, se recrea
  limpio (sin backfill) — confirmar "sin datos prod" al ejecutar, no asumir.
- **RLS no es barrera primaria:** si el helper se omite en una query futura, RLS es
  la única red. Lint/review debe rechazar queries directas a tablas de datos fuera
  del helper.

### Timezone (§O1)
- Render fijo: `America/Mexico_City` (FOTL y Ubiqo operan en México).
- Almacenamiento: UTC (`TIMESTAMPTZ`). Formateo en cliente.
