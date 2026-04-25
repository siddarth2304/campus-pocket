DO $$
BEGIN
  UPDATE auth.users 
  SET encrypted_password = crypt('password', gen_salt('bf'))
  WHERE email = 'admin@demo.com';
END $$;
