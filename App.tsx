import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { ActivityIndicator } from 'react-native';
import { useAuthListener } from './hooks/useAuthListener';
import AppNavigator from './navigation/AppNavigator';
import AuthNavigator from './navigation/AuthNavigator';


export default function App() {
  const { user, loading } = useAuthListener();

  if (loading) {
    return <ActivityIndicator style={{ flex:1 }} size="large" />;
  }

  return (
    <NavigationContainer>
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

