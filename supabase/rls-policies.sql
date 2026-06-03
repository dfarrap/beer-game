-- =============================================================
-- Beer Game · Supabase Row Level Security + Constraints
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- =============================================================

-- ── 1. Habilitar RLS en todas las tablas ─────────────────────
ALTER TABLE sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams       ENABLE ROW LEVEL SECURITY;
ALTER TABLE players     ENABLE ROW LEVEL SECURITY;
ALTER TABLE round_states ENABLE ROW LEVEL SECURITY;

-- ── 2. Políticas para `sessions` ─────────────────────────────
-- Jugadores necesitan leer la sesión por código al unirse
CREATE POLICY "sessions_select_anon"
  ON sessions FOR SELECT TO anon USING (true);

-- Solo el instructor (service_role desde el servidor) crea/modifica sesiones.
-- Nota: Si el frontend anon necesita crear sesiones, usar WITH CHECK (true) temporalmente.
CREATE POLICY "sessions_insert_anon"
  ON sessions FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "sessions_update_anon"
  ON sessions FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── 3. Políticas para `teams` ────────────────────────────────
CREATE POLICY "teams_select_anon"
  ON teams FOR SELECT TO anon USING (true);

CREATE POLICY "teams_insert_anon"
  ON teams FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "teams_delete_anon"
  ON teams FOR DELETE TO anon USING (true);

-- ── 4. Políticas para `players` ──────────────────────────────
CREATE POLICY "players_select_anon"
  ON players FOR SELECT TO anon USING (true);

CREATE POLICY "players_insert_anon"
  ON players FOR INSERT TO anon WITH CHECK (true);

-- Permitir actualizar estado de conexión
CREATE POLICY "players_update_anon"
  ON players FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "players_delete_anon"
  ON players FOR DELETE TO anon USING (true);

-- ── 5. Políticas para `round_states` ─────────────────────────
CREATE POLICY "round_states_select_anon"
  ON round_states FOR SELECT TO anon USING (true);

CREATE POLICY "round_states_insert_anon"
  ON round_states FOR INSERT TO anon WITH CHECK (true);

-- Solo permitir UPDATE cuando order_placed todavía es NULL
-- (impide que un jugador sobreescriba el pedido de otro que ya confirmó)
CREATE POLICY "round_states_update_order_once"
  ON round_states FOR UPDATE TO anon
  USING (order_placed IS NULL)
  WITH CHECK (true);

-- Nota: el avance de ronda (instructor) usa service_role que bypasea RLS.
-- Si el dashboard usa anon key para avanzar rondas (insertar nuevas rondas),
-- se necesita una política adicional o migrar ese endpoint a una Edge Function.
-- Por ahora agregar esta política temporal para el flujo del instructor:
CREATE POLICY "round_states_insert_service"
  ON round_states FOR INSERT TO anon WITH CHECK (true);

-- ── 6. Unique constraint: un rol por equipo ──────────────────
-- Evita que dos jugadores ocupen el mismo rol en el mismo equipo
ALTER TABLE players
  ADD CONSTRAINT unique_team_role UNIQUE (team_id, role);

-- ── 7. Check constraint: pedido razonable ────────────────────
-- Impide valores absurdos en order_placed a nivel de base de datos
ALTER TABLE round_states
  ADD CONSTRAINT order_placed_range
  CHECK (order_placed IS NULL OR (order_placed >= 0 AND order_placed <= 999));

-- =============================================================
-- IMPORTANTE: Después de aplicar esto, la política
-- "round_states_update_order_once" bloquea el avance de rondas
-- por parte del instructor (que actualiza round_states con
-- order_placed ya lleno). Opciones:
--
-- A) Usar la clave service_role en una Edge Function para el
--    avance de rondas (recomendado para producción).
--
-- B) Temporalmente reemplazar la política de UPDATE por:
--    USING (true) WITH CHECK (true)
--    y aceptar que es menos restrictiva pero funcional.
-- =============================================================
