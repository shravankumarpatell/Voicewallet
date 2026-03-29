import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Modal, Platform, Alert, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, AudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { api } from '../../src/utils/api';

const CATS: Record<string, { icon: string; color: string }> = {
  Food: { icon: 'restaurant', color: '#F97316' },
  Transport: { icon: 'car', color: '#3B82F6' },
  Shopping: { icon: 'cart', color: '#8B5CF6' },
  Entertainment: { icon: 'game-controller', color: '#EC4899' },
  Bills: { icon: 'document-text', color: '#6366F1' },
  Health: { icon: 'medical', color: '#EF4444' },
  Education: { icon: 'school', color: '#14B8A6' },
  Groceries: { icon: 'basket', color: '#22C55E' },
  Rent: { icon: 'home', color: '#F59E0B' },
  Salary: { icon: 'cash', color: '#10B981' },
  Freelance: { icon: 'laptop', color: '#06B6D4' },
  Investment: { icon: 'trending-up', color: '#8B5CF6' },
  Other: { icon: 'ellipsis-horizontal', color: '#6B7280' },
};

export default function Dashboard() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [voiceResult, setVoiceResult] = useState<any>(null);
  const [showVoice, setShowVoice] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api('/api/dashboard')); } catch (e) { console.error(e); }
    setLoading(false);
    setRefreshing(false);
  }, []);

  // Refresh data when tab comes into focus
  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = () => { setRefreshing(true); load(); };

  const startRec = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Microphone access required'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
    } catch (e) { console.error(e); Alert.alert('Error', 'Could not start recording'); }
  };

  const stopRec = async () => {
    setIsRecording(false);
    setProcessing(true);
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (uri) {
        const fd = new FormData();
        if (Platform.OS !== 'web') {
          fd.append('audio', { uri, type: 'audio/m4a', name: 'rec.m4a' } as any);
        } else {
          const blob = await fetch(uri).then(r => r.blob());
          fd.append('audio', blob, 'rec.webm');
        }
        const result = await api('/api/voice/process', { method: 'POST', body: fd });
        setVoiceResult(result);
        load();
      }
    } catch (e) { console.error(e); Alert.alert('Error', 'Failed to process voice'); }
    setProcessing(false);
  };

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  if (loading) return (
    <View style={[s.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <View testID="dashboard-screen" style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        <View style={s.header}>
          <View>
            <Text style={[s.greeting, { color: colors.textSecondary }]}>Welcome back,</Text>
            <Text style={[s.name, { color: colors.textPrimary }]}>{user?.name?.split(' ')[0] || 'User'}</Text>
          </View>
          <View style={[s.avatar, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="person" size={22} color={colors.textSecondary} />
          </View>
        </View>

        <View style={[s.balanceCard, { backgroundColor: colors.primary }]}>
          <Text style={[s.balLabel, { color: colors.primaryForeground + '90' }]}>TOTAL BALANCE</Text>
          <Text testID="balance-amount" style={[s.balAmount, { color: colors.primaryForeground }]}>{fmt(data?.balance || 0)}</Text>
          <Text style={[s.balInfo, { color: colors.primaryForeground + '70' }]}>Monthly Income: {fmt(data?.monthly_income || 0)}</Text>
        </View>

        <View style={s.row}>
          <View style={[s.miniCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[s.miniIcon, { backgroundColor: colors.income + '20' }]}>
              <Ionicons name="arrow-down" size={18} color={colors.income} />
            </View>
            <Text style={[s.miniLabel, { color: colors.textSecondary }]}>INCOME</Text>
            <Text testID="income-amount" style={[s.miniAmt, { color: colors.income }]}>{fmt(data?.total_income || 0)}</Text>
          </View>
          <View style={[s.miniCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[s.miniIcon, { backgroundColor: colors.expense + '20' }]}>
              <Ionicons name="arrow-up" size={18} color={colors.expense} />
            </View>
            <Text style={[s.miniLabel, { color: colors.textSecondary }]}>EXPENSES</Text>
            <Text testID="expense-amount" style={[s.miniAmt, { color: colors.expense }]}>{fmt(data?.total_expense || 0)}</Text>
          </View>
        </View>

        {data?.category_breakdown?.length > 0 && (
          <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.secTitle, { color: colors.textPrimary }]}>Spending by Category</Text>
            {data.category_breakdown.map((c: any, i: number) => {
              const ci = CATS[c.category] || CATS.Other;
              const pct = data.total_expense > 0 ? (c.amount / data.total_expense * 100) : 0;
              return (
                <View key={i} style={s.catRow}>
                  <View style={[s.catIcon, { backgroundColor: ci.color + '20' }]}>
                    <Ionicons name={ci.icon as any} size={16} color={ci.color} />
                  </View>
                  <View style={s.catInfo}>
                    <Text style={[s.catName, { color: colors.textPrimary }]}>{c.category}</Text>
                    <View style={[s.catBar, { backgroundColor: colors.border }]}>
                      <View style={[s.catFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: ci.color }]} />
                    </View>
                  </View>
                  <Text style={[s.catAmt, { color: colors.textPrimary }]}>{fmt(c.amount)}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={[s.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.secTitle, { color: colors.textPrimary }]}>Recent Transactions</Text>
          {!data?.recent_transactions?.length ? (
            <Text style={[s.empty, { color: colors.textSecondary }]}>No transactions yet. Tap the mic to start!</Text>
          ) : data.recent_transactions.map((t: any, i: number) => {
            const ci = CATS[t.category] || CATS.Other;
            return (
              <View key={i} testID={`transaction-item-${t.transaction_id}`}
                style={[s.txnRow, i < data.recent_transactions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <View style={[s.txnIcon, { backgroundColor: ci.color + '20' }]}>
                  <Ionicons name={ci.icon as any} size={16} color={ci.color} />
                </View>
                <View style={s.txnInfo}>
                  <Text style={[s.txnDesc, { color: colors.textPrimary }]} numberOfLines={1}>{t.description}</Text>
                  <Text style={[s.txnDate, { color: colors.textSecondary }]}>{t.date} • {t.category}</Text>
                </View>
                <Text style={[s.txnAmt, { color: t.type === 'income' ? colors.income : colors.expense }]}>
                  {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity testID="voice-input-button" style={[s.voiceBtn, { backgroundColor: colors.primary }]}
        onPress={() => setShowVoice(true)} activeOpacity={0.8}>
        <Ionicons name="mic" size={28} color={colors.primaryForeground} />
      </TouchableOpacity>

      <Modal visible={showVoice} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={s.modalClose} onPress={() => { setShowVoice(false); setVoiceResult(null); }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            {processing ? (
              <View style={s.modalCenter}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[s.modalText, { color: colors.textSecondary }]}>Processing your voice...</Text>
              </View>
            ) : voiceResult ? (
              <ScrollView style={{ maxHeight: 400 }}>
                <Text style={[s.modalTitle, { color: colors.textPrimary }]}>Extracted Transactions</Text>
                <Text style={[s.transcript, { color: colors.textSecondary }]}>"{voiceResult.transcript}"</Text>
                {voiceResult.transactions?.length > 0 ? voiceResult.transactions.map((t: any, i: number) => (
                  <View key={i} style={[s.exTxn, { borderColor: colors.border }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[s.exDesc, { color: colors.textPrimary }]}>{t.description}</Text>
                      <Text style={[s.exAmt, { color: t.type === 'income' ? colors.income : colors.expense }]}>
                        {t.type === 'income' ? '+' : '-'}₹{t.amount}
                      </Text>
                    </View>
                    <Text style={[s.exCat, { color: colors.textSecondary }]}>{t.category} • {t.date}</Text>
                  </View>
                )) : <Text style={[s.empty, { color: colors.textSecondary }]}>No transactions detected</Text>}
                <TouchableOpacity style={[s.doneBtn, { backgroundColor: colors.primary }]}
                  onPress={() => { setShowVoice(false); setVoiceResult(null); }}>
                  <Text style={[s.doneTxt, { color: colors.primaryForeground }]}>Done</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <View style={s.modalCenter}>
                <TouchableOpacity testID="record-button"
                  style={[s.recBtn, { backgroundColor: isRecording ? colors.expense : colors.primary }]}
                  onPress={isRecording ? stopRec : startRec} activeOpacity={0.7}>
                  <Ionicons name={isRecording ? 'stop' : 'mic'} size={36} color={isRecording ? '#FFF' : colors.primaryForeground} />
                </TouchableOpacity>
                <Text style={[s.modalText, { color: colors.textPrimary }]}>
                  {isRecording ? 'Listening... Tap to stop' : 'Tap to start speaking'}
                </Text>
                <Text style={[s.modalHint, { color: colors.textSecondary }]}>Describe your transactions naturally</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' },
  name: { fontSize: 28, fontWeight: '300', marginTop: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  balanceCard: { borderRadius: 24, padding: 24, marginBottom: 16 },
  balLabel: { fontSize: 12, letterSpacing: 1.5, marginBottom: 8 },
  balAmount: { fontSize: 36, fontWeight: '300', marginBottom: 8 },
  balInfo: { fontSize: 13 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  miniCard: { flex: 1, borderRadius: 20, padding: 16, borderWidth: 1 },
  miniIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  miniLabel: { fontSize: 11, letterSpacing: 0.5, marginBottom: 4 },
  miniAmt: { fontSize: 20, fontWeight: '600' },
  section: { borderRadius: 20, padding: 20, borderWidth: 1, marginBottom: 16 },
  secTitle: { fontSize: 17, fontWeight: '600', marginBottom: 16 },
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  catIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  catInfo: { flex: 1, marginRight: 12 },
  catName: { fontSize: 13, marginBottom: 4 },
  catBar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  catFill: { height: '100%', borderRadius: 2 },
  catAmt: { fontSize: 13, fontWeight: '600' },
  empty: { fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  txnIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txnInfo: { flex: 1 },
  txnDesc: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  txnDate: { fontSize: 12 },
  txnAmt: { fontSize: 15, fontWeight: '600' },
  voiceBtn: {
    position: 'absolute', bottom: 20, alignSelf: 'center',
    width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center',
    elevation: 8,
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, minHeight: 320 },
  modalClose: { position: 'absolute', top: 16, right: 16, zIndex: 10 },
  modalCenter: { alignItems: 'center', paddingVertical: 40 },
  modalTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  modalText: { fontSize: 16, marginTop: 16 },
  modalHint: { fontSize: 13, marginTop: 8 },
  recBtn: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  transcript: { fontSize: 13, fontStyle: 'italic', marginBottom: 16, lineHeight: 20 },
  exTxn: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 8 },
  exDesc: { fontSize: 14, fontWeight: '500', flex: 1 },
  exAmt: { fontSize: 16, fontWeight: '700' },
  exCat: { fontSize: 12, marginTop: 4 },
  doneBtn: { borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 12 },
  doneTxt: { fontSize: 16, fontWeight: '600' },
});
