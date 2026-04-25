import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useStore } from '../src/store/useStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Users, Calendar as CalendarIcon, LogOut, Plus, Megaphone, ArrowLeft, Upload, FileSpreadsheet, CheckCircle } from 'lucide-react-native';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function AdminPortal() {
  const router = useRouter();
  const { user, logout } = useStore();
  const [loading, setLoading] = useState(true);
  
  // Dashboard Stats
  const [totalStudents, setTotalStudents] = useState(0);
  const [overallAttendance, setOverallAttendance] = useState(0);
  const [debugError, setDebugError] = useState<string | null>(null);
  
  // Events & Classrooms
  const [events, setEvents] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);
  
  // Form State
  const [title, setTitle] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [desc, setDesc] = useState('');
  const [posting, setPosting] = useState(false);

  // Bulk Upload State
  const [csvText, setCsvText] = useState('');
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [recentUploads, setRecentUploads] = useState<any[]>([]);

  useEffect(() => {
    fetchData();

    const eventSub = supabase.channel('public:events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_events' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(eventSub);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setDebugError(null);
    try {
      // 1. Fetch Students count
      const { count: studentCount, error: err1 } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student');
        
      if (err1) throw new Error(`Users query error: ${err1.message}`);
      setTotalStudents(studentCount || 0);

      // 2. Fetch overall attendance
      const { data: attData, error: err2 } = await supabase.from('attendance').select('status');
      if (err2) throw new Error(`Attendance query error: ${err2.message}`);
      
      if (attData && attData.length > 0) {
        const present = attData.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
        setOverallAttendance((present / attData.length) * 100);
      }

      // 3. Fetch global events
      const { data: eventData, error: err3 } = await supabase
        .from('global_events')
        .select('*, classroom(name)')
        .order('date', { ascending: true });
        
      if (err3) throw new Error(`Events query error: ${err3.message}`);
      setEvents(eventData || []);

      // 4. Fetch classrooms
      const { data: classData, error: err4 } = await supabase.from('classroom').select('*');
      if (err4) throw new Error(`Classroom query error: ${err4.message}`);
      setClassrooms(classData || []);
    } catch (e: any) {
      setDebugError(e.message);
    }

    setLoading(false);
  };

  const handleCreateEvent = async () => {
    if (!title || !dateStr) return;
    setPosting(true);
    
    // Convert DD/MM/YYYY or YYYY-MM-DD to proper DATE if needed. 
    // We assume YYYY-MM-DD for simplicity in the demo.
    const { error } = await supabase.from('global_events').insert({
      title,
      date: dateStr,
      description: desc,
      classroom_id: selectedClassroomId,
      created_by: user?.id
    });

    if (!error) {
      setTitle('');
      setDateStr('');
      setDesc('');
      fetchData(); // Auto-refresh the list
    }
    setPosting(false);
  };

  const handleBulkUpload = async () => {
    if (!csvText.trim()) return;
    setUploadingCsv(true);
    
    try {
      const lines = csvText.split('\n');
      const newStudents = [];
      
      const { data: schools } = await supabase.from('schools').select('id').limit(1);
      const schoolId = schools?.[0]?.id;
      
      if (!schoolId) throw new Error("No school found in DB");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.toLowerCase().includes('username') || line.toLowerCase().includes('name')) continue;
        
        const cols = line.split(',');
        const username = cols[0]?.trim();
        if (!username) continue;
        
        const fakeUuid = generateUUID();
        
        const { error: insErr } = await supabase.from('users').insert({
           id: fakeUuid,
           username: username,
           role: 'student',
           school_id: schoolId
        });
        
        if (!insErr) {
           newStudents.push({ username, role: 'student' });
        } else {
           console.log("Insert err", insErr);
        }
      }
      
      setRecentUploads(newStudents);
      setCsvText('');
      fetchData();
      Alert.alert("Success", `Uploaded ${newStudents.length} students to the database.`);
    } catch (e: any) {
      setDebugError(e.message);
    }
    setUploadingCsv(false);
  };

  if (loading && totalStudents === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Loading Admin Command Center...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#312e81', '#1e1b4b']} style={styles.headerGradient}>
        <View style={styles.headerContent}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <TouchableOpacity onPress={() => router.replace('/')} style={{padding: 8, marginRight: 8, marginLeft: -8}}>
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text style={styles.title}>Admin Command Center</Text>
              <Text style={styles.subtitle}>Welcome back, {user?.username}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => { logout(); router.replace('/'); }} style={styles.logoutBtn}>
            <LogOut size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll}>
        
        {debugError && (
          <View style={{backgroundColor: '#fef2f2', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#f87171'}}>
            <Text style={{color: '#b91c1c', fontWeight: 'bold'}}>Debug Error:</Text>
            <Text style={{color: '#b91c1c'}}>{debugError}</Text>
          </View>
        )}

        {/* DASHBOARD STATS */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: '#e0e7ff' }]}>
              <Users size={24} color="#4f46e5" />
            </View>
            <Text style={styles.statValue}>{totalStudents}</Text>
            <Text style={styles.statLabel}>Total Students</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: '#dcfce7' }]}>
              <CalendarIcon size={24} color="#16a34a" />
            </View>
            <Text style={styles.statValue}>{overallAttendance.toFixed(1)}%</Text>
            <Text style={styles.statLabel}>School Attendance</Text>
          </View>
        </View>

        {/* BULK CSV UPLOAD */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <FileSpreadsheet size={20} color="#10b981" />
            <Text style={styles.cardTitle}>Smart CSV Bulk Upload</Text>
          </View>
          <Text style={{color: '#64748b', fontSize: 13, marginBottom: 12}}>
            Paste CSV data to instantly sync students (Format: <Text style={{fontWeight: 'bold'}}>Username, Email</Text>)
          </Text>
          
          <TextInput 
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]} 
            placeholder="student5, student5@school.com&#10;student6, student6@school.com" 
            value={csvText} 
            onChangeText={setCsvText} 
            multiline
          />
          
          <TouchableOpacity 
            style={[styles.postBtn, {backgroundColor: '#10b981', marginTop: 12}]} 
            onPress={handleBulkUpload}
            disabled={uploadingCsv}
          >
            {uploadingCsv ? <ActivityIndicator color="#fff" /> : (
              <>
                <Upload size={18} color="#fff" />
                <Text style={styles.postBtnText}>Sync to Database</Text>
              </>
            )}
          </TouchableOpacity>

          {recentUploads.length > 0 && (
            <View style={{marginTop: 16, padding: 12, backgroundColor: '#ecfdf5', borderRadius: 12, borderWidth: 1, borderColor: '#a7f3d0'}}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
                <CheckCircle size={16} color="#059669" />
                <Text style={{color: '#065f46', fontWeight: '700', marginLeft: 6}}>Recently Uploaded</Text>
              </View>
              {recentUploads.map((st, i) => (
                <Text key={i} style={{color: '#047857', fontSize: 13}}>• {st.username} (Student)</Text>
              ))}
            </View>
          )}
        </View>

        {/* CREATE EVENT FORM */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Megaphone size={20} color="#4f46e5" />
            <Text style={styles.cardTitle}>Post Global Event</Text>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Target Audience</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
              <TouchableOpacity 
                style={[styles.classChip, selectedClassroomId === null && styles.classChipActive]}
                onPress={() => setSelectedClassroomId(null)}
              >
                <Text style={[styles.classChipText, selectedClassroomId === null && styles.classChipTextActive]}>All Students</Text>
              </TouchableOpacity>
              {classrooms.map(cls => (
                <TouchableOpacity 
                  key={cls.id}
                  style={[styles.classChip, selectedClassroomId === cls.id && styles.classChipActive]}
                  onPress={() => setSelectedClassroomId(cls.id)}
                >
                  <Text style={[styles.classChipText, selectedClassroomId === cls.id && styles.classChipTextActive]}>{cls.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Event Title</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. Science Fair 2026" 
              value={title} 
              onChangeText={setTitle} 
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="2026-10-15" 
              value={dateStr} 
              onChangeText={setDateStr} 
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              placeholder="Event details..." 
              value={desc} 
              onChangeText={setDesc} 
              multiline
              numberOfLines={3}
            />
          </View>

          <TouchableOpacity 
            style={[styles.submitBtn, (!title || !dateStr || posting) && styles.submitBtnDisabled]}
            onPress={handleCreateEvent}
            disabled={!title || !dateStr || posting}
          >
            {posting ? <ActivityIndicator color="#fff" /> : (
              <>
                <Plus size={20} color="#fff" />
                <Text style={styles.submitBtnText}>Post Announcement</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* UPCOMING EVENTS LIST */}
        <Text style={styles.sectionTitle}>Upcoming Events</Text>
        {events.length === 0 ? (
          <Text style={styles.emptyText}>No events scheduled.</Text>
        ) : (
          events.map((evt) => (
            <View key={evt.id} style={styles.eventCard}>
              <View style={styles.eventDateBox}>
                <Text style={styles.eventMonth}>{new Date(evt.date).toLocaleString('default', { month: 'short' }).toUpperCase()}</Text>
                <Text style={styles.eventDay}>{new Date(evt.date).getDate()}</Text>
              </View>
              <View style={styles.eventInfo}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4}}>
                  <Text style={styles.eventTitle}>{evt.title}</Text>
                  <View style={{backgroundColor: evt.classroom_id ? '#fef3c7' : '#e0e7ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8}}>
                    <Text style={{fontSize: 10, fontWeight: '700', color: evt.classroom_id ? '#d97706' : '#4f46e5'}}>
                      {evt.classroom ? evt.classroom.name : 'GLOBAL'}
                    </Text>
                  </View>
                </View>
                {evt.description ? <Text style={styles.eventDesc}>{evt.description}</Text> : null}
              </View>
            </View>
          ))
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#4b5563' },
  
  headerGradient: {
    paddingTop: Platform.OS === 'web' ? 20 : 10,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 14, color: '#a5b4fc', marginTop: 4 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 20 },

  scroll: { padding: 16, paddingBottom: 40 },

  statsGrid: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: '#fff', padding: 20, borderRadius: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  statIconBg: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statValue: { fontSize: 28, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 13, color: '#6b7280', fontWeight: '500', marginTop: 4 },

  card: { backgroundColor: '#fff', padding: 20, borderRadius: 24, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  
  formGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#4b5563', marginBottom: 8 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, fontSize: 15, color: '#1f2937' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  
  submitBtn: { flexDirection: 'row', backgroundColor: '#4f46e5', padding: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 8 },
  submitBtnDisabled: { backgroundColor: '#a5b4fc' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  
  classChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f9fafb', marginRight: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  classChipActive: { backgroundColor: '#eef2ff', borderColor: '#6366f1' },
  classChipText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  classChipTextActive: { color: '#4f46e5' },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 16, marginLeft: 4 },
  emptyText: { color: '#6b7280', fontStyle: 'italic', marginLeft: 4 },
  
  eventCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderRadius: 20, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  eventDateBox: { backgroundColor: '#eef2ff', padding: 12, borderRadius: 16, alignItems: 'center', justifyContent: 'center', minWidth: 64 },
  eventMonth: { fontSize: 12, fontWeight: '700', color: '#4f46e5' },
  eventDay: { fontSize: 24, fontWeight: '800', color: '#312e81' },
  eventInfo: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  eventTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  eventDesc: { fontSize: 13, color: '#6b7280', lineHeight: 18 }
});
