import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { signOut } from 'firebase/auth';
import React from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { auth } from '../firebase/firebaseConfig';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
};

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();

  const handleLogout = async () => {
    try {
      await signOut(auth); // ✅ no manual navigation needed
    } catch (error: any) {
      console.error('Logout error:', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Welcome Home!</Text>
      <Button title="Logout" onPress={handleLogout} />
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  welcome: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
});

