// src/hooks/useUserRole.js

import { useState, useEffect } from 'react';
import { firestore } from '../firebase';

function useUserRole(user) {
  const [role, setRole] = useState(null);

  useEffect(() => {
    if (user) {
      // console.log("useUserRole: Detected user", user);
      
      // Query the "users" collection where the 'uid' field matches the authenticated user's UID.
      const query = firestore.collection('users').where("uid", "==", user.uid).limit(1);
      // console.log("useUserRole: Querying for user with uid:", user.uid);

      const unsubscribe = query.onSnapshot(
        (snapshot) => {
          if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const data = doc.data();
            // console.log("useUserRole: Retrieved document data:", data);
            if (data && data.role) {
              setRole(data.role);
              // console.log("useUserRole: Role set to:", data.role);
            } else {
              // console.warn("useUserRole: Role field is missing in document:", doc.id);
              setRole(null);
            }
          } else {
            // console.warn("useUserRole: No document found for uid:", user.uid);
            setRole(null);
          }
        },
        error => {
          // console.error("useUserRole: Error querying user document:", error);
          setRole(null);
        }
      );
      
      return () => unsubscribe();
    } else {
      // console.log("useUserRole: No user provided.");
      setRole(null);
    }
  }, [user]);

  // console.log("useUserRole: Returning role:", role);
  return role;
}

export default useUserRole;
