// =============================================
// Code Analysis Orchestrator
// Coordinates all detectors and produces analysis results
// =============================================

import { parseCode, detectLanguage, type CodeLanguage, type ParsedCode } from "./parser";
import { detectArrayMethods } from "./detectors/arrayMethods";
import { detectAsyncPatterns } from "./detectors/asyncPatterns";
import { detectReactHooks } from "./detectors/reactHooks";
import { detectJSXPatterns } from "./detectors/jsxPatterns";
import { detectErrorHandlingPatterns } from "./detectors/errorHandling";
import { detectVariablePatterns } from "./detectors/variablePatterns";
import { detectFunctionPatterns } from "./detectors/functionPatterns";
import { detectLoopsAndContext } from "./detectors/loopsAndContext";
import { detectAdvancedHooks } from "./detectors/advancedHooks";
import { detectComponentPatterns } from "./detectors/componentPatterns";
import { detectStatePatterns } from "./detectors/statePatterns";
import { detectAdvancedReactPatterns } from "./detectors/advancedReactPatterns";
import { detectErrorBoundaries } from "./detectors/errorBoundaries";

// ESLint detector
import { analyzeWithESLint } from "./eslintDetector";

// Data flow detector
import { analyzeDataFlow } from "./dataFlowDetector";

// New expanded detectors
import { detectArrayMutationMethods } from "./detectors/arrayMutationMethods";
import { detectStringMethods } from "./detectors/stringMethods";
import { detectObjectMethods } from "./detectors/objectMethods";
import { detectNumberMath } from "./detectors/numberMath";
import { detectJsonOperations } from "./detectors/jsonOperations";
import { detectModernOperators } from "./detectors/modernOperators";
import { detectControlFlow } from "./detectors/controlFlow";
import { detectClassSyntax } from "./detectors/classSyntax";
import { detectModulePatterns } from "./detectors/modulePatterns";
import { detectMapSetCollections } from "./detectors/mapSetCollections";
import { detectTimersScheduling } from "./detectors/timersScheduling";
import { detectDateHandling } from "./detectors/dateHandling";
import { detectRegexPatterns } from "./detectors/regexPatterns";
import { detectDomOperations } from "./detectors/domOperations";
import { detectBrowserApis } from "./detectors/browserApis";
import { detectObserverApis } from "./detectors/observerApis";
import { detectAntiPatterns } from "./detectors/antiPatterns";

// =============================================
// Types
// =============================================

export interface Detection {
  topicSlug: string;
  detected: boolean;
  isPositive: boolean;
  isNegative: boolean;
  isIdiomatic: boolean;
  isTrivial?: boolean;
  location?: { line: number; column: number };
  details?: string;
  source?: "babel" | "eslint" | "dataflow";
}

export interface AnalysisResult {
  parsed: ParsedCode;
  detections: Detection[];
  summary: AnalysisSummary;
  topicsDetected: string[];
  issuesFound: Detection[];
  positiveFindings: Detection[];
}

export interface AnalysisSummary {
  totalDetections: number;
  positiveCount: number;
  negativeCount: number;
  idiomaticCount: number;
  isReact: boolean;
  hasTypeScript: boolean;
  topIssues: Detection[];
  topicsCovered: string[];
}

export interface TopicPerformance {
  topicSlug: string;
  detectionCount: number;
  positiveCount: number;
  negativeCount: number;
  idiomaticCount: number;
  score: number; // 0.0 - 1.0
}

// Re-export parser types and functions
export { parseCode, detectLanguage, type CodeLanguage, type ParsedCode } from "./parser";

// =============================================
// Main Analysis Function
// =============================================

/**
 * Analyze code and return all detections
 */
