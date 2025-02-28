// File: /pages/api/match-with-pinecone.js
import OpenAI from 'openai';
import { queryPinecone } from '@/lib/vectorDb';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { requirements } = await request.json();
    
    if (!requirements || typeof requirements !== 'string') {
      return NextResponse.json({ error: 'Invalid requirements data' }, { status: 400 });
    }
    
    // Step 1: Get embedding for requirements
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: requirements,
    });
    
    const queryVector = embeddingResponse.data[0].embedding;
    
    // Step 2: Query Pinecone for similar candidates
    const indexName = process.env.PINECONE_INDEX || 'candidates';
    const matches = await queryPinecone(indexName, queryVector, 20);
    
    // Step 3: Get full candidate data for the matches
    // Read original candidates from file to get complete data
    const dataFilePath = path.join(process.cwd(), 'data', 'candidates.json');
    const fileContents = fs.readFileSync(dataFilePath, 'utf8');
    const allCandidates = JSON.parse(fileContents);
    
    // Find the full candidate data for each match
    const matchedCandidates = matches.map(match => {
      const email = match.id;
      // Find the full candidate data
      const candidate = allCandidates.find((c: any) => c.email === email);
      return {
        candidate,
        score: match.score
      };
    }).filter(item => item.candidate); // Remove any unfound candidates
    
    // Step 4: Use GPT-4 to select a diverse team of 5
    if (matchedCandidates.length === 0) {
      return NextResponse.json({ error: 'No matching candidates found' }, { status: 404 });
    }
    
    // Format candidate info for GPT-4
    const candidateDescriptions = matchedCandidates.map(({ candidate }, index) => {
      const skills = candidate.skills.join(", ");
      
      const experience = candidate.work_experiences
        .map((exp: any) => `${exp.roleName} at ${exp.company}`)
        .join("; ");
      
      const education = candidate.education.degrees
        .map((deg: any) => `${deg.degree} in ${deg.subject} from ${deg.originalSchool || deg.school}`)
        .join("; ");
      
      return `
        Candidate ${index + 1}: ${candidate.name} (${candidate.email})
        Location: ${candidate.location}
        Work availability: ${candidate.work_availability.join(", ")}
        Salary expectation: ${Object.entries(candidate.annual_salary_expectation).map(([key, value]) => `${key}: ${value}`).join(", ")}
        Skills: ${skills}
        Work experience: ${experience}
        Education: ${education}
      `;
    }).join("\n\n");
    
    // Create GPT-4 prompt
    const prompt = `
      Job Requirements:
      ${requirements}
      
      Below are the top 20 candidates based on initial similarity matching:
      ${candidateDescriptions}
      
      Select the 5 best candidates that form a diverse team to address all aspects of the job requirements.
      Each selected candidate should bring unique strengths and complement the others.
      
      For each selected candidate, explain:
      1. Why they were chosen
      2. What unique strengths they bring to the team
      3. How they complement the other team members
      
      Return the response as a JSON array with these fields:
      [
        {
          "candidateEmail": "email of the candidate",
          "reasons": ["reason 1", "reason 2", ...],
          "uniqueStrengths": ["strength 1", "strength 2", ...],
          "complementsTeam": "explanation of how they complement others"
        },
        ...
      ]
    `;
    
    // Call GPT-4 API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an AI expert in talent acquisition and team composition. Your response must be valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 2000,
    });
    
    // Extract and parse GPT-4 response
    const responseText = completion.choices[0].message.content.trim();
    let selectedTeam;
    
    try {
      // Find JSON array in response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        selectedTeam = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON found in response');
      }
    } catch (jsonError) {
      console.error('Error parsing GPT-4 response:', jsonError);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }
    
    // Map selected candidates to full profiles
    const teamWithProfiles = selectedTeam.map(selection => {
      const matchedItem = matchedCandidates.find(m => m.candidate.email === selection.candidateEmail);
      const { candidate } = matchedItem || {};
      
      if (!candidate) {
        throw new Error(`Selected candidate with email ${selection.candidateEmail} not found`);
      }
      
      return {
        candidate,
        reasons: selection.reasons,
        uniqueStrengths: selection.uniqueStrengths,
        complementsTeam: selection.complementsTeam
      };
    });
    
    return NextResponse.json(teamWithProfiles);
  } catch (error: any) {
    console.error('Error matching candidates:', error);
    return NextResponse.json({ error: 'Failed to match candidates' }, { status: 500 });
  }
}