// File: /pages/api/query-candidates.js
import OpenAI from 'openai';
import { queryPinecone } from '../../../lib/vectorDb';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { requirements, limit = 20 } = req.body;
    
    if (!requirements || typeof requirements !== 'string') {
      return res.status(400).json({ error: 'Invalid requirements data' });
    }
    
    // Get embedding for requirements from OpenAI
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: requirements,
    });
    
    const queryVector = embeddingResponse.data[0].embedding;
    
    // Query Pinecone for similar candidates
    const indexName = process.env.PINECONE_INDEX || 'candidates';
    const matches = await queryPinecone(indexName, queryVector, limit);
    
    res.status(200).json(matches);
  } catch (error) {
    console.error('Error querying candidates:', error);
    res.status(500).json({ error: 'Failed to query candidates' });
  }
}