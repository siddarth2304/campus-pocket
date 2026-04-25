import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../src/lib/supabase';
import { useStore } from '../src/store/useStore';
import { useRouter, useSegments } from 'expo-router';

export default function RootLayout() {
  const { user, setUser } = useStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchUserRole(session.user.id);
      }
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchUserRole(session.user.id);
      } else {
        setUser(null);
      }
    });
  }, []);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    if (!user && segments[0] !== undefined && segments[0] !== '') {
      router.replace('/');
    } else if (user) {
      if (user.role === 'admin' && segments[0] !== 'admin') {
        router.replace('/admin');
      } else if (user.role === 'teacher' && segments[0] !== 'teacher') {
        router.replace('/teacher');
      } else if (user.role === 'parent' && segments[0] !== 'parent') {
        router.replace('/parent');
      } else if (user.role === 'student' && segments[0] !== 'student') {
        router.replace('/student');
      }
    }
  }, [user, segments, mounted]);

  const fetchUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (data) {
      setUser(data);
    }
  };

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false, headerBackVisible: false }} />
      <Stack.Screen name="parent" options={{ headerShown: false, headerBackVisible: false }} />
      <Stack.Screen name="student" options={{ headerShown: false, headerBackVisible: false }} />
      <Stack.Screen name="teacher" options={{ headerShown: false, headerBackVisible: false }} />
    </Stack>
  );
}
