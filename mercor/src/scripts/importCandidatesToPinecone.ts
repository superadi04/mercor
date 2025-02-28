// scripts/importCandidatesToPinecone.js
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createPineconeIndex, upsertToPinecone, createCandidateDescription } from '../lib/vectorDb';
import OpenAI from 'openai';

// Load environment variables
dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to get embedding from OpenAI
async function getEmbedding(text: string) {
  try {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });
    
    return embeddingResponse.data[0].embedding;
  } catch (error) {
    console.error('Error creating embedding:', error);
    throw error;
  }
}

// Function to add delay between API calls
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main function to import candidates to Pinecone
async function importCandidatesToPinecone() {
  console.log('Starting candidate import to Pinecone...');
  
  try {
    // // Validate environment variables
    // if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_ENVIRONMENT) {
    //   throw new Error('Missing Pinecone environment variables. Check your .env file.');
    // }
    
    // if (!process.env.OPENAI_API_KEY) {
    //   throw new Error('Missing OpenAI API key. Check your .env file.');
    // }
    
    // Read candidates from JSON file
    const dataFilePath = path.join(process.cwd(), 'data', 'candidates.json');
    console.log(`Reading candidates from ${dataFilePath}...`);
    
    if (!fs.existsSync(dataFilePath)) {
      throw new Error(`File not found at ${dataFilePath}`);
    }
    
    const fileContents = fs.readFileSync(dataFilePath, 'utf8');
    const candidates = JSON.parse(fileContents);
    
    console.log(`Successfully loaded ${candidates.length} candidates.`);
    
    // Initialize Pinecone index
    const indexName = process.env.PINECONE_INDEX || 'candidates';
    const dimension = 1536; // Dimension of text-embedding-ada-002
    
    await createPineconeIndex(indexName, dimension);
    
    // Process candidates in batches
    const batchSize = 50;
    const totalCandidates = candidates.length;
    let processedCount = 0;
    
    for (let i = 0; i < totalCandidates; i += batchSize) {
      const batchEnd = Math.min(i + batchSize, totalCandidates);
      console.log(`Processing batch ${i + 1} to ${batchEnd} of ${totalCandidates}...`);
      
      const batch = candidates.slice(i, batchEnd);
      const vectors = [];
      
      // Process each candidate in the batch
      for (const candidate of batch) {
        try {
          // Create a rich description of the candidate for embedding
          const candidateText = createCandidateDescription(candidate);
          
          // Get embedding from OpenAI
          const embedding = await getEmbedding(candidateText);
          
          // Prepare vector for Pinecone
          vectors.push({
            id: candidate.email,
            values: embedding,
            metadata: {
              name: candidate.name,
              email: candidate.email,
              location: candidate.location,
              skills: candidate.skills,
              work_availability: candidate.work_availability,
              highest_education: candidate.education.highest_level,
              recent_role: candidate.work_experiences[0]?.roleName,
              recent_company: candidate.work_experiences[0]?.company,
            },
          });
          
          processedCount++;
          
          // Add a small delay to avoid rate limits
          await delay(200);
          
          // Log progress
          if (processedCount % 10 === 0) {
            console.log(`Processed ${processedCount}/${totalCandidates} candidates`);
          }
        } catch (error) {
          console.error(`Error processing candidate ${candidate.email}:`, error);
        }
      }
      
      // Upsert batch to Pinecone
      if (vectors.length > 0) {
        await upsertToPinecone(indexName, vectors);
        console.log(`Upserted ${vectors.length} vectors to Pinecone`);
      }
      
      // Add delay between batches to avoid rate limits
      if (i + batchSize < totalCandidates) {
        console.log('Pausing between batches...');
        await delay(2000);
      }
    }
    
    console.log(`Successfully imported ${processedCount} candidates to Pinecone!`);
  } catch (error) {
    console.error('Error importing candidates to Pinecone:', error);
  }
}

// Execute the import
importCandidatesToPinecone().catch(console.error);