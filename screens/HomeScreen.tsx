// screens/HomeScreen.tsx
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { signOut } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth } from '../firebase/firebaseConfig';

// ---------------- Types ----------------
type UserDoc = {
  email?: string;
  name?: string;
  partnerUid?: string | null;
  // points
  totalPoints?: number;
  streak?: number;
  lastCheckin?: any; // Timestamp
};

type Challenge = {
  id: string;
  title: string;
  points: number;
  createdAt: any;
  createdBy: string;
  completedBy?: string | null;
  completedAt?: any | null;
};

// ---------------- Firestore helpers ----------------
const db = getFirestore();

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function diffLocalDays(a: Date, b: Date) {
  const A = startOfLocalDay(a).getTime();
  const B = startOfLocalDay(b).getTime();
  return Math.round((A - B) / 86400000);
}
function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  try { return new Date(ts); } catch { return null; }
}
function makeCode(len = 6) {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function getPairId(a: string, b: string) {
  return [a, b].sort().join('_');
}

export default function HomeScreen() {
  const me = auth.currentUser!;
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);

  // UI bits
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  };

  // profile
  const [nameInput, setNameInput] = useState('');

  // partner linking
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [linking, setLinking] = useState(false);
  const isLinked = !!userDoc?.partnerUid;

  // partner display
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [partnerEmail, setPartnerEmail] = useState<string | null>(null);

  // points
  const points = userDoc?.totalPoints ?? 0;
  const streak = userDoc?.streak ?? 0;

  // challenges
  const [newChallenge, setNewChallenge] = useState('');
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  // subscribe to my user doc
  useEffect(() => {
    const ref = doc(db, 'users', me.uid);
    const unsub = onSnapshot(ref, (snap) => {
      const data = (snap.data() as UserDoc) ?? null;
      setUserDoc(data);
      setLoadingDoc(false);
      if (data?.name) setNameInput(data.name);
    });
    return () => unsub();
  }, [me.uid]);

  // when linked, resolve partner display
  useEffect(() => {
    if (!userDoc?.partnerUid) {
      setPartnerName(null);
      setPartnerEmail(null);
      return;
    }
    const ref = doc(db, 'users', userDoc.partnerUid);
    getDoc(ref).then((snap) => {
      const p = (snap.data() as UserDoc) ?? undefined;
      if (p) {
        setPartnerName(p.name ?? null);
        setPartnerEmail(p.email ?? null);
      }
    });
  }, [userDoc?.partnerUid]);

  // subscribe to challenges (shared if linked)
  useEffect(() => {
    const baseRef = isLinked
      ? collection(db, 'pairs', getPairId(me.uid, userDoc!.partnerUid!), 'challenges')
      : collection(db, 'users', me.uid, 'challenges');
    const qRef = query(baseRef, orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(qRef, (snap) => {
      const list: Challenge[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      setChallenges(list);
    });
    return () => unsub();
  }, [isLinked, me.uid, userDoc?.partnerUid]);

  // -------- derived: check-in today? --------
  const alreadyToday = useMemo(() => {
    const last = tsToDate(userDoc?.lastCheckin);
    if (!last) return false;
    return diffLocalDays(new Date(), last) === 0;
  }, [userDoc?.lastCheckin]);

  // ---------------- Actions ----------------
  async function saveName() {
    if (!nameInput.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    try {
      await setDoc(
        doc(db, 'users', me.uid),
        { name: nameInput.trim(), email: me.email ?? null, updatedAt: serverTimestamp() },
        { merge: true }
      );
      Keyboard.dismiss();
      showToast('Saved ✓');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message ?? 'Failed to save name.');
    }
  }

  async function handleLogout() {
    await signOut(auth);
  }

  // ------- partner codes -------
  async function handleCreateCode() {
    if (isLinked) return Alert.alert('Already linked');
    try {
      const code = makeCode(6);
      await setDoc(doc(db, 'pairCodes', code), {
        ownerUid: me.uid,
        createdAt: serverTimestamp(),
        used: false,
      });
      setGeneratedCode(code);
      showToast('Code created');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message ?? 'Failed to create code.');
    }
  }
  async function copyCode() {
    if (!generatedCode) return;
    await Clipboard.setStringAsync(generatedCode);
    showToast('Copied to clipboard');
    Haptics.selectionAsync();
  }
  async function shareCode() {
    if (!generatedCode) return;
    try {
      await Share.share({ message: `My partner code for LovePoints: ${generatedCode}` });
    } catch {}
  }

  async function handleJoinWithCode() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return Alert.alert('Enter a code');
    if (isLinked) return Alert.alert('Already linked');

    setLinking(true);
    try {
      await runTransaction(db, async (tx) => {
        const meRef = doc(db, 'users', me.uid);
        const meSnap = await tx.get(meRef);
        const meData = (meSnap.data() as UserDoc) ?? {};
        if (meData.partnerUid) throw new Error('You are already linked.');

        const codeRef = doc(db, 'pairCodes', code);
        const codeSnap = await tx.get(codeRef);
        if (!codeSnap.exists()) throw new Error('Invalid or expired code.');
        const codeData = codeSnap.data() as { ownerUid: string; used: boolean };
        if (codeData.used) throw new Error('Code already used.');
        if (codeData.ownerUid === me.uid) throw new Error('Cannot use your own code.');

        const partnerRef = doc(db, 'users', codeData.ownerUid);
        const partnerSnap = await tx.get(partnerRef);
        const partner = (partnerSnap.data() as UserDoc) ?? {};
        if (partner.partnerUid) throw new Error('Partner is already linked.');

        // link both
        tx.set(meRef, { partnerUid: codeData.ownerUid, updatedAt: serverTimestamp() }, { merge: true });
        tx.set(partnerRef, { partnerUid: me.uid, updatedAt: serverTimestamp() }, { merge: true });
        tx.update(codeRef, { used: true, claimedBy: me.uid, usedAt: serverTimestamp() });
      });

      setJoinCode('');
      setGeneratedCode(null);
      showToast('Linked ✓');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Linking failed', e.message ?? 'Please try another code.');
    } finally {
      setLinking(false);
    }
  }

  // ------- points: daily check-in -------
  async function handleDailyCheckin() {
    if (alreadyToday) return;
    try {
      await runTransaction(db, async (tx) => {
        const meRef = doc(db, 'users', me.uid);
        const snap = await tx.get(meRef);
        const cur = (snap.data() as UserDoc) ?? {};
        const now = new Date();
        const last = tsToDate(cur.lastCheckin);
        let newStreak = cur.streak ?? 0;

        if (last) {
          const delta = diffLocalDays(now, last);
          if (delta === 0) throw new Error('Already checked in today.');
          newStreak = delta === 1 ? newStreak + 1 : 1;
        } else {
          newStreak = 1;
        }

        const earned = 10;
        const newTotal = (cur.totalPoints ?? 0) + earned;

        tx.set(
          meRef,
          { totalPoints: newTotal, streak: newStreak, lastCheckin: serverTimestamp(), updatedAt: serverTimestamp() },
          { merge: true }
        );

        const logRef = collection(db, 'users', me.uid, 'pointsLog');
        tx.set(doc(logRef), { type: 'daily_checkin', points: earned, createdAt: serverTimestamp() });
      });

      showToast('+10 points');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Check-in failed', e.message ?? 'Try again.');
    }
  }

  // ------- challenges -------
  const challengesBaseCol = isLinked
    ? collection(db, 'pairs', getPairId(me.uid, userDoc?.partnerUid!), 'challenges')
    : collection(db, 'users', me.uid, 'challenges');

  async function addChallenge() {
    const title = newChallenge.trim();
    if (!title) return;
    try {
      await addDoc(challengesBaseCol, {
        title,
        points: 20,
        createdAt: serverTimestamp(),
        createdBy: me.uid,
        completedBy: null,
        completedAt: null,
      });
      setNewChallenge('');
      showToast('Challenge added');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message ?? 'Failed to add challenge.');
    }
  }

  async function completeChallenge(ch: Challenge) {
    if (ch.completedBy) return; // already done
    try {
      await runTransaction(db, async (tx) => {
        const chRef = doc(challengesBaseCol, ch.id);
        const chSnap = await tx.get(chRef);
        if (!chSnap.exists()) throw new Error('Challenge missing.');
        const cur = chSnap.data() as Challenge;
        if (cur.completedBy) throw new Error('Already completed.');

        // mark complete
        tx.update(chRef, { completedBy: me.uid, completedAt: serverTimestamp() });

        // award points to me (for now)
        const meRef = doc(db, 'users', me.uid);
        const meSnap = await tx.get(meRef);
        const meData = (meSnap.data() as UserDoc) ?? {};
        tx.set(
          meRef,
          { totalPoints: (meData.totalPoints ?? 0) + (cur.points ?? 20), updatedAt: serverTimestamp() },
          { merge: true }
        );

        // log
        const logRef = doc(collection(db, 'users', me.uid, 'pointsLog'));
        tx.set(logRef, { type: 'challenge', points: cur.points ?? 20, challengeId: ch.id, createdAt: serverTimestamp() });
      });

      showToast(`+${ch.points} points`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Could not complete', e.message ?? 'Try again.');
    }
  }

  // partner line
  const partnerLine = useMemo(() => {
    if (!isLinked) return 'Not linked yet';
    if (partnerName) return `Partner: ${partnerName}`;
    if (partnerEmail) return `Partner: ${partnerEmail}`;
    return `Partner UID: ${userDoc?.partnerUid}`;
  }, [isLinked, partnerName, partnerEmail, userDoc?.partnerUid]);

  // ---------------- UI ----------------
  if (loadingDoc) {
    return <View style={styles.center}><Text>Loading...</Text></View>;
  }

  return (
    <View style={styles.screen}>
      {/* tiny toast */}
      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      <Text style={styles.title}>Welcome!</Text>

      {/* Profile card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profile</Text>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your name"
          value={nameInput}
          onChangeText={setNameInput}
        />
        <PrimaryButton label="Save name" onPress={saveName} />

        <Text style={[styles.label, { marginTop: 12 }]}>Email</Text>
        <Text style={styles.value}>{me.email}</Text>
      </View>

      {/* Points card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Love Points</Text>
        <Text style={styles.value}>Total: <Text style={styles.emph}>{points}</Text></Text>
        <Text style={styles.value}>Streak: <Text style={styles.emph}>{streak}</Text> 🔥</Text>
        <PrimaryButton
          style={{ marginTop: 12 }}
          label={alreadyToday ? 'Already checked in today' : 'Daily check-in (+10)'}
          onPress={handleDailyCheckin}
          disabled={alreadyToday}
        />
      </View>

      {/* Partner card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Partner</Text>
        <Text style={styles.value}>{partnerLine}</Text>

        {!isLinked && (
          <>
            <PrimaryButton label="Create code to share" onPress={handleCreateCode} style={{ marginTop: 12 }} />
            {generatedCode && (
              <View style={styles.codeRow}>
                <Text style={styles.codeText}>{generatedCode}</Text>
                <SmallButton label="Copy" onPress={copyCode} />
                <SmallButton label="Share" onPress={shareCode} />
              </View>
            )}
            <TextInput
              style={[styles.input, { marginTop: 12 }]}
              placeholder="Enter partner code"
              autoCapitalize="characters"
              value={joinCode}
              onChangeText={setJoinCode}
            />
            <PrimaryButton label={linking ? 'Linking…' : 'Join with code'} onPress={handleJoinWithCode} />
          </>
        )}
      </View>

      {/* Challenges card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Challenges</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            placeholder="New challenge (e.g., Surprise your partner)"
            value={newChallenge}
            onChangeText={setNewChallenge}
          />
          <SmallButton label="Add" onPress={addChallenge} />
        </View>

        {challenges.length === 0 ? (
          <Text style={[styles.value, { marginTop: 8 }]}>No challenges yet.</Text>
        ) : (
          <FlatList
            style={{ marginTop: 8 }}
            data={challenges}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <View style={styles.challengeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.challengeTitle}>{item.title}</Text>
                  <Text style={styles.challengeMeta}>
                    {item.points ?? 20} pts • {item.completedBy ? 'Completed' : 'Open'}
                  </Text>
                </View>
                {!item.completedBy ? (
                  <SmallButton label="Complete" onPress={() => completeChallenge(item)} />
                ) : (
                  <Text style={styles.doneBadge}>Done</Text>
                )}
              </View>
            )}
          />
        )}
      </View>

      <TouchableOpacity onPress={handleLogout} style={{ marginVertical: 16 }}>
        <Text style={styles.logout}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------- small UI bits ----------
function PrimaryButton({
  label,
  onPress,
  disabled,
  style,
}: { label: string; onPress: () => void; disabled?: boolean; style?: any }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.primaryBtn, disabled && { opacity: 0.5 }, style]}
      activeOpacity={0.75}
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}
function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.smallBtn} activeOpacity={0.75}>
      <Text style={styles.smallBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------- styles ----------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f6f7f9', paddingHorizontal: 16, paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 34, fontWeight: '800', textAlign: 'center', marginVertical: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  label: { fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fbfdff',
    padding: 12,
    borderRadius: 10,
  },
  value: { fontSize: 16 },
  emph: { fontWeight: '800' },

  primaryBtn: {
    marginTop: 10,
    backgroundColor: '#5a67d8',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  smallBtn: {
    backgroundColor: '#edf2ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  smallBtnText: { color: '#3f51b5', fontWeight: '700' },

  codeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  codeText: { fontFamily: 'Courier', fontSize: 16, letterSpacing: 1, paddingVertical: 4 },

  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },

  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  challengeTitle: { fontSize: 16, fontWeight: '600' },
  challengeMeta: { color: '#64748b', marginTop: 2 },
  doneBadge: { color: '#16a34a', fontWeight: '800' },

  logout: { color: '#2563eb', textAlign: 'center', fontSize: 16, fontWeight: '700' },

  toast: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(20,20,20,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    zIndex: 10,
  },
  toastText: { color: '#fff', fontWeight: '700' },
});
