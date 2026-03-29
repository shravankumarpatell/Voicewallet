import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { useTheme } from '../../src/contexts/ThemeContext';
import { api } from '../../src/utils/api';

type Msg = { role: string; content: string; message_id?: string };

export default function Chat() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await api('/api/chat/history');
      setMessages(data);
    } catch (e) { console.error(e); }
    setHistoryLoaded(true);
  };

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    const userMsg: Msg = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const data = await api('/api/chat', { method: 'POST', body: JSON.stringify({ message: msg }) });
      const aiMsg: Msg = { role: 'assistant', content: data.response };
      setMessages(prev => [...prev, aiMsg]);
      if (data.new_transactions?.length > 0) {
        const txnMsg: Msg = { role: 'assistant', content: `✅ Added ${data.new_transactions.length} transaction(s) to your records.` };
        setMessages(prev => [...prev, txnMsg]);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble processing that. Please try again.' }]);
    }
    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
  };

  const toggleRec = async () => {
    if (isRecording) {
      setIsRecording(false);
      try {
        await audioRecorder.stop();
        const uri = audioRecorder.uri;
        if (uri) {
          setLoading(true);
          const fd = new FormData();
          if (Platform.OS !== 'web') {
            fd.append('audio', { uri, type: 'audio/m4a', name: 'rec.m4a' } as any);
          } else {
            const blob = await fetch(uri).then(r => r.blob());
            fd.append('audio', blob, 'rec.webm');
          }
          const res = await api('/api/voice/transcribe', { method: 'POST', body: fd });
          setLoading(false);
          if (res.transcript) sendMessage(res.transcript);
        }
      } catch (e) { console.error(e); setLoading(false); }
    } else {
      try {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) return;
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
        setIsRecording(true);
      } catch (e) { console.error(e); }
    }
  };

  return (
    <View testID="chat-screen" style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <View style={[s.jarvisIcon, { backgroundColor: colors.primary }]}>
          <Ionicons name="sparkles" size={18} color={colors.primaryForeground} />
        </View>
        <View>
          <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Jarvis</Text>
          <Text style={[s.headerSub, { color: colors.textSecondary }]}>Your AI Financial Assistant</Text>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={s.msgs} contentContainerStyle={s.msgsContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
        {!historyLoaded ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : messages.length === 0 ? (
          <View style={s.welcomeWrap}>
            <View style={[s.welcomeIcon, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="sparkles" size={40} color={colors.primary} />
            </View>
            <Text style={[s.welcomeTitle, { color: colors.textPrimary }]}>Hi! I'm Jarvis</Text>
            <Text style={[s.welcomeDesc, { color: colors.textSecondary }]}>
              Ask me about your spending, get financial advice, or tell me about your expenses and I'll track them for you.
            </Text>
            <View style={s.suggestions}>
              {['How much did I spend this month?', 'Can I afford a trip this weekend?', 'I spent ₹200 on lunch today'].map((q, i) => (
                <TouchableOpacity key={i} style={[s.sugBtn, { borderColor: colors.border }]} onPress={() => sendMessage(q)}>
                  <Text style={[s.sugText, { color: colors.textSecondary }]}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : messages.map((m, i) => (
          <View key={i} style={[s.bubble, m.role === 'user' ? s.userBubble : s.aiBubble,
            { backgroundColor: m.role === 'user' ? colors.surfaceElevated : colors.surface, borderColor: colors.border }]}>
            {m.role === 'assistant' && (
              <View style={s.bubbleHeader}>
                <Ionicons name="sparkles" size={12} color={colors.primary} />
                <Text style={[s.bubbleName, { color: colors.primary }]}>Jarvis</Text>
              </View>
            )}
            <Text style={[s.bubbleText, { color: colors.textPrimary }]}>{m.content}</Text>
          </View>
        ))}
        {loading && (
          <View style={[s.bubble, s.aiBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity testID="chat-mic-button" style={[s.micBtn, { backgroundColor: isRecording ? colors.expense + '20' : colors.surfaceElevated }]}
            onPress={toggleRec}>
            <Ionicons name={isRecording ? 'stop' : 'mic'} size={20} color={isRecording ? colors.expense : colors.textSecondary} />
          </TouchableOpacity>
          <TextInput testID="jarvis-chat-input" style={[s.textInput, { backgroundColor: colors.surfaceElevated, color: colors.textPrimary }]}
            placeholder="Ask Jarvis anything..." placeholderTextColor={colors.textSecondary}
            value={input} onChangeText={setInput} onSubmitEditing={() => sendMessage()}
            returnKeyType="send" editable={!loading} multiline />
          <TouchableOpacity testID="chat-send-button" style={[s.sendBtn, { backgroundColor: input.trim() ? colors.primary : colors.surfaceElevated }]}
            onPress={() => sendMessage()} disabled={!input.trim() || loading}>
            <Ionicons name="send" size={18} color={input.trim() ? colors.primaryForeground : colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1 },
  jarvisIcon: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  headerSub: { fontSize: 12 },
  msgs: { flex: 1 },
  msgsContent: { padding: 16, paddingBottom: 8 },
  welcomeWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
  welcomeIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  welcomeTitle: { fontSize: 24, fontWeight: '300', marginBottom: 8 },
  welcomeDesc: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  suggestions: { width: '100%', gap: 8 },
  sugBtn: { borderWidth: 1, borderRadius: 14, padding: 14 },
  sugText: { fontSize: 14 },
  bubble: { maxWidth: '85%', padding: 14, borderRadius: 18, marginBottom: 8, borderWidth: 1 },
  userBubble: { alignSelf: 'flex-end', borderTopRightRadius: 4 },
  aiBubble: { alignSelf: 'flex-start', borderTopLeftRadius: 4 },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  bubbleName: { fontSize: 11, fontWeight: '700' },
  bubbleText: { fontSize: 14, lineHeight: 22 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 8, borderTopWidth: 1 },
  micBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  textInput: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
});
