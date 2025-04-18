// src/components/InterviewPage.js

import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { toast } from 'react-toastify';
import { auth, firestore } from '../firebase';
import * as faceapi from 'face-api.js';
import { useParams } from 'react-router-dom';
import stringSimilarity from 'string-similarity';


// DEBUG flag to enable/disable extra logging.
const DEBUG = false;
const debugLog = (...args) => {
  if (DEBUG) console.log(...args);
};

// Placeholder for emotion detection (replace with a real library later)
function detectEmotions(videoElement) {
  const moods = ["Relaxed", "Neutral", "Stressed"];
  const mood = moods[Math.floor(Math.random() * moods.length)];
  const anxietyScore = (Math.random() * 10).toFixed(1);
  return { mood, anxietyScore };
}

// Speech Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function InterviewPage() {
  // Phase: "waiting", "inProgress", or "completed"
  const { interviewId } = useParams();
  const [phase, setPhase] = useState("waiting");
  const [gradedResponses, setGradedResponses] = useState([]);

  // Waiting area state
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [numQuestions, setNumQuestions] = useState(5);

  // Full question bank loaded from CSV.
  const [allQuestions, setAllQuestions] = useState([]);

  // Questions selected for this interview session.
  const [sessionQuestions, setSessionQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Interview session responses array.
  const [responses, setResponses] = useState([]);

  // Real-time emotional state.
  const [emotionalState, setEmotionalState] = useState({ mood: "Neutral", anxietyScore: "0" });

  // Video reference for camera feed.
  const videoRef = useRef(null);

  // Speech recognition state.
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const recognitionRef = useRef(null);
  const recognitionTimerRef = useRef(null);

  // Get candidate UID.
  const candidateUid = auth.currentUser ? auth.currentUser.uid : null;

  // --- STEP 1: Load CSV question bank ---
  useEffect(() => {
    const csvUrl = "/questionBank.csv"; // CSV file should be in the public folder.
    debugLog("Fetching CSV from:", csvUrl);
    Papa.parse(csvUrl, {
      download: true,
      header: true, // Expect headers such as "Question;Answer;Category;Difficulty"
      delimiter: ",", // Adjust the delimiter if needed (change if semicolon is required)
      skipEmptyLines: "greedy",
      complete: (results) => {
        // debugLog("CSV parsing complete:", results);
        if (results.errors && results.errors.length > 0) {
          const errorString = results.errors.map(e => e.message).join(", ");
          toast.error("CSV parsing errors: " + errorString);
          return;
        }
        setAllQuestions(results.data);
        // toast.success("Loaded " + results.data.length + " interview questions.");
        // toast.success("Loaded interview questions successfully!");
      },
      error: (error) => {
        debugLog("CSV loading error:", error);
        toast.error("Error loading CSV: " + error.message);
      }
    });
  }, []);

  // --- STEP 2: Filter questions by selected category ---
  useEffect(() => {
    if (selectedCategory === "All") {
      setSessionQuestions(allQuestions);
    } else {
      const subset = allQuestions.filter(q => q.Category && q.Category.toLowerCase() === selectedCategory.toLowerCase());
      setSessionQuestions(subset);
    }
    setCurrentIndex(0);
  }, [selectedCategory, allQuestions]);

  // --- STEP 3: Setup camera feed ONLY in InterviewPage ---
  useEffect(() => {
    let stream; // local variable to store the stream
    const setupCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        debugLog("Camera stream started.");
      } catch (error) {
        debugLog("Error accessing webcam:", error);
        toast.error("Unable to access camera. Please check your browser settings.");
      }
    };
    
    setupCamera();
    
    // Cleanup function: stop all tracks when the component unmounts.
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop();
        });
        debugLog("Camera stream stopped on unmount.");
      }
    };
  }, []);

  // --- STEP 4: Poll for real-time emotion ---
  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        await faceapi.nets.faceExpressionNet.loadFromUri("/models");
        debugLog("face-api.js models loaded successfully.");
      } catch (error) {
        debugLog("Error loading face-api.js models:", error);
        toast.error("Failed to load face detection models.");
      }
    };
    loadModels();
  }, []);
  
  useEffect(() => {
    const interval = setInterval(async () => {
      if (videoRef.current) {
        try {
          const detections = await faceapi
            .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
            .withFaceExpressions();
          if (detections && detections.expressions) {
            const expressions = detections.expressions;
            // Determine the dominant expression for "mood"
            let dominantExpression = "neutral";
            let dominantValue = 0;
            for (const [expr, value] of Object.entries(expressions)) {
              if (value > dominantValue) {
                dominantValue = value;
                dominantExpression = expr;
              }
            }
            // Compute anxiety using a weighted formula
            // We assume: angry, fearful, and sad contribute positively; happy reduces anxiety.
            const rawAnxiety = 
              0.3 * (expressions.angry || 0) + 
              0.3 * (expressions.fearful || 0) + 
              0.2 * (expressions.sad || 0) - 
              0.4 * (expressions.happy || 0);
            // Ensure no negative values
            const adjustedAnxiety = Math.max(0, rawAnxiety);
            // Multiply by 20 to amplify differences, then clamp the result between 0 and 10
            const anxietyScore = Math.min(10, Math.round(adjustedAnxiety * 20));

            setEmotionalState({ mood: dominantExpression, anxietyScore: anxietyScore.toString() });
            debugLog("Detected expressions:", expressions, "Dominant:", dominantExpression, "Anxiety Score:", anxietyScore);
          }
        } catch (error) {
          debugLog("Error in face detection:", error);
        }
      }
    }, 1000); // Poll every second
    return () => clearInterval(interval);
  }, []);

  // --- STEP 5: Use TTS to speak the current question ---
  useEffect(() => {
    if (phase !== "inProgress" || sessionQuestions.length === 0) return;
    const currentQ = sessionQuestions[currentIndex];
    if (currentQ && currentQ.Question) {
      const utterance = new SpeechSynthesisUtterance(currentQ.Question);
      speechSynthesis.speak(utterance);
      debugLog("Speaking question:", currentQ.Question);
    }
  }, [phase, currentIndex, sessionQuestions]);

  // --- STEP 6: Waiting Area - Start Interview Session ---
  const startInterviewSession = () => {
    let filtered;
    if (selectedCategory === "All") {
      filtered = allQuestions;
    } else {
      filtered = allQuestions.filter(q => q.Category && q.Category.toLowerCase() === selectedCategory.toLowerCase());
    }
    if (filtered.length === 0) {
      toast.error("No questions available for this category.");
      return;
    }
    // Select up to numQuestions from the filtered questions.
    const sessionQs = filtered.slice(0, numQuestions);
    setSessionQuestions(sessionQs);
    setCurrentIndex(0);
    setResponses([]);
    setPhase("inProgress");
  };

  // --- STEP 7: Start Speech Recognition with Auto-Stop ---
  const startRecognition = () => {
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported by this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    setCurrentTranscript("");

    recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          setCurrentTranscript(prev => prev + transcript + " ");
        } else {
          interimTranscript += transcript;
        }
      }
      debugLog("Interim transcript:", interimTranscript);
      // Reset auto-stop timer on each result.
      if (recognitionTimerRef.current) {
        clearTimeout(recognitionTimerRef.current);
      }
      recognitionTimerRef.current = setTimeout(() => {
        recognition.stop();
      }, 3000); // Stop after 3 seconds of silence.
    };

    recognition.onerror = (event) => {
      debugLog("Speech recognition error:", event.error);
      toast.error("Speech recognition error: " + event.error);
    };

    recognition.onend = () => {
      setIsRecognizing(false);
      debugLog("Speech recognition ended. Final transcript:", currentTranscript);
    };

    recognition.start();
    setIsRecognizing(true);
    recognitionRef.current = recognition;
    debugLog("Speech recognition started.");
    toast.info("Listening for your answer...");
  };

  const stopRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  // --- STEP 8: Submit Answer for Current Question ---
  const handleSubmitAnswer = async () => {
    if (!currentTranscript.trim()) {
      toast.error("No answer captured. Please try again.");
      return;
    }
    const currentQ = sessionQuestions[currentIndex];
    const newResponse = {
      question: currentQ.Question,
      category: currentQ.Category,
      difficulty: currentQ.Difficulty,
      answer: currentTranscript.trim(),
      emotion: emotionalState,
      answeredAt: new Date()
    };
    const updatedResponses = [...responses, newResponse];
    setResponses(updatedResponses);
    setCurrentTranscript("");
    
    if (currentIndex + 1 < sessionQuestions.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      completeInterviewSession(updatedResponses);
    }
  };

  // --- STEP 9: Complete Interview Session & Save as One Document in Firestore ---
  const completeInterviewSession = async (sessionResponses) => {
    if (!candidateUid || !interviewId) return;

    console.log("Grading sessionResponses:", sessionResponses);
    console.log("stringSimilarity function:", stringSimilarity);

    const gradedResponses = sessionResponses.map(resp => {
      // find matching question in this session
      const q = sessionQuestions.find(q => q.Question === resp.question) || {};
      const correct = q.Answer ?? q.Answer ?? "";

      // compare lowercased strings
      const similarity = stringSimilarity.compareTwoStrings(
        resp.answer.trim().toLowerCase(),
        correct.trim().toLowerCase()
      );
      const score = Math.round(similarity * 100);
      let grade;
      if (score >= 80) grade = 'A';
      else if (score >= 60) grade = 'B';
      else if (score >= 40) grade = 'C';
      else grade = 'F';
  
      return {
        ...resp,
        correctAnswer: correct,
        score,
        grade
      };
    });
    setGradedResponses(gradedResponses);
    const sessionData = {
      interviewId,  
      userId: candidateUid,
      selectedCategory,
      numQuestions: sessionQuestions.length,
      responses: gradedResponses,
      completedAt: new Date()
    };
    try {
      const sessionRef = await firestore
        .collection("interviewSessions")
        .add(sessionData);
      await firestore
        .collection("interviews")
        .doc(interviewId)
        .update({
          status: 'completed',
          sessionId: sessionRef.id,    // remove if you don’t need it
      });
      toast.success("Interview session saved successfully!");
      setPhase("completed");
    } catch (error) {
      debugLog("Error saving interview session:", error);
      toast.error("Failed to save interview session: " + error.message);
    }
  };

  // --- STEP 10: Regrade Session (Placeholder) ---
  const regradeSession = async () => {
    // Placeholder: Add regrading logic here if desired.
    toast.info("Regrading session... (Feature to be implemented)");
  };

  // --- Render Based on Phase ---
  if (phase === "waiting") {
    return (
      <div style={styles.container}>
        <h2>Interview Waiting Room</h2>
        <div style={styles.videoWrapper}>
          <video ref={videoRef} autoPlay muted style={styles.video} />
          <div style={styles.emotionFeedback}>
            <p>Mood: {emotionalState.mood}</p>
            <p>Anxiety: {emotionalState.anxietyScore}</p>
          </div>
        </div>
        <div style={styles.waitingOptions}>
          <div>
            <label>Select Interview Topic (Category): </label>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              <option value="All">All</option>
              {Array.from(new Set(allQuestions.map(q => q.Category).filter(Boolean))).map((cat, idx) => (
                <option key={idx} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: "10px" }}>
            <label>Number of Questions: </label>
            <input 
              type="number" 
              value={numQuestions} 
              onChange={(e) => setNumQuestions(parseInt(e.target.value) || 0)} 
              style={{ width: "60px" }}
            />
          </div>
          <button style={{ marginTop: "20px", padding: "10px 20px" }} onClick={startInterviewSession}>
            I'm Ready
          </button>
        </div>
      </div>
    );
  } else if (phase === "inProgress") {
    const currentQ = sessionQuestions[currentIndex];
    return (
      <div style={styles.container}>
        <h2>Interview Session</h2>
        <div style={styles.videoWrapper}>
          <video ref={videoRef} autoPlay muted style={styles.video} />
          <div style={styles.emotionFeedback}>
            <p>Mood: {emotionalState.mood}</p>
            <p>Anxiety: {emotionalState.anxietyScore}</p>
          </div>
        </div>
        <div style={styles.questionSection}>
          <h3>Question {currentIndex + 1} of {sessionQuestions.length}</h3>
          <p>{currentQ.Question}</p>
        </div>
        <div style={styles.answerSection}>
          {isRecognizing ? (
            <p>Listening… (Please speak your answer)</p>
          ) : (
            <button onClick={startRecognition} style={styles.button}>
              Record Answer
            </button>
          )}
          <p><strong>Your Captured Answer:</strong> {currentTranscript}</p>
          <button onClick={handleSubmitAnswer} style={{ ...styles.button, marginTop: "10px" }}>
            Submit Answer & Next
          </button>
        </div>
      </div>
    );
  } else if (phase === "completed") {
    return (
      <div style={styles.container}>
        <h2>Interview Session Completed</h2>
        <p>Your interview responses have been saved.</p>
        <button onClick={regradeSession} style={styles.button}>
          Regrade Session
        </button>
      </div>
    );
  } else {
    return <div style={styles.container}>Unknown phase.</div>;
  }
}

const styles = {
  container: {
    padding: "20px",
    maxWidth: "800px",
    margin: "0 auto",
    textAlign: "center"
  },
  videoWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "20px"
  },
  video: {
    width: "320px",
    height: "240px",
    backgroundColor: "#333",
    marginRight: "20px"
  },
  emotionFeedback: {
    border: "1px solid #ccc",
    borderRadius: "4px",
    padding: "10px",
    width: "150px",
    textAlign: "center"
  },
  waitingOptions: {
    marginTop: "20px",
    textAlign: "left",
    display: "inline-block"
  },
  questionSection: {
    marginBottom: "20px",
    textAlign: "left"
  },
  answerSection: {
    marginBottom: "20px"
  },
  button: {
    padding: "10px 20px",
    backgroundColor: "#1976d2",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    fontSize: "16px",
    cursor: "pointer"
  }
};

export default InterviewPage;