import { onAuthStateChanged, User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth } from '../firebase/firebaseConfig';

export default function useAuthListener() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('👤 Auth state changed:', firebaseUser);
      setUser(firebaseUser ?? null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
}
