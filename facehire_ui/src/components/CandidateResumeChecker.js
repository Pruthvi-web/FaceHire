// src/components/CandidateResumeChecker.js

import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { auth, storage } from '../firebase';
import cloudinaryConfig from '../cloudinaryConfig';

function CandidateResumeChecker() {
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file to upload.");
      return;
    }
    
    const candidateUid = auth.currentUser ? auth.currentUser.uid : null;
    if (!candidateUid) {
      toast.error("User not logged in.");
      return;
    }
    
    // Create a storage reference under resumes/{candidateUid}/{fileName}
    // For Cloudinary, we will call its API directly using fetch.
    const url = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.secure_url) {
        toast.success("Resume uploaded successfully!");
        console.log("Uploaded resume URL:", data.secure_url);
        // Optionally, store data.secure_url in Firestore or update user profile.
        setUploadProgress(0);
        setFile(null);
      } else {
        console.error("Upload error:", data);
        toast.error("Upload failed. Please try again.");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Error uploading resume.");
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Resume Checker</h2>
      <p>Please upload your resume:</p>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload} style={{ marginLeft: '10px' }}>
        Upload Resume
      </button>
      {uploadProgress > 0 && <p>Upload Progress: {Math.round(uploadProgress)}%</p>}
    </div>
  );
}

export default CandidateResumeChecker;
