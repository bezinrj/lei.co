
-- user_calendar_events: moderador acesso total
CREATE POLICY "Mods view all events" ON public.user_calendar_events
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'moderador'::app_role));
CREATE POLICY "Mods insert events" ON public.user_calendar_events
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'moderador'::app_role));
CREATE POLICY "Mods update events" ON public.user_calendar_events
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'moderador'::app_role));
CREATE POLICY "Mods delete events" ON public.user_calendar_events
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'moderador'::app_role));

-- Admin policies espelho onde ainda faltam (insert/update/delete)
CREATE POLICY "Admins insert events" ON public.user_calendar_events
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update events" ON public.user_calendar_events
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete events" ON public.user_calendar_events
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- user_topico_progresso
CREATE POLICY "Mods view all progresso" ON public.user_topico_progresso
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'moderador'::app_role));
CREATE POLICY "Staff insert progresso" ON public.user_topico_progresso
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderador'::app_role));
CREATE POLICY "Staff update progresso" ON public.user_topico_progresso
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderador'::app_role));
CREATE POLICY "Staff delete progresso" ON public.user_topico_progresso
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderador'::app_role));

-- user_cronograma_ativacao
CREATE POLICY "Mods view all ativacao" ON public.user_cronograma_ativacao
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'moderador'::app_role));
CREATE POLICY "Staff insert ativacao" ON public.user_cronograma_ativacao
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderador'::app_role));
CREATE POLICY "Staff update ativacao" ON public.user_cronograma_ativacao
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderador'::app_role));
CREATE POLICY "Staff delete ativacao" ON public.user_cronograma_ativacao
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderador'::app_role));

-- user_fonte_progress (já tem SELECT mod; adicionar edição staff)
CREATE POLICY "Staff insert fonte progress" ON public.user_fonte_progress
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderador'::app_role));
CREATE POLICY "Staff update fonte progress" ON public.user_fonte_progress
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderador'::app_role));
CREATE POLICY "Staff delete fonte progress" ON public.user_fonte_progress
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderador'::app_role));

-- user_sessions: staff edição (já tem SELECT mod+admin)
CREATE POLICY "Staff insert sessions" ON public.user_sessions
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderador'::app_role));
CREATE POLICY "Staff update sessions" ON public.user_sessions
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderador'::app_role));
CREATE POLICY "Staff delete sessions" ON public.user_sessions
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderador'::app_role));
