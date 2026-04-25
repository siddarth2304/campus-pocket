import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { AlertCircle, ArrowLeft, BookOpen, Calculator, Calendar, ChevronLeft, ChevronRight, FileText, Flame, Lock, LogOut, MessageSquare, Plus, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../src/lib/supabase';
import { useStore } from '../src/store/useStore';

export default function StudentPortal() {
  const router = useRouter();
  const { user, logout } = useStore();
  const [classes, setClasses] = useState<any[]>([]);
  const [globalEvents, setGlobalEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Bunk Effect State
  const [minPercentage, setMinPercentage] = useState(75);
  const [plannedSkips, setPlannedSkips] = useState<Record<string, number>>({});

  // Modals
  const [toolkitVisible, setToolkitVisible] = useState(false);
  const [toolkitTab, setToolkitTab] = useState('sgpa');

  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null); // if null, shows all classes
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [streak, setStreak] = useState(0);

  // Classroom specific state
  const [activeTab, setActiveTab] = useState('calendar'); // calendar, stream, assignments
  const [classPosts, setClassPosts] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');

  // Quiz Attempt State
  const [attemptModalVisible, setAttemptModalVisible] = useState(false);
  const [currentAssignment, setCurrentAssignment] = useState<any>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [securityCheckPassed, setSecurityCheckPassed] = useState(false);

  // SGPA State
  const [sgpaSubjects, setSgpaSubjects] = useState([{ id: 1, name: '', credits: 3, marks: '' }]);
  const [convMarks, setConvMarks] = useState('');
  const [convSrc, setConvSrc] = useState('20');
  const [convTgt, setConvTgt] = useState('5');

  useEffect(() => {
    fetchData();

    const attendanceSub = supabase.channel('public:attendance_student')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `student_id=eq.${user?.id}` }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceSub);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const { data: events } = await supabase.from('global_events').select('*, classroom(name)');

    const { data: schoolClasses } = await supabase
      .from('classroom')
      .select('id, name, class_code')
      .eq('school_id', user?.school_id);

    const memberships = (schoolClasses || []).map((cls: any) => ({
      classroom_id: cls.id,
      classroom: { name: cls.name, class_code: cls.class_code }
    }));

    if (memberships) {
      const classIds = memberships.map(m => m.classroom_id);
      const filteredEvents = (events || []).filter(e => !e.classroom_id || classIds.includes(e.classroom_id));
      setGlobalEvents(filteredEvents);
      let overallAttendances = [];

      const classData = await Promise.all(memberships.map(async (m: any) => {
        const classId = m.classroom_id;

        const sessionsRes = await supabase.from('class_session').select('id, date, topic').eq('classroom_id', classId);
        const sessions = sessionsRes.data || [];
        const sessionIds = sessions.map(s => s.id);

        let attendances = [];
        if (sessionIds.length > 0) {
          const attRes = await supabase.from('attendance').select('status, session_id, class_session!inner(date)').eq('student_id', user?.id).in('session_id', sessionIds);
          attendances = attRes.data || [];
          overallAttendances.push(...attendances);
        }

        const submissionsRes = await supabase.from('assignment_submission').select('assignment_id, percentage, assignment!inner(title, classroom_id)').eq('user_id', user?.id).eq('assignment.classroom_id', classId);
        const allAssignmentsRes = await supabase.from('assignment').select('*').eq('classroom_id', classId);

        const attendedCount = attendances.filter(a => a.status === 'PRESENT').length;
        const totalSessions = sessions.length;
        const attendancePercent = totalSessions === 0 ? 100 : (attendedCount / totalSessions) * 100;

        const grades = submissionsRes.data || [];
        const totalGrades = grades.reduce((sum: number, g: any) => sum + Number(g.percentage), 0);
        const avgGrade = grades.length ? totalGrades / grades.length : 100;

        return {
          id: classId,
          name: m.classroom.name,
          class_code: m.classroom.class_code,
          attendedCount,
          totalSessions,
          attendancePercent,
          avgGrade,
          sessions,
          attendances,
          assignments: allAssignmentsRes.data || [],
          recentAssignments: grades.slice(0, 3),
          submissions: grades
        };
      }));
      setClasses(classData);

      const presentCount = overallAttendances.filter(a => a.status === 'PRESENT').length;
      setStreak(presentCount > 0 ? presentCount : 0);
    }
    setLoading(false);
  };

  const fetchClassPosts = async (classId: string) => {
    const { data } = await supabase.from('classroom_posts').select('*, author:users(username)').eq('classroom_id', classId).order('created_at', { ascending: false });
    if (data) setClassPosts(data);
  };

  const handlePostComment = async (postId: string) => {
    if (!commentText.trim()) return;
    await supabase.from('post_comments').insert([{ post_id: postId, content: commentText, author_id: user?.id }]);
    setCommentText('');
    Alert.alert("Success", "Comment posted!");
  };

  const startQuiz = (assignment: any) => {
    setCurrentAssignment(assignment);
    setQuizAnswers({});
    setSecurityCheckPassed(false);
    setAttemptModalVisible(true);
  };

  const submitQuiz = async () => {
    setSubmittingQuiz(true);
    try {
      // Auto-grading logic
      let correct = 0;
      const questions = currentAssignment.questions || [];
      questions.forEach((q: any, i: number) => {
        if (quizAnswers[i] && q.correct_answer && quizAnswers[i].toLowerCase() === q.correct_answer.toLowerCase()) {
          correct++;
        }
      });
      const percentage = questions.length > 0 ? (correct / questions.length) * 100 : 100;

      await supabase.from('assignment_submission').upsert({
        assignment_id: currentAssignment.id,
        user_id: user?.id,
        percentage: percentage,
        answers: quizAnswers
      }, { onConflict: 'assignment_id,user_id' });

      Alert.alert("Submitted!", `You scored ${percentage.toFixed(0)}%`);
      setAttemptModalVisible(false);
      fetchData(); // refresh grades
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const getImpact = (cls: any) => {
    const skips = plannedSkips[cls.id] || 0;
    const afterTotal = cls.totalSessions + skips;
    const afterAttended = cls.attendedCount;
    const afterPercentage = afterTotal === 0 ? 100 : (afterAttended / afterTotal) * 100;

    const isSafe = afterPercentage >= minPercentage + 5;
    const isDanger = afterPercentage < minPercentage;
    const maxBunkable = Math.max(0, Math.floor((cls.attendedCount / (minPercentage / 100)) - cls.totalSessions));

    let classesToRecover = 0;
    if (afterPercentage < minPercentage && afterTotal > 0) {
      classesToRecover = Math.max(0, Math.ceil(((minPercentage / 100) * afterTotal - afterAttended) / (1 - (minPercentage / 100))));
    }
    return { skips, afterPercentage, isSafe, isDanger, maxBunkable, classesToRecover };
  };

  const adjustSkip = (id: string, delta: number) => {
    setPlannedSkips(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }));
  };

  const getGrade = (m: string) => {
    const v = parseFloat(m);
    if (isNaN(v)) return null;
    if (v > 92) return { grade: 'O', pts: 10 };
    if (v > 84) return { grade: 'A+', pts: 9.5 };
    if (v > 77) return { grade: 'A', pts: 9 };
    if (v > 70) return { grade: 'B+', pts: 8 };
    if (v > 63) return { grade: 'B', pts: 7 };
    if (v > 56) return { grade: 'C', pts: 6 };
    if (v > 49) return { grade: 'P', pts: 5 };
    return { grade: 'F', pts: 0 };
  };

  const sgpa = (() => {
    const valid = sgpaSubjects.filter(r => r.marks !== '');
    if (!valid.length) return null;
    const totalCreds = valid.reduce((s, r) => s + r.credits, 0);
    const weighted = valid.reduce((s, r) => s + r.credits * (getGrade(r.marks)?.pts || 0), 0);
    return totalCreds ? (weighted / totalCreds) : 0;
  })();

  const ProgressBar = ({ value, color, bg = '#f1f5f9' }: { value: number, color: string, bg?: string }) => (
    <View style={[styles.progressTrack, { backgroundColor: bg }]}>
      <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }]} />
    </View>
  );

  const renderCalendarGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const headers = weekDays.map((day, index) => (
      <View key={`header-${index}`} style={styles.calHeaderCell}>
        <Text style={styles.calHeaderText}>{day}</Text>
      </View>
    ));

    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calCell} />);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const iso = d.toISOString().split('T')[0];
      const isSelected = selectedDate === iso;

      const hasGlobalEvent = globalEvents.some(e => e.date === iso);
      let hasClassSession = false;
      const classesToSearch = selectedClass ? [selectedClass] : classes;
      for (const cls of classesToSearch) {
        if (cls.sessions && cls.sessions.some((s: any) => s.date === iso)) {
          hasClassSession = true;
          break;
        }
      }

      const hasEvent = hasGlobalEvent || hasClassSession;

      days.push(
        <TouchableOpacity
          key={iso}
          style={[styles.calCell, isSelected && styles.calCellSelected]}
          onPress={() => setSelectedDate(iso)}
        >
          <Text style={[styles.calDayText, isSelected && styles.calDayTextSelected]}>{i}</Text>
          {hasEvent && <View style={[styles.eventDot, isSelected && { backgroundColor: '#fff' }]} />}
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calHeaderRow}>{headers}</View>
        <View style={styles.calGrid}>{days}</View>
      </View>
    );
  };

  const changeMonth = (offset: number) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0284c7" />
        <Text style={styles.loadingText}>Loading Academic Profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.headerGradient}>
        <View style={styles.headerContent}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => router.replace('/')} style={{ padding: 8, marginRight: 8, marginLeft: -8 }}>
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text style={styles.title}>Student Portal</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Text style={styles.subtitle}>{user?.username}</Text>
                {streak > 0 && (
                  <View style={styles.streakBadge}>
                    <Flame size={14} color="#f97316" />
                    <Text style={styles.streakText}>{streak} Day Streak</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={() => { setSelectedClass(null); setActiveTab('calendar'); setHistoryModalVisible(true); }} style={styles.toolkitBtn}>
              <Calendar size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setToolkitVisible(true)} style={styles.toolkitBtn}>
              <Calculator size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { logout(); router.replace('/'); }} style={styles.logoutBtn}>
              <LogOut size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll}>

        <View style={styles.thresholdCard}>
          <View style={styles.thresholdHeader}>
            <Text style={styles.thresholdTitle}>Target Attendance</Text>
            <Text style={styles.thresholdValue}>{minPercentage}%</Text>
          </View>
          <View style={styles.thresholdBar}>
            <View style={[styles.thresholdFill, { width: `${minPercentage}%` }]} />
            <View style={[styles.thresholdMarker, { left: '75%' }]}><Text style={styles.markerText}>75%</Text></View>
          </View>
          <Text style={styles.thresholdHint}>Adjusting target affects Leave Projection</Text>
        </View>

        {classes.map(cls => {
          const impact = getImpact(cls);
          const hasSkips = impact.skips > 0;
          const statusColor = impact.isDanger ? '#ef4444' : (impact.isSafe ? '#10b981' : '#f59e0b');

          return (
            <View key={cls.id} style={styles.classCard}>
              <View style={styles.classHeader}>
                <View style={styles.classNameContainer}>
                  <Text style={styles.className}>{cls.name}</Text>
                  <Text style={styles.classSubText}>{cls.attendedCount} / {cls.totalSessions} classes attended</Text>
                </View>
                <View style={styles.gradeBadge}>
                  <Text style={styles.gradeBadgeText}>{cls.avgGrade.toFixed(0)}% Avg</Text>
                </View>
              </View>

              <View style={styles.bunkSection}>
                <View style={styles.bunkControls}>
                  <Text style={styles.bunkLabel}>Planned Leaves</Text>
                  <View style={styles.bunkButtons}>
                    <TouchableOpacity onPress={() => adjustSkip(cls.id, -1)} style={styles.bunkBtn}><Text style={styles.bunkBtnText}>-</Text></TouchableOpacity>
                    <Text style={styles.bunkCount}>{impact.skips}</Text>
                    <TouchableOpacity onPress={() => adjustSkip(cls.id, 1)} style={styles.bunkBtn}><Text style={styles.bunkBtnText}>+</Text></TouchableOpacity>
                  </View>
                </View>

                <View style={styles.bunkVisuals}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={styles.bunkVisualText}>Current: {cls.attendancePercent.toFixed(1)}%</Text>
                    {hasSkips && <Text style={[styles.bunkVisualText, { color: statusColor, fontWeight: '700' }]}>After: {impact.afterPercentage.toFixed(1)}%</Text>}
                  </View>
                  <ProgressBar value={hasSkips ? impact.afterPercentage : cls.attendancePercent} color={statusColor} />

                  {hasSkips ? (
                    <Text style={[styles.bunkStatusMsg, { color: statusColor }]}>
                      {impact.isDanger ? `Danger! Need ${impact.classesToRecover} more classes to recover.` : impact.isSafe ? 'Safe to take leave.' : 'Borderline! Be careful.'}
                    </Text>
                  ) : (
                    <Text style={styles.bunkStatusMsg}>
                      {impact.maxBunkable > 0 ? `You can safely take up to ${impact.maxBunkable} leaves.` : 'Cannot take any leaves safely.'}
                    </Text>
                  )}
                </View>
              </View>

              <TouchableOpacity style={styles.viewHistoryBtn} onPress={() => { setSelectedClass(cls); fetchClassPosts(cls.id); setActiveTab('stream'); setHistoryModalVisible(true); }}>
                <BookOpen size={16} color="#0284c7" />
                <Text style={styles.viewHistoryText}>Enter Classroom Portal</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {/* CLASSROOM PORTAL MODAL (Replacing simple history modal) */}
      <Modal visible={historyModalVisible} animationType="slide" transparent>
        <View style={styles.blurOverlay}>
          <View style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <View>
                <Text style={styles.historyTitle}>{selectedClass ? selectedClass.name : 'Global Calendar'}</Text>
                {selectedClass && <Text style={styles.historySubtitle}>Code: {selectedClass.class_code}</Text>}
              </View>
              <TouchableOpacity onPress={() => setHistoryModalVisible(false)} style={styles.closeBtnDark}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedClass && (
              <View style={styles.portalTabs}>
                <TouchableOpacity style={[styles.portalTab, activeTab === 'stream' && styles.portalTabActive]} onPress={() => setActiveTab('stream')}>
                  <MessageSquare size={16} color={activeTab === 'stream' ? '#4f46e5' : '#64748b'} />
                  <Text style={[styles.portalTabText, activeTab === 'stream' && styles.portalTabTextActive]}>Stream</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.portalTab, activeTab === 'assignments' && styles.portalTabActive]} onPress={() => setActiveTab('assignments')}>
                  <FileText size={16} color={activeTab === 'assignments' ? '#4f46e5' : '#64748b'} />
                  <Text style={[styles.portalTabText, activeTab === 'assignments' && styles.portalTabTextActive]}>Assignments</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.portalTab, activeTab === 'calendar' && styles.portalTabActive]} onPress={() => setActiveTab('calendar')}>
                  <Calendar size={16} color={activeTab === 'calendar' ? '#4f46e5' : '#64748b'} />
                  <Text style={[styles.portalTabText, activeTab === 'calendar' && styles.portalTabTextActive]}>Calendar</Text>
                </TouchableOpacity>
              </View>
            )}

            {activeTab === 'calendar' && (
              <>
                <View style={styles.monthNav}>
                  <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthBtn}>
                    <ChevronLeft size={24} color="#64748b" />
                  </TouchableOpacity>
                  <Text style={styles.monthLabel}>
                    {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </Text>
                  <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthBtn}>
                    <ChevronRight size={24} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' }}>
                  {renderCalendarGrid()}
                </View>

                <ScrollView style={{ flex: 1, padding: 16 }}>
                  {globalEvents.filter(e => e.date === selectedDate).length > 0 && (
                    <View style={{ marginBottom: 24 }}>
                      <Text style={styles.historySectionTitle}>School Announcements</Text>
                      {globalEvents.filter(e => e.date === selectedDate).map(e => (
                        <View key={e.id} style={[styles.historyItem, { borderColor: '#4f46e5', borderWidth: 1 }]}>
                          <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                              <Text style={[styles.historyItemName, { color: '#818cf8', marginRight: 8 }]}>{e.title}</Text>
                              <View style={{ backgroundColor: e.classroom_id ? 'rgba(217, 119, 6, 0.2)' : 'rgba(79, 70, 229, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: e.classroom_id ? '#fbbf24' : '#818cf8' }}>
                                  {e.classroom ? e.classroom.name : 'GLOBAL'}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.historyItemTopic}>{e.description}</Text>
                          </View>
                          <AlertCircle size={20} color="#818cf8" />
                        </View>
                      ))}
                    </View>
                  )}

                  <Text style={styles.historySectionTitle}>Class Sessions on {selectedDate}</Text>
                  {(() => {
                    const classesToSearch = selectedClass ? [selectedClass] : classes;
                    let foundSessions = 0;

                    const elements = classesToSearch.map(cls => {
                      const daySessions = cls.sessions.filter((s: any) => s.date === selectedDate);
                      if (daySessions.length === 0) return null;

                      return daySessions.map((s: any, i: number) => {
                        foundSessions++;
                        const attendance = cls.attendances?.find((att: any) => att.session_id === s.id);
                        const status = attendance ? attendance.status : 'ABSENT';
                        return (
                          <View key={s.id} style={styles.historyItem}>
                            <View>
                              <Text style={styles.historyItemName}>{cls.name}</Text>
                              <Text style={styles.historyItemTopic}>{s.topic}</Text>
                            </View>
                            <View style={[styles.statusBadge, status === 'PRESENT' ? styles.statusPresent : styles.statusAbsent]}>
                              <Text style={[styles.statusText, status === 'PRESENT' ? styles.statusTextPresent : styles.statusTextAbsent]}>{status}</Text>
                            </View>
                          </View>
                        )
                      });
                    });

                    if (foundSessions === 0) return <Text style={styles.historyEmpty}>No classes scheduled for this date.</Text>;
                    return elements;
                  })()}
                </ScrollView>
              </>
            )}

            {activeTab === 'stream' && (
              <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc', padding: 16 }}>
                {classPosts.map(post => (
                  <View key={post.id} style={styles.postCard}>
                    <View style={styles.postHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ backgroundColor: '#3b82f6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginRight: 8 }}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>POST</Text>
                        </View>
                        <Text style={styles.author}>{post.author?.username}</Text>
                      </View>
                      <Text style={styles.time}>{new Date(post.created_at).toLocaleDateString()}</Text>
                    </View>
                    <Text style={styles.postContent}>{post.content}</Text>
                    <View style={{ borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 12, paddingTop: 12, flexDirection: 'row', alignItems: 'center' }}>
                      <TextInput
                        style={styles.commentInput}
                        placeholder="Add class comment..."
                        value={commentText}
                        onChangeText={setCommentText}
                      />
                      <TouchableOpacity style={styles.sendCommentBtn} onPress={() => handlePostComment(post.id)}>
                        <Text style={{ color: '#3b82f6', fontWeight: '700' }}>Post</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {activeTab === 'assignments' && (
              <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc', padding: 16 }}>
                {selectedClass?.assignments.map((a: any) => {
                  const submission = selectedClass?.submissions?.find((s: any) => s.assignment_id === a.id);
                  const isSubmitted = !!submission;
                  return (
                    <View key={a.id} style={styles.assignmentCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={styles.assignTitle}>{a.title}</Text>
                        <View style={{ backgroundColor: isSubmitted ? '#e2e8f0' : '#10b981', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                          <Text style={{ color: isSubmitted ? '#64748b' : '#fff', fontSize: 10, fontWeight: '700' }}>{isSubmitted ? 'SUBMITTED' : 'OPEN'}</Text>
                        </View>
                      </View>
                      <Text style={styles.assignDesc}>{a.description}</Text>
                      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                        <Text style={styles.assignTime}>Due: {a.due_at ? new Date(a.due_at).toLocaleString() : 'No Due Date'}</Text>
                      </View>
                      {isSubmitted ? (
                        <View style={[styles.startBtn, { backgroundColor: '#f1f5f9' }]}>
                          <Text style={[styles.startBtnText, { color: '#64748b' }]}>Score: {submission.percentage}%</Text>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.startBtn} onPress={() => startQuiz(a)}>
                          <Text style={styles.startBtnText}>Start Online Quiz</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}

          </View>
        </View>
      </Modal>

      {/* SECURE ASSIGNMENT MODAL (Removed presentationStyle fullScreen for mobile compatibility) */}
      <Modal visible={attemptModalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }} edges={['top']}>
          {!securityCheckPassed ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
              <Lock size={64} color="#3b82f6" style={{ marginBottom: 24 }} />
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 12, textAlign: 'center' }}>Security Check Required</Text>
              <Text style={{ fontSize: 16, color: '#94a3b8', textAlign: 'center', marginBottom: 32 }}>
                By entering full screen, you agree not to leave this page or open other tabs. Any attempt to switch tabs may result in auto-submission.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: '#3b82f6', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, width: '100%', alignItems: 'center' }}
                onPress={() => setSecurityCheckPassed(true)}
              >
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Enter Full Screen & Start</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 16 }} onPress={() => setAttemptModalVisible(false)}>
                <Text style={{ color: '#94a3b8' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>{currentAssignment?.title}</Text>
                  <Text style={{ fontSize: 13, color: '#64748b' }}>Secure Mode Active</Text>
                </View>
                <TouchableOpacity onPress={() => Alert.alert("Warning", "Are you sure you want to exit? Your progress will be lost.", [{ text: "Cancel" }, { text: "Exit", style: "destructive", onPress: () => setAttemptModalVisible(false) }])}>
                  <X size={24} color="#ef4444" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1, padding: 20 }}>
                {currentAssignment?.questions?.map((q: any, idx: number) => (
                  <View key={idx} style={styles.questionCard}>
                    <Text style={styles.questionText}>{idx + 1}. {q.question}</Text>
                    {q.options ? (
                      <View style={{ marginTop: 12, gap: 8 }}>
                        {q.options.map((opt: string, optIdx: number) => {
                          const isSelected = quizAnswers[idx] === opt;
                          return (
                            <TouchableOpacity
                              key={optIdx}
                              style={[styles.optionBtn, isSelected && styles.optionBtnSelected]}
                              onPress={() => setQuizAnswers(prev => ({ ...prev, [idx]: opt }))}
                            >
                              <View style={[styles.optionCircle, isSelected && styles.optionCircleSelected]} />
                              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{opt}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : (
                      <TextInput
                        style={styles.subjectiveInput}
                        multiline
                        placeholder="Type your answer here..."
                        value={quizAnswers[idx] || ''}
                        onChangeText={t => setQuizAnswers(prev => ({ ...prev, [idx]: t }))}
                      />
                    )}
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.primaryBtn, { marginBottom: 40 }]}
                  onPress={submitQuiz}
                  disabled={submittingQuiz}
                >
                  <Text style={styles.btnText}>{submittingQuiz ? 'Submitting...' : 'Submit Assignment'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* ACADEMIC TOOLKIT MODAL */}
      <Modal visible={toolkitVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Academic Toolkit</Text>
            <TouchableOpacity onPress={() => setToolkitVisible(false)} style={styles.closeBtn}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>
          <View style={styles.tabBar}>
            <TouchableOpacity onPress={() => setToolkitTab('sgpa')} style={[styles.tab, toolkitTab === 'sgpa' && styles.tabActive]}><Text style={[styles.tabText, toolkitTab === 'sgpa' && styles.tabTextActive]}>SGPA Calc</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setToolkitTab('conv')} style={[styles.tab, toolkitTab === 'conv' && styles.tabActive]}><Text style={[styles.tabText, toolkitTab === 'conv' && styles.tabTextActive]}>Marks Converter</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {toolkitTab === 'sgpa' && (
              <View>
                <View style={styles.sgpaResultCard}>
                  <Text style={styles.sgpaResultLabel}>Predicted SGPA</Text>
                  <Text style={styles.sgpaResultValue}>{sgpa ? sgpa.toFixed(2) : '—'}</Text>
                </View>
                {sgpaSubjects.map((sub, i) => (
                  <View key={sub.id} style={styles.sgpaRow}>
                    <Text style={styles.sgpaRowIndex}>Sub {i + 1}</Text>
                    <View style={styles.sgpaInputs}>
                      <TextInput style={[styles.input, { flex: 1 }]} placeholder="Credits" keyboardType="numeric" value={String(sub.credits)} onChangeText={v => { const n = [...sgpaSubjects]; n[i].credits = parseInt(v) || 0; setSgpaSubjects(n); }} />
                      <TextInput style={[styles.input, { flex: 1 }]} placeholder="Marks / 100" keyboardType="numeric" value={sub.marks} onChangeText={v => { const n = [...sgpaSubjects]; n[i].marks = v; setSgpaSubjects(n); }} />
                    </View>
                  </View>
                ))}
                <TouchableOpacity style={styles.addBtn} onPress={() => setSgpaSubjects([...sgpaSubjects, { id: Date.now(), name: '', credits: 3, marks: '' }])}>
                  <Plus size={20} color="#0284c7" />
                  <Text style={styles.addBtnText}>Add Subject</Text>
                </TouchableOpacity>
              </View>
            )}
            {toolkitTab === 'conv' && (
              <View style={styles.convContainer}>
                <View style={styles.convCard}>
                  <Text style={styles.convLabel}>Marks Obtained</Text>
                  <TextInput style={styles.convInputHuge} keyboardType="numeric" value={convMarks} onChangeText={setConvMarks} placeholder="e.g. 18" />
                  <View style={styles.convGrid}>
                    <View style={{ flex: 1 }}><Text style={styles.convLabel}>Original Total</Text><TextInput style={styles.convInput} keyboardType="numeric" value={convSrc} onChangeText={setConvSrc} /></View>
                    <Text style={styles.convArrow}>→</Text>
                    <View style={{ flex: 1 }}><Text style={styles.convLabel}>Target Total</Text><TextInput style={styles.convInput} keyboardType="numeric" value={convTgt} onChangeText={setConvTgt} /></View>
                  </View>
                </View>
                {convMarks !== '' && (
                  <View style={styles.sgpaResultCard}><Text style={styles.sgpaResultLabel}>Converted Marks</Text><Text style={styles.sgpaResultValue}>{((parseFloat(convMarks) / parseFloat(convSrc)) * parseFloat(convTgt)).toFixed(2)}</Text></View>
                )}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#475569', fontWeight: '500' },
  headerGradient: { paddingTop: Platform.OS === 'web' ? 20 : 10, paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(249,115,22,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginLeft: 8, borderWidth: 1, borderColor: 'rgba(249,115,22,0.5)' },
  streakText: { color: '#fdba74', fontSize: 12, fontWeight: '700', marginLeft: 4 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  toolkitBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  scroll: { padding: 16, paddingTop: 20, paddingBottom: 40 },
  thresholdCard: { backgroundColor: '#fff', padding: 16, borderRadius: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  thresholdHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  thresholdTitle: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  thresholdValue: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  thresholdBar: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, position: 'relative' },
  thresholdFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 4 },
  thresholdMarker: { position: 'absolute', top: -4, width: 2, height: 16, backgroundColor: '#cbd5e1', alignItems: 'center' },
  markerText: { position: 'absolute', top: 18, fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  thresholdHint: { fontSize: 12, color: '#94a3b8', marginTop: 12, textAlign: 'center' },
  classCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
  classHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  classNameContainer: { flex: 1 },
  className: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  classSubText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  gradeBadge: { backgroundColor: '#f0fdf4', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#bbf7d0' },
  gradeBadgeText: { color: '#166534', fontWeight: '700', fontSize: 14 },
  bunkSection: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9' },
  bunkControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  bunkLabel: { fontSize: 15, fontWeight: '700', color: '#334155' },
  bunkButtons: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  bunkBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#f8fafc' },
  bunkBtnText: { fontSize: 18, fontWeight: '600', color: '#64748b' },
  bunkCount: { paddingHorizontal: 16, fontSize: 16, fontWeight: '700', color: '#0f172a' },
  bunkVisuals: { marginTop: 4 },
  bunkVisualText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  bunkStatusMsg: { fontSize: 12, marginTop: 8, fontWeight: '600', color: '#64748b' },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  viewHistoryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: '#f0f9ff', borderRadius: 16 },
  viewHistoryText: { color: '#0284c7', fontWeight: '700', fontSize: 15, marginLeft: 8 },
  modalContainer: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  closeBtn: { padding: 4 },
  tabBar: { flexDirection: 'row', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#f0f9ff' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#0284c7', fontWeight: '700' },
  modalScroll: { padding: 16 },
  sgpaResultCard: { backgroundColor: '#0f172a', padding: 24, borderRadius: 24, alignItems: 'center', marginBottom: 24 },
  sgpaResultLabel: { color: '#94a3b8', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  sgpaResultValue: { color: '#fff', fontSize: 48, fontWeight: '900', marginTop: 8 },
  sgpaRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  sgpaRowIndex: { width: 50, fontSize: 14, fontWeight: '700', color: '#64748b' },
  sgpaInputs: { flex: 1, flexDirection: 'row', gap: 12 },
  input: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 12, fontSize: 16, fontWeight: '600', color: '#0f172a' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 16, backgroundColor: '#fff' },
  addBtnText: { marginLeft: 8, fontSize: 16, fontWeight: '600', color: '#0284c7' },
  convContainer: { gap: 16 },
  convCard: { backgroundColor: '#fff', padding: 20, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  convLabel: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  convInputHuge: { backgroundColor: '#f1f5f9', padding: 16, borderRadius: 16, fontSize: 24, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: 20 },
  convGrid: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  convInput: { backgroundColor: '#f1f5f9', padding: 16, borderRadius: 12, fontSize: 18, fontWeight: '700', color: '#0f172a', textAlign: 'center' },
  convArrow: { fontSize: 24, color: '#94a3b8' },
  blurOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.6)' },
  historyCard: { height: '88%', backgroundColor: '#ffffff', borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  historyTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  historySubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  closeBtnDark: { backgroundColor: '#f1f5f9', padding: 8, borderRadius: 20 },
  historySectionTitle: { fontSize: 14, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  historyEmpty: { color: '#64748b', fontSize: 15, fontStyle: 'italic', textAlign: 'center', marginTop: 20 },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#f8fafc', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  historyItemName: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  historyItemTopic: { fontSize: 13, color: '#475569' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusPresent: { backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  statusAbsent: { backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  statusText: { fontSize: 12, fontWeight: '800' },
  statusTextPresent: { color: '#059669' },
  statusTextAbsent: { color: '#dc2626' },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#fff' },
  monthBtn: { padding: 8 },
  monthLabel: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  calendarContainer: { width: '100%' },
  calHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  calHeaderCell: { flex: 1, alignItems: 'center' },
  calHeaderText: { fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 4, position: 'relative' },
  calCellSelected: { backgroundColor: '#4f46e5', borderRadius: 24 },
  calDayText: { fontSize: 16, color: '#1e293b', fontWeight: '500' },
  calDayTextSelected: { color: '#fff', fontWeight: '700' },
  eventDot: { position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: 2, backgroundColor: '#ef4444' },
  portalTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  portalTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  portalTabActive: { borderBottomWidth: 2, borderBottomColor: '#4f46e5' },
  portalTabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  portalTabTextActive: { color: '#4f46e5', fontWeight: '700' },
  postCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  author: { fontWeight: '700', color: '#0f172a' },
  time: { fontSize: 12, color: '#94a3b8' },
  postContent: { fontSize: 15, color: '#334155', lineHeight: 22 },
  commentInput: { flex: 1, backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, fontSize: 14 },
  sendCommentBtn: { padding: 8, marginLeft: 8 },
  assignmentCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  assignTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  assignDesc: { fontSize: 14, color: '#64748b', marginBottom: 12 },
  assignTime: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  startBtn: { backgroundColor: '#4f46e5', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  questionCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  questionText: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  optionBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, backgroundColor: '#f8fafc' },
  optionBtnSelected: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  optionCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#cbd5e1', marginRight: 12 },
  optionCircleSelected: { borderColor: '#4f46e5', backgroundColor: '#4f46e5' },
  optionText: { fontSize: 15, color: '#334155' },
  optionTextSelected: { color: '#4f46e5', fontWeight: '600' },
  subjectiveInput: { backgroundColor: '#f1f5f9', padding: 16, borderRadius: 12, minHeight: 120, textAlignVertical: 'top', marginTop: 12, fontSize: 15 },
  primaryBtn: { backgroundColor: '#10b981', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});
