// src/openai.js
import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY, dangerouslyAllowBrowser: true
  // or read from wherever you store it at runtime
});
