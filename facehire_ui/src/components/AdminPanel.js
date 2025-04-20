// src/components/AdminPanel.js

import React, { useState , useEffect } from 'react';
import { firestore } from '../firebase';
import { toast } from 'react-toastify';

function AdminPanel() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [message, setMessage] = useState('');
  const [mode,    setMode]    = useState("openai");
  const [apiKey, setApiKey]  = useState("");

  useEffect(() => {
    const docRef = firestore.collection("config").doc("grading");
    docRef.get().then(snap => {
      if (snap.exists) {
        const data = snap.data();
        setMode(data.mode || "openai");
        setApiKey(data.apiKey || "");
      }
    });
  }, []);

  const saveConfig = async () => {
    try {
      await firestore.collection("config").doc("grading").set({ mode, apiKey });
      toast.success("Grading config saved!");
    } catch (err) {
      toast.error("Failed to save config: " + err.message);
    }
  };

  // Function to call the external server to create an Auth user.
  const createUserExternally = async (userData) => {
    try {
      const response = await fetch('http://localhost:3001/createUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error);
      }
      console.log('External server created user with UID:', data.uid);
      return data.uid;
    } catch (error) {
      console.error('Error creating user externally:', error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      // Call the external server to create the Auth user.
      const uid = await createUserExternally({ name, email, password, role });
      
      // Use a batched write to add/update documents in both collections.
      const batch = firestore.batch();

      // Create a new document in the pendingUsers collection.
      const pendingDocRef = firestore.collection('pendingUsers').doc();
      batch.set(pendingDocRef, {
        name,
        email,
        password, // Note: Storing plaintext passwords is not recommended for production.
        role,
        isActivated: false,
        uid: uid, // Set the returned UID.
        createdAt: new Date()
      });

      // Create a new document in the users collection.
      const userDocRef = firestore.collection('users').doc();
      batch.set(userDocRef, {
        name,
        email,
        role,
        uid: uid, // Set the returned UID.
        createdAt: new Date()
      });

      await batch.commit();
      toast.success(`User created successfully!`);
      
      // Clear the form fields.
      setName('');
      setEmail('');
      setPassword('');
      setRole('user');
    } catch (error) {
      console.error("Error adding user request:", error);
      toast.error(`Error: ${error.message}`);
    }
  };

  // NEW: state for adding interviewers
  const [newInterviewer, setNewInterviewer] = useState('');

  // NEW: write interviewer to Firestore
  const addInterviewer = async (e) => {
    e.preventDefault();
    if (!newInterviewer.trim()) return;
    try {
      await firestore.collection('interviewers').add({
        name: newInterviewer.trim(),
        createdAt: new Date()
      });
      toast.success(`Interviewer “${newInterviewer}” added`);
      setNewInterviewer('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to add interviewer');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Admin Panel - Add New User</h2>
      {message && <p>{message}</p>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '10px' }}>
          <label>Name:</label><br />
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            required 
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>Email:</label><br />
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>Temporary Password:</label><br />
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>Role:</label><br />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="submit">Submit User Request</button>
      </form>
      <hr />
      <h3>Manage Interviewers</h3>
      <form onSubmit={addInterviewer} style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <label>Interviewer Name:</label><br />
          <input
            type="text"
            value={newInterviewer}
            onChange={e => setNewInterviewer(e.target.value)}
            placeholder="e.g. Jane Doe"
            required
          />
        </div>
        <button type="submit">Add Interviewer</button>
      </form>
      <hr />
      <h3>Grading Configuration</h3>
      <div style={{ marginBottom: 8 }}>
        <label>Mode: </label>
        <select value={mode} onChange={e => setMode(e.target.value)}>
          <option value="openai">OpenAI</option>
          <option value="local">Local Pre-trained Model</option>
        </select>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label>OpenAI API Key:</label><br/>
        <input
          type="text"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="sk-..."
          style={{ width: "100%" }}
        />
      </div>
      <button onClick={saveConfig}>Save Grading Config</button>
    </div>
  );
}

export default AdminPanel;
