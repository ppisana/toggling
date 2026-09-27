# Knockout Golf Scheduler

App para organizar torneos de knock-out (llaves) de WGT dentro de un Country Club
con jugadores repartidos en distintos husos horarios. Frente a los demás socios
del club cada jugador se identifica solo por nickname y avatar — el email que
usan para entrar es privado, solo sirve para el login y nunca se muestra.

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
- Supabase (Postgres + Auth por magic link + Realtime) como backend, sin servidor propio

## Login

Cada jugador entra con su email (magic link, sin contraseña): al crear o unirse
a un club, la app le pide el email, manda un link de acceso, y al hacer click
queda logueado en ese dispositivo/navegador — sin volver a pedirle nada. Ese
email vive únicamente en `auth.users` de Supabase; ninguna pantalla de la app
lo muestra a otros socios, solo nickname + avatar.

Los perfiles creados antes de este cambio (login anónimo) ven un cartel para
"asegurar su cuenta" agregando un email, sin perder su club ni su historial.

## Setup

1. `npm install`
2. Copiá `.env.example` a `.env` (ya apunta al proyecto Supabase del club).
3. **Pasos manuales en el dashboard de Supabase** (Authentication):
   - *Sign In / Providers → Email* debe estar activado (suele venir activado
     por defecto).
   - *URL Configuration → Redirect URLs*: agregá la URL desde donde vas a
     correr la app (por ejemplo `http://localhost:5173`, y más adelante la URL
     de producción). Sin esto el magic link rebota y no vuelve a loguear.
4. `npm run dev`

## Base de datos

El esquema completo (tablas, políticas RLS y funciones RPC) vive en
`supabase/migrations/`. Todas las escrituras sensibles (crear club, generar
cuadro, proponer/aceptar horario, reportar resultado) pasan por funciones
`SECURITY DEFINER` que validan permisos internamente — las tablas no tienen
políticas de INSERT/UPDATE abiertas por RLS, solo SELECT para los miembros
del club correspondiente.
