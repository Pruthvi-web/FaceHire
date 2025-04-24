// src/components/InterviewPage.js

import { pipeline } from '@xenova/transformers';
import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { toast } from 'react-toastify';
import { auth, firestore } from '../firebase';
import * as faceapi from 'face-api.js';
import { useParams, useNavigate, Link } from 'react-router-dom';
import stringSimilarity from 'string-similarity';
import { openai } from '../openai';
import OpenAI from 'openai';                            // ← default export

import * as use from '@tensorflow-models/universal-sentence-encoder';
import '@tensorflow/tfjs';

// System font stack for Apple-style
const systemFontStack = [
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  'Oxygen',
  'Ubuntu',
  'Cantarell',
  '"Open Sans"',
  '"Helvetica Neue"',
  'sans-serif',
].join(', ');

// Shared Apple-inspired styles
const styles = {
  container: {
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto',
    fontFamily: systemFontStack,
    color: '#1d1d1f',
    backgroundColor: '#fff',
    textAlign: 'center'
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    marginBottom: '24px',
    fontFamily: systemFontStack
  },
  videoWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    marginBottom: '32px'
  },
  video: {
    width: '320px',
    height: '240px',
    backgroundColor: '#000',
    borderRadius: 8
  },
  emotionFeedback: {
    border: '1px solid #d2d2d7',
    borderRadius: 8,
    padding: '16px',
    width: '160px',
    textAlign: 'center',
    backgroundColor: '#f5f5f7',
    fontFamily: systemFontStack
  },
  formGrid: {
    display: 'grid',
    gap: '16px',
    maxWidth: '400px',
    margin: '0 auto',
    textAlign: 'left'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: '#3c3c4399',
    marginBottom: '8px',
    fontFamily: systemFontStack
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    fontSize: 16,
    border: '1px solid #d2d2d7',
    borderRadius: 8,
    backgroundColor: '#f5f5f7',
    outline: 'none',
    fontFamily: systemFontStack
  },
  numberInput: {
    width: '80px',
    padding: '12px 16px',
    fontSize: 16,
    border: '1px solid #d2d2d7',
    borderRadius: 8,
    backgroundColor: '#f5f5f7',
    outline: 'none',
    fontFamily: systemFontStack
  },
  button: {
    padding: '14px 20px',
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#0070f3',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: systemFontStack
  },
  questionBox: {
    padding: '24px',
    border: '1px solid #e1e1e4',
    borderRadius: 8,
    marginBottom: '24px',
    textAlign: 'left',
    backgroundColor: '#fdfdfd',
    fontFamily: systemFontStack
  },
  questionText: {
    fontSize: 18,
    color: '#1d1d1f'
  },
  answerSection: {
    marginTop: '16px',
    textAlign: 'center'
  },
  listening: {
    fontStyle: 'italic',
    fontFamily: systemFontStack
  },
  transcript: {
    marginTop: '16px',
    fontSize: 16,
    fontFamily: systemFontStack
  },
  bodyText: {
    fontSize: 16,
    marginBottom: '24px',
    fontFamily: systemFontStack
  }
};

// DEBUG flag to enable/disable extra logging.
const DEBUG = false;
const debugLog = (...args) => { if (DEBUG) console.log(...args); };

// Placeholder for emotion detection (replace with a real library later)
function detectEmotions(videoElement) {
  const moods = ["Relaxed", "Neutral", "Stressed"];
  const mood = moods[Math.floor(Math.random() * moods.length)];
  const anxietyScore = (Math.random() * 10).toFixed(1);
  return { mood, anxietyScore };
}

// Speech Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const useExtractor = () => {
  const [extractor, setExtractor] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await pipeline(
          'feature-extraction',
          '/models/use-mini'
        );
        debugLog("p:", p);
        setExtractor(p);
        debugLog('✅ MiniLM extractor loaded');
      } catch (e) {
        console.error('Extractor load failed', e);
        toast.error('Failed to load NLP model');
      }
    })();
  }, []);

  return extractor;
};

// ——— Load the USE model from TF Hub ———
const useModelLoader = () => {
  const [model, setModel] = useState(null);

  useEffect(() => {
    use.load()
      .then(m => {
        setModel(m);
        debugLog('✅ USE model loaded from TF Hub');
      })
      .catch(err => {
        console.error('❌ Failed to load USE:', err);
        toast.error('Failed to load grading model');
      });
  }, []);

  return model;
};

