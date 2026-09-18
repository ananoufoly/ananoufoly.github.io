/**
 * Flowra Scoring Engine — Core scoring logic
 *
 * 60-point score across three layers:
 *   Layer 1 — Price Coherence     25 pts  (15 coherence + 10 spread)
 *   Layer 2 — Route Risk          20 pts  (9 corridor + 6 product + 5 incidents)
 *   Layer 3 — Borrower Activity   15 pts  (6 repeat + 5 frequency + 4 specialization)
 *
 * Rule scales follow OPERATIONAL_SCORING_RULES.md, which is the authoritative
 * specification. Any change there must be mirrored here and in SCORING_RULES.md.
 *
 * All point allocations are PROVISIONAL: they encode domain expertise over a
 * base of 314 observed transactions, not a statistically fitted model. Layer 3
 * in particular carries an explicit caveat — trading activity does not predict
 * repayment in the current data; it is retained as a portfolio-management
 * signal, deliberately capped at 25% of the total.
 */

class ScoringEngine {

  /* ================================================================ *
   * LAYER 1 — Price Coherence (25 pts)
   * ================================================================ */

  scoreLayer1(transaction) {
    const layer1 = { name: 'Price Coherence', max: 25, breakdown: [], total: 0 };

    // Rule 1A: Cohérence Prix (15 pts)
    const coherenceMap = {
      '✓ Cohérent': 15,
      '⚠ Légèrement hors': 8,
      '⚠ Hors norme': 0
    };
    const coherencePts = coherenceMap[transaction.coherencePrix] || 0;
    layer1.breakdown.push({
      rule: 'Cohérence Prix',
      max: 15,
      value: transaction.coherencePrix || '—',
      points: coherencePts,
      explanation: this.explainCoherence(transaction.coherencePrix)
    });
    layer1.total += coherencePts;

    // Rule 1B: Spread Commercial (10 pts)
    const spread = Number(transaction.spreadCommercial);
    let spreadPts = 0;
    let spreadCategory = '';
    if (spread >= 20 && spread <= 40) {
      spreadPts = 10;
      spreadCategory = 'Realistic (20–40%)';
    } else if ((spread >= 15 && spread < 20) || (spread > 40 && spread <= 50)) {
      spreadPts = 5;
      spreadCategory = 'Borderline (15–19% or 41–50%)';
    } else {
      spreadPts = 0;
      spreadCategory = 'Unrealistic (<15% or >50%)';
    }
    layer1.breakdown.push({
      rule: 'Spread Commercial',
      max: 10,
      value: `${this.fmtNum(spread)}% (${spreadCategory})`,
      points: spreadPts,
      explanation: this.explainSpread(spread)
    });
    layer1.total += spreadPts;

    return layer1;
  }

  /* ================================================================ *
   * LAYER 2 — Route Risk (20 pts)
   * ================================================================ */

  scoreLayer2(transaction) {
    const layer2 = { name: 'Route Risk', max: 20, breakdown: [], total: 0 };

    // Rule 2A: Corridor Success Rate (10 pts)
    const corridorData = this.getCorridorData(transaction.corridor);
    layer2.breakdown.push({
      rule: 'Corridor Success Rate',
      max: 9,
      value: `${transaction.corridor || '—'} (${(corridorData.successRate * 100).toFixed(1)}%)`,
      points: corridorData.points,
      explanation: this.explainCorridor(corridorData, transaction.corridor)
    });
    layer2.total += corridorData.points;

    // Rule 2B: Product Risk (6 pts)
    const productPts = this.getProductPoints(transaction.typeProduct);
    layer2.breakdown.push({
      rule: 'Product Type',
      max: 6,
      value: transaction.typeProduct || 'Unknown',
      points: productPts,
      explanation: this.explainProduct(transaction.typeProduct)
    });
    layer2.total += productPts;

    // Rule 2C: Corridor Incident Rate (4 pts)
    const incidents = this.toInt(transaction.nbIncidents);
    const incidentPts = this.getIncidentPoints(incidents);
    layer2.breakdown.push({
      rule: 'Corridor Incidents',
      max: 5,
      value: `${incidents} incident(s)`,
      points: incidentPts,
      explanation: this.explainIncidents(incidents)
    });
    layer2.total += incidentPts;

    return layer2;
  }

