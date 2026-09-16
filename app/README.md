# Knockout Golf Scheduler

App para organizar torneos de knock-out (llaves) de WGT dentro de un Country Club
con jugadores repartidos en distintos husos horarios. Sin emails, sin teléfonos:
cada jugador se identifica solo por nickname y un avatar.

## Qué resuelve

- La administradora crea el club y comparte un **código de invitación**; cada
  jugador entra, elige su nickname (el mismo de WGT), un avatar y su huso
  horario — nada más.
- La administradora arma el **cuadro de knock-out** (sorteo aleatorio,
  incluyendo byes si el número de jugadores es impar) y lo va avanzando ronda
  a ronda a medida que se completan los cruces.
- Cada cruce tiene su propia pantalla donde los dos jugadores **proponen y
  aceptan un horario**, viendo la hora convertida al huso horario de cada
  uno, y un **chat** para coordinar sin depender del chat de WGT.
- El resultado lo reporta cualquiera de los dos jugadores y lo confirma el
  rival (o lo fuerza la administradora si hay disputa).

## Stack

- Vite + React + TypeScript + Tailwind CSS v4
- Supabase (Postgres + Auth anónimo + Realtime) como backend, sin servidor propio

## Setup

1. `npm install`
2. Copiá `.env.example` a `.env` (ya apunta al proyecto Supabase del club).
3. **Paso manual único en Supabase**: en el dashboard del proyecto, andá a
   *Authentication → Sign In / Providers → Anonymous Sign-Ins* y activalo.
   La app inicia sesión de forma anónima automáticamente; sin este toggle
   Supabase rechaza el login.
4. `npm run dev`

## Base de datos

El esquema completo (tablas, políticas RLS y funciones RPC) vive en
`supabase/migrations/`. Todas las escrituras sensibles (crear club, generar
cuadro, proponer/aceptar horario, reportar resultado) pasan por funciones
`SECURITY DEFINER` que validan permisos internamente — las tablas no tienen
políticas de INSERT/UPDATE abiertas por RLS, solo SELECT para los miembros
del club correspondiente.
