import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { api } from '../../src/utils/api';

export default function Profile() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, logout, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [income, setIncome] = useState(String(user?.monthly_income || ''));
  const [saving, setSaving] = useState(false);

  const saveIncome = async () => {
    const val = parseFloat(income);
    if (isNaN(val) || val < 0) { Alert.alert('Error', 'Enter a valid amount'); return; }
    setSaving(true);
    try {
      await api('/api/user/income', { method: 'PUT', body: JSON.stringify({ monthly_income: val }) });
      await refreshUser();
      Alert.alert('Success', 'Monthly income updated!');
    } catch (e: any) { Alert.alert('Error', e.message); }
    setSaving(false);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); router.replace('/'); } },
    ]);
  };

  return (
    <View testID="profile-screen" style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={[s.title, { color: colors.textPrimary }]}>Profile</Text>

        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[s.avatarCircle, { backgroundColor: colors.primary }]}>
            <Text style={[s.avatarText, { color: colors.primaryForeground }]}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={[s.userName, { color: colors.textPrimary }]}>{user?.name || 'User'}</Text>
          <Text style={[s.userEmail, { color: colors.textSecondary }]}>{user?.email || ''}</Text>
        </View>

        <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Monthly Income</Text>
          <Text style={[s.sectionDesc, { color: colors.textSecondary }]}>Set your monthly income for balance calculations</Text>
          <View style={s.incomeRow}>
            <TextInput testID="income-input"
              style={[s.incomeInput, { backgroundColor: colors.surfaceElevated, color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="₹ 0" placeholderTextColor={colors.textSecondary}
              keyboardType="numeric" value={income}
              onChangeText={setIncome} />
            <TouchableOpacity testID="save-income-button" style={[s.saveBtn, { backgroundColor: colors.primary }]}
              onPress={saveIncome} disabled={saving}>
              <Text style={[s.saveTxt, { color: colors.primaryForeground }]}>{saving ? '...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Appearance</Text>
          <TouchableOpacity testID="theme-toggle-button" style={s.settingRow} onPress={toggleTheme}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[s.settingIcon, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={[s.settingLabel, { color: colors.textPrimary }]}>Dark Mode</Text>
                <Text style={[s.settingDesc, { color: colors.textSecondary }]}>{isDark ? 'On' : 'Off'}</Text>
              </View>
            </View>
            <View style={[s.toggle, { backgroundColor: isDark ? colors.primary : colors.border }]}>
              <View style={[s.toggleKnob, { backgroundColor: isDark ? colors.primaryForeground : '#fff', transform: [{ translateX: isDark ? 18 : 2 }] }]} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>About</Text>
          <View style={s.aboutRow}>
            <Text style={[s.aboutLabel, { color: colors.textSecondary }]}>App</Text>
            <Text style={[s.aboutValue, { color: colors.textPrimary }]}>VoiceWallet v1.0</Text>
          </View>
          <View style={s.aboutRow}>
            <Text style={[s.aboutLabel, { color: colors.textSecondary }]}>AI Model</Text>
            <Text style={[s.aboutValue, { color: colors.textPrimary }]}>GPT-5.2 + Whisper</Text>
          </View>
        </View>

        <TouchableOpacity testID="logout-button" style={[s.logoutBtn, { borderColor: colors.expense }]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.expense} />
          <Text style={[s.logoutTxt, { color: colors.expense }]}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20 },
  title: { fontSize: 28, fontWeight: '300', marginBottom: 24 },
  card: { borderRadius: 20, padding: 24, borderWidth: 1, alignItems: 'center', marginBottom: 16 },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '600' },
  userName: { fontSize: 20, fontWeight: '600', marginBottom: 4 },
  userEmail: { fontSize: 14 },
  section: { borderRadius: 20, padding: 20, borderWidth: 1, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  sectionDesc: { fontSize: 13, marginBottom: 12 },
  incomeRow: { flexDirection: 'row', gap: 10 },
  incomeInput: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 16 },
  saveBtn: { borderRadius: 14, paddingHorizontal: 24, justifyContent: 'center' },
  saveTxt: { fontSize: 15, fontWeight: '600' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  settingIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  settingLabel: { fontSize: 15, fontWeight: '500' },
  settingDesc: { fontSize: 12, marginTop: 1 },
  toggle: { width: 44, height: 26, borderRadius: 13, justifyContent: 'center' },
  toggleKnob: { width: 22, height: 22, borderRadius: 11 },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  aboutLabel: { fontSize: 14 },
  aboutValue: { fontSize: 14, fontWeight: '500' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 16, padding: 16 },
  logoutTxt: { fontSize: 16, fontWeight: '600' },
});
