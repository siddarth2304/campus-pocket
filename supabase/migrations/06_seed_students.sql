DO $$
DECLARE
  school_uuid UUID;
  student_names TEXT[] := ARRAY[
    'AADHAV GUGAN D U', 'ABHINAV DILEEP', 'ADARSH BINU', 'AJITH ASHOK', 'ALEENA SEBASTIAN',
    'ANAMIKA V MENON', 'ANNA OUSEPH', 'ARJUN RAJESH', 'AYYAPPADAS M T', 'BANTUPALLI HARSHAVARDHAN',
    'BHAVANA P H', 'BOYIGADDA PRAVALLIKA', 'BUSSA SURYA', 'CHINTALAPALLI PATTA CHAITANYA KRISHNA',
    'D ADITYA KIRAN', 'DEON SAJAN', 'EARLAPALLY SAHITH SIDDARTH', 'FAYHA NAZMINE', 'GARLAPATI TEJASWINI',
    'GOLLAPALLI YASWANTH RAM SARAN', 'HARI SANKAR A', 'HARSHITHA DANDAMUDI', 'JAYANTHI TANMAY',
    'JOHN YOHAN SKARIA', 'JUDITH ANN BENNY', 'KANCHAGARI BELAGAL SAI PRASAD REDDY', 'KARTIK T NAIR',
    'KOTA KARTHIK', 'LEYA PAUL', 'MACHARLA LAXMISHAJITH', 'MANEPALLI POOJITH', 'MARAM SURYAPRAKASH',
    'MITHUN KRISHNA', 'MUKALA GUNA ABHIRAM', 'NALLA LOKESH', 'NEEMA VINOD', 
    'NOOKALA VENKATA DURGA LAKSHMI SADGURU', 'PARTHIV M', 'PENDLY RUSHIKESH', 'POOJA SATHYAN',
    'PRANAV PRADEEP', 'RAMISETTI VENKATA MANIKANTA', 'RISHIKA V PRABHU', 'SABBISETTI KRISHNA VAMSI',
    'SAI KISHEN K M', 'SAI THARUN REDDY NALLALA', 'SAMBANGI RESHMA SRI', 'SAMRIDHI SINGH',
    'SETTIPALLI GOWTHAM', 'SHABREESH M MENON', 'SHAROON JOSEPH', 'SHRAVYA K SURESH', 'SHRIA MANOJ NAIR',
    'SIDHARTH R KRISHNA', 'SINGAMSETTY HARI CHARAN', 'SNEHA V NAMBIAR', 'SOURAV SASIRAJ', 'SRIMITHULA',
    'SURE VENKATA MANOJ KUMAR', 'SYED MUSAFIRUNNISA BEGUM', 'TOTTALI HESHAJA', 'VANI SUGOVIND S R',
    'VASUDEV B', 'VELAMURI SIVA SAI SUBRAHMANYAH RAKSHANN', 'VIGHNESH B', 'YADHU VIPIN MADHILAKATH MADATHIL',
    'YAMPATI SAI SAILESH REDDY', 'Chintalapalli Patta Chetan Krishna'
  ];
  current_name TEXT;
  new_uuid UUID;
  new_email TEXT;
  new_username TEXT;
  i INT;
BEGIN
  -- Get the school ID
  SELECT id INTO school_uuid FROM public.schools LIMIT 1;

  FOR i IN 1..array_length(student_names, 1) LOOP
    current_name := student_names[i];
    new_uuid := gen_random_uuid();
    new_email := 'student' || (i + 1)::text || '@demo.com';
    new_username := substring(replace(lower(current_name), ' ', '_') from 1 for 20);

    -- 1. Insert into auth.users
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('00000000-0000-0000-0000-000000000000', new_uuid, 'authenticated', 'authenticated', new_email, crypt('password', gen_salt('bf')), now(), '{}', '{}', now(), now())
    ON CONFLICT (email) DO NOTHING;

    -- 2. Insert into auth.identities
    INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (new_uuid::text, new_uuid, format('{"sub": "%s", "email": "%s"}', new_uuid::text, new_email)::jsonb, 'email', now(), now(), now())
    ON CONFLICT (provider_id, provider) DO NOTHING;

    -- 3. Insert into public.users
    INSERT INTO public.users (id, username, role, school_id)
    VALUES (new_uuid, new_username, 'student', school_uuid)
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;