/** Fisher–Yates shuffle */
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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

  // NEW: Speech recognition state.
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const recognitionRef = useRef(null);
  const recognitionTimerRef = useRef(null);

  // Get candidate UID.
  const candidateUid = auth.currentUser ? auth.currentUser.uid : null;

  // ——— Grading config from Firestore ———
  const [gradingMode, setGradingMode] = useState("openai");
  const [gradingApiKey, setGradingApiKey] = useState("");
  const [openaiClient, setOpenaiClient] = useState(null);

  const navigate = useNavigate();

  // Load grading config once
  useEffect(() => {
    firestore.collection("config").doc("grading").get()
      .then(snap => {
        if (snap.exists) {
          const cfg = snap.data();
          setGradingMode(cfg.mode || "openai");
          setGradingApiKey(cfg.apiKey || "");
        }
      })
      .catch(err => console.error("Config load error:", err));
  }, []);

  // Reconfigure OpenAI client whenever mode or key changes
  useEffect(() => {
    if (gradingMode === "openai" && gradingApiKey) {
      setOpenaiClient(new OpenAI({ apiKey: gradingApiKey, dangerouslyAllowBrowser: true }));
      debugLog("OpenAI client initialized");
    } else {
      setOpenaiClient(null);
    }
  }, [gradingMode, gradingApiKey]);

  // --- STEP 1: Load CSV question bank ---
  useEffect(() => {
    const csvUrl = "/questionBank.csv";
    debugLog("Fetching CSV from:", csvUrl);
    Papa.parse(csvUrl, {
      download: true,
      header: true,
      delimiter: ",",
      skipEmptyLines: "greedy",
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          const errorString = results.errors.map(e => e.message).join(", ");
          toast.error("CSV parsing errors: " + errorString);
          return;
        }
        setAllQuestions(results.data);
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
    let stream;
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

    const interval = setInterval(async () => {
      if (videoRef.current) {
        try {
          const detections = await faceapi
            .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
            .withFaceExpressions();
          if (detections && detections.expressions) {
            const expressions = detections.expressions;
            let dominantExpression = "neutral";
            let dominantValue = 0;
            for (const [expr, value] of Object.entries(expressions)) {
              if (value > dominantValue) {
                dominantValue = value;
                dominantExpression = expr;
              }
            }
            const rawAnxiety =
              0.3 * (expressions.angry || 0) +
              0.3 * (expressions.fearful || 0) +
              0.2 * (expressions.sad || 0) -
              0.4 * (expressions.happy || 0);
            const adjustedAnxiety = Math.max(0, rawAnxiety);
            const anxietyScore = Math.min(10, Math.round(adjustedAnxiety * 20));

            setEmotionalState({ mood: dominantExpression, anxietyScore: anxietyScore.toString() });
          }
        } catch (error) {
          debugLog("Error in face detection:", error);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // --- STEP 5: Use TTS to speak the current question ---
  useEffect(() => {
    if (phase !== "inProgress" || sessionQuestions.length === 0) return;
    const currentQ = sessionQuestions[currentIndex];
    if (currentQ && currentQ.Question) {
      const utterance = new SpeechSynthesisUtterance(currentQ.Question);
      speechSynthesis.speak(utterance);
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
    const sessionQs = shuffleArray(filtered).slice(0, numQuestions);
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
      if (recognitionTimerRef.current) {
        clearTimeout(recognitionTimerRef.current);
      }
      recognitionTimerRef.current = setTimeout(() => {
        recognition.stop();
      }, 3000);
    };

    recognition.onerror = (event) => {
      toast.error("Speech recognition error: " + event.error);
    };

    recognition.onend = () => {
      setIsRecognizing(false);
    };

    recognition.start();
    setIsRecognizing(true);
    recognitionRef.current = recognition;
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
    const graded = await Promise.all(sessionResponses.map(async resp => {
      const q = sessionQuestions.find(q => q.Question === resp.question) || {};
      const correct = q.Answer || "";
      let score = 0;

      if (gradingMode === "openai" && openaiClient) {
        try {
          const res = await openaiClient.createEmbedding({
            model: "text-embedding-ada-002",
            input: [resp.answer, correct]
          });
          const [u, v] = res.data.data.map(d => d.embedding);
          const dot = u.reduce((s, x, i) => s + x * v[i], 0);
          const magU = Math.hypot(...u), magV = Math.hypot(...v);
          score = magU && magV ? Math.round(dot / (magU * magV) * 100) : 0;
        } catch {
          score = Math.round(
            stringSimilarity.compareTwoStrings(
              resp.answer.trim().toLowerCase(),
              correct.trim().toLowerCase()
            ) * 100
          );
        }
      } else {
        score = Math.round(
          stringSimilarity.compareTwoStrings(
            resp.answer.trim().toLowerCase(),
            correct.trim().toLowerCase()
          ) * 100
        );
      }

      const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'F';
      return { ...resp, correctAnswer: correct, score, grade };
    }));

    setGradedResponses(graded);

    try {
      const sessionRef = await firestore.collection("interviewSessions").add({
        interviewId,
        userId: candidateUid,
        selectedCategory,
        numQuestions: sessionQuestions.length,
        responses: graded,
        completedAt: new Date()
      });
      await firestore.collection("interviews")
        .doc(interviewId)
        .update({ status: 'completed', sessionId: sessionRef.id });
      toast.success("Interview saved!");
      setPhase("completed");
    } catch (err) {
      toast.error("Save error: " + err.message);
    }
  };

  // --- STEP 10: Regrade Session (Placeholder) ---
  const regradeSession = async () => {
    // Placeholder: Add regrading logic here if desired.
  };

  // --- Render Based on Phase ---
  if (phase === "waiting") {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>Interview Waiting Room</h2>
        <div style={styles.videoWrapper}>
          <video ref={videoRef} autoPlay muted style={styles.video} />
          <div style={styles.emotionFeedback}>
            <p>Mood: {emotionalState.mood}</p>
            <p>Anxiety: {emotionalState.anxietyScore}</p>
          </div>
        </div>
        <div style={styles.formGrid}>
          <label style={styles.label}>Select Interview Topic (Category):</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={styles.select}
          >
            <option value="All">All</option>
            {Array.from(new Set(allQuestions.map(q => q.Category).filter(Boolean))).map((cat, idx) => (
              <option key={idx} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>

          <label style={styles.label}>Number of Questions:</label>
          <input
            type="number"
            value={numQuestions}
            onChange={(e) => setNumQuestions(parseInt(e.target.value, 10) || 0)}
            style={styles.numberInput}
          />

          <button style={styles.button} onClick={startInterviewSession}>
            I’m Ready
          </button>
        </div>
      </div>
    );
  } else if (phase === "inProgress") {
    const currentQ = sessionQuestions[currentIndex] || {};
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>
          Question {currentIndex + 1} of {sessionQuestions.length}
        </h2>
  
        {/* ← KEEP CAMERA VISIBLE */}
        <div style={styles.videoWrapper}>
          <video
            ref={videoRef}
            autoPlay
            muted
            style={styles.video}
          />
          <div style={styles.emotionFeedback}>
            <p>Mood: {emotionalState.mood}</p>
            <p>Anxiety: {emotionalState.anxietyScore}</p>
          </div>
        </div>
  
        <div style={styles.questionBox}>
          <p style={styles.questionText}>{currentQ.Question}</p>
        </div>
  
        <div style={styles.answerSection}>
          {isRecognizing ? (
            <p style={styles.listening}>Listening… (Please speak your answer)</p>
          ) : (
            <button onClick={startRecognition} style={styles.button}>
              Record Answer
            </button>
          )}
          <p style={styles.transcript}>
            <strong>Your Captured Answer:</strong> {currentTranscript}
          </p>
          <button
            onClick={handleSubmitAnswer}
            style={{ ...styles.button, marginTop: '16px' }}
          >
            Submit Answer & Next
          </button>
        </div>
      </div>
    );  
  } else if (phase === "completed") {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>Interview Session Completed</h2>
        <p style={styles.bodyText}>Your interview responses have been saved.</p>
        <button
          style={styles.button}
          onClick={async () => {
            await regradeSession();
            navigate('/candidate-dashboard');
          }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  } else {
    return <div style={styles.container}>Unknown phase.</div>;
  }
}

export default InterviewPage;
