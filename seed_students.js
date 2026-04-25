const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const studentNames = [
  "AADHAV GUGAN D U", "ABHINAV DILEEP", "ADARSH BINU", "AJITH ASHOK", "ALEENA SEBASTIAN",
  "ANAMIKA V MENON", "ANNA OUSEPH", "ARJUN RAJESH", "AYYAPPADAS M T", "BANTUPALLI HARSHAVARDHAN",
  "BHAVANA P H", "BOYIGADDA PRAVALLIKA", "BUSSA SURYA", "CHINTALAPALLI PATTA CHAITANYA KRISHNA",
  "D ADITYA KIRAN", "DEON SAJAN", "EARLAPALLY SAHITH SIDDARTH", "FAYHA NAZMINE", "GARLAPATI TEJASWINI",
  "GOLLAPALLI YASWANTH RAM SARAN", "HARI SANKAR A", "HARSHITHA DANDAMUDI", "JAYANTHI TANMAY",
  "JOHN YOHAN SKARIA", "JUDITH ANN BENNY", "KANCHAGARI BELAGAL SAI PRASAD REDDY", "KARTIK T NAIR",
  "KOTA KARTHIK", "LEYA PAUL", "MACHARLA LAXMISHAJITH", "MANEPALLI POOJITH", "MARAM SURYAPRAKASH",
  "MITHUN KRISHNA", "MUKALA GUNA ABHIRAM", "NALLA LOKESH", "NEEMA VINOD", 
  "NOOKALA VENKATA DURGA LAKSHMI SADGURU", "PARTHIV M", "PENDLY RUSHIKESH", "POOJA SATHYAN",
  "PRANAV PRADEEP", "RAMISETTI VENKATA MANIKANTA", "RISHIKA V PRABHU", "SABBISETTI KRISHNA VAMSI",
  "SAI KISHEN K M", "SAI THARUN REDDY NALLALA", "SAMBANGI RESHMA SRI", "SAMRIDHI SINGH",
  "SETTIPALLI GOWTHAM", "SHABREESH M MENON", "SHAROON JOSEPH", "SHRAVYA K SURESH", "SHRIA MANOJ NAIR",
  "SIDHARTH R KRISHNA", "SINGAMSETTY HARI CHARAN", "SNEHA V NAMBIAR", "SOURAV SASIRAJ", "SRIMITHULA",
  "SURE VENKATA MANOJ KUMAR", "SYED MUSAFIRUNNISA BEGUM", "TOTTALI HESHAJA", "VANI SUGOVIND S R",
  "VASUDEV B", "VELAMURI SIVA SAI SUBRAHMANYAH RAKSHANN", "VIGHNESH B", "YADHU VIPIN MADHILAKATH MADATHIL",
  "YAMPATI SAI SAILESH REDDY", "Chintalapalli Patta Chetan Krishna"
];

async function seedStudents() {
  console.log("Starting Student Seeding Process...");

  console.log("Logging in as admin to get school_id...");
  await supabase.auth.signInWithPassword({
    email: 'admin@demo.com',
    password: 'password'
  });

  const { data: schoolData, error: schoolError } = await supabase
    .from('schools')
    .select('id')
    .limit(1)
    .single();

  if (schoolError || !schoolData) {
    console.error("Failed to fetch school:", schoolError);
    return;
  }

  console.log("School ID found:", schoolData.id);
  await supabase.auth.signOut();

  for (let i = 0; i < studentNames.length; i++) {
    const name = studentNames[i];
    const email = `student${i + 2}@demo.com`; // student1 already exists
    const username = name.toLowerCase().replace(/ /g, '_').substring(0, 20);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: 'password',
    });

    if (authError) {
      console.log(`Failed to create ${email}: ${authError.message}`);
      continue;
    }

    if (authData.user) {
      const { error: profileError } = await supabase
        .from('users')
        .upsert([
          {
            id: authData.user.id,
            username: username,
            role: 'student',
            school_id: schoolData.id
          }
        ], { onConflict: 'id' });

      if (profileError) {
        console.error(`Profile Error for ${username}:`, profileError.message);
      } else {
        console.log(`Created student: ${name} (${email})`);
      }
    }
  }

  console.log("Finished seeding students.");
}

seedStudents();
