// lib/vectorDb.ts
import { Pinecone, Index, RecordMetadata } from '@pinecone-database/pinecone';

// Define Types
interface PineconeVector {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

interface PineconeQueryResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}


interface WorkExperience {
  roleName: string;
  company: string;
}

interface Degree {
  degree: string;
  subject: string;
  originalSchool?: string;
  school: string;
}

interface Candidate {
  name: string;
  email: string;
  location: string;
  work_availability: string[];
  annual_salary_expectation: Record<string, number>;
  skills: string[];
  work_experiences: WorkExperience[];
  education: { degrees: Degree[] };
}

// Initialize Pinecone client
let pineconeClient: Pinecone | null = null;

export async function getPineconeClient(): Promise<Pinecone> {
  if (pineconeClient) return pineconeClient;

  pineconeClient = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || '',
  });

  return pineconeClient;
}

export async function createPineconeIndex(indexName: string, dimension: number): Promise<void> {
  const client = await getPineconeClient();
  const existingIndexes = await client.listIndexes();

  if (!existingIndexes.indexes?.some((index) => index.name === indexName)) {
    console.log(`Creating Pinecone index: ${indexName}`);

    await client.createIndex({
      name: indexName,
      dimension,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1',
        },
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

export async function upsertToPinecone(indexName: string, vectors: PineconeVector[]): Promise<void> {
  const client = await getPineconeClient();
  const index: Index = client.index(indexName);

  // Process in batches to avoid rate limits
  const batchSize = 100;
  const batches: PineconeVector[][] = [];

  for (let i = 0; i < vectors.length; i += batchSize) {
    batches.push(vectors.slice(i, i + batchSize));
  }

  console.log(`Upserting ${vectors.length} vectors in ${batches.length} batches`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    await index.upsert(
      batch.map((vector) => ({
        id: vector.id,
        values: vector.values,
        metadata: vector.metadata as RecordMetadata,
      }))
    );

    console.log(`Upserted batch ${i + 1}/${batches.length}`);
  }
}

export async function queryPinecone(indexName: string, queryVector: number[], topK = 20): Promise<PineconeQueryResult[]> {
  const client = await getPineconeClient();
  const index: Index = client.index(indexName);

  const queryResponse = await index.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
    includeValues: false,
  });

  return queryResponse.matches as PineconeQueryResult[];
}

// Helper function to create rich candidate description for embedding
export function createCandidateDescription(candidate: Candidate): string {
  const skills = candidate.skills.join(', ');

  const experience = candidate.work_experiences
    .map((exp) => `${exp.roleName} at ${exp.company}`)
    .join('; ');

  const education = candidate.education.degrees
    .map((deg) => `${deg.degree} in ${deg.subject} from ${deg.originalSchool || deg.school}`)
    .join('; ');

  return `
    Candidate name: ${candidate.name}
    Location: ${candidate.location}
    Work availability: ${candidate.work_availability.join(', ')}
    Salary expectation: ${Object.entries(candidate.annual_salary_expectation)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ')}
    Skills: ${skills}
    Work experience: ${experience}
    Education: ${education}
  `;
}

export async function getPineconeIndex(indexName: string): Promise<Index> {
  const client = await getPineconeClient();
  return client.index(indexName);
}

