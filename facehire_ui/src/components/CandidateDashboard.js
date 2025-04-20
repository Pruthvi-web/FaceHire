// src/components/CandidateDashboard.js

import React, { useState, useEffect } from 'react';
import { firestore, auth } from '../firebase';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';


// Helper to convert Firestore Timestamp (or Date) to a JavaScript Date.
const convertTimestampToDate = (ts) => {
  if (!ts) return null;
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return new Date(ts);
};

function CandidateDashboard() {
  // Get candidate's UID.
  const candidateUid = auth.currentUser ? auth.currentUser.uid : null;
  const [activeTab, setActiveTab] = useState("schedule");
  const [formData, setFormData] = useState({ date: '', time: '', interviewer: '' });
  const [upcomingInterviews, setUpcomingInterviews] = useState([]); // future interviews
  const [missedInterviews, setMissedInterviews] = useState([]);     // interviews that have passed
  const [interviewers, setInterviewers] = useState([]);          // NEW
  const [pastInterviews, setPastInterviews] = useState([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [loadingPast, setLoadingPast] = useState(true);

  // NEW: subscribe to interviewer list
  useEffect(() => {
    const unsubscribe = firestore
      .collection('interviewers')
      .orderBy('name')
      .onSnapshot(snapshot => {
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name
        }));
        setInterviewers(list);

        // If "AI" isn't already in Firestore, add it
        if (!list.some(i => i.name === 'AI')) {
          firestore.collection('interviewers')
            .add({ name: 'AI', createdAt: new Date() })
            .catch(err => console.error("Could not add default AI:", err));
        }
      }, err => {
        console.error("Error loading interviewer list:", err);
        toast.error("Could not load interviewer list");
      });
    return () => unsubscribe();
  }, []);

  // when interviewers list changes, default to AI if not already set
  useEffect(() => {
    if (interviewers.some(i => i.name === 'AI') && !formData.interviewer) {
      setFormData(fd => ({ ...fd, interviewer: 'AI' }));
    }
  }, [interviewers]);

  // Function to schedule an interview.
  const scheduleInterview = async (e) => {
    e.preventDefault();
    if (!candidateUid) {
      toast.error("Candidate UID not found. Please log in again.");
      return;
    }
    try {
      const scheduledAt = new Date(`${formData.date}T${formData.time}:00`);
      const newInterview = {
        candidateUid,
        scheduledAt, // Firestore converts this to a Timestamp.
        interviewer: formData.interviewer,
        status: 'upcoming',
        createdAt: new Date(),
      };
      await firestore.collection('interviews').add(newInterview);
      toast.success("Interview scheduled successfully!");
      setFormData({ date: '', time: '', interviewer: '' });
    } catch (error) {
      console.error("Error scheduling interview:", error);
      toast.error("Error scheduling interview. Please try again.");
    }
  };

  // Fetch upcoming interviews (status 'upcoming') and partition into future and missed.
  useEffect(() => {
    if (!candidateUid) return;
    const now = new Date();
    const unsubscribe = firestore.collection('interviews')
      .where('candidateUid', '==', candidateUid)
      .where('status', '==', 'upcoming')
      .orderBy('scheduledAt')
      .onSnapshot(snapshot => {
        const future = [];
        const missed = [];
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (!data.scheduledAt) return;
          const scheduledDate = convertTimestampToDate(data.scheduledAt);
          if (scheduledDate >= now) {
            future.push({ id: doc.id, ...data });
          } else {
            missed.push({ id: doc.id, ...data });
          }
        });
        setUpcomingInterviews(future);
        setMissedInterviews(missed);
        setLoadingUpcoming(false);
      }, error => {
        console.error("Error fetching interviews:", error);
        toast.error("Error fetching interviews.");
        setLoadingUpcoming(false);
      });
    return () => unsubscribe();
  }, [candidateUid]);

  // Fetch past (completed) interviews.
  useEffect(() => {
    if (!candidateUid) return;
    const unsubscribePast = firestore.collection('interviews')
      .where('candidateUid', '==', candidateUid)
      .where('status', '==', 'completed')
      .orderBy('scheduledAt', 'desc')
      .onSnapshot(snapshot => {
        const past = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPastInterviews(past);
        setLoadingPast(false);
      }, error => {
        console.error("Error fetching past interviews:", error);
        toast.error("Error fetching past interviews.");
        setLoadingPast(false);
      });
    return () => unsubscribePast();
  }, [candidateUid]);

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
          <label>Interviewer:</label><br />
          <select
            value={formData.interviewer}
            onChange={e => setFormData({ ...formData, interviewer: e.target.value })}
            required
          >
            {interviewers.map(i => (
              <option key={i.id} value={i.name}>{i.name}</option>
            ))}
          </select>
        </div>
        <button type="submit">Schedule Interview</button>
      </form>
    </div>
  );

  const renderUpcomingTab = () => (
    <div>
      <h3>Upcoming/Missed Interviews</h3>
      {loadingUpcoming ? (
        <p>Loading interviews...</p>
      ) : (
        <>
          {upcomingInterviews.length === 0 && missedInterviews.length === 0 ? (
            <p>No upcoming interviews scheduled.</p>
          ) : (
            <>
              {upcomingInterviews.length > 0 && (
                <div>
                  <h4>Scheduled Interviews</h4>
                  <ul>
                    {upcomingInterviews.map(interview => {
                      const dateObj = convertTimestampToDate(interview.scheduledAt);
                      return (
                        <li key={interview.id}>
                          <strong>Date:</strong> {dateObj ? dateObj.toLocaleDateString() : 'N/A'} |{' '}
                          <strong>Time:</strong> {dateObj ? dateObj.toLocaleTimeString() : 'N/A'} |{' '}
                          <strong>Interviewer:</strong> {interview.interviewer}
                          {/* ←–– here’s your Join button */}
                          <Link to={`/interview/${interview.id}`} style={{ marginLeft: '12px', textDecoration: 'none' }}>
                          <button type="button">Join</button>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {missedInterviews.length > 0 && (
                <div style={{ marginTop: '20px', color: '#888' }}>
                  <h4>Missed Interviews (Deadline Passed)</h4>
                  <ul>
                    {missedInterviews.map(interview => {
                      const dateObj = convertTimestampToDate(interview.scheduledAt);
                      return (
                        <li key={interview.id}>
                          <strong>Date:</strong> {dateObj ? dateObj.toLocaleDateString() : 'N/A'} |{' '}
                          <strong>Time:</strong> {dateObj ? dateObj.toLocaleTimeString() : 'N/A'} |{' '}
                          <strong>Interviewer:</strong> {interview.interviewer}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );

  const renderPastTab = () => (
    <div>
      <h3>Past Interviews & Reports</h3>
      {loadingPast ? (
        <p>Loading past interviews...</p>
      ) : pastInterviews.length === 0 ? (
        <p>No past interviews available.</p>
      ) : (
        <ul>
          {pastInterviews.map(interview => {
            const dateObj = convertTimestampToDate(interview.scheduledAt);
            return (
              <li key={interview.id}>
                <strong>Date:</strong> {dateObj ? dateObj.toLocaleDateString() : 'N/A'} |{' '}
                <strong>Time:</strong> {dateObj ? dateObj.toLocaleTimeString() : 'N/A'} |{' '}
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
          Upcoming/Missed Interviews
        </button>
        <button
          style={activeTab === 'past' ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab('past')}
        >
          Past Interviews/Reports
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
