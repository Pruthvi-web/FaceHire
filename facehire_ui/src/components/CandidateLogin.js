// src/components/CandidateLogin.js

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { firestore } from '../firebase';

function CandidateLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCandidateLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      // Query the pendingUsers collection for a document matching the email.
      const querySnapshot = await firestore
        .collection('pendingUsers')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (querySnapshot.empty) {
        setError('No account found with this email.');
        return;
      }
      
      const doc = querySnapshot.docs[0];
      const candidateData = doc.data();

      // Check if the entered password matches the stored password.
      if (candidateData.password !== password) {
        setError('Incorrect password.');
        return;
      }
      
      // Credentials are correct. Navigate to candidate dashboard.
      navigate('/candidate-dashboard');
      
    } catch (err) {
      console.error("Error during candidate login:", err);
      setError('An error occurred. Please try again.');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Candidate Login</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleCandidateLogin}>
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
          <label>Password:</label><br />
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
        </div>
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

export default CandidateLogin;
