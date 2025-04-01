// src/components/CandidateDashboard.js

import React, { useState, useEffect } from 'react';
import { firestore, auth } from '../firebase';

// Helper function to safely convert Firestore timestamp to Date.
const convertTimestampToDate = (ts) => {
  if (!ts) return null;
  if (ts.seconds) {
    return new Date(ts.seconds * 1000);
  }
  return new Date(ts);
};

function CandidateDashboard() {
  // Get the candidate's UID from the current auth user.
  const candidateUid = auth.currentUser ? auth.currentUser.uid : null;

  const [activeTab, setActiveTab] = useState('upcoming'); // "upcoming" and "past" tabs
  const [upcomingInterviews, setUpcomingInterviews] = useState([]);
  const [missedInterviews, setMissedInterviews] = useState([]);
  const [pastInterviews, setPastInterviews] = useState([]);
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    interviewer: '',
  });
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [loadingMissed, setLoadingMissed] = useState(true);
  const [loadingPast, setLoadingPast] = useState(true);

  // Function to schedule an interview.
  const scheduleInterview = async (e) => {
    e.preventDefault();
    if (!candidateUid) {
      alert('Candidate UID not found. Please log in again.');
      return;
    }
    try {
      // Combine date and time into a Date object.
      const scheduledAt = new Date(`${formData.date}T${formData.time}:00`);
      
      const newInterview = {
        candidateUid,
        scheduledAt, // Firestore will convert this to a Timestamp.
        interviewer: formData.interviewer,
        status: 'upcoming',
        createdAt: new Date(),
      };
      await firestore.collection('interviews').add(newInterview);
      alert('Interview scheduled successfully!');
      // Clear form fields.
      setFormData({ date: '', time: '', interviewer: '' });
    } catch (error) {
      console.error('Error scheduling interview:', error);
      alert('Error scheduling interview. Please try again.');
    }
  };

  // Query upcoming interviews: scheduledAt >= now.
  useEffect(() => {
    if (!candidateUid) return;
    const now = new Date();
    const unsubscribeUpcoming = firestore
      .collection('interviews')
      .where('candidateUid', '==', candidateUid)
      .where('status', '==', 'upcoming')
      .where('scheduledAt', '>=', now)
      .orderBy('scheduledAt')
      .onSnapshot((snapshot) => {
        const upcoming = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUpcomingInterviews(upcoming);
        setLoadingUpcoming(false);
      }, error => {
        console.error('Error fetching upcoming interviews:', error);
        setLoadingUpcoming(false);
      });
    return () => unsubscribeUpcoming();
  }, [candidateUid]);

  // Query missed interviews: scheduledAt < now.
  useEffect(() => {
    if (!candidateUid) return;
    const now = new Date();
    const unsubscribeMissed = firestore
      .collection('interviews')
      .where('candidateUid', '==', candidateUid)
      .where('status', '==', 'upcoming')
      .where('scheduledAt', '<', now)
      .orderBy('scheduledAt', 'desc')
      .onSnapshot((snapshot) => {
        const missed = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMissedInterviews(missed);
        setLoadingMissed(false);
      }, error => {
        console.error('Error fetching missed interviews:', error);
        setLoadingMissed(false);
      });
    return () => unsubscribeMissed();
  }, [candidateUid]);

  // Query past (completed) interviews.
  useEffect(() => {
    if (!candidateUid) return;
    const unsubscribePast = firestore
      .collection('interviews')
      .where('candidateUid', '==', candidateUid)
      .where('status', '==', 'completed')
      .orderBy('scheduledAt', 'desc')
      .onSnapshot((snapshot) => {
        const past = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPastInterviews(past);
        setLoadingPast(false);
      }, error => {
        console.error('Error fetching past interviews:', error);
        setLoadingPast(false);
      });
    return () => unsubscribePast();
  }, [candidateUid]);

  // Render the tab for scheduling an interview.
  const renderScheduleTab = () => (
    <div>
      <h3>Schedule an Interview</h3>
      <form onSubmit={scheduleInterview}>
        <div style={{ marginBottom: '10px' }}>
          <label>Date:</label><br />
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>Time:</label><br />
          <input
            type="time"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            required
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>Interviewer Name:</label><br />
          <input
            type="text"
            value={formData.interviewer}
            onChange={(e) => setFormData({ ...formData, interviewer: e.target.value })}
            required
          />
        </div>
        <button type="submit">Schedule Interview</button>
      </form>
    </div>
  );

  // Render upcoming interviews: those with scheduledAt >= now are shown normally,
  // and those with scheduledAt < now (missed) are shown in a greyed-out section.
  const renderUpcomingTab = () => (
    <div>
      <h3>Upcoming Interviews</h3>
      {loadingUpcoming ? (
        <p>Loading upcoming interviews...</p>
      ) : upcomingInterviews.length === 0 ? (
        <p>No upcoming interviews scheduled.</p>
      ) : (
        <ul>
          {upcomingInterviews.map((interview) => {
            const scheduledAt = convertTimestampToDate(interview.scheduledAt);
            return (
              <li key={interview.id}>
                <strong>Date:</strong> {scheduledAt ? scheduledAt.toLocaleDateString() : 'N/A'} |{' '}
                <strong>Time:</strong> {scheduledAt ? scheduledAt.toLocaleTimeString() : 'N/A'} |{' '}
                <strong>Interviewer:</strong> {interview.interviewer}
              </li>
            );
          })}
        </ul>
      )}
      {missedInterviews.length > 0 && (
        <div style={{ marginTop: '20px', color: '#888' }}>
          <h4 style={{ color: '#888' }}>Missed Interviews (Deadline Passed)</h4>
          {loadingMissed ? (
            <p>Loading missed interviews...</p>
          ) : (
            <ul>
              {missedInterviews.map((interview) => {
                const scheduledAt = convertTimestampToDate(interview.scheduledAt);
                return (
                  <li key={interview.id}>
                    <strong>Date:</strong> {scheduledAt ? scheduledAt.toLocaleDateString() : 'N/A'} |{' '}
                    <strong>Time:</strong> {scheduledAt ? scheduledAt.toLocaleTimeString() : 'N/A'} |{' '}
                    <strong>Interviewer:</strong> {interview.interviewer}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  // Render the Past Interviews & Reports tab.
  const renderPastTab = () => (
    <div>
      <h3>Past Interviews & Reports</h3>
      {loadingPast ? (
        <p>Loading past interviews...</p>
      ) : pastInterviews.length === 0 ? (
        <p>No past interviews available.</p>
      ) : (
        <ul>
          {pastInterviews.map((interview) => {
            const scheduledAt = convertTimestampToDate(interview.scheduledAt);
            return (
              <li key={interview.id}>
                <strong>Date:</strong> {scheduledAt ? scheduledAt.toLocaleDateString() : 'N/A'} |{' '}
                <strong>Time:</strong> {scheduledAt ? scheduledAt.toLocaleTimeString() : 'N/A'} |{' '}
                <strong>Interviewer:</strong> {interview.interviewer}
                {interview.report && (
                  <>
                    <br /><strong>Report:</strong> {interview.report}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <div style={{ padding: '20px' }}>
      <h2>Candidate Dashboard</h2>
      <div style={styles.tabContainer}>
        <button
          style={activeTab === 'schedule' ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab('schedule')}
        >
          Schedule Interview
        </button>
        <button
          style={activeTab === 'upcoming' ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab('upcoming')}
        >
          Upcoming Interviews
        </button>
        <button
          style={activeTab === 'past' ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab('past')}
        >
          Past Interviews & Reports
        </button>
      </div>
      <div style={styles.contentContainer}>
        {activeTab === 'schedule' && renderScheduleTab()}
        {activeTab === 'upcoming' && renderUpcomingTab()}
        {activeTab === 'past' && renderPastTab()}
      </div>
    </div>
  );
}

const styles = {
  tabContainer: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px'
  },
  tab: {
    padding: '10px 20px',
    cursor: 'pointer',
    backgroundColor: '#e0e0e0',
    border: 'none',
    borderRadius: '4px'
  },
  activeTab: {
    padding: '10px 20px',
    cursor: 'pointer',
    backgroundColor: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: '4px'
  },
  contentContainer: {
    border: '1px solid #ccc',
    borderRadius: '4px',
    padding: '20px'
  }
};

export default CandidateDashboard;
