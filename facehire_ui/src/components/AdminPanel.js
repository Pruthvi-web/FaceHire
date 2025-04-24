// src/components/AdminPanel.js

import React, { useState, useEffect } from 'react';
import { firestore } from '../firebase';
import { toast } from 'react-toastify';

const styles = {
  container: {
    maxWidth: 600,
    margin: '40px auto',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
    color: '#1d1d1f',
    lineHeight: 1.6,
    padding: '0 20px',
  },
  title: {
    fontSize: 28,
    fontWeight: 600,
    marginBottom: 24,
  },
  section: {
    marginBottom: 40,
  },
  label: {
    display: 'block',
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 8,
    color: '#3c3c4399',
  },
  input: {
    display: 'block',
    boxSizing: 'border-box',
    width: '100%',
    padding: '12px 16px',
    fontSize: 16,
    border: '1px solid #d2d2d7',
    borderRadius: 8,
    background: '#f5f5f7',
    marginBottom: 24,
    color: '#1d1d1f',
    outline: 'none',
  },
  button: {
    display: 'inline-block',
    padding: '14px 20px',
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#0070f3',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'opacity 0.2s ease',
  },
  hr: {
    border: 0,
    borderTop: '1px solid #e1e1e4',
    margin: '40px 0',
  },
};

export default function AdminPanel() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [mode, setMode] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [newInterviewer, setNewInterviewer] = useState('');

  useEffect(() => {
    firestore
      .collection('config')
      .doc('grading')
      .get()
      .then((snap) => {
        if (snap.exists) {
          const d = snap.data();
          setMode(d.mode || 'openai');
          setApiKey(d.apiKey || '');
        }
      });
  }, []);

  const saveConfig = async () => {
    try {
      await firestore.collection('config').doc('grading').set({ mode, apiKey });
      toast.success('Grading config saved!');
    } catch (err) {
      toast.error('Failed to save config: ' + err.message);
    }
  };

  const createUserExternally = async (userData) => {
    const res = await fetch('http://localhost:3001/createUser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.uid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const uid = await createUserExternally({ name, email, password, role });
      const batch = firestore.batch();

      const pRef = firestore.collection('pendingUsers').doc();
      batch.set(pRef, {
        name,
        email,
        password,
        role,
        isActivated: false,
        uid,
        createdAt: new Date(),
      });

      const uRef = firestore.collection('users').doc();
      batch.set(uRef, {
        name,
        email,
        role,
        uid,
        createdAt: new Date(),
      });

      await batch.commit();
      toast.success('User created successfully!');
      setName('');
      setEmail('');
      setPassword('');
      setRole('user');
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const addInterviewer = async (e) => {
    e.preventDefault();
    if (!newInterviewer.trim()) return;
    try {
      await firestore.collection('interviewers').add({
        name: newInterviewer.trim(),
        createdAt: new Date(),
      });
      toast.success(`Interviewer “${newInterviewer}” added`);
      setNewInterviewer('');
    } catch {
      toast.error('Failed to add interviewer');
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Admin Panel</h2>

      <section style={styles.section}>
        <h3 style={{ ...styles.title, fontSize: 20 }}>Add New User</h3>
        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Name</label>
          <input
            style={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label style={styles.label}>Temporary Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <label style={styles.label}>Role</label>
          <select
            style={{ ...styles.input, padding: '12px 16px' }}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>

          <button type="submit" style={styles.button}>
            Submit
          </button>
        </form>
      </section>

      <hr style={styles.hr} />

      <section style={styles.section}>
        <h3 style={{ ...styles.title, fontSize: 20 }}>Manage Interviewers</h3>
        <form onSubmit={addInterviewer}>
          <label style={styles.label}>Interviewer Name</label>
          <input
            style={styles.input}
            value={newInterviewer}
            onChange={(e) => setNewInterviewer(e.target.value)}
            placeholder="e.g. Jane Doe"
            required
          />
          <button type="submit" style={styles.button}>
            Add
          </button>
        </form>
      </section>

      <hr style={styles.hr} />

      <section style={styles.section}>
        <h3 style={{ ...styles.title, fontSize: 20 }}>Grading Configuration</h3>
        <label style={styles.label}>Mode</label>
        <select
          style={{ ...styles.input, padding: '12px 16px' }}
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="openai">OpenAI</option>
          <option value="local">Local Model</option>
        </select>

        <label style={styles.label}>OpenAI API Key</label>
        <input
          style={styles.input}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
        />

        <button onClick={saveConfig} style={styles.button}>
          Save Config
        </button>
      </section>
    </div>
  );
}
