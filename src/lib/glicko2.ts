// =============================================
// Glicko-2 Rating System Implementation
// Based on Mark Glickman's Glicko-2 algorithm
// =============================================

import {
  GLICKO2,
  RATING_THRESHOLDS,
  RATING_LEVELS,
  RD_THRESHOLDS,
  CONFIDENCE_LEVELS,
} from "./constants";

// =============================================
// Types
// =============================================

export interface GlickoRating {
  rating: number;
  rd: number; // Rating Deviation
  volatility: number;
}

export interface PerformanceResult {
  score: number; // 0.0 to 1.0
  opponentRating?: number; // Optional: topic difficulty rating
}

export interface RatingUpdate {
  newRating: number;
  newRd: number;
  newVolatility: number;
  ratingChange: number;
  rdChange: number;
}

// =============================================
// Constants for Glicko-2 math
// =============================================

const PI_SQUARED = Math.PI * Math.PI;
const GLICKO2_SCALE = 173.7178; // Converts between Glicko-1 and Glicko-2 scale

// =============================================
// Core Glicko-2 Functions
// =============================================

/**
 * Convert from Glicko-1 to Glicko-2 scale
 */
function toGlicko2Scale(rating: number, rd: number): { mu: number; phi: number } {
  return {
    mu: (rating - 1500) / GLICKO2_SCALE,
    phi: rd / GLICKO2_SCALE,
  };
}

/**
 * Convert from Glicko-2 back to Glicko-1 scale
 */
function fromGlicko2Scale(mu: number, phi: number): { rating: number; rd: number } {
  return {
    rating: mu * GLICKO2_SCALE + 1500,
    rd: phi * GLICKO2_SCALE,
  };
}

/**
 * The g function - reduces impact based on opponent's RD
 */
function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / PI_SQUARED);
}

/**
 * The E function - expected score based on ratings
 */
function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/**
 * Calculate expected score between two ratings (public interface)
 */
export function calculateExpectedScore(
  rating1: number,
  rating2: number,
  rd2: number = GLICKO2.INITIAL_RD
): number {
  const { mu: mu1 } = toGlicko2Scale(rating1, GLICKO2.INITIAL_RD);
  const { mu: mu2, phi: phi2 } = toGlicko2Scale(rating2, rd2);
  return E(mu1, mu2, phi2);
}

/**
 * Calculate the variance (v) for a rating period
 */
function calculateVariance(
  mu: number,
  opponents: Array<{ mu: number; phi: number; score: number }>
): number {
  let sum = 0;
  for (const opp of opponents) {
    const gPhi = g(opp.phi);
    const e = E(mu, opp.mu, opp.phi);
    sum += gPhi * gPhi * e * (1 - e);
  }
  return 1 / sum;
}

/**
 * Calculate delta for rating update
 */
function calculateDelta(
  mu: number,
  v: number,
  opponents: Array<{ mu: number; phi: number; score: number }>
): number {
  let sum = 0;
  for (const opp of opponents) {
    const gPhi = g(opp.phi);
    const e = E(mu, opp.mu, opp.phi);
    sum += gPhi * (opp.score - e);
  }
  return v * sum;
}

/**
 * Find new volatility using iterative algorithm
 */
function calculateNewVolatility(
  sigma: number,
  phi: number,
  v: number,
  delta: number
): number {
  const tau = GLICKO2.TAU;
  const tolerance = GLICKO2.CONVERGENCE_TOLERANCE;

  const a = Math.log(sigma * sigma);
  const deltaSquared = delta * delta;
  const phiSquared = phi * phi;

  // Function f for iterative algorithm
  const f = (x: number): number => {
    const eX = Math.exp(x);
    const tmp = phiSquared + v + eX;
    const left = (eX * (deltaSquared - phiSquared - v - eX)) / (2 * tmp * tmp);
    const right = (x - a) / (tau * tau);
    return left - right;
  };

  // Initialize bounds for iteration
  let A = a;
  let B: number;

  if (deltaSquared > phiSquared + v) {
    B = Math.log(deltaSquared - phiSquared - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) {
      k++;
    }
    B = a - k * tau;
  }

  // Iterative algorithm
  let fA = f(A);
  let fB = f(B);

  while (Math.abs(B - A) > tolerance) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);

    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }

    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}

/**
 * Main rating update function
 */
export function updateRating(
  current: GlickoRating,
  performance: PerformanceResult,
  opponentRd: number = GLICKO2.INITIAL_RD
): RatingUpdate {
  // Convert to Glicko-2 scale
  const { mu, phi } = toGlicko2Scale(current.rating, current.rd);
  const sigma = current.volatility;

  // Default opponent rating (topic difficulty) is same as player rating
  const oppRating = performance.opponentRating ?? GLICKO2.INITIAL_RATING;
  const { mu: muOpp, phi: phiOpp } = toGlicko2Scale(oppRating, opponentRd);

  // Create opponent array (single performance)
  const opponents = [{ mu: muOpp, phi: phiOpp, score: performance.score }];

  // Step 3: Calculate variance
  const v = calculateVariance(mu, opponents);

  // Step 4: Calculate delta
  const delta = calculateDelta(mu, v, opponents);

  // Step 5: Calculate new volatility
  const sigmaNew = calculateNewVolatility(sigma, phi, v, delta);

  // Step 6: Update phi* (pre-rating period)
  const phiStar = Math.sqrt(phi * phi + sigmaNew * sigmaNew);

  // Step 7: Calculate new phi and mu
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * calculateDelta(mu, 1, opponents);

  // Convert back to Glicko-1 scale
  const result = fromGlicko2Scale(muNew, phiNew);

  // Clamp values to bounds
  const newRating = Math.max(
    GLICKO2.MIN_RATING,
    Math.min(GLICKO2.MAX_RATING, result.rating)
  );
  const newRd = Math.max(
    GLICKO2.MIN_RD,
    Math.min(GLICKO2.MAX_RD, result.rd)
  );
  const newVolatility = Math.max(0.01, Math.min(0.2, sigmaNew));

  return {
    newRating,
    newRd,
    newVolatility,
    ratingChange: newRating - current.rating,
    rdChange: newRd - current.rd,
  };
}

/**
 * Apply knowledge decay - RD increases over time without practice
 */
export function applyDecay(
  rd: number,
  daysSinceLastPractice: number
): number {
  // RD increases based on time since last practice
  const decayAmount = GLICKO2.DECAY_CONSTANT * daysSinceLastPractice;
  const newRd = Math.sqrt(rd * rd + decayAmount * decayAmount);
  return Math.min(GLICKO2.MAX_RD, newRd);
}

/**
 * Calculate RD decay for a given time period (in days)
 * Uses the Glicko-2 volatility-based decay
 */
export function calculateRdDecay(
  currentRd: number,
  volatility: number,
  daysPassed: number
): number {
  // Simplified decay: RD increases with sqrt of days
  const ratingPeriods = daysPassed / 30; // Assume 30 days per rating period
  const decayFactor = volatility * ratingPeriods;
  const newRd = Math.sqrt(currentRd * currentRd + decayFactor * decayFactor * GLICKO2_SCALE * GLICKO2_SCALE);
  return Math.min(GLICKO2.MAX_RD, newRd);
}

// =============================================
// Display Conversion Functions
// =============================================

/**
 * Convert rating to star display (1-5 stars)
 */
export function ratingToStars(rating: number): number {
  if (rating < RATING_THRESHOLDS.NOVICE_CEILING) return 1;
  if (rating < RATING_THRESHOLDS.BASIC_CEILING) return 2;
  if (rating < RATING_THRESHOLDS.COMPETENT_CEILING) return 3;
  if (rating < RATING_THRESHOLDS.PROFICIENT_CEILING) return 4;
  return 5;
}

