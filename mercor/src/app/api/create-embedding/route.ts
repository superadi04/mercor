// File: /pages/api/create-embedding.js
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Invalid text data' });
    }
    
    // Get embedding from OpenAI
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });
    
    const embedding = embeddingResponse.data[0].embedding;
    
    res.status(200).json({ embedding });
  } catch (error) {
    console.error('Error creating embedding:', error);
    res.status(500).json({ error: 'Failed to create embedding' });
  }
}