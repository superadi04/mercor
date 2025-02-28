"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  GraduationCap,
  MapPin,
  DollarSign,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface WorkExperience {
  roleName: string;
  company: string;
}

interface Education {
  highest_level: string;
  degrees: Array<{
    subject: string;
    school: string;
    originalSchool?: string;
  }>;
}

interface Candidate {
  name: string;
  location: string;
  work_experiences: WorkExperience[];
  education: Education;
  skills: string[];
  annual_salary_expectation: {
    "full-time": string;
  };
  work_availability: string[];
}

interface MatchResult {
  candidate: Candidate;
  reasons: string[];
  uniqueStrengths: string[];
  complementsTeam: string;
}

export default function JobCandidateMatcher() {
  const [requirements, setRequirements] = useState("");
  const [matchedCandidates, setMatchedCandidates] = useState<MatchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);

  // Function to match candidates using Pinecone and GPT-4
  const matchCandidates = async () => {
    if (!requirements.trim()) {
      setError("Please enter job requirements first");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      setProgress(10);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 1500);

      // Call our API that handles Pinecone query and GPT-4 selection
      const response = await fetch("/api/match-with-pinecone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requirements }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to match candidates");
      }

      setProgress(100);
      const teamData = await response.json();
      setMatchedCandidates(teamData);

      // Reset progress after a delay
      setTimeout(() => setProgress(0), 500);
      setIsLoading(false);
    } catch (err) {
      setError(
        `Error matching candidates: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
      setIsLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">
        AI-Powered Job Candidate Matcher
      </h1>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mb-8 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Job Requirements</h2>
        <Textarea
          placeholder="Describe the job requirements in detail. Include skills, experience level, education, team fit, and any other relevant factors."
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          className="min-h-[120px] mb-4"
          disabled={isLoading}
        />
        <Button
          onClick={matchCandidates}
          disabled={!requirements.trim() || isLoading}
          className="w-full md:w-auto"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Finding Your Ideal Team...
            </>
          ) : (
            "Find Diverse Team of 5"
          )}
        </Button>

        {isLoading && progress > 0 && (
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-gray-500 mt-2">
              {progress < 30 && "Analyzing job requirements..."}
              {progress >= 30 &&
                progress < 60 &&
                "Finding matching candidates..."}
              {progress >= 60 && progress < 90 && "Selecting diverse team..."}
              {progress >= 90 && "Finalizing results..."}
            </p>
          </div>
        )}
      </div>

      {matchedCandidates.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-6">
            Top 5 Diverse Team Members
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matchedCandidates.map((result, index) => (
              <Card key={index} className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {result.candidate.name}
                    {index === 0 && (
                      <Badge variant="default" className="ml-2">
                        Team Lead
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {result.candidate.location}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Briefcase className="h-4 w-4" /> Work Experience
                    </h3>
                    <ul className="text-sm space-y-1">
                      {result.candidate.work_experiences
                        .slice(0, 3)
                        .map((exp: WorkExperience, i: number) => (
                          <li key={i}>
                            {exp.roleName} at {exp.company}
                          </li>
                        ))}
                      {result.candidate.work_experiences.length > 3 && (
                        <li className="text-muted-foreground">
                          +{result.candidate.work_experiences.length - 3} more
                          positions
                        </li>
                      )}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" /> Education
                    </h3>
                    <p className="text-sm">
                      {result.candidate.education.highest_level} in{" "}
                      {result.candidate.education.degrees[0].subject}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {result.candidate.education.degrees[0].originalSchool ||
                        result.candidate.education.degrees[0].school}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-2">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.candidate.skills.map((skill, i) => (
                        <Badge key={i} variant="secondary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      {result.candidate.annual_salary_expectation[
                        "full-time"
                      ] || "N/A"}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {result.candidate.work_availability.join(", ")}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col items-start">
                  <h4 className="text-sm font-medium mb-2">Why Selected:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground mb-2">
                    {result.reasons.map((reason, i) => (
                      <li key={i}>• {reason}</li>
                    ))}
                  </ul>

                  <h4 className="text-sm font-medium mb-2">
                    Unique Strengths:
                  </h4>
                  <ul className="text-sm space-y-1 text-muted-foreground mb-2">
                    {result.uniqueStrengths.map((strength, i) => (
                      <li key={i}>• {strength}</li>
                    ))}
                  </ul>

                  <h4 className="text-sm font-medium mb-2">Team Fit:</h4>
                  <p className="text-sm text-muted-foreground">
                    {result.complementsTeam}
                  </p>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      {matchedCandidates.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="font-medium mb-2">
              Want to try a different job description?
            </h3>
            <Button
              variant="outline"
              onClick={() => {
                window.scrollTo({ top: 0, behavior: "smooth" });
                setRequirements("");
              }}
            >
              Start New Search
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