export function analyzeCode(
  code: string,
  language?: CodeLanguage
): AnalysisResult {
  // Auto-detect language if not provided
  const detectedLanguage = language ?? detectLanguage(code);

  // Parse the code
  const parsed = parseCode(code, detectedLanguage);

  // Run all detectors
  const allDetections: Detection[] = [];

  // Always run general JS detectors
  allDetections.push(...detectArrayMethods(parsed.ast));
  allDetections.push(...detectAsyncPatterns(parsed.ast));
  allDetections.push(...detectErrorHandlingPatterns(parsed.ast));
  allDetections.push(...detectVariablePatterns(parsed.ast));
  allDetections.push(...detectFunctionPatterns(parsed.ast));
  allDetections.push(...detectLoopsAndContext(parsed.ast));

  // Expanded JS detectors (always run)
  allDetections.push(...detectArrayMutationMethods(parsed.ast));
  allDetections.push(...detectStringMethods(parsed.ast));
  allDetections.push(...detectObjectMethods(parsed.ast));
  allDetections.push(...detectNumberMath(parsed.ast));
  allDetections.push(...detectJsonOperations(parsed.ast));
  allDetections.push(...detectModernOperators(parsed.ast));
  allDetections.push(...detectControlFlow(parsed.ast));
  allDetections.push(...detectClassSyntax(parsed.ast));
  allDetections.push(...detectModulePatterns(parsed.ast));
  allDetections.push(...detectMapSetCollections(parsed.ast));
  allDetections.push(...detectTimersScheduling(parsed.ast));
  allDetections.push(...detectDateHandling(parsed.ast));
  allDetections.push(...detectRegexPatterns(parsed.ast));
  allDetections.push(...detectDomOperations(parsed.ast));
  allDetections.push(...detectBrowserApis(parsed.ast));
  allDetections.push(...detectObserverApis(parsed.ast));
  allDetections.push(...detectAntiPatterns(parsed.ast));

  // Run React detectors if React is detected
  if (parsed.isReact) {
    allDetections.push(...detectReactHooks(parsed.ast));
    allDetections.push(...detectJSXPatterns(parsed.ast));
    allDetections.push(...detectAdvancedHooks(parsed.ast));
    allDetections.push(...detectComponentPatterns(parsed.ast));
    allDetections.push(...detectStatePatterns(parsed.ast));
    allDetections.push(...detectAdvancedReactPatterns(parsed.ast));
    allDetections.push(...detectErrorBoundaries(parsed.ast));
  }

  // Tag all Babel detections with source
  for (const d of allDetections) {
    d.source = "babel";
  }

  // Run ESLint detectors on the raw code
  const eslintDetections = analyzeWithESLint(code, parsed.isReact, parsed.hasTypeScript);
  allDetections.push(...eslintDetections);

  // Run data flow detectors on the AST
  const dataFlowDetections = analyzeDataFlow(parsed.ast, parsed.isReact);
  allDetections.push(...dataFlowDetections);

  // Build summary
  const positiveFindings = allDetections.filter((d) => d.isPositive && !d.isNegative);
  const issuesFound = allDetections.filter((d) => d.isNegative);
  const idiomaticFindings = allDetections.filter((d) => d.isIdiomatic);

  // Get unique topics
  const topicsDetected = [...new Set(allDetections.map((d) => d.topicSlug))];

  // Get top issues (prioritize non-trivial)
  const topIssues = issuesFound
    .sort((a, b) => {
      // Non-trivial issues first
      if (a.isTrivial !== b.isTrivial) {
        return a.isTrivial ? 1 : -1;
      }
      return 0;
    })
    .slice(0, 3);

  const summary: AnalysisSummary = {
    totalDetections: allDetections.length,
    positiveCount: positiveFindings.length,
    negativeCount: issuesFound.length,
    idiomaticCount: idiomaticFindings.length,
    isReact: parsed.isReact,
    hasTypeScript: parsed.hasTypeScript,
    topIssues,
    topicsCovered: topicsDetected,
  };

  return {
    parsed,
    detections: allDetections,
    summary,
    topicsDetected,
    issuesFound,
    positiveFindings,
  };
}

// =============================================
// Performance Scoring
// =============================================

/**
 * Calculate performance score for each detected topic
 */