  /* ================================================================ *
   * LAYER 3 — Borrower Activity (15 pts)
   * ================================================================ */

  scoreLayer3(transaction) {
    const layer3 = { name: 'Borrower Activity', max: 15, breakdown: [], total: 0 };

    // Rule 3A: Repeat Trader (6 pts)
    const trips = this.toInt(transaction.nbTripsTotal);
    const tripsPts = this.getTripPoints(trips);
    layer3.breakdown.push({
      rule: 'Repeat Trader Status',
      max: 6,
      value: `${trips} prior trip(s)`,
      points: tripsPts,
      explanation: this.explainTrips(trips),
      caveat: 'Note: Activity does not statistically predict success in current data'
    });
    layer3.total += tripsPts;

    // Rule 3B: Frequency (5 pts)
    const freq = this.toNum(transaction.tripsPerMonth);
    const frequencyPts = this.getFrequencyPoints(freq);
    layer3.breakdown.push({
      rule: 'Trading Frequency',
      max: 5,
      value: `${freq.toFixed(1)} trips/month`,
      points: frequencyPts,
      explanation: this.explainFrequency(freq),
      caveat: 'Portfolio management signal only'
    });
    layer3.total += frequencyPts;

    // Rule 3C: Specialization (4 pts)
    const conc = this.toNum(transaction.concentrationCorridor);
    const specializationPts = this.getSpecializationPoints(conc);
    layer3.breakdown.push({
      rule: 'Corridor Specialization',
      max: 4,
      value: `${(conc * 100).toFixed(0)}% on primary corridor`,
      points: specializationPts,
      explanation: this.explainSpecialization(conc)
    });
    layer3.total += specializationPts;

    return layer3;
  }

  /* ================================================================ *
   * TOTAL
   * ================================================================ */

  calculateScore(transaction) {
    const layer1 = this.scoreLayer1(transaction);
    const layer2 = this.scoreLayer2(transaction);
    const layer3 = this.scoreLayer3(transaction);

    const rawScore = layer1.total + layer2.total + layer3.total;

    const mandatoryDeclines = this.getMandatoryDeclines(transaction);
    const hardDeclined = mandatoryDeclines.length > 0;

    // A mandatory decline overrides the points: the file cannot be funded
    // regardless of how well it scores on the remaining rules.
    const tier = hardDeclined
      ? this.declineTier()
      : this.assignTier(rawScore);

    const advancePct = tier.advancePct;
    const declaredValue = this.toNum(transaction.declaredValue);
    const advanceFcfa = Math.round(declaredValue * advancePct);

    return {
      transactionId: transaction.id || 'TXN001',
      borrower: transaction.borrower || '—',
      corridor: transaction.corridor || '—',
      product: transaction.typeProduct || 'Unknown',
      productDetail: transaction.product || null,
      declaredValue: declaredValue,
      scoredAt: new Date().toISOString(),

      scoring: {
        layer1: layer1,
        layer2: layer2,
        layer3: layer3,
        totalScore: rawScore,
        maxScore: 60,
        tier: tier.name,
        tierSlug: tier.slug,
        tierEmoji: tier.emoji,
        tierColor: tier.color,
        advancePct: advancePct,
        advanceFcfa: advanceFcfa,
        tenor: tier.tenor,
        overriddenByDecline: hardDeclined
      },

      validation: {
        isValid: this.validateTransaction(transaction).isValid,
        errors: this.validateTransaction(transaction).errors,
        mandatoryDeclines: mandatoryDeclines,
        manualReviewFlags: this.getManualReviewFlags(transaction, rawScore)
      },

      rulesTrace: this.generateTrace(layer1, layer2, layer3),

      caveat: {
        text: 'Points are PROVISIONAL based on domain expertise, not statistical validation.',
        detail: 'After 50 completed loans, these will be recalibrated based on actual repayment data.'
      }
    };
  }

  /* ================================================================ *
   * LOOKUPS
   * ================================================================ */

