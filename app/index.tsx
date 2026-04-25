import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useStore } from '../src/store/useStore';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { GraduationCap, Lock, Mail, ChevronRight } from 'lucide-react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('parent1@demo.com');
  const [password, setPassword] = useState('password');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();
  const setUser = useStore((state) => state.setUser);

  // Simple scale animation for button
  const [scale] = useState(new Animated.Value(1));
  const animateButton = (pressIn: boolean) => {
    Animated.spring(scale, {
      toValue: pressIn ? 0.95 : 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10
    }).start();
  };

  const handleLogin = async () => {
    setLoading(true);
    setErrorMsg('');
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();
        
      if (userData) {
        setUser(userData);
        // Routing is automatically handled by the _layout.tsx observer based on user.role

      } else {
        setErrorMsg('Error fetching user profile');
      }
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1e1b4b', '#4338ca', '#312e81']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      />
      
      {/* Decorative background elements */}
      <View style={[styles.blob, styles.blob1]} />
      <View style={[styles.blob, styles.blob2]} />

      <BlurView intensity={Platform.OS === 'web' ? 40 : 80} tint="light" style={styles.card}>
        <View style={styles.logoContainer}>
          <View style={styles.iconWrapper}>
            <GraduationCap size={40} color="#4f46e5" strokeWidth={2.5} />
          </View>
          <Text style={styles.title}>Campus Cortex <Text style={styles.aiText}>AI</Text></Text>
          <Text style={styles.subtitle}>Parent & Student Intelligence</Text>
        </View>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputContainer}>
            <Mail size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputContainer}>
            <Lock size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>
        </View>

        <Animated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity 
            style={styles.button}
            activeOpacity={0.9}
            onPressIn={() => animateButton(true)}
            onPressOut={() => animateButton(false)}
            onPress={handleLogin}
            disabled={loading}
          >
            <LinearGradient
              colors={['#4f46e5', '#6366f1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Secure Login</Text>
                  <ChevronRight size={20} color="#fff" />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.footerText}>
          Don't have an account? <Text style={styles.linkText}>Contact your school administrator.</Text>
        </Text>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  blob: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.5,
  },
  blob1: {
    backgroundColor: '#818cf8',
    top: -100,
    left: -100,
    transform: [{ scale: 1.5 }],
  },
  blob2: {
    backgroundColor: '#c084fc',
    bottom: -100,
    right: -100,
    transform: [{ scale: 1.5 }],
  },
  card: {
    width: '90%',
    maxWidth: 420,
    padding: 32,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'web' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' as any,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.2)' as any,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1e1b4b',
    letterSpacing: -0.5,
  },
  aiText: {
    color: '#4f46e5',
  },
  subtitle: {
    fontSize: 15,
    color: '#4b5563',
    marginTop: 4,
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    height: '100%',
    outlineStyle: 'none' as any, // Web specific
  },
  button: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.4)' as any,
  },
  buttonGradient: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 4,
  },
  footerText: {
    textAlign: 'center',
    marginTop: 24,
    color: '#6b7280',
    fontSize: 13,
  },
  linkText: {
    color: '#4f46e5',
    fontWeight: '600',
  }
});
