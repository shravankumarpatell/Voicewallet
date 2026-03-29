import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function LoginScreen() {
  const { user, isLoading, login } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  // OTP flow state
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [mockOtp, setMockOtp] = useState('');

  useEffect(() => {
    if (user && !isLoading) router.replace('/(tabs)/dashboard');
  }, [user, isLoading]);

  // Handle web Google auth callback
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash.includes('session_id=')) {
        const sid = hash.split('session_id=')[1]?.split('&')[0];
        if (sid) {
          window.history.replaceState(null, '', window.location.pathname);
          handleGoogleSession(sid);
        }
      }
    }
  }, []);

  const handleGoogleSession = async (sessionId: string) => {
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
      const redirectUrl = window.location.origin;
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    } else {
      Alert.alert('Google Login', 'Google login is available on web only. Please use Mobile OTP login on this device.');
    }
  };

  const sendOtp = async () => {
    const cleaned = mobile.replace(/\s/g, '');
    if (cleaned.length < 10) {
      Alert.alert('Error', 'Enter a valid 10-digit mobile number');
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: cleaned }),
      });
      const data = await res.json();
      if (res.ok) {
        setOtpSent(true);
        setMockOtp(data.mock_otp);
        Alert.alert('OTP Sent', `Your OTP is: ${data.mock_otp}\n\n(Mock OTP for personal use)`);
      } else {
        Alert.alert('Error', data.detail || 'Failed to send OTP');
      }
    } catch (e) { Alert.alert('Error', 'Network error. Try again.'); }
    setProcessing(false);
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Enter the 6-digit OTP');
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobile.replace(/\s/g, ''), otp }),
      });
      const data = await res.json();
      if (res.ok) {
        await login(data.session_token, data.user);
        router.replace('/(tabs)/dashboard');
      } else {
        Alert.alert('Error', data.detail || 'Invalid OTP');
      }
    } catch (e) { Alert.alert('Error', 'Network error. Try again.'); }
    setProcessing(false);
  };

  if (isLoading) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[s.container, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled">
        <View style={s.content}>
          <View style={[s.iconCircle, { backgroundColor: colors.primary }]}>
            <Ionicons name="wallet" size={48} color={colors.primaryForeground} />
          </View>
          <Text style={[s.title, { color: colors.textPrimary }]}>VoiceWallet</Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>Your AI Financial Jarvis</Text>

          {!otpSent ? (
            <View style={s.formWrap}>
              <Text style={[s.label, { color: colors.textSecondary }]}>MOBILE NUMBER</Text>
              <View style={[s.phoneRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Text style={[s.prefix, { color: colors.textSecondary }]}>+91</Text>
                <TextInput
                  testID="mobile-input"
                  style={[s.phoneInput, { color: colors.textPrimary }]}
                  placeholder="Enter mobile number"
                  placeholderTextColor={colors.textSecondary + '80'}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={mobile}
                  onChangeText={setMobile}
                />
              </View>
              <TouchableOpacity
                testID="send-otp-button"
                style={[s.primaryBtn, { backgroundColor: colors.primary, opacity: processing ? 0.6 : 1 }]}
                onPress={sendOtp}
                disabled={processing}
                activeOpacity={0.8}
              >
                {processing ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={[s.primaryBtnText, { color: colors.primaryForeground }]}>Send OTP</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.formWrap}>
              <Text style={[s.label, { color: colors.textSecondary }]}>ENTER OTP</Text>
              <View style={[s.otpHint, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="key" size={16} color={colors.primary} />
                <Text style={[s.otpHintText, { color: colors.primary }]}>Your OTP: {mockOtp}</Text>
              </View>
              <TextInput
                testID="otp-input"
                style={[s.otpInput, { backgroundColor: colors.surfaceElevated, color: colors.textPrimary, borderColor: colors.border }]}
                placeholder="Enter 6-digit OTP"
                placeholderTextColor={colors.textSecondary + '80'}
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
              />
              <TouchableOpacity
                testID="verify-otp-button"
                style={[s.primaryBtn, { backgroundColor: colors.primary, opacity: processing ? 0.6 : 1 }]}
                onPress={verifyOtp}
                disabled={processing}
                activeOpacity={0.8}
              >
                {processing ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={[s.primaryBtnText, { color: colors.primaryForeground }]}>Verify & Login</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.backBtn} onPress={() => { setOtpSent(false); setOtp(''); setMockOtp(''); }}>
                <Text style={[s.backBtnText, { color: colors.textSecondary }]}>Change number</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={s.divider}>
            <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[s.dividerText, { color: colors.textSecondary }]}>or</Text>
            <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <TouchableOpacity
            testID="google-login-button"
            style={[s.googleBtn, { borderColor: colors.border }]}
            onPress={handleGoogleLogin}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-google" size={20} color={colors.textSecondary} />
            <Text style={[s.googleBtnText, { color: colors.textSecondary }]}>Continue with Google</Text>
          </TouchableOpacity>
        </View>
        <Text style={[s.footer, { color: colors.textSecondary }]}>Powered by AI • Secure & Private</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', width: '100%', maxWidth: 360 },
  iconCircle: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 34, fontWeight: '300', letterSpacing: -1, marginBottom: 6 },
  subtitle: { fontSize: 16, fontWeight: '500', marginBottom: 32 },
  formWrap: { width: '100%', marginBottom: 8 },
  label: { fontSize: 12, letterSpacing: 1, marginBottom: 8 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, marginBottom: 12 },
  prefix: { fontSize: 16, fontWeight: '500', marginRight: 8 },
  phoneInput: { flex: 1, fontSize: 16, paddingVertical: 14 },
  otpHint: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, marginBottom: 12 },
  otpHintText: { fontSize: 14, fontWeight: '600' },
  otpInput: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 20, textAlign: 'center', letterSpacing: 8, marginBottom: 12 },
  primaryBtn: { width: '100%', borderRadius: 50, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontSize: 16, fontWeight: '600' },
  backBtn: { alignItems: 'center', paddingVertical: 12 },
  backBtnText: { fontSize: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { paddingHorizontal: 12, fontSize: 13 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingVertical: 14, borderRadius: 50, borderWidth: 1, gap: 10 },
  googleBtnText: { fontSize: 15, fontWeight: '500' },
  footer: { marginTop: 32, fontSize: 12 },
});