  getCorridorData(corridor) {
    const table = (typeof CORRIDOR_DATA !== 'undefined') ? CORRIDOR_DATA : {};
    const fallback = (typeof CORRIDOR_DEFAULT !== 'undefined')
      ? CORRIDOR_DEFAULT
      : { successRate: 0.900, points: 9, dealsCount: 0, note: 'Portfolio average applied.' };
    return table[corridor] || fallback;
  }

  getProductPoints(typeProduct) {
    const table = (typeof PRODUCT_DATA !== 'undefined') ? PRODUCT_DATA : {};
    const entry = table[typeProduct];
    return entry ? entry.points : 0;
  }

  /** 5 pts. Incidents recorded on this corridor for this borrower. */
  getIncidentPoints(incidents) {
    if (incidents <= 0) return 5;
    if (incidents === 1) return 2;
    return 0;
  }

  /** 6 pts. Prior completed trips. */
  getTripPoints(trips) {
    if (trips >= 3) return 6;
    if (trips === 2) return 3;
    return 0;
  }

  /** 5 pts. Trips per month. */
  getFrequencyPoints(tripsPerMonth) {
    if (tripsPerMonth >= 2) return 5;
    if (tripsPerMonth >= 1) return 2;
    return 0;
  }

  /** 4 pts. Share of trips on the primary corridor. */
  getSpecializationPoints(concentration) {
    if (concentration >= 0.80) return 4;
    if (concentration >= 0.50) return 2;
    return 0;
  }

  /* ================================================================ *
   * TIERS
   * ================================================================ */

  assignTier(score) {
    if (score >= 50) {
      return { name: '★★★ Approved', slug: 'approved', emoji: '✓', advancePct: 0.70, tenor: '14 days', color: '#2ecc71' };
    } else if (score >= 40) {
      return { name: '★★ Standard', slug: 'standard', emoji: '◐', advancePct: 0.55, tenor: '10 days', color: '#f39c12' };
    } else if (score >= 30) {
      return { name: '★ Conditional', slug: 'conditional', emoji: '⚠', advancePct: 0.40, tenor: '7 days', color: '#e67e22' };
    }
    return this.declineTier();
  }

  declineTier() {
    return { name: '⚠ Decline', slug: 'decline', emoji: '✗', advancePct: 0, tenor: 'N/A', color: '#e74c3c' };
  }

  /* ================================================================ *
   * VALIDATION
   * ================================================================ */

  /** Structural completeness — are the inputs usable at all? */
  validateTransaction(transaction) {
    const errors = [];

    if (!transaction.borrower || !String(transaction.borrower).trim()) {
      errors.push('Borrower name is missing.');
    }
    if (!transaction.corridor) {
      errors.push('Corridor is missing.');
    }
    if (!transaction.typeProduct) {
      errors.push('Product type is missing.');
    }
    if (!(this.toNum(transaction.declaredValue) > 0)) {
      errors.push('Declared value must be greater than 0.');
    }
    if (!transaction.coherencePrix) {
      errors.push('Price coherence assessment is missing.');
    }
    const spread = this.toNum(transaction.spreadCommercial);
    if (!Number.isFinite(spread) || spread < 0 || spread > 200) {
      errors.push('Commercial spread must be between 0 and 200%.');
    }
    const conc = this.toNum(transaction.concentrationCorridor);
    if (conc < 0 || conc > 1) {
      errors.push('Corridor concentration must be between 0 and 1.');
    }

    return { isValid: errors.length === 0, errors: errors };
  }

  /**
   * Hard stops — fund nothing, whatever the score.
   * Per OPERATIONAL_SCORING_RULES.md § Mandatory Decline Conditions.
   */
  getMandatoryDeclines(transaction) {
    const declines = [];

    if (transaction.coherencePrix === '⚠ Hors norme') {
      declines.push({
        code: 'PRICE_OUT_OF_RANGE',
        label: 'Declared price is out of range',
        detail: 'A price that does not match the observed market cannot anchor an advance — the collateral value is unverifiable, and an unrealistic price is a fraud signal.'
      });
    }

    const productPts = this.getProductPoints(transaction.typeProduct);
    if (productPts === 0) {
      declines.push({
        code: 'PRODUCT_UNKNOWN',
        label: 'Product type unclassified',
        detail: 'An unclassified product has no price reference against which the declared value can be verified.'
      });
    }

    const corridorData = this.getCorridorData(transaction.corridor);
    if (corridorData.untested) {
      declines.push({
        code: 'CORRIDOR_UNTESTED',
        label: 'Corridor is untested',
        detail: 'This route does not appear in the observed base. First trips on an unobserved corridor are not funded automatically.'
      });
    }

    const trips = this.toInt(transaction.nbTripsTotal);
    if (trips === 0) {
      declines.push({
        code: 'NO_TRIP_HISTORY',
        label: 'Brand-new seller — no prior trips',
        detail: 'No WACTAF history. There is nothing observed about how this borrower operates.'
      });
    }

    if (!(this.toNum(transaction.declaredValue) > 0)) {
      declines.push({
        code: 'NO_DECLARED_VALUE',
        label: 'No declared value',
        detail: 'Nothing to advance against.'
      });
    }

    return declines;
  }

  /**
   * Soft flags — fundable, but a human should look.
   * Per OPERATIONAL_SCORING_RULES.md § Mandatory Manual Review / Insurance.
   */
  getManualReviewFlags(transaction, totalScore) {
    const flags = [];

    const trips = this.toInt(transaction.nbTripsTotal);
    if (trips <= 1 && totalScore >= 50) {
      flags.push({
        code: 'FIRST_TIME_HIGH_SCORE',
        label: 'First-time borrower scoring 50+',
        detail: 'Verify identity and WACTAF record before disbursing. A high score on no history rests entirely on the transaction, not the borrower.'
      });
    }

    const declaredValue = this.toNum(transaction.declaredValue);
    const advance = Math.round(declaredValue * this.assignTier(totalScore).advancePct);
    if (advance > 15000000) {
      flags.push({
        code: 'LARGE_ADVANCE',
        label: `Advance of ${this.fmtFcfa(advance)} FCFA exceeds 15,000,000`,
        detail: 'Escalate to the risk committee. Above this size a single file carries concentration risk for the whole book.'
      });
    }

    const corridorData = this.getCorridorData(transaction.corridor);
    if (corridorData.successRate < 0.90) {
      flags.push({
        code: 'LOW_CORRIDOR_SUCCESS',
        label: `Corridor success rate is ${(corridorData.successRate * 100).toFixed(1)}%`,
        detail: 'Below 90% the corridor should be treated as rare and reviewed by hand.'
      });
    }
    if (corridorData.rare && !corridorData.untested) {
      flags.push({
        code: 'RARE_CORRIDOR',
        label: `Rare corridor — only ${corridorData.dealsCount} observed deals`,
        detail: 'Manual approval required. The success rate for this route rests on a sample too small to rely on.'
      });
    }

    /* Insurance requirements — Taux Assurance % > 1.5%. */
    const tier = this.assignTier(totalScore);
    const insuranceReasons = [];
    if (tier.slug === 'conditional') insuranceReasons.push('the file is in the Conditional tier');
    if (transaction.typeProduct === 'Produits Halieutiques') insuranceReasons.push('the product is perishable (halieutiques)');
    const incidents = this.toInt(transaction.nbIncidents);
    if (incidents >= 1) insuranceReasons.push(`${incidents} incident(s) are recorded on this corridor`);

    if (insuranceReasons.length) {
      flags.push({
        code: 'INSURANCE_REQUIRED',
        label: 'Insurance rate above 1.5% required',
        detail: `Mandatory because ${insuranceReasons.join(', and ')}.`
      });
    }

    if (transaction.coherencePrix === '⚠ Légèrement hors') {
      flags.push({
        code: 'PRICE_DEVIATION',
        label: 'Declared price deviates from market',
        detail: 'Minor deviation. Confirm the source quote before disbursing.'
      });
    }

    const spread = this.toNum(transaction.spreadCommercial);
    if (Number.isFinite(spread) && (spread < 15 || spread > 50)) {
      flags.push({
        code: 'SPREAD_IMPLAUSIBLE',
        label: `Commercial spread of ${this.fmtNum(spread)}% is economically implausible`,
        detail: spread < 15
          ? 'Below 15%, transport and levies consume the whole margin — the borrower cannot service the advance out of the trade.'
          : 'Above 50% the margin is not observed on these corridors and usually indicates a mis-stated price on one side of the trade.'
      });
    }

    if (totalScore >= 38 && totalScore < 42) {
      flags.push({
        code: 'TIER_BOUNDARY',
        label: `Score of ${totalScore} sits on the Standard/Conditional boundary`,
        detail: 'A single rule moves this file between tiers. The tier is not robust — apply judgement.'
      });
    }
    if (totalScore >= 48 && totalScore < 52) {
      flags.push({
        code: 'TIER_BOUNDARY',
        label: `Score of ${totalScore} sits on the Approved/Standard boundary`,
        detail: 'A single rule moves this file between tiers. The tier is not robust — apply judgement.'
      });
    }

    return flags;
  }