/**
 * Get rating level info
 */
export function getRatingLevel(rating: number): {
  stars: number;
  label: string;
  min: number;
  max: number;
} {
  if (rating < RATING_THRESHOLDS.NOVICE_CEILING) return RATING_LEVELS.NOVICE;
  if (rating < RATING_THRESHOLDS.BASIC_CEILING) return RATING_LEVELS.BASIC;
  if (rating < RATING_THRESHOLDS.COMPETENT_CEILING) return RATING_LEVELS.COMPETENT;
  if (rating < RATING_THRESHOLDS.PROFICIENT_CEILING) return RATING_LEVELS.PROFICIENT;
  return RATING_LEVELS.EXPERT;
}

/**
 * Convert RD to confidence dots (1-3 dots)
 */
export function rdToConfidence(rd: number): number {
  if (rd < RD_THRESHOLDS.HIGH_CONFIDENCE_RD) return 3;
  if (rd < RD_THRESHOLDS.MEDIUM_CONFIDENCE_RD) return 2;
  return 1;
}

/**
 * Get confidence level info
 */
export function getConfidenceLevel(rd: number): {
  dots: number;
  label: string;
  maxRd: number;
} {
  if (rd < RD_THRESHOLDS.HIGH_CONFIDENCE_RD) return CONFIDENCE_LEVELS.HIGH;
  if (rd < RD_THRESHOLDS.MEDIUM_CONFIDENCE_RD) return CONFIDENCE_LEVELS.MEDIUM;
  return CONFIDENCE_LEVELS.LOW;
}

/**
 * Format rating for display with stars and confidence
 */
export function formatRatingDisplay(rating: number, rd: number): {
  stars: number;
  starsDisplay: string;
  confidence: number;
  confidenceDisplay: string;
  level: string;
  rating: number;
  rd: number;
} {
  const stars = ratingToStars(rating);
  const confidence = rdToConfidence(rd);
  const level = getRatingLevel(rating);

  return {
    stars,
    starsDisplay: "★".repeat(stars) + "☆".repeat(5 - stars),
    confidence,
    confidenceDisplay: "●".repeat(confidence) + "○".repeat(3 - confidence),
    level: level.label,
    rating: Math.round(rating),
    rd: Math.round(rd),
  };
}

// =============================================
// Utility Functions
// =============================================

/**
 * Create a new default rating
 */
export function createInitialRating(): GlickoRating {
  return {
    rating: GLICKO2.INITIAL_RATING,
    rd: GLICKO2.INITIAL_RD,
    volatility: GLICKO2.INITIAL_VOLATILITY,
  };
}

/**
 * Calculate weighted average rating (by confidence)
 */
export function calculateWeightedAverageRating(
  ratings: Array<{ rating: number; rd: number }>
): { avgRating: number; avgRd: number } {
  if (ratings.length === 0) {
    return {
      avgRating: GLICKO2.INITIAL_RATING,
      avgRd: GLICKO2.INITIAL_RD,
    };
  }

  // Weight by inverse of RD (higher confidence = higher weight)
  let totalWeight = 0;
  let weightedRatingSum = 0;
  let weightedRdSum = 0;

  for (const r of ratings) {
    const weight = 1 / r.rd;
    totalWeight += weight;
    weightedRatingSum += r.rating * weight;
    weightedRdSum += r.rd * weight;
  }

  return {
    avgRating: weightedRatingSum / totalWeight,
    avgRd: weightedRdSum / totalWeight,
  };
}

/**
 * Check if a rating represents mastery
 */
export function isMastered(rating: number, rd: number): boolean {
  return rating >= RATING_THRESHOLDS.PROFICIENT_CEILING && rd < RD_THRESHOLDS.HIGH_CONFIDENCE_RD;
}

/**
 * Check if a rating represents struggling
 */
export function isStruggling(rating: number): boolean {
  return rating < RATING_THRESHOLDS.NOVICE_CEILING;
}
