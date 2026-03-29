import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { api } from '../../src/utils/api';

const CATS = ['Food','Transport','Shopping','Entertainment','Bills','Health','Education','Groceries','Rent','Salary','Freelance','Investment','Other'];
const CAT_ICONS: Record<string, { icon: string; color: string }> = {
  Food: { icon: 'restaurant', color: '#F97316' }, Transport: { icon: 'car', color: '#3B82F6' },
  Shopping: { icon: 'cart', color: '#8B5CF6' }, Entertainment: { icon: 'game-controller', color: '#EC4899' },
  Bills: { icon: 'document-text', color: '#6366F1' }, Health: { icon: 'medical', color: '#EF4444' },
  Education: { icon: 'school', color: '#14B8A6' }, Groceries: { icon: 'basket', color: '#22C55E' },
  Rent: { icon: 'home', color: '#F59E0B' }, Salary: { icon: 'cash', color: '#10B981' },
  Freelance: { icon: 'laptop', color: '#06B6D4' }, Investment: { icon: 'trending-up', color: '#8B5CF6' },
  Other: { icon: 'ellipsis-horizontal', color: '#6B7280' },
};
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Transactions() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTxn, setEditTxn] = useState<any>(null);
  const [form, setForm] = useState({ amount: '', category: 'Food', description: '', date: '', type: 'expense' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = String(month).padStart(2, '0');
      const data = await api(`/api/transactions?month=${m}&year=${year}`);
      setTxns(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const openAdd = () => {
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    setForm({ amount: '', category: 'Food', description: '', date: dateStr, type: 'expense' });
    setEditTxn(null);
    setShowForm(true);
  };

  const openEdit = (t: any) => {
    setForm({ amount: String(t.amount), category: t.category, description: t.description, date: t.date, type: t.type });
    setEditTxn(t);
    setShowForm(true);
  };

  const save = async () => {
    if (!form.amount || !form.description || !form.date) { Alert.alert('Error', 'Fill all fields'); return; }
    try {
      const body = { ...form, amount: parseFloat(form.amount) };
      if (editTxn) {
        await api(`/api/transactions/${editTxn.transaction_id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/api/transactions', { method: 'POST', body: JSON.stringify(body) });
      }
      setShowForm(false);
      load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const deleteTxn = (t: any) => {
    Alert.alert('Delete', `Delete "${t.description}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api(`/api/transactions/${t.transaction_id}`, { method: 'DELETE' }); load(); }
        catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <View testID="transactions-screen" style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={s.headerRow}>
        <Text style={[s.title, { color: colors.textPrimary }]}>Transactions</Text>
        <TouchableOpacity testID="add-transaction-button" style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={openAdd}>
          <Ionicons name="add" size={20} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      <View style={[s.monthNav, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity onPress={prevMonth} style={s.monthArrow}><Ionicons name="chevron-back" size={20} color={colors.textPrimary} /></TouchableOpacity>
        <Text style={[s.monthText, { color: colors.textPrimary }]}>{MONTHS[month-1]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={s.monthArrow}><Ionicons name="chevron-forward" size={20} color={colors.textPrimary} /></TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
          {txns.length === 0 ? (
            <Text style={[s.empty, { color: colors.textSecondary }]}>No transactions for {MONTHS[month-1]} {year}</Text>
          ) : txns.map((t, i) => {
            const ci = CAT_ICONS[t.category] || CAT_ICONS.Other;
            return (
              <TouchableOpacity key={t.transaction_id || i} testID={`txn-row-${t.transaction_id}`}
                style={[s.txnRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => openEdit(t)} onLongPress={() => deleteTxn(t)}>
                <View style={[s.txnIcon, { backgroundColor: ci.color + '20' }]}>
                  <Ionicons name={ci.icon as any} size={18} color={ci.color} />
                </View>
                <View style={s.txnInfo}>
                  <Text style={[s.txnDesc, { color: colors.textPrimary }]} numberOfLines={1}>{t.description}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[s.txnMeta, { color: colors.textSecondary }]}>{t.date}</Text>
                    {t.created_by === 'ai' && (
                      <View style={[s.aiBadge, { backgroundColor: colors.primary + '20' }]}>
                        <Text style={[s.aiBadgeText, { color: colors.primary }]}>AI</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.txnAmt, { color: t.type === 'income' ? colors.income : colors.expense }]}>
                    {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                  </Text>
                  <Text style={[s.txnCat, { color: colors.textSecondary }]}>{t.category}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      <Modal visible={showForm} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.modalOverlay}>
            <View style={[s.modalContent, { backgroundColor: colors.surface }]}>
              <View style={s.modalHeader}>
                <Text style={[s.modalTitle, { color: colors.textPrimary }]}>{editTxn ? 'Edit' : 'Add'} Transaction</Text>
                <TouchableOpacity onPress={() => setShowForm(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={s.typeRow}>
                {['expense', 'income'].map(t => (
                  <TouchableOpacity key={t} style={[s.typeBtn, form.type === t && { backgroundColor: t === 'income' ? colors.income + '20' : colors.expense + '20' }]}
                    onPress={() => setForm(f => ({ ...f, type: t }))}>
                    <Text style={[s.typeTxt, { color: form.type === t ? (t === 'income' ? colors.income : colors.expense) : colors.textSecondary }]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput testID="amount-input" style={[s.input, { backgroundColor: colors.surfaceElevated, color: colors.textPrimary, borderColor: colors.border }]}
                placeholder="Amount (₹)" placeholderTextColor={colors.textSecondary}
                keyboardType="numeric" value={form.amount} onChangeText={v => setForm(f => ({ ...f, amount: v }))} />

              <TextInput testID="description-input" style={[s.input, { backgroundColor: colors.surfaceElevated, color: colors.textPrimary, borderColor: colors.border }]}
                placeholder="Description" placeholderTextColor={colors.textSecondary}
                value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} />

              <TextInput testID="date-input" style={[s.input, { backgroundColor: colors.surfaceElevated, color: colors.textPrimary, borderColor: colors.border }]}
                placeholder="Date (YYYY-MM-DD)" placeholderTextColor={colors.textSecondary}
                value={form.date} onChangeText={v => setForm(f => ({ ...f, date: v }))} />

              <Text style={[s.catLabel, { color: colors.textSecondary }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={s.catChips}>
                  {CATS.map(c => (
                    <TouchableOpacity key={c} style={[s.catChip, form.category === c && { backgroundColor: (CAT_ICONS[c]?.color || '#666') + '20', borderColor: CAT_ICONS[c]?.color }]}
                      onPress={() => setForm(f => ({ ...f, category: c }))}>
                      <Ionicons name={(CAT_ICONS[c]?.icon || 'ellipsis-horizontal') as any} size={14} color={form.category === c ? CAT_ICONS[c]?.color : colors.textSecondary} />
                      <Text style={[s.catChipTxt, { color: form.category === c ? CAT_ICONS[c]?.color : colors.textSecondary }]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <TouchableOpacity testID="save-transaction-button" style={[s.saveBtn, { backgroundColor: colors.primary }]} onPress={save}>
                <Text style={[s.saveTxt, { color: colors.primaryForeground }]}>{editTxn ? 'Update' : 'Add'} Transaction</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '300' },
  addBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, padding: 12, borderWidth: 1, marginBottom: 16 },
  monthArrow: { padding: 4 },
  monthText: { fontSize: 16, fontWeight: '600' },
  list: { paddingBottom: 20 },
  empty: { fontSize: 14, textAlign: 'center', paddingVertical: 40 },
  txnRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
  txnIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txnInfo: { flex: 1 },
  txnDesc: { fontSize: 14, fontWeight: '500', marginBottom: 3 },
  txnMeta: { fontSize: 12 },
  txnAmt: { fontSize: 15, fontWeight: '700' },
  txnCat: { fontSize: 11, marginTop: 2 },
  aiBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  aiBadgeText: { fontSize: 10, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '600' },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  typeTxt: { fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 15, marginBottom: 12 },
  catLabel: { fontSize: 13, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  catChips: { flexDirection: 'row', gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'transparent' },
  catChipTxt: { fontSize: 12, fontWeight: '500' },
  saveBtn: { borderRadius: 16, padding: 16, alignItems: 'center' },
  saveTxt: { fontSize: 16, fontWeight: '600' },
});
