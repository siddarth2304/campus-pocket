import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as Speech from 'expo-speech';
import { Activity, AlertCircle, ArrowLeft, BookOpen, BrainCircuit, Calendar, ChevronRight, DollarSign, FileText, Languages, LogOut, MessageSquare, Mic, Phone, ShieldAlert, Square, Type, Volume2, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../src/lib/supabase';
import { useStore } from '../src/store/useStore';

export default function ParentPortal() {
  const router = useRouter();
  const { user, logout } = useStore();
  const [children, setChildren] = useState<any[]>([]);
  const [insights, setInsights] = useState<{ [key: string]: any }>({});
  const [globalEvents, setGlobalEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [askModalVisible, setAskModalVisible] = useState(false);
  const [currentChild, setCurrentChild] = useState<any>(null);
  const [askQuery, setAskQuery] = useState('');
  const [askResponse, setAskResponse] = useState('');
  const [asking, setAsking] = useState(false);

  // Message Modal State
  const [msgModalVisible, setMsgModalVisible] = useState(false);
  const [msgResponse, setMsgResponse] = useState('');

  // Cortex Assistant State
  const [cortexVisible, setCortexVisible] = useState(false);
  const [cortexQuery, setCortexQuery] = useState('');
  const [cortexResponse, setCortexResponse] = useState('');

  // Accessibility State
  const [translating, setTranslating] = useState<{ [key: string]: boolean }>({});
  const [speaking, setSpeaking] = useState<{ [key: string]: boolean }>({});
  const [isDyslexic, setIsDyslexic] = useState(false);
  const [mascotVisible, setMascotVisible] = useState(false);

  const toggleTTS = (childId: string, text: string) => {
    if (speaking[childId]) {
      Speech.stop();
      setSpeaking(prev => ({ ...prev, [childId]: false }));
    } else {
      Speech.stop(); // Stop anything else playing
      setSpeaking({}); // Clear all
      setSpeaking(prev => ({ ...prev, [childId]: true }));

      const isHindi = /[\u0900-\u097F]/.test(text);
      Speech.speak(text, {
        language: isHindi ? 'hi-IN' : 'en',
        rate: 0.9,
        onDone: () => setSpeaking(prev => ({ ...prev, [childId]: false })),
        onStopped: () => setSpeaking(prev => ({ ...prev, [childId]: false })),
      });
    }
  };

  const playBriefing = (child: any) => {
    const id = `briefing-${child.id}`;
    if (speaking[id]) {
      Speech.stop();
      setSpeaking(prev => ({ ...prev, [id]: false }));
      return;
    }

    Speech.stop();
    setSpeaking({});
    setSpeaking(prev => ({ ...prev, [id]: true }));

    const text = `Good morning. ${child.username} needs attention today. Attendance is ${child.attendancePercent.toFixed(0)} percent, average grade is ${child.avgGrade.toFixed(0)} percent, and fees are ${child.overdueFees ? 'overdue' : 'cleared'}. Recommended action: ${insights[child.id]?.recommendations?.[0] || 'review recent assignments'}.`;

    Speech.speak(text, {
      language: 'en',
      rate: 0.9,
      onDone: () => setSpeaking(prev => ({ ...prev, [id]: false })),
      onStopped: () => setSpeaking(prev => ({ ...prev, [id]: false })),
    });
  };

  const handleCortexQuery = () => {
    if (!cortexQuery.trim() || children.length === 0) return;

    const child = children[0];
    const insight = insights[child.id];
    const q = cortexQuery.toLowerCase();

    let response = "I'm not sure. Try asking about attendance, grades, fees, or risk level.";
    if (q.includes('risk')) {
      response = `Your child is at a ${insight?.risk_level || 'UNKNOWN'} risk level.`;
      if (insight?.risk_level === 'HIGH') response += " This requires immediate attention.";
    } else if (q.includes('fee') || q.includes('pending')) {
      response = child.overdueFees ? "Yes, there are overdue fees on your account." : "No, all fees are currently cleared.";
    } else if (q.includes('attendance')) {
      response = `Attendance is currently at ${child.attendancePercent.toFixed(0)} percent.`;
    } else if (q.includes('grade') || q.includes('score')) {
      response = `The average grade is ${child.avgGrade.toFixed(0)} percent.`;
    } else if (q.includes('today') || q.includes('do')) {
      response = `Today's action plan: ${insight?.recommendations?.join('. ') || 'Review the dashboard.'}`;
    }

    setCortexResponse(response);

    Speech.stop();
    setSpeaking({});
    setSpeaking(prev => ({ ...prev, cortex: true }));
    Speech.speak(response, {
      language: 'en',
      rate: 0.9,
      onDone: () => setSpeaking(prev => ({ ...prev, cortex: false })),
      onStopped: () => setSpeaking(prev => ({ ...prev, cortex: false })),
    });
  };

  const handleTranslate = async (childId: string, insightReason: string) => {
    if (translating[childId] || !insightReason) return;
    setTranslating(prev => ({ ...prev, [childId]: true }));
    try {
      const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encodeURIComponent(insightReason)}`);
      const data = await response.json();
      if (data && data[0]) {
        const translatedText = data[0].map((item: any) => item[0]).join('');
        setInsights(prev => ({
          ...prev,
          [childId]: { ...prev[childId], reason: translatedText }
        }));
      }
    } catch (e) {
      console.log(e);
      Alert.alert("Translation Failed", "Could not connect to translation service.");
    }
    setTranslating(prev => ({ ...prev, [childId]: false }));
  };

  useEffect(() => {
    fetchData();

    const attendanceSub = supabase
      .channel('public:attendance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, payload => {
        fetchData();
      })
      .subscribe();

    const gradesSub = supabase
      .channel('public:assignment_submission')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignment_submission' }, payload => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceSub);
      supabase.removeChannel(gradesSub);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const { data: eventsData } = await supabase.from('global_events').select('*, classroom(name)').order('date', { ascending: true });

    const { data: links } = await supabase
      .from('parent_student_link')
      .select('student_id, users!parent_student_link_student_id_fkey(username)')
      .eq('parent_id', user?.id);

    if (links) {
      const childrenData = await Promise.all(links.map(async (link: any) => {
        const studentId = link.student_id;

        const [attendanceRes, gradesRes, feesRes, classRes] = await Promise.all([
          supabase.from('attendance').select('status').eq('student_id', studentId),
          supabase.from('assignment_submission').select('percentage').eq('user_id', studentId),
          supabase.from('fees').select('status, amount').eq('student_id', studentId),
          supabase.from('classroom_membership').select('classroom_id').eq('user_id', studentId)
        ]);

        const attendance = attendanceRes.data || [];
        const grades = gradesRes.data || [];
        const fees = feesRes.data || [];
        const classIds = (classRes.data || []).map((c: any) => c.classroom_id);

        const totalAttendance = attendance.length;
        const presentCount = attendance.filter((a: any) => a.status === 'PRESENT' || a.status === 'LATE').length;
        const attendancePercent = totalAttendance ? (presentCount / totalAttendance) * 100 : 100;

        const nextAbsencePercent = totalAttendance ? (presentCount / (totalAttendance + 1)) * 100 : 100;
        let futureRisk = null;
        if (nextAbsencePercent < 75 && attendancePercent >= 75) {
          futureRisk = `Critical: 1 more absence drops attendance below 75%`;
        } else if (attendancePercent < 75) {
          futureRisk = `Attendance is critically low. Action required.`;
        }

        const totalGrades = grades.reduce((sum: number, g: any) => sum + Number(g.percentage), 0);
        const avgGrade = grades.length ? totalGrades / grades.length : 100;

        const overdueFees = fees.filter((f: any) => f.status === 'OVERDUE');

        let whatChanged = null;
        if (overdueFees.length > 0) whatChanged = "⚠️ Fee Overdue Added";
        else if (attendancePercent < 80) whatChanged = "📉 Recent Attendance Drop";

        const insightRes = await supabase.functions.invoke('insight_engine', {
          body: { studentId }
        });

        if (insightRes.error || insightRes.data?.error) {
          const errMsg = insightRes.error?.message || insightRes.error?.toString() || insightRes.data?.error || 'Unknown error';
          console.error("Insight Error:", errMsg);
          setInsights(prev => ({
            ...prev,
            [studentId]: { risk_level: 'UNKNOWN', reason: `Error: ${errMsg}` }
          }));
        } else if (insightRes.data) {
          setInsights(prev => ({ ...prev, [studentId]: insightRes.data }));
        }

        return {
          id: studentId,
          username: link.users.username,
          attendancePercent,
          avgGrade,
          overdueFees: overdueFees.length > 0,
          classIds,
          futureRisk,
          whatChanged
        };
      }));

      const allClassIds = new Set();
      childrenData.forEach(c => c.classIds.forEach((id: string) => allClassIds.add(id)));

      if (eventsData) {
        setGlobalEvents(eventsData.filter(e => !e.classroom_id || allClassIds.has(e.classroom_id)));
      }

      setChildren(childrenData);
    }
    setLoading(false);
  };

  const generatePDF = async (child: any) => {
    const insight = insights[child.id];
    const html = `
      <html>
        <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1f2937;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="color: #4f46e5; margin: 0; font-size: 32px;">Campus Cortex AI</h1>
            <p style="color: #6b7280; font-size: 16px; margin-top: 5px;">Official Progress Report</p>
          </div>
          <div style="background-color: #f9fafb; padding: 24px; border-radius: 12px; border: 1px solid #e5e7eb;">
            <h2 style="margin-top: 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Student: ${child.username}</h2>
            <table style="width: 100%; font-size: 18px; margin-top: 20px;">
              <tr>
                <td style="padding: 10px 0; color: #4b5563;"><strong>Attendance</strong></td>
                <td style="text-align: right; font-weight: bold; color: ${child.attendancePercent < 75 ? '#dc2626' : '#15803d'};">${child.attendancePercent.toFixed(1)}%</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #4b5563;"><strong>Average Grade</strong></td>
                <td style="text-align: right; font-weight: bold;">${child.avgGrade.toFixed(1)}%</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #4b5563;"><strong>Fee Status</strong></td>
                <td style="text-align: right; font-weight: bold; color: ${child.overdueFees ? '#dc2626' : '#15803d'};">${child.overdueFees ? 'OVERDUE' : 'CLEARED'}</td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #eef2ff; padding: 24px; border-radius: 12px; margin-top: 30px; border-left: 6px solid #4f46e5;">
            <h3 style="color: #4338ca; margin-top: 0; font-size: 20px;">AI Risk Assessment: ${insight?.risk_level || 'UNKNOWN'}</h3>
            <p style="font-size: 16px; line-height: 1.6;">${insight?.reason || 'No insight available'}</p>
            <h4 style="margin-bottom: 10px;">Recommended Action Plan:</h4>
            <ul style="font-size: 15px; line-height: 1.5; padding-left: 20px; color: #374151;">
              ${insight?.recommendations?.map((r: string) => `<li style="margin-bottom: 5px;">${r}</li>`).join('') || '<li>Please contact the school directly.</li>'}
            </ul>
          </div>
          
          <p style="text-align: center; color: #9ca3af; margin-top: 50px; font-size: 12px;">Generated securely by Campus Cortex AI</p>
        </body>
      </html>
    `;

    try {
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri);
      }
    } catch (err) {
      if (Platform.OS !== 'web') Alert.alert('Error generating PDF');
      else console.error('Error generating PDF', err);
    }
  };

  const openAskModal = (child: any) => {
    setCurrentChild(child);
    setAskQuery('');
    setAskResponse('');
    setAskModalVisible(true);
  };

  const submitAsk = async () => {
    if (!askQuery.trim()) return;
    setAsking(true);
    const insight = insights[currentChild.id];
    const { data, error } = await supabase.functions.invoke('gemini_assistant', {
      body: {
        action: 'qa',
        query: askQuery,
        contextData: {
          attendancePercent: currentChild.attendancePercent,
          avgGrade: currentChild.avgGrade,
          overdueFees: currentChild.overdueFees,
          riskLevel: insight?.risk_level,
          reason: insight?.reason
        }
      }
    });
    setAsking(false);
    if (data?.response) {
      setAskResponse(data.response);
    } else {
      setAskResponse("Error: " + (error?.message || data?.error || 'Failed to reach AI.'));
    }
  };

  const generateMessage = async (child: any) => {
    setCurrentChild(child);
    setMsgResponse('');
    setAsking(true);
    setMsgModalVisible(true);

    const insight = insights[child.id];
    const { data, error } = await supabase.functions.invoke('gemini_assistant', {
      body: {
        action: 'generate_message',
        contextData: {
          attendancePercent: child.attendancePercent,
          avgGrade: child.avgGrade,
          riskLevel: insight?.risk_level,
          reason: insight?.reason
        }
      }
    });
    setAsking(false);
    if (data?.response) {
      setMsgResponse(data.response);
    } else {
      setMsgResponse("Error: " + (error?.message || data?.error || 'Failed to reach AI.'));
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Syncing Intelligence Engine...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#312e81' }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#312e81' }} edges={['top', 'bottom']}>
        <ScrollView style={{ backgroundColor: '#f1f5f9' }} contentContainerStyle={styles.scroll}>
          <LinearGradient colors={['#312e81', '#4338ca']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGradient}>
            <View style={styles.headerContent}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => router.replace('/')} style={styles.backBtn}>
                  <ArrowLeft size={24} color="#fff" />
                </TouchableOpacity>
                <View>
                  <Text style={styles.title}>Command Centre</Text>
                  <Text style={styles.subtitle}>Welcome back, Parent</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => { logout(); router.replace('/'); }} style={styles.logoutBtn}>
                <LogOut size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {children.map(child => {
            const insight = insights[child.id];
            const isHighRisk = insight?.risk_level === 'HIGH';
            const isMedRisk = insight?.risk_level === 'MEDIUM';
            const isUnknown = insight?.risk_level === 'UNKNOWN' || !insight;

            let gradientColors = ['#f0fdf4', '#dcfce7'];
            let iconColor = '#15803d';
            let borderColor = '#86efac';

            if (isHighRisk) {
              gradientColors = ['#fef2f2', '#fee2e2'];
              iconColor = '#dc2626';
              borderColor = '#fca5a5';
            } else if (isMedRisk) {
              gradientColors = ['#fffbeb', '#fef3c7'];
              iconColor = '#b45309';
              borderColor = '#fcd34d';
            } else if (isUnknown) {
              gradientColors = ['#f3f4f6', '#e5e7eb'];
              iconColor = '#6b7280';
              borderColor = '#d1d5db';
            }

            return (
              <View key={child.id} style={styles.childSection}>
                <View style={styles.childHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{child.username.charAt(0).toUpperCase()}</Text></View>
                    <Text style={[styles.childName, isDyslexic && styles.dyslexicFont, { flexShrink: 1 }]} numberOfLines={2}>{child.username}'s Intelligence Profile</Text>
                  </View>
                  <TouchableOpacity onPress={() => setIsDyslexic(!isDyslexic)} style={[styles.accessToggle, isDyslexic && { backgroundColor: '#4f46e5' }]}>
                    <Type size={16} color={isDyslexic ? "#fff" : "#4f46e5"} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.briefingBtn} onPress={() => playBriefing(child)}>
                  {speaking[`briefing-${child.id}`] ? <Square size={16} color="#dc2626" fill="#dc2626" /> : <Mic size={16} color="#4f46e5" />}
                  <Text style={styles.briefingBtnText}>{speaking[`briefing-${child.id}`] ? 'Stop Briefing' : 'Daily Voice Briefing'}</Text>
                </TouchableOpacity>

                <LinearGradient colors={gradientColors as [string, string]} style={[styles.insightCard, { borderColor }]}>
                  <View style={styles.insightHeader}>
                    <ShieldAlert color={iconColor} size={24} strokeWidth={2.5} />
                    <Text style={[styles.insightTitle, { color: iconColor }]}>
                      Risk Assessment: {insight?.risk_level || 'ANALYZING...'}
                    </Text>
                  </View>
                  <Text style={[styles.insightReason, isDyslexic && styles.dyslexicFont]}>{insight?.reason || 'Syncing data from school servers...'}</Text>

                  <View style={styles.accessBar}>
                    <TouchableOpacity style={styles.accessBtn} onPress={() => toggleTTS(child.id, insight?.reason || '')}>
                      {speaking[child.id] ? <Square size={16} color="#dc2626" fill="#dc2626" /> : <Volume2 size={16} color="#4b5563" />}
                      <Text style={styles.accessBtnText}>{speaking[child.id] ? 'Stop' : 'Read Aloud'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.accessBtn} onPress={() => handleTranslate(child.id, insight?.reason || '')}>
                      {translating[child.id] ? <ActivityIndicator size="small" color="#4b5563" /> : <Languages size={16} color="#4b5563" />}
                      <Text style={styles.accessBtnText}>Translate</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>

                {insight?.recommendations && insight.recommendations.length > 0 && (
                  <View style={styles.actionPlanContainer}>
                    <Text style={styles.actionPlanTitle}>TODAY'S ACTION PLAN</Text>
                    {insight.recommendations.map((rec: string, i: number) => (
                      <View key={i} style={styles.actionPlanItem}>
                        <View style={[styles.actionPlanCheck, { borderColor: iconColor }]} />
                        <Text style={[styles.actionPlanText, isDyslexic && styles.dyslexicFont]}>{rec}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {(child.futureRisk || child.whatChanged) && (
                  <View style={styles.alertsContainer}>
                    {child.whatChanged && (
                      <View style={styles.alertBox}>
                        <Text style={styles.alertTitle}>WHAT CHANGED</Text>
                        <Text style={[styles.alertText, isDyslexic && styles.dyslexicFont]}>{child.whatChanged}</Text>
                      </View>
                    )}
                    {child.futureRisk && (
                      <View style={styles.alertBoxRisk}>
                        <Text style={styles.alertTitleRisk}>FUTURE RISK PREDICTION</Text>
                        <Text style={[styles.alertTextRisk, isDyslexic && styles.dyslexicFont]}>{child.futureRisk}</Text>
                      </View>
                    )}
                  </View>
                )}


                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <View style={[styles.statIconBg, { backgroundColor: '#e0e7ff' }]}><Activity size={20} color="#4f46e5" /></View>
                    <Text style={styles.statValue}>{child.attendancePercent.toFixed(0)}%</Text>
                    <Text style={styles.statLabel}>Attendance</Text>
                  </View>
                  <View style={styles.statBox}>
                    <View style={[styles.statIconBg, { backgroundColor: '#dbeafe' }]}><BookOpen size={20} color="#2563eb" /></View>
                    <Text style={styles.statValue}>{child.avgGrade.toFixed(0)}%</Text>
                    <Text style={styles.statLabel}>Avg Grade</Text>
                  </View>
                  <View style={[styles.statBox, child.overdueFees && styles.statBoxAlert]}>
                    <View style={[styles.statIconBg, { backgroundColor: child.overdueFees ? '#fee2e2' : '#dcfce7' }]}>
                      <DollarSign size={20} color={child.overdueFees ? '#dc2626' : '#16a34a'} />
                    </View>
                    <Text style={[styles.statValue, child.overdueFees && { color: '#dc2626' }]}>
                      {child.overdueFees ? 'Overdue' : 'Paid'}
                    </Text>
                    <Text style={[styles.statLabel, child.overdueFees && { color: '#dc2626' }]}>Fees</Text>
                  </View>
                </View>

                <View style={styles.actionGrid}>
                  <View style={styles.smartActionsRow}>
                    <TouchableOpacity style={styles.smartActionBtn} onPress={() => Linking.openURL('tel:+1234567890')}>
                      <Phone size={18} color="#4f46e5" />
                      <Text style={styles.smartActionText}>Call School</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.smartActionBtn} onPress={() => generateMessage(child)}>
                      <MessageSquare size={18} color="#10b981" />
                      <Text style={[styles.smartActionText, { color: '#10b981' }]}>Msg Teacher</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.smartActionBtn} onPress={() => generatePDF(child)}>
                      <FileText size={18} color="#8b5cf6" />
                      <Text style={[styles.smartActionText, { color: '#8b5cf6' }]}>Report</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.actionCard} onPress={() => openAskModal(child)}>
                    <LinearGradient colors={['#ffffff', '#f8fafc']} style={styles.actionGradient}>
                      <BrainCircuit size={24} color="#8b5cf6" />
                      <Text style={styles.actionText}>Ask Cortex AI</Text>
                      <ChevronRight size={16} color="#cbd5e1" style={styles.actionArrow} />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {/* GLOBAL EVENTS SECTION */}
          {globalEvents.length > 0 && (
            <View style={{ marginTop: 24, marginBottom: 40 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Calendar size={24} color="#4f46e5" />
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', marginLeft: 8 }}>School Announcements</Text>
              </View>
              {globalEvents.map(evt => (
                <View key={evt.id} style={{ backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e0e7ff' }}>
                  <View style={{ backgroundColor: '#eef2ff', padding: 12, borderRadius: 12, marginRight: 16, alignItems: 'center', minWidth: 60 }}>
                    <Text style={{ color: '#4f46e5', fontSize: 12, fontWeight: '700' }}>{new Date(evt.date).toLocaleString('default', { month: 'short' }).toUpperCase()}</Text>
                    <Text style={{ color: '#312e81', fontSize: 20, fontWeight: '800' }}>{new Date(evt.date).getDate()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginRight: 8 }}>{evt.title}</Text>
                      <View style={{ backgroundColor: evt.classroom_id ? 'rgba(217, 119, 6, 0.2)' : 'rgba(79, 70, 229, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: evt.classroom_id ? '#fbbf24' : '#818cf8' }}>
                          {evt.classroom ? evt.classroom.name : 'GLOBAL'}
                        </Text>
                      </View>
                    </View>
                    {evt.description && <Text style={{ fontSize: 14, color: '#64748b' }}>{evt.description}</Text>}
                  </View>
                  <AlertCircle size={20} color="#818cf8" />
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Floating Cortex Buddy */}
        <TouchableOpacity
          style={styles.mascotBtn}
          onPress={() => setCortexVisible(true)}
        >
          <BrainCircuit size={30} color="#fff" />
        </TouchableOpacity>

        <Modal visible={cortexVisible} animationType="slide" transparent>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardWrapper}
              >
                <TouchableWithoutFeedback onPress={() => { }}>
                  <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                      <View style={styles.modalHeaderLeft}>
                        <BrainCircuit size={24} color="#8b5cf6" />
                        <Text style={styles.modalTitle}>Cortex Buddy 🤖</Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => {
                          Keyboard.dismiss();
                          Speech.stop();
                          setCortexVisible(false);
                        }}
                        style={styles.closeBtn}
                      >
                        <X size={20} color="#6b7280" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.modalBody}>
                      <Text style={styles.modalContextText}>
                        Ask me about attendance, grades, fees, or risk.
                      </Text>

                      {cortexResponse ? (
                        <View style={styles.aiChatBubble}>
                          <Text style={styles.aiChatText}>{cortexResponse}</Text>
                        </View>
                      ) : null}

                      <View style={styles.inputWrapper}>
                        <TextInput
                          style={styles.aiInput}
                          placeholder="e.g. Are fees pending?"
                          placeholderTextColor="#9ca3af"
                          value={cortexQuery}
                          onChangeText={setCortexQuery}
                          multiline
                          returnKeyType="done"
                          blurOnSubmit
                          onSubmitEditing={Keyboard.dismiss}
                        />

                        <TouchableOpacity
                          style={styles.aiSendBtn}
                          onPress={() => {
                            Keyboard.dismiss();
                            handleCortexQuery();
                          }}
                        >
                          <Text style={styles.aiSendText}>Ask</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        onPress={() => {
                          Alert.alert(
                            'Voice Input',
                            'Voice listening depends on device permissions. For demo safety, please type the question here and Cortex Buddy will speak the answer.'
                          );
                        }}
                        style={styles.voiceBtn}
                      >
                        <Mic size={18} color="#4f46e5" />
                        <Text style={styles.voiceBtnText}>Tap to Speak</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => Speech.stop()}
                        style={{ marginTop: 12, alignItems: 'center' }}
                      >
                        <Text style={{ color: '#dc2626', fontWeight: '700' }}>
                          Stop Speaking
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableWithoutFeedback>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>


        {/* Ask AI Modal */}
        <Modal visible={askModalVisible} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <BrainCircuit size={24} color="#8b5cf6" />
                  <Text style={styles.modalTitle}>Ask Campus Cortex AI</Text>
                </View>
                <TouchableOpacity onPress={() => setAskModalVisible(false)} style={styles.closeBtn}>
                  <X size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <Text style={styles.modalContextText}>
                  AI is analyzing <Text style={{ fontWeight: 'bold' }}>{currentChild?.username}</Text>'s latest stats. What do you want to know?
                </Text>

                {askResponse ? (
                  <View style={styles.aiChatBubble}>
                    <Text style={styles.aiChatText}>{askResponse}</Text>
                  </View>
                ) : null}

                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.aiInput}
                    placeholder="e.g. Why is the risk level high today?"
                    placeholderTextColor="#9ca3af"
                    value={askQuery}
                    onChangeText={setAskQuery}
                    multiline
                    autoFocus
                  />
                  <TouchableOpacity style={styles.aiSendBtn} onPress={submitAsk} disabled={asking}>
                    {asking ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.aiSendText}>Send</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* Ask AI Modal */}
        <Modal visible={msgModalVisible} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <MessageSquare size={24} color="#10b981" />
                  <Text style={styles.modalTitle}>AI Message Drafter</Text>
                </View>
                <TouchableOpacity onPress={() => setMsgModalVisible(false)} style={styles.closeBtn}>
                  <X size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                {asking ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color="#10b981" />
                    <Text style={{ marginTop: 10, color: '#6b7280' }}>Generating professional draft...</Text>
                  </View>
                ) : (
                  <View style={styles.draftBox}>
                    <Text style={styles.draftText}>{msgResponse}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#4f46e5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#4b5563', fontWeight: '500' },

  headerGradient: {
    paddingTop: Platform.OS === 'web' ? 20 : 10,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginHorizontal: -16, // offset scrollview padding
    marginTop: -24, // offset scrollview padding
    marginBottom: 24
  },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: '#e0e7ff', marginTop: 4, opacity: 0.9 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  logoutText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  scroll: { padding: 16, paddingTop: 24 },
  childSection: { marginBottom: 32, backgroundColor: '#fff', borderRadius: 24, padding: 20, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' as any, },

  childHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  childName: { fontSize: 20, fontWeight: '700', color: '#111827' },

  insightCard: { padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  insightTitle: { fontSize: 18, fontWeight: '800', marginLeft: 10, letterSpacing: -0.5 },
  insightReason: { fontSize: 16, color: '#374151', marginBottom: 16, lineHeight: 24, fontWeight: '500' },
  recommendations: { backgroundColor: 'rgba(255,255,255,0.6)', padding: 16, borderRadius: 12 },
  recTitle: { fontSize: 13, fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  recItemRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  recDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, marginRight: 8 },
  recItem: { flex: 1, fontSize: 15, color: '#4b5563', lineHeight: 22 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, alignItems: 'center', marginHorizontal: 4, borderWidth: 1, borderColor: '#f1f5f9' },
  statBoxAlert: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  statIconBg: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  statLabel: { fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' },

  actionGrid: { flexDirection: 'column', gap: 12 },
  actionCard: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' as any },
  actionGradient: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  actionText: { color: '#1e293b', fontWeight: '600', fontSize: 16, marginLeft: 12, flex: 1 },
  actionArrow: { marginLeft: 'auto' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', width: '100%', maxWidth: 600, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', boxShadow: '0 -10px 15px -3px rgba(0, 0, 0, 0.1)' as any },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginLeft: 10 },
  closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },

  modalBody: { padding: 20 },
  modalContextText: { fontSize: 14, color: '#64748b', marginBottom: 20, textAlign: 'center' },

  aiChatBubble: { backgroundColor: '#f3e8ff', padding: 16, borderRadius: 16, borderBottomLeftRadius: 4, marginBottom: 20 },
  aiChatText: { color: '#4c1d95', fontSize: 16, lineHeight: 24 },

  inputWrapper: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#f8fafc', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 8 },
  aiInput: { flex: 1, padding: 12, minHeight: 40, maxHeight: 120, fontSize: 16, outlineStyle: 'none' as any },
  aiSendBtn: { backgroundColor: '#8b5cf6', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginLeft: 8 },
  aiSendText: { color: '#fff', fontWeight: '700' },

  loadingBox: { padding: 40, alignItems: 'center' },
  draftBox: { backgroundColor: '#ecfdf5', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#a7f3d0' },
  draftText: { fontSize: 16, color: '#065f46', lineHeight: 24 },

  accessToggle: { marginLeft: 'auto', backgroundColor: '#e0e7ff', padding: 8, borderRadius: 20 },
  dyslexicFont: { fontFamily: Platform.OS === 'ios' ? 'Trebuchet MS' : 'sans-serif', letterSpacing: 1.2, lineHeight: 26 },

  accessBar: { flexDirection: 'row', gap: 10, marginTop: 10 },
  accessBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6 },
  accessBtnText: { color: '#4b5563', fontSize: 13, fontWeight: '600' },

  actionPlanContainer: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 16, marginBottom: 20 },
  actionPlanTitle: { fontSize: 12, fontWeight: '800', color: '#64748b', letterSpacing: 1, marginBottom: 12 },
  actionPlanItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  actionPlanCheck: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, marginRight: 12 },
  actionPlanText: { fontSize: 15, color: '#1e293b', flex: 1 },

  alertsContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  alertBox: { flex: 1, backgroundColor: '#fffbeb', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#fde68a' },
  alertTitle: { fontSize: 10, fontWeight: '800', color: '#b45309', marginBottom: 4 },
  alertText: { fontSize: 13, color: '#92400e', fontWeight: '600' },
  alertBoxRisk: { flex: 1, backgroundColor: '#fef2f2', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#fecaca' },
  alertTitleRisk: { fontSize: 10, fontWeight: '800', color: '#dc2626', marginBottom: 4 },
  alertTextRisk: { fontSize: 13, color: '#991b1b', fontWeight: '600' },

  smartActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  smartActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 6 },
  smartActionText: { color: '#4f46e5', fontWeight: '600', fontSize: 14 },

  briefingBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e0e7ff', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#c7d2fe', gap: 8 },
  briefingBtnText: { color: '#4f46e5', fontWeight: '700', fontSize: 15 },

  backBtn: { padding: 8, marginRight: 8, marginLeft: -8 },
  mascotBtn: { position: 'absolute', bottom: 60, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#8b5cf6', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 10, zIndex: 100 },
  mascotTooltip: { position: 'absolute', bottom: 130, right: 20, backgroundColor: '#fff', padding: 15, borderRadius: 16, borderBottomRightRadius: 4, width: 220, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5, zIndex: 99, borderWidth: 1, borderColor: '#e2e8f0' },
  mascotText: { color: '#4c1d95', fontWeight: '600', fontSize: 14, lineHeight: 20 },

  keyboardWrapper: {
    width: '100%',
    justifyContent: 'flex-end',
  },

  voiceBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ff',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },

  voiceBtnText: {
    color: '#4f46e5',
    fontWeight: '700',
  },
});
