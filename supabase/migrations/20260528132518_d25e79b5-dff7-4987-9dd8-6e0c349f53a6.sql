CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  generated_friend_id text;
BEGIN
  LOOP
    generated_friend_id := '#LEI-' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE friend_id = generated_friend_id);
  END LOOP;

  INSERT INTO public.profiles (id, display_name, friend_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    generated_friend_id
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();