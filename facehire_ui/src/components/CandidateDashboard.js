// src/components/CandidateDashboard.js

import React, { useState, useEffect, useRef } from 'react';
import {
  Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Divider, Grid,
  Paper, Stack
} from '@mui/material';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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

  // ─── DEBUG FLAG ───────────────────────────────────────
  const DEBUG = false;
  const debugLog = (...args) => { if (DEBUG) console.log(...args); };

  // Get candidate's UID.
  const [candidateUid, setCandidateUid] = useState(null);
  const [activeTab, setActiveTab] = useState("schedule");
  const [formData, setFormData] = useState({ date: '', time: '', interviewer: '' });
  const [upcomingInterviews, setUpcomingInterviews] = useState([]); // future interviews
  const [missedInterviews, setMissedInterviews] = useState([]);     // interviews that have passed
  const [interviewers, setInterviewers] = useState([]);          // NEW
  const [pastInterviews, setPastInterviews] = useState([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [loadingPast, setLoadingPast] = useState(true);

  const [candidateName, setCandidateName] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const reportRef = useRef();    // ← NEW: ref to the report DOM node
  // NEW: generate & download PDF of the report
  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`report_${selectedInterview.id}.pdf`);
  };

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      if (user) {
        debugLog("🔑 auth state change, setting UID:", user.uid);
        setCandidateUid(user.uid);
        // fetch user profile by matching the `uid` field, not doc ID
        firestore
          .collection('users')
          .where('uid', '==', user.uid)
          .limit(1)
          .get()
          .then(snapshot => {
            debugLog("snapshot", snapshot)
            if (!snapshot.empty) {
              const data = snapshot.docs[0].data() || {};
              setCandidateName(data.name || user.email);
            } else {
              // no matching user doc → fallback to email
              setCandidateName(user.email);
            }
          })
          .catch(err => console.error("Error loading user profile:", err));
      }
    });
    return unsubscribeAuth;
  }, []);

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

  // Log whenever selectedInterview changes
  useEffect(() => {
    if (DEBUG && selectedInterview) {
      debugLog("📋 selectedInterview:", selectedInterview);
      debugLog("📊 responses array:", selectedInterview.responses ?? []);
    }
  }, [selectedInterview]);

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
    const unsubscribePast = firestore
      .collection('interviews')
      .where('candidateUid', '==', candidateUid)
      .where('status', '==', 'completed')
      .orderBy('scheduledAt', 'desc')
      .onSnapshot(snapshot => {
        debugLog("fetched past interviews:", snapshot.docs.length);
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

  // Open/close modal
  const openReport = async (interview) => {
    debugLog("▶️ openReport()", interview);
    try {
      // 1) Query the session doc matching this interview.id
      const sessionSnap = await firestore
        .collection('interviewSessions')
        .where('interviewId', '==', interview.id)
        .limit(1)
        .get();

      if (!sessionSnap.empty) {
        const sessionData = sessionSnap.docs[0].data();
        debugLog("📑 sessionData", sessionData);

        // 2) Merge interview + session fields (including the 'responses' array)
        setSelectedInterview({
          ...interview,
          completedAt: sessionData.completedAt,
          numQuestions: sessionData.numQuestions,
          responses: sessionData.responses || []
        });
      } else {
        debugLog("⚠️ No interviewSessions doc for interviewId:", interview.id);
        setSelectedInterview({ ...interview, responses: [] });
      }
    } catch (err) {
      console.error("Error fetching interview session:", err);
      toast.error("Could not load interview report.");
      return;
    }

    // 3) Now open the modal
    setModalOpen(true);
  };

  const closeReport = () => {
    setModalOpen(false);
    setSelectedInterview(null);
  };

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
        <p>Loading past interviews…</p>
      ) : pastInterviews.length === 0 ? (
        <p>No past interviews available.</p>
      ) : (
        <Table>
        <TableHead>
          <TableRow>
            <TableCell>Date & Time</TableCell>
            <TableCell>Interviewer</TableCell>
            <TableCell>Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pastInterviews.map(interview => {
            const dateObj = convertTimestampToDate(interview.scheduledAt);
            return (
              <TableRow key={interview.id}>
                <TableCell>{dateObj?.toLocaleString() || 'N/A'}</TableCell>
                <TableCell>{interview.interviewer}</TableCell>
                <TableCell>
                  <Button
                    variant="contained"
                    onClick={() => openReport(interview)}
                  >
                    Show Report
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      )}
      {selectedInterview && (
        <Dialog
          open={modalOpen}
          fullScreen
          onClose={closeReport}
        >
          <DialogTitle>
            Interview Assessment Report
            <IconButton
              aria-label="close"
              onClick={closeReport}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers ref={reportRef}>
          {/* ─── Header Details ─────────────────────────────── */}
        <Box mb={3}>
          <Typography variant="h4" gutterBottom>
            Interview Assessment Report
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Typography variant="subtitle2">Candidate</Typography>
              <Typography variant="body1">{candidateName}</Typography>
            </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Date</Typography>
                <Typography variant="body1">
                  {convertTimestampToDate(selectedInterview.scheduledAt)?.toLocaleString()}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Interviewer</Typography>
                <Typography variant="body1">{selectedInterview.interviewer}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Total Score</Typography>
                <Typography variant="body1">
                {(
                    (selectedInterview.responses ?? [])
                      .reduce((sum, r) => sum + (r.score || 0), 0)
                    / Math.max((selectedInterview.responses ?? []).length, 1)
                  ).toFixed(1)}
                %
                </Typography>
              </Grid>
            </Grid>
          </Box>
          <Divider />

        {/* ─── Question Breakdown ─────────────────────────── */}
        <Box mt={3}>
          <Typography variant="h6" gutterBottom>
            Question Breakdown
          </Typography>
          <Stack spacing={2}>
            {(selectedInterview.responses ?? []).map((resp, i) => (
              <Paper key={i} variant="outlined" sx={{ p: 2 }}>
                <Grid container spacing={1} alignItems="center">
                  <Grid item xs={12} sm={8}>
                    <Typography variant="subtitle1">
                      {`Q${i+1}. ${resp.question}`}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={4} textAlign={{ xs: 'left', sm: 'right' }}>
                    <Typography variant="body2">
                      <strong>Score:</strong> {resp.score} / 100
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {resp.difficulty}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      <strong>Expected:</strong> {resp.correctAnswer}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Your Answer:</strong> {resp.answer}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            ))}
          </Stack>
        </Box>
          </DialogContent>
          <DialogActions>
          {/* Print via browser print stylesheet */}
            <Button onClick={() => window.print()}>Print</Button>
            {/* Existing PDF download */}
            <Button onClick={handleDownloadPDF}>Download PDF</Button>
            <Button onClick={closeReport}>Close</Button>
          </DialogActions>
        </Dialog>
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
  },
  th: {
    borderBottom: '1px solid #999',
    textAlign: 'left',
    padding: '8px'
  },
  td: {
    borderBottom: '1px solid #eee',
    padding: '8px'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    width: '85%',
    height: '85%',
    padding: '20px',
    overflowY: 'auto',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
  }
};

export default CandidateDashboard;
