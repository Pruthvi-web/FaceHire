// src/components/CandidateResumeChecker.js

import React, { useState } from 'react';
import { toast } from 'react-toastify';
import cloudinaryConfig from '../cloudinaryConfig';
import { auth, firestore } from '../firebase';
import { extractPdfText } from '../utils/extractPdfText';

function CandidateResumeChecker() {
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const candidateUid = auth.currentUser ? auth.currentUser.uid : null;
  const [processing, setProcessing] = useState(false);

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

    // Cloudinary upload URL constructed using your cloud name.
    const url = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    
    // Explicitly add parameters (optional) to help enforce public access.
    //formData.append('resource_type', 'raw');  // For non-image files such as PDFs.
    //formData.append('type', 'upload');          // 'upload' indicates a regular public upload.

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (!data.secure_url) {
        throw new Error("Upload failed. No secure URL returned.");
      }
      toast.success("Resume uploaded successfully!");
      console.log("Uploaded resume URL:", data.secure_url);

      // Now extract text from the resume using its secure URL.
      let extractedText = "";
      try {
        extractedText = await extractPdfText(data.secure_url);
        console.log("Extracted text:", extractedText);
      } catch (extractionError) {
        console.error("Error extracting PDF text:", extractionError);
        throw new Error("Failed to extract text. Ensure the PDF is valid.");
      }

      // Create a new document in Firestore with the resume details.
      const resumeDoc = {
        documentName: file.name,
        userId: candidateUid,
        uploadedAt: new Date(),
        cloudinaryUrl: data.secure_url,
        extractedText: extractedText,
      };

      await firestore.collection("uploadedResumes").add(resumeDoc);
      toast.success("Resume processed and saved in Firestore!");
      setFile(null);
      setUploadProgress(0);
    } catch (error) {
      console.error("Error uploading or processing resume:", error);
      toast.error(error.message || "Error uploading or processing resume. Please try again.");
    }
    setProcessing(false);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Resume Checker</h2>
      <p>Please upload your resume (PDF format recommended):</p>
      <input type="file" accept="application/pdf" onChange={handleFileChange} />
      <button onClick={handleUpload} style={{ marginLeft: '10px' }} disabled={processing}>
        {processing ? "Processing..." : "Upload Resume"}
      </button>
      {uploadProgress > 0 && <p>Upload Progress: {Math.round(uploadProgress)}%</p>}
    </div>
  );
}

export default CandidateResumeChecker;
