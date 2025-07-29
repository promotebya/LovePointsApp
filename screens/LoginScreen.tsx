// screens/LoginScreen.tsx

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { auth } from '../firebase/firebaseConfig';


type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
};


type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

const LoginScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

 const handleLogin = async () => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    console.log('✅ Login successful:', user.email);

    // 🔥 Firestore: save or update user info
    const db = getFirestore();
    const userDocRef = doc(db, 'users', user.uid);

    await setDoc(userDocRef, {
      email: user.email,
      createdAt: serverTimestamp(),
    }, { merge: true });

    console.log('📝 User document saved to Firestore');

    // ✅ Navigate to Home screen
    navigation.replace('Home');

  } catch (error: any) {
    console.error('❌ Login error:', error.message);
    Alert.alert('Login Failed', error.message);
  }
};


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
      />

      <Button title="Login" onPress={handleLogin} />

      <Text
        style={styles.registerLink}
        onPress={() => navigation.navigate('Register')}
      >
        Don't have an account? Register here
      </Text>
    </View>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    alignSelf: 'center',
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
  },
  registerLink: {
    marginTop: 16,
    color: 'blue',
    textAlign: 'center',
  },
});
