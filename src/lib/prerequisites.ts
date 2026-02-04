// =============================================
// Prerequisite Analysis System
// Analyzes prerequisite chains to find knowledge gaps
// =============================================

import { prisma } from "./prisma";
import { GLICKO2, RATING_THRESHOLDS } from "./constants";

// =============================================
// Types
// =============================================

export interface TopicWithPrereqs {
  id: number;
  slug: string;
  name: string;
  layer: string;
  category: string;
  prerequisites: number[];
}

export interface SkillInfo {
  topicId: number;
  rating: number;
  rd: number;
  timesEncountered: number;
}

export interface PrerequisiteNode {
  topic: TopicWithPrereqs;
  skill: SkillInfo | null;
  isWeak: boolean;
  weakReason: string | null;
  children: PrerequisiteNode[];
  depth: number;
}

export interface WeakPrerequisite {
  topic: TopicWithPrereqs;
  skill: SkillInfo | null;
  reason: string;
  severity: "critical" | "moderate" | "mild";
  suggestedAction: string;
}

// =============================================
// Prerequisite Chain Analysis
// =============================================

/**
 * Get the full prerequisite chain for a topic
 */
export async function getPrerequisiteChain(
  topicId: number,
  maxDepth: number = 5
): Promise<PrerequisiteNode> {
  const topicsMap = await loadAllTopics();
  const topic = topicsMap.get(topicId);

  if (!topic) {
    throw new Error(`Topic ${topicId} not found`);
  }

  return buildPrerequisiteTree(topic, topicsMap, 0, maxDepth, new Set());
}

/**
 * Load all topics into a map for efficient lookup
 */
async function loadAllTopics(): Promise<Map<number, TopicWithPrereqs>> {
  const topics = await prisma.topic.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      layer: true,
      category: true,
      prerequisites: true,
    },
  });

  return new Map(topics.map((t) => [t.id, t]));
}

/**
 * Build prerequisite tree recursively
 */
function buildPrerequisiteTree(
  topic: TopicWithPrereqs,
  topicsMap: Map<number, TopicWithPrereqs>,
  depth: number,
  maxDepth: number,
  visited: Set<number>
): PrerequisiteNode {
  // Prevent infinite loops
  if (visited.has(topic.id)) {
    return {
      topic,
      skill: null,
      isWeak: false,
      weakReason: null,
      children: [],
      depth,
    };
  }

  visited.add(topic.id);

  // Build children if within depth limit
  const children: PrerequisiteNode[] = [];
  if (depth < maxDepth && topic.prerequisites.length > 0) {
    for (const prereqId of topic.prerequisites) {
      const prereqTopic = topicsMap.get(prereqId);
      if (prereqTopic) {
        children.push(
          buildPrerequisiteTree(prereqTopic, topicsMap, depth + 1, maxDepth, visited)
        );
      }
    }
  }

  return {
    topic,
    skill: null, // Will be populated when analyzing for user
    isWeak: false,
    weakReason: null,
    children,
    depth,
  };
}

/**
 * Find the weakest prerequisite in the chain for a user
 *
 * From CLAUDE.md:
 * "When user fails Topic X, check all prerequisites.
 *  Find lowest weak prerequisite = real gap. Target feedback there."
 */
export async function findWeakestPrerequisite(
  userId: string,
  topicId: number
): Promise<WeakPrerequisite | null> {
  // Get user skills for all topics
  const userSkills = await prisma.userSkillMatrix.findMany({
    where: { userId },
    select: {
      topicId: true,
      rating: true,
      rd: true,
      timesEncountered: true,
    },
  });

  const skillsMap = new Map(userSkills.map((s) => [s.topicId, s]));

  // Get prerequisite chain
  const chain = await getPrerequisiteChain(topicId);

  // Find all weak prerequisites
  const weakPrereqs = findWeakInChain(chain, skillsMap);

  if (weakPrereqs.length === 0) {
    return null;
  }

  // Sort by severity and depth (prefer deeper/more fundamental gaps)
  weakPrereqs.sort((a, b) => {
    const severityOrder = { critical: 0, moderate: 1, mild: 2 };
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;

    // If same severity, prefer the one with lower rating (more fundamental gap)
    const aRating = a.skill?.rating ?? GLICKO2.INITIAL_RATING;
    const bRating = b.skill?.rating ?? GLICKO2.INITIAL_RATING;
    return aRating - bRating;
  });

  return weakPrereqs[0];
}

/**
 * Recursively find weak prerequisites in chain
 */
function findWeakInChain(
  node: PrerequisiteNode,
  skillsMap: Map<number, SkillInfo>
): WeakPrerequisite[] {
  const weakPrereqs: WeakPrerequisite[] = [];
  const skill = skillsMap.get(node.topic.id) ?? null;

  // Check if this node is weak
  const weakness = assessWeakness(node.topic, skill);
  if (weakness) {
    weakPrereqs.push(weakness);
  }

  // Recursively check children
  for (const child of node.children) {
    weakPrereqs.push(...findWeakInChain(child, skillsMap));
  }

  return weakPrereqs;
}

/**
 * Assess if a topic is a weak prerequisite
 */
