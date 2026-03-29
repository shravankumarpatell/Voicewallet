import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function LoginScreen() {
  const { user, isLoading, login } = useAuth();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [showWebView, setShowWebView] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (user && !isLoading) router.replace('/(tabs)/dashboard');
  }, [user, isLoading]);

  // Handle web auth callback
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash.includes('session_id=')) {
        const sid = hash.split('session_id=')[1]?.split('&')[0];
        if (sid) {
          window.history.replaceState(null, '', window.location.pathname);
          handleSessionExchange(sid);
        }
      }
    }
  }, []);

  const handleSessionExchange = async (sessionId: string) => {
    setProcessing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        await login(data.session_token, data.user);
        router.replace('/(tabs)/dashboard');
      }
    } catch (e) { console.error('Auth failed:', e); }
    setProcessing(false);
  };

  const handleGoogleLogin = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
      const redirectUrl = window.location.origin;
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    } else {
      setShowWebView(true);
    }
  };

  if (isLoading || processing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {processing ? 'Signing you in...' : 'Loading...'}
        </Text>
      </View>
    );
  }

  if (showWebView) {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = BACKEND_URL;
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl || '')}`;
    return (
      <View style={{ flex: 1 }}>
        <TouchableOpacity
          style={[styles.webViewBack, { backgroundColor: colors.surface }]}
          onPress={() => setShowWebView(false)}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          <Text style={[styles.webViewBackText, { color: colors.textPrimary }]}>Back</Text>
        </TouchableOpacity>
        <WebView
          source={{ uri: authUrl }}
          injectedJavaScript={`
            (function() {
              function check() {
                if (window.location.hash && window.location.hash.includes('session_id=')) {
                  window.ReactNativeWebView.postMessage(window.location.hash);
                }
              }
              check();
              setInterval(check, 500);
            })();
            true;
          `}
          onMessage={(event) => {
            const hash = event.nativeEvent.data;
            if (hash.includes('session_id=')) {
              const sid = hash.split('session_id=')[1]?.split('&')[0];
              if (sid) { setShowWebView(false); handleSessionExchange(sid); }
            }
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primary }]}>
          <Ionicons name="wallet" size={48} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>VoiceWallet</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Your AI Financial Jarvis</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          Track expenses by voice, get AI insights, and manage your finances effortlessly
        </Text>
        <TouchableOpacity
          testID="google-login-button"
          style={[styles.loginBtn, { backgroundColor: colors.primary }]}
          onPress={handleGoogleLogin}
          activeOpacity={0.8}
        >
          <Ionicons name="logo-google" size={22} color={colors.primaryForeground} />
          <Text style={[styles.loginText, { color: colors.primaryForeground }]}>Continue with Google</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.footer, { color: colors.textSecondary }]}>Powered by AI • Secure & Private</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', width: '100%', maxWidth: 360 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 36, fontWeight: '300', letterSpacing: -1, marginBottom: 8 },
  subtitle: { fontSize: 18, fontWeight: '500', marginBottom: 12 },
  desc: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 48, paddingHorizontal: 20 },
  loginBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, paddingHorizontal: 32, borderRadius: 50, width: '100%', gap: 12,
  },
  loginText: { fontSize: 16, fontWeight: '600' },
  loadingText: { marginTop: 12, fontSize: 14 },
  footer: { position: 'absolute', bottom: 40, fontSize: 12 },
  webViewBack: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 12,
    paddingHorizontal: 16, gap: 8,
  },
  webViewBackText: { fontSize: 16, fontWeight: '500' },
});
