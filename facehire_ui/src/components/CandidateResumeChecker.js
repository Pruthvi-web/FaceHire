// src/components/CandidateResumeChecker.js

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { auth, firestore } from '../firebase';
import cloudinaryConfig from '../cloudinaryConfig';
import { extractPdfText } from '../utils/extractPdfText';
import atsKeywords from '../atsKeywords';

// Helper function to convert a string to Title Case.
function toTitleCase(str) {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function CandidateResumeChecker() {
  // Tab state: "upload" or "review"
  const [activeTab, setActiveTab] = useState('upload');

  // File upload state.
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const candidateUid = auth.currentUser ? auth.currentUser.uid : null;
  
  // State for listing uploaded resumes.
  const [uploadedResumes, setUploadedResumes] = useState([]);
  const [loadingResumes, setLoadingResumes] = useState(true);

  // State for the role selection from the dropdown.
  const roleOptions = Object.keys(atsKeywords);
  const [appliedRole, setAppliedRole] = useState(roleOptions[0] || '');

  // Handle file selection.
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        toast.error("Please select a valid PDF file.");
        return;
      }
      setFile(selectedFile);
    }
  };

  // Upload resume: Upload to Cloudinary, extract text, and store details in Firestore.
  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file to upload.");
      return;
    }
    if (!candidateUid) {
      toast.error("User not logged in.");
      return;
    }
    
    setProcessing(true);
    
    // Construct Cloudinary upload URL.
    const url = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    // Include parameters to have the file handled as raw (non-image) files.
    // formData.append('resource_type', 'raw');
    // formData.append('type', 'upload');

    try {
      const response = await fetch(url, { method: 'POST', body: formData });
      const data = await response.json();
      console.log("Cloudinary response:", data);
      if (!data.secure_url) {
        throw new Error("Upload failed. No secure URL returned.");
      }
      toast.success("Resume uploaded successfully!");
      console.log("Uploaded resume URL:", data.secure_url);

      // Extract text from the PDF using its secure URL.
      let extractedText = "";
      try {
        extractedText = await extractPdfText(data.secure_url);
        console.log("Extracted text:", extractedText);
      } catch (extractionError) {
        console.error("Error extracting PDF text:", extractionError);
        throw new Error("Failed to extract text. Ensure the PDF is valid.");
      }

      // Create a document with resume details in "uploadedResumes" collection.
      const resumeDoc = {
        documentName: file.name,
        userId: candidateUid,
        appliedRole,  // The role selected by the candidate.
        uploadedAt: new Date(),
        cloudinaryUrl: data.secure_url,
        extractedText: extractedText,
      };

      await firestore.collection("uploadedResumes").add(resumeDoc);
      toast.success("Resume processed and saved in Firestore!");
      setFile(null);
    } catch (error) {
      console.error("Error uploading or processing resume:", error);
      toast.error(error.message || "Error uploading or processing resume. Please try again.");
    }
    setProcessing(false);
  };

  // Fetch uploaded resumes for this candidate.
  useEffect(() => {
    if (!candidateUid) return;
    const unsubscribe = firestore.collection("uploadedResumes")
      .where("userId", "==", candidateUid)
      .orderBy("uploadedAt", "desc")
      .onSnapshot(snapshot => {
        const resumes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUploadedResumes(resumes);
        setLoadingResumes(false);
      }, error => {
        console.error("Error fetching uploaded resumes:", error);
        toast.error("Error fetching resumes.");
        setLoadingResumes(false);
      });
    return () => unsubscribe();
  }, [candidateUid]);

  // Fetch grade data from "resumeGrades" for this candidate.
  const [gradeData, setGradeData] = useState({});
  useEffect(() => {
    if (!candidateUid) return;
    const unsubscribeGrade = firestore.collection("resumeGrades")
      .where("userId", "==", candidateUid)
      .onSnapshot(snapshot => {
        const grades = {};
        snapshot.docs.forEach(doc => {
          grades[doc.id] = doc.data();
        });
        setGradeData(grades);
      }, error => {
        console.error("Error fetching grade data:", error);
        toast.error("Error fetching grade data.");
      });
    return () => unsubscribeGrade();
  }, [candidateUid]);

  // Function to grade or regrade a resume.
  const gradeResume = async (resume) => {
    if (!resume.extractedText) {
      toast.error("No text available for grading.");
      return;
    }
    
    // Retrieve the keywords relevant to the selected applied role.
    const roleKeywords = atsKeywords[resume.appliedRole] || [];
    if (roleKeywords.length === 0) {
      toast.error(`No keywords available for the role: ${toTitleCase(resume.appliedRole)}`);
      return;
    }
    
    const text = resume.extractedText.toLowerCase();
    let criteriaMarks = {};
    let matchCount = 0;
    
    roleKeywords.forEach(keyword => {
      const present = text.includes(keyword.toLowerCase());
      criteriaMarks[keyword] = present ? 1 : 0;
      if (present) matchCount++;
    });
    
    const finalScore = Math.round((matchCount / roleKeywords.length) * 10);
    
    const gradeDoc = {
      resumeId: resume.id,
      userId: candidateUid,
      appliedRole: resume.appliedRole,
      criteriaMarks,
      finalScore,
      gradedAt: new Date(),
    };
    
    try {
      // Save or update the grade in "resumeGrades" using the resume ID as the document ID.
      await firestore.collection("resumeGrades").doc(resume.id).set(gradeDoc, { merge: true });
      toast.success(`Resume graded successfully! Final Rating: ${finalScore}/10`);
    } catch (error) {
      console.error("Error updating resume grade:", error);
      toast.error("Error updating resume grade.");
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Resume Checker</h2>
      <div style={styles.tabContainer}>
        <button
          style={activeTab === 'upload' ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab('upload')}
        >
          Upload Resume
        </button>
        <button
          style={activeTab === 'review' ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab('review')}
        >
          Review & Grade Resumes
        </button>
      </div>
      <div style={styles.contentContainer}>
        {activeTab === 'upload' && (
          <div>
            <p>Please upload your resume (PDF format recommended):</p>
            <input type="file" accept="application/pdf" onChange={handleFileChange} />
            <br />
            <label style={{ marginTop: '10px', display: 'block' }}>
              Select Role Applying For:
            </label>
            <select value={appliedRole} onChange={(e) => setAppliedRole(e.target.value)}>
              {roleOptions.map(roleOption => (
                <option key={roleOption} value={roleOption}>
                  {toTitleCase(roleOption)}
                </option>
              ))}
            </select>
            <br />
            <button onClick={handleUpload} style={{ marginTop: '10px' }} disabled={processing}>
              {processing ? "Processing..." : "Upload Resume"}
            </button>
          </div>
        )}
        {activeTab === 'review' && (
          <div>
            <h3>Your Uploaded Resumes</h3>
            {loadingResumes ? (
              <p>Loading resumes...</p>
            ) : uploadedResumes.length === 0 ? (
              <p>No resumes uploaded yet.</p>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th>Document Name</th>
                    <th>Uploaded At</th>
                    <th>Role Applied For</th>
                    <th>Actions</th>
                    <th>Grade</th>
                    <th>Regrade</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadedResumes.map(resume => {
                    const gradeRecord = gradeData[resume.id]; // undefined if not graded
                    return (
                      <tr key={resume.id}>
                        <td>{resume.documentName}</td>
                        <td>
                          {resume.uploadedAt && resume.uploadedAt.toDate 
                            ? resume.uploadedAt.toDate().toLocaleString() 
                            : new Date(resume.uploadedAt).toLocaleString()}
                        </td>
                        <td>{toTitleCase(resume.appliedRole)}</td>
                        <td>
                          <a href={resume.cloudinaryUrl} target="_blank" rel="noopener noreferrer">
                            View/Download
                          </a>
                        </td>
                        <td>
                          {!gradeRecord ? (
                            <button onClick={() => gradeResume(resume)}>
                              Grade
                            </button>
                          ) : (
                            gradeRecord.finalScore + "/10"
                          )}
                        </td>
                        <td>
                          <button onClick={() => gradeResume(resume)}>
                            Regrade
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
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
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    border: '1px solid #ddd',
    padding: '8px',
    backgroundColor: '#f2f2f2'
  },
  td: {
    border: '1px solid #ddd',
    padding: '8px'
  }
};

export default CandidateResumeChecker;
