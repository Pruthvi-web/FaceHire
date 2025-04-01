// functions/index.js

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// A simple test function.
exports.helloWorld = functions.https.onRequest((request, response) => {
  response.send("Hello from Firebase Functions!");
});

// Callable function to create a new user.
exports.createUser = functions.https.onCall(async (data, context) => {
  // Ensure the request is authenticated.
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }
  
  // Check if the requesting user is the admin (test@gmail.com).
  const requestingUserEmail = context.auth.token.email;
  if (requestingUserEmail !== 'test@gmail.com') {
    throw new functions.https.HttpsError('permission-denied', 'Only admin can create users.');
  }

  // Extract the new user's details.
  const { name, email, password, role } = data;
  try {
    // Create a new user in Firebase Auth.
    const userRecord = await admin.auth().createUser({ email, password });
    
    // Save additional user details to Firestore.
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      name,
      email,
      role,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true, uid: userRecord.uid };
  } catch (error) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});