  /* ================================================================ *
   * TRACE
   * ================================================================ */

  generateTrace(layer1, layer2, layer3) {
    const trace = [];
    [layer1, layer2, layer3].forEach((layer, i) => {
      layer.breakdown.forEach(rule => {
        trace.push({
          layer: `Layer ${i + 1} — ${layer.name}`,
          rule: rule.rule,
          input: rule.value,
          points: rule.points,
          max: rule.max,
          reason: rule.explanation
        });
      });
      trace.push({
        layer: `Layer ${i + 1} — ${layer.name}`,
        rule: 'SUBTOTAL',
        input: '',
        points: layer.total,
        max: layer.max,
        reason: `Layer ${i + 1} contributes ${layer.total} of a possible ${layer.max} points.`
      });
    });
    return trace;
  }

  /* ================================================================ *
   * EXPLANATIONS
   * ================================================================ */

  explainCoherence(coherence) {
    switch (coherence) {
      case '✓ Cohérent':
        return 'The declared price matches the observed market for this product and corridor. The advance is anchored on a value that can be verified independently — this is the single strongest signal in the model.';
      case '⚠ Légèrement hors':
        return 'The declared price deviates from the observed market, but within a range explainable by quality, timing, or a genuine sourcing advantage. Half credit: the price is plausible but unconfirmed.';
      case '⚠ Hors norme':
        return 'The declared price does not correspond to any observed market level. No points, and the file is a mandatory decline: an unverifiable price means an unverifiable collateral value.';
      default:
        return 'No price coherence assessment was supplied, so no points can be awarded on this rule.';
    }
  }

  explainSpread(spread) {
    if (!Number.isFinite(spread)) {
      return 'No commercial spread supplied — no points awarded.';
    }
    if (spread >= 20 && spread <= 40) {
      return `A spread of ${this.fmtNum(spread)}% sits in the realistic band for these corridors: wide enough to absorb transport, levies, and losses, and to leave the borrower a margin from which the advance can be repaid.`;
    }
    if (spread >= 15 && spread < 20) {
      return `A spread of ${this.fmtNum(spread)}% is thin. It is achievable, but transport and informal levies leave little room — a delay or a price move on the buyer side erases the margin.`;
    }
    if (spread > 40 && spread <= 50) {
      return `A spread of ${this.fmtNum(spread)}% is above the usual band. It may reflect a genuine sourcing advantage, but it more often signals a mis-stated purchase price. Half credit pending confirmation.`;
    }
    if (spread < 15) {
      return `A spread of ${this.fmtNum(spread)}% leaves no workable margin once transport and levies are paid — economically impossible as stated. No points.`;
    }
    return `A spread of ${this.fmtNum(spread)}% is not observed on these corridors and most likely reflects a mis-stated price on one side of the trade. No points.`;
  }

  explainCorridor(corridorData, corridorName) {
    const pct = (corridorData.successRate * 100).toFixed(1);
    const base = corridorData.dealsCount > 0
      ? `${corridorName} shows a ${pct}% success rate over ${corridorData.dealsCount} observed deals.`
      : `${corridorName || 'This corridor'} does not appear in the observed base.`;
    return `${base} ${corridorData.note}`;
  }

