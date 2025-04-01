// facehire_external/index.js

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');

// Initialize Firebase Admin with your service account.
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Replace with your Firebase project ID if needed.
  databaseURL: "https://facehiretest.firebaseio.com"
});

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Endpoint to create a new Firebase Auth user.
app.post('/createUser', async (req, res) => {
  const { email, password, role, name } = req.body;
  
  // Validate the input data.
  if (!email || !password || !role || !name) {
    return res.status(400).json({ error: 'Missing required fields (name, email, password, role).' });
  }

  try {
    // Create new Auth user.
    const userRecord = await admin.auth().createUser({ email, password });
    
    // Optionally, you can also add custom claims if needed:
    // await admin.auth().setCustomUserClaims(userRecord.uid, { role: role });
    
    console.log(`Successfully created user ${email}!`);
    
    // Return the new UID to the caller.
    res.status(200).json({ uid: userRecord.uid });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`External server running on port ${PORT}`);
});