function assessWeakness(
  topic: TopicWithPrereqs,
  skill: SkillInfo | null
): WeakPrerequisite | null {
  // No skill record = never attempted
  if (!skill) {
    return {
      topic,
      skill: null,
      reason: "Never practiced this prerequisite topic",
      severity: "moderate",
      suggestedAction: `Start with the basics of ${topic.name} before continuing`,
    };
  }

  // Very low rating with attempts = struggling
  if (skill.rating < RATING_THRESHOLDS.NOVICE_CEILING && skill.timesEncountered >= 2) {
    return {
      topic,
      skill,
      reason: `Struggling with ${topic.name} (rating: ${Math.round(skill.rating)})`,
      severity: "critical",
      suggestedAction: `Focus on mastering ${topic.name} - this is blocking your progress`,
    };
  }

  // Low rating = needs work
  if (skill.rating < RATING_THRESHOLDS.BASIC_CEILING) {
    return {
      topic,
      skill,
      reason: `Weak foundation in ${topic.name} (rating: ${Math.round(skill.rating)})`,
      severity: "moderate",
      suggestedAction: `Strengthen your understanding of ${topic.name}`,
    };
  }

  // High RD = uncertain
  if (skill.rd > 200 && skill.timesEncountered < 3) {
    return {
      topic,
      skill,
      reason: `Limited practice with ${topic.name} (only ${skill.timesEncountered} encounters)`,
      severity: "mild",
      suggestedAction: `Get more practice with ${topic.name} to build confidence`,
    };
  }

  return null;
}

// =============================================
// Prerequisite Status Helpers
// =============================================

/**
 * Check if all prerequisites for a topic are met
 */
export async function checkPrerequisitesMet(
  userId: string,
  topicId: number
): Promise<{
  allMet: boolean;
  metCount: number;
  totalCount: number;
  unmetPrereqs: TopicWithPrereqs[];
}> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { prerequisites: true },
  });

  if (!topic || topic.prerequisites.length === 0) {
    return { allMet: true, metCount: 0, totalCount: 0, unmetPrereqs: [] };
  }

  const userSkills = await prisma.userSkillMatrix.findMany({
    where: {
      userId,
      topicId: { in: topic.prerequisites },
    },
    select: { topicId: true, rating: true },
  });

  const prereqTopics = await prisma.topic.findMany({
    where: { id: { in: topic.prerequisites } },
    select: {
      id: true,
      slug: true,
      name: true,
      layer: true,
      category: true,
      prerequisites: true,
    },
  });

  const skillsMap = new Map(userSkills.map((s) => [s.topicId, s]));
  const unmetPrereqs: TopicWithPrereqs[] = [];

  for (const prereq of prereqTopics) {
    const skill = skillsMap.get(prereq.id);
    // Prerequisite met if rating >= Basic (1400)
    if (!skill || skill.rating < RATING_THRESHOLDS.NOVICE_CEILING) {
      unmetPrereqs.push(prereq);
    }
  }

  return {
    allMet: unmetPrereqs.length === 0,
    metCount: topic.prerequisites.length - unmetPrereqs.length,
    totalCount: topic.prerequisites.length,
    unmetPrereqs,
  };
}

/**
 * Get prerequisite readiness score (0-100)
 */
export async function getPrerequisiteReadiness(
  userId: string,
  topicId: number
): Promise<{
  readiness: number;
  details: Array<{
    topic: TopicWithPrereqs;
    rating: number;
    contribution: number;
  }>;
}> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { prerequisites: true },
  });

  if (!topic || topic.prerequisites.length === 0) {
    return { readiness: 100, details: [] };
  }

  const userSkills = await prisma.userSkillMatrix.findMany({
    where: {
      userId,
      topicId: { in: topic.prerequisites },
    },
  });

  const prereqTopics = await prisma.topic.findMany({
    where: { id: { in: topic.prerequisites } },
    select: {
      id: true,
      slug: true,
      name: true,
      layer: true,
      category: true,
      prerequisites: true,
    },
  });

  const skillsMap = new Map(userSkills.map((s) => [s.topicId, s]));
  const details: Array<{
    topic: TopicWithPrereqs;
    rating: number;
    contribution: number;
  }> = [];

  let totalReadiness = 0;

  for (const prereq of prereqTopics) {
    const skill = skillsMap.get(prereq.id);
    const rating = skill?.rating ?? GLICKO2.INITIAL_RATING;

    // Map rating to 0-100 scale
    // 1200 = 0%, 1650 = 100%
    const normalized = Math.max(
      0,
      Math.min(100, ((rating - 1200) / (1650 - 1200)) * 100)
    );

    details.push({
      topic: prereq,
      rating,
      contribution: normalized,
    });

    totalReadiness += normalized;
  }

  const readiness = prereqTopics.length > 0 ? totalReadiness / prereqTopics.length : 100;

  return { readiness: Math.round(readiness), details };
}

/**
 * Get suggested learning path based on prerequisites
 */
export async function getSuggestedLearningPath(
  userId: string,
  targetTopicId: number
): Promise<TopicWithPrereqs[]> {
  const weakest = await findWeakestPrerequisite(userId, targetTopicId);

  if (!weakest) {
    // No weak prerequisites - ready for target
    const target = await prisma.topic.findUnique({
      where: { id: targetTopicId },
      select: {
        id: true,
        slug: true,
        name: true,
        layer: true,
        category: true,
        prerequisites: true,
      },
    });
    return target ? [target] : [];
  }

  // Build path from weakest prerequisite to target
  const path: TopicWithPrereqs[] = [];

  // Start with the weakest prerequisite
  path.push(weakest.topic);

  // Add intermediate topics (simplified - in practice would build full path)
  const target = await prisma.topic.findUnique({
    where: { id: targetTopicId },
    select: {
      id: true,
      slug: true,
      name: true,
      layer: true,
      category: true,
      prerequisites: true,
    },
  });

  if (target && target.id !== weakest.topic.id) {
    path.push(target);
  }

  return path;
}