export function scoreTopicPerformance(detections: Detection[]): TopicPerformance[] {
  // Group detections by topic
  const byTopic = new Map<string, Detection[]>();

  for (const detection of detections) {
    const existing = byTopic.get(detection.topicSlug) ?? [];
    existing.push(detection);
    byTopic.set(detection.topicSlug, existing);
  }

  // Calculate scores
  const performances: TopicPerformance[] = [];

  for (const [topicSlug, topicDetections] of byTopic) {
    const positiveCount = topicDetections.filter((d) => d.isPositive && !d.isNegative).length;
    const negativeCount = topicDetections.filter((d) => d.isNegative).length;
    const idiomaticCount = topicDetections.filter((d) => d.isIdiomatic).length;
    const total = topicDetections.length;

    // Score calculation:
    // - Positive detections contribute positively
    // - Negative detections contribute negatively
    // - Idiomatic usage is bonus
    let score = 0.5; // Start at neutral

    if (total > 0) {
      const positiveRatio = positiveCount / total;
      const negativeRatio = negativeCount / total;
      const idiomaticBonus = idiomaticCount > 0 ? 0.1 : 0;

      // Base score from positive/negative balance
      score = positiveRatio - negativeRatio * 0.5;

      // Add idiomatic bonus
      score = Math.min(1.0, score + idiomaticBonus);

      // Clamp to valid range
      score = Math.max(0.0, Math.min(1.0, score));
    }

    performances.push({
      topicSlug,
      detectionCount: total,
      positiveCount,
      negativeCount,
      idiomaticCount,
      score,
    });
  }

  return performances;
}

/**
 * Prioritize issues for feedback (return top N most important)
 */
export function prioritizeIssues(
  detections: Detection[],
  maxIssues: number = 3
): Detection[] {
  const issues = detections.filter((d) => d.isNegative);

  // Sort by priority
  return issues
    .sort((a, b) => {
      // Non-trivial issues first
      if (a.isTrivial !== b.isTrivial) {
        return a.isTrivial ? 1 : -1;
      }

      // Then by topic importance (could be enhanced with topic criticality)
      return 0;
    })
    .slice(0, maxIssues);
}

/**
 * Get topics that should be included in feedback
 */
export function getRelevantTopicsForFeedback(
  analysis: AnalysisResult,
  userFrameworks: string[] = ["js", "react"]
): string[] {
  const topics = new Set<string>();

  // Add topics with issues
  for (const issue of analysis.issuesFound) {
    topics.add(issue.topicSlug);
  }

  // Add topics with positive findings (shows what user knows)
  for (const positive of analysis.positiveFindings) {
    topics.add(positive.topicSlug);
  }

  return [...topics];
}

// =============================================
// Analysis Data for Storage
// =============================================

/**
 * Convert analysis result to JSON-serializable format for storage
 */
export function serializeAnalysis(analysis: AnalysisResult): object {
  return {
    language: analysis.parsed.language,
    isReact: analysis.parsed.isReact,
    hasTypeScript: analysis.parsed.hasTypeScript,
    parseErrors: analysis.parsed.errors,
    summary: {
      totalDetections: analysis.summary.totalDetections,
      positiveCount: analysis.summary.positiveCount,
      negativeCount: analysis.summary.negativeCount,
      idiomaticCount: analysis.summary.idiomaticCount,
      topicsCovered: analysis.summary.topicsCovered,
    },
    detections: analysis.detections.map((d) => ({
      topicSlug: d.topicSlug,
      detected: d.detected,
      isPositive: d.isPositive,
      isNegative: d.isNegative,
      isIdiomatic: d.isIdiomatic,
      isTrivial: d.isTrivial,
      location: d.location,
      details: d.details,
      source: d.source,
    })),
    topicsDetected: analysis.topicsDetected,
  };
}

/**
 * Build context object for Grok prompt
 */
export function buildAnalysisContext(analysis: AnalysisResult): {
  frameworkContext: string;
  issuesSummary: string;
  positiveSummary: string;
  topicsToAddress: string[];
} {
  const frameworkContext = analysis.parsed.isReact
    ? "React/JSX code"
    : analysis.parsed.hasTypeScript
      ? "TypeScript code"
      : "JavaScript code";

  const issuesSummary =
    analysis.issuesFound.length > 0
      ? analysis.issuesFound
          .slice(0, 5)
          .map((i) => `- ${i.topicSlug}: ${i.details || "Issue detected"}`)
          .join("\n")
      : "No significant issues detected";

  const positiveSummary =
    analysis.positiveFindings.length > 0
      ? analysis.positiveFindings
          .slice(0, 5)
          .map((p) => `- ${p.topicSlug}: ${p.details || "Good usage"}`)
          .join("\n")
      : "Limited positive patterns detected";

  const topicsToAddress = [
    ...new Set(analysis.issuesFound.map((i) => i.topicSlug)),
  ];

  return {
    frameworkContext,
    issuesSummary,
    positiveSummary,
    topicsToAddress,
  };
}
