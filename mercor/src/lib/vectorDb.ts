// lib/vectorDb.js
import { Pinecone } from '@pinecone-database/pinecone';

// Initialize Pinecone client
let pineconeClient: Pinecone | null = null;

export async function getPineconeClient() {
  if (pineconeClient) return pineconeClient;

  pineconeClient = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || '',
    // environment: 'us-east1-gcp',
  });

  return pineconeClient;
}

export async function createPineconeIndex(indexName: string, dimension: number) {
    const client = await getPineconeClient();
    const existingIndexes = await client.listIndexes();
    
    if (!existingIndexes.indexes?.some((index: { name: string }) => index.name === indexName)) {
      console.log(`Creating Pinecone index: ${indexName}`);
      
      await client.createIndex({
        name: indexName,
        dimension,
        metric: 'cosine',
        spec: {
            serverless: {
                cloud: 'aws',
                region: 'us-east-1'
            }
        },
      });
  
      // Wait for index to initialize
      console.log('Waiting for index to initialize...');
      await new Promise((resolve) => setTimeout(resolve, 30 * 1000));
      console.log('Index initialized');
    } else {
      console.log(`Index ${indexName} already exists`);
    }
  }
  

export async function upsertToPinecone(indexName: string, vectors: any[]) {
  const client = await getPineconeClient();
  const index = client.index(indexName);
  
  // Process in batches to avoid rate limits
  const batchSize = 100;
  const batches = [];
  
  for (let i = 0; i < vectors.length; i += batchSize) {
    batches.push(vectors.slice(i, i + batchSize));
  }
  
  console.log(`Upserting ${vectors.length} vectors in ${batches.length} batches`);
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    await index.upsert(
      batch.map(vector => ({
        id: vector.id,
        values: vector.values,
        metadata: vector.metadata
      }))
    );
    
    console.log(`Upserted batch ${i + 1}/${batches.length}`);
  }
}

export async function queryPinecone(indexName: string, queryVector: any[], topK = 20) {
  const client = await getPineconeClient();
  const index = client.index(indexName);
  
  const queryResponse = await index.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
    includeValues: false,
  });
  
  return queryResponse.matches;
}

// Helper function to create rich candidate description for embedding
export function createCandidateDescription(candidate: any) {
  const skills = candidate.skills.join(", ");
  
  const experience = candidate.work_experiences
    .map((exp: any) => `${exp.roleName} at ${exp.company}`)
    .join("; ");
  
  const education = candidate.education.degrees
    .map((deg: any) => `${deg.degree} in ${deg.subject} from ${deg.originalSchool || deg.school}`)
    .join("; ");
  
  return `
    Candidate name: ${candidate.name}
    Location: ${candidate.location}
    Work availability: ${candidate.work_availability.join(", ")}
    Salary expectation: ${Object.entries(candidate.annual_salary_expectation).map(([key, value]) => `${key}: ${value}`).join(", ")}
    Skills: ${skills}
    Work experience: ${experience}
    Education: ${education}
  `;
}