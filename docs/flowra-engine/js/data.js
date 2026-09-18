/**
 * Flowra Scoring Engine — Data & Lookups
 *
 * Corridor statistics are derived from a base of 314 observed transactions.
 * Point allocations are PROVISIONAL (domain expertise, not statistical
 * validation). They are to be recalibrated after 50 completed loans with
 * observed repayment outcomes.
 */

/* ------------------------------------------------------------------ *
 * Corridors
 * ------------------------------------------------------------------ */

const CORRIDOR_DATA = {
  'Bénin → Togo': {
    successRate: 0.908,
    points: 9,
    dealsCount: 120,
    note: 'High-volume corridor, well observed.'
  },
  'Togo → Bénin': {
    successRate: 0.943,
    points: 9,
    dealsCount: 70,
    note: 'Return leg of the Bénin–Togo axis.'
  },
  'Bénin → Burkina Faso': {
    successRate: 0.938,
    points: 9,
    dealsCount: 32,
    note: 'Longer inland route, stable performance.'
  },
  'Bénin → Côte d\'Ivoire': {
    successRate: 0.958,
    points: 9,
    dealsCount: 24,
    note: 'Strong success rate on a moderate sample.'
  },
  'Bénin → Ghana': {
    successRate: 0.950,
    points: 9,
    dealsCount: 20,
    note: 'Cross-currency corridor (FCFA/GHS).'
  },
  'Bénin → Nigeria': {
    successRate: 0.950,
    points: 9,
    dealsCount: 20,
    note: 'Cross-currency corridor (FCFA/NGN), large demand pool.'
  },
  'Niger → Côte d\'Ivoire': {
    successRate: 1.000,
    points: 5,
    dealsCount: 6,
    rare: true,
    note: 'Rare corridor: a perfect record over 6 deals is not evidence of a safe route. Scored as untested — manual approval required.'
  },
  'Nigeria → Côte d\'Ivoire': {
    successRate: 1.000,
    points: 5,
    dealsCount: 6,
    rare: true,
    note: 'Rare corridor: a perfect record over 6 deals is not evidence of a safe route. Scored as untested — manual approval required.'
  }
};

/** Default applied to any corridor absent from the table. */
const CORRIDOR_DEFAULT = {
  successRate: 0.900,
  points: 5,
  dealsCount: 0,
  rare: true,
  untested: true,
  note: 'Corridor absent from the observed base — scored as untested. Manual approval required.'
};

/* ------------------------------------------------------------------ *
 * Products
 * ------------------------------------------------------------------ */

const PRODUCT_DATA = {
  'Produits Agricoles': {
    points: 6,
    note: 'Non-perishable in the main, storable, deepest resale market.'
  },
  'Produits Bétails': {
    points: 5,
    note: 'Live animals: mortality and feeding costs en route.'
  },
  'Produits Halieutiques': {
    points: 4,
    note: 'Highly perishable, cold-chain dependent, fastest value decay.'
  },
  'Unknown': {
    points: 0,
    note: 'Unclassified product — no collateral view, no points.'
  }
};

/* ------------------------------------------------------------------ *
 * Scoring bands (mirrored in scoring-engine.js; exposed for the UI)
 * ------------------------------------------------------------------ */

const TIER_BANDS = [
  { min: 50, name: '★★★ Approved',    emoji: '✓', advancePct: 0.70, tenor: '14 days', color: '#2ecc71', slug: 'approved' },
  { min: 40, name: '★★ Standard',     emoji: '◐', advancePct: 0.55, tenor: '10 days', color: '#f39c12', slug: 'standard' },
  { min: 30, name: '★ Conditional',   emoji: '⚠', advancePct: 0.40, tenor: '7 days',  color: '#e67e22', slug: 'conditional' },
  { min: -Infinity, name: '⚠ Decline', emoji: '✗', advancePct: 0,   tenor: 'N/A',     color: '#e74c3c', slug: 'decline' }
];

const MAX_SCORE = 60;

/* Layer maxima: L1 = 15 + 10; L2 = 9 + 6 + 5; L3 = 6 + 5 + 4. */

/* ------------------------------------------------------------------ *
 * Sample transactions
 *
 * SYNTHETIC demonstration data. Names are invented and phone numbers are
 * placeholders. No real borrower record appears in this file — the observed
 * transaction base is held privately and is never published with this site.
 * ------------------------------------------------------------------ */

const SAMPLE_TRANSACTIONS = [
  {
    id: 'BRK733XZ',
    borrower: 'Exemple Vendeur A',
    phone: '00000000',
    corridor: 'Togo → Bénin',
    typeProduct: 'Produits Agricoles',
    product: 'Gingembre',
    quantity: 100,
    declaredValue: 900000,
    coherencePrix: '✓ Cohérent',
    spreadCommercial: 35,
    nbTripsTotal: 5,
    tripsPerMonth: 2.1,
    concentrationCorridor: 0.85,
    nbIncidents: 0,
    label: 'Strong file — coherent price, proven corridor'
  },
  {
    id: 'BRK901KM',
    borrower: 'Exemple Vendeur B',
    phone: '00000000',
    corridor: 'Bénin → Nigeria',
    typeProduct: 'Produits Bétails',
    product: 'Ovins',
    quantity: 40,
    declaredValue: 2400000,
    coherencePrix: '⚠ Légèrement hors',
    spreadCommercial: 44,
    nbTripsTotal: 12,
    tripsPerMonth: 3.4,
    concentrationCorridor: 0.62,
    nbIncidents: 1,
    label: 'Mid file — borderline spread, one past incident'
  },
  {
    id: 'BRK455QT',
    borrower: 'Exemple Vendeur C',
    phone: '00000000',
    corridor: 'Bénin → Togo',
    typeProduct: 'Produits Halieutiques',
    product: 'Poisson fumé',
    quantity: 300,
    declaredValue: 1500000,
    coherencePrix: '⚠ Hors norme',
    spreadCommercial: 68,
    nbTripsTotal: 1,
    tripsPerMonth: 0.4,
    concentrationCorridor: 1.0,
    nbIncidents: 3,
    label: 'Weak file — price out of range, incident history'
  },
  {
    id: 'BRK288RD',
    borrower: 'Exemple Vendeur D',
    phone: '00000000',
    corridor: 'Niger → Côte d\'Ivoire',
    typeProduct: 'Produits Agricoles',
    product: 'Oignon',
    quantity: 500,
    declaredValue: 3200000,
    coherencePrix: '✓ Cohérent',
    spreadCommercial: 27,
    nbTripsTotal: 9,
    tripsPerMonth: 1.6,
    concentrationCorridor: 0.71,
    nbIncidents: 0,
    label: 'Strong file — thin-sample corridor, clean history'
  },
  {
    id: 'BRK612VN',
    borrower: 'Exemple Vendeur E',
    phone: '00000000',
    corridor: 'Bénin → Burkina Faso',
    typeProduct: 'Produits Agricoles',
    product: 'Maïs',
    quantity: 800,
    declaredValue: 1800000,
    coherencePrix: '✓ Cohérent',
    spreadCommercial: 17,
    nbTripsTotal: 3,
    tripsPerMonth: 0.9,
    concentrationCorridor: 0.55,
    nbIncidents: 0,
    label: 'Mid file — thin margin, new-ish trader'
  }
];

/* ------------------------------------------------------------------ *
 * Enumerations used by the form
 * ------------------------------------------------------------------ */

const COHERENCE_OPTIONS = [
  { value: '✓ Cohérent',           label: '✓ Coherent (price matches market)',  points: 15 },
  { value: '⚠ Légèrement hors',    label: '⚠ Slightly off (minor deviation)',   points: 8  },
  { value: '⚠ Hors norme',         label: '⚠ Out of range (unrealistic)',       points: 0  }
];

const PRODUCT_OPTIONS = Object.keys(PRODUCT_DATA).filter(k => k !== 'Unknown');
const CORRIDOR_OPTIONS = Object.keys(CORRIDOR_DATA);
