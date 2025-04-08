// src/components/CandidateResumeChecker.js

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { auth, firestore } from '../firebase';
import cloudinaryConfig from '../cloudinaryConfig';
import { extractPdfText } from '../utils/extractPdfText';
import atsKeywords from '../atsKeywords';

function CandidateResumeChecker() {
  // Tab state: "upload" or "review"
  const [activeTab, setActiveTab] = useState('upload');

  // For file upload.
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const candidateUid = auth.currentUser ? auth.currentUser.uid : null;

  // For listing uploaded resumes.
  const [uploadedResumes, setUploadedResumes] = useState([]);
  const [loadingResumes, setLoadingResumes] = useState(true);

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

  // Upload resume to Cloudinary, extract text, and store document in Firestore.
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
    try {
      // Construct Cloudinary upload URL.
      const url = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', cloudinaryConfig.uploadPreset);
      // Include parameters to treat file as raw (non-image)
      // formData.append('resource_type', 'raw');
      // formData.append('type', 'upload');

      // Upload to Cloudinary.
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });
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

      // Create a Firestore document with the uploaded resume details.
      const resumeDoc = {
        documentName: file.name,
        userId: candidateUid,
        uploadedAt: new Date(),
        cloudinaryUrl: data.secure_url,
        extractedText: extractedText,
        rating: null // Initially null, will be updated when graded.
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

  // Fetch all resume documents for this candidate.
  useEffect(() => {
    if (!candidateUid) return;
    // console.log(candidateUid);
    const unsubscribe = firestore.collection("uploadedResumes")
      .where("userId", "==", candidateUid)
      .orderBy("uploadedAt", "desc")
      .onSnapshot(snapshot => {
        const resumes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // console.log(resumes);
        setUploadedResumes(resumes);
        setLoadingResumes(false);
      }, error => {
        console.error("Error fetching uploaded resumes:", error);
        toast.error("Error fetching resumes.");
        setLoadingResumes(false);
      });
    return () => unsubscribe();
  }, [candidateUid]);

  // Function to grade a resume using ATS keywords.
  const gradeResume = async (resume) => {
    if (!resume.extractedText) {
      toast.error("No text available for grading.");
      return;
    }

    // Simple grading: count occurrences of keywords.
    const text = resume.extractedText.toLowerCase();
    let matchCount = 0;
    atsKeywords.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    });
    // Calculate a rating out of 10.
    const totalKeywords = atsKeywords.length;
    const rating = Math.min(10, Math.round((matchCount / totalKeywords) * 10));
    
    try {
      // Update the resume document with the computed rating.
      await firestore.collection("uploadedResumes").doc(resume.id).update({ rating });
      toast.success(`Resume graded successfully! Rating: ${rating}/10`);
    } catch (error) {
      console.error("Error updating resume with rating:", error);
      toast.error("Error updating resume rating.");
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
            <button onClick={handleUpload} style={{ marginLeft: '10px' }} disabled={processing}>
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
                    <th>Actions</th>
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadedResumes.map(resume => (
                    <tr key={resume.id}>
                      <td>{resume.documentName}</td>
                      <td>{resume.uploadedAt?.toDate ? resume.uploadedAt.toDate().toLocaleString() : new Date(resume.uploadedAt).toLocaleString()}</td>
                      <td>
                        <a href={resume.cloudinaryUrl} target="_blank" rel="noopener noreferrer">
                          View/Download
                        </a>
                        {" | "}
                        <button onClick={() => gradeResume(resume)}>
                          Grade
                        </button>
                      </td>
                      <td>{resume.rating !== null ? `${resume.rating}/10` : "Not graded"}</td>
                    </tr>
                  ))}
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