  explainProduct(typeProduct) {
    const table = (typeof PRODUCT_DATA !== 'undefined') ? PRODUCT_DATA : {};
    const entry = table[typeProduct];
    if (!entry) {
      return 'Product type unrecognised. Without a product classification there is no resale reference, so no points are awarded and the file is a mandatory decline.';
    }
    return `${typeProduct}: ${entry.note} Product risk is scored on how fast the goods lose value if the trip is delayed and how readily they can be resold if the buyer walks.`;
  }

  explainIncidents(incidents) {
    if (incidents <= 0) {
      return 'No incidents recorded on this route — no friction. Full credit: a clean route history is the cheapest evidence available.';
    }
    if (incidents === 1) {
      return 'One recorded incident. Partial credit: a single event is as likely to be circumstance as pattern, but it triggers the insurance requirement and warrants asking what happened.';
    }
    return `${incidents} recorded incidents. No points — at this frequency the route has too many problems to treat the record as incidental.`;
  }

  explainTrips(trips) {
    if (trips >= 3) {
      return `${trips} prior trips — a proven track record. The borrower is established and their declarations can be checked against a real history.`;
    }
    if (trips === 2) {
      return 'Two prior trips. Minimal but acceptable: enough to confirm the borrower operates, not enough to characterise how they behave under stress.';
    }
    if (trips === 1) {
      return 'One prior trip. A one-off carries almost no information about the borrower — no points on this rule.';
    }
    return 'No prior trips. No WACTAF history at all, which is a mandatory decline: the file rests entirely on the transaction, with nothing known about who is behind it.';
  }

  explainFrequency(tripsPerMonth) {
    if (tripsPerMonth >= 2) {
      return `${tripsPerMonth.toFixed(1)} trips per month is the cadence of an active trader with a working buyer relationship — trading is the borrower's profession, not a sideline.`;
    }
    if (tripsPerMonth >= 1) {
      return `${tripsPerMonth.toFixed(1)} trips per month indicates occasional, regular activity. Partial credit.`;
    }
    return `${tripsPerMonth.toFixed(1)} trips per month is too sporadic to characterise the borrower as an active trader. No points on this rule.`;
  }

  explainSpecialization(concentration) {
    const pct = (concentration * 100).toFixed(0);
    if (concentration >= 0.80) {
      return `${pct}% of trips on one corridor. The borrower is a specialist: they know the route, the checkpoints, and the buyers on it.`;
    }
    if (concentration >= 0.50) {
      return `${pct}% of trips on the primary corridor. Reasonably diversified, but with less accumulated route knowledge on any single one. Partial credit.`;
    }
    return `${pct}% on the primary corridor. A generalist spread thin across routes, with no corridor they can be said to know well — no points on this rule.`;
  }

  /* ================================================================ *
   * WHAT-IF
   * ================================================================ */

  /**
   * Score a variant of a transaction and return both results plus the deltas.
   * @param {object} base      the original transaction
   * @param {object} overrides fields to change
   */
  compareScenario(base, overrides) {
    const variant = Object.assign({}, base, overrides);
    const baseResult = this.calculateScore(base);
    const variantResult = this.calculateScore(variant);

    return {
      base: baseResult,
      variant: variantResult,
      overrides: overrides,
      delta: {
        totalScore: variantResult.scoring.totalScore - baseResult.scoring.totalScore,
        layer1: variantResult.scoring.layer1.total - baseResult.scoring.layer1.total,
        layer2: variantResult.scoring.layer2.total - baseResult.scoring.layer2.total,
        layer3: variantResult.scoring.layer3.total - baseResult.scoring.layer3.total,
        advanceFcfa: variantResult.scoring.advanceFcfa - baseResult.scoring.advanceFcfa,
        tierChanged: variantResult.scoring.tier !== baseResult.scoring.tier
      }
    };
  }

  /* ================================================================ *
   * UTILITIES
   * ================================================================ */

  toNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  toInt(v) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }

  fmtNum(n) {
    if (!Number.isFinite(n)) return '—';
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  fmtFcfa(n) {
    return Math.round(this.toNum(n)).toLocaleString('fr-FR').replace(/ | /g, ' ');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ScoringEngine };
}
