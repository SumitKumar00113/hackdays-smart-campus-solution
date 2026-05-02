const CLAIM_MATCH_THRESHOLD = 70;

const CLAIM_FIELDS = ["color", "brand", "uniqueIdentifier"];

const FIELD_WEIGHTS = {
  color: 25,
  brand: 25,
  uniqueIdentifier: 50,
};

const FIELD_ALIASES = {
  uniqueIdentifier: [
    "uniqueIdentifier",
    "identifier",
    "serialNumber",
    "rollNumber",
    "engraving",
  ],
};

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const normalizeAnswer = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const normalizeComparable = (value) =>
  normalizeAnswer(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const getFirstValue = (source, field) => {
  const keys = FIELD_ALIASES[field] || [field];

  for (const key of keys) {
    if (source?.[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }

  return undefined;
};

const resolveVerificationSource = (payload = {}) => {
  if (typeof payload.verification === "string") {
    return safeJsonParse(payload.verification) || {};
  }

  if (payload.verification) {
    return payload.verification;
  }

  if (typeof payload.claimVerification === "string") {
    return safeJsonParse(payload.claimVerification) || {};
  }

  if (payload.claimVerification) {
    return payload.claimVerification;
  }

  return payload;
};

const normalizeVerificationInput = (payload = {}) => {
  const source = resolveVerificationSource(payload);
  const verification = CLAIM_FIELDS.reduce((details, field) => {
    const value = normalizeAnswer(getFirstValue(source, field));
    if (value) {
      details[field] = value;
    }
    return details;
  }, {});

  return Object.keys(verification).length ? verification : undefined;
};

const normalizeClaimAnswers = (payload = {}) => {
  const source = payload.answers || payload.claimAnswers || payload;

  return CLAIM_FIELDS.reduce((answers, field) => {
    answers[field] = normalizeAnswer(getFirstValue(source, field));
    return answers;
  }, {});
};

const validateClaimAnswers = (payload = {}) => {
  const answers = normalizeClaimAnswers(payload);
  const errors = CLAIM_FIELDS.filter((field) => !answers[field]).map(
    (field) => `${field} is required`,
  );

  return {
    answers,
    errors,
    isValid: errors.length === 0,
  };
};

const compareField = (expected, provided, { strict = false } = {}) => {
  const normalizedExpected = normalizeComparable(expected);
  const normalizedProvided = normalizeComparable(provided);
  const expectedPresent = Boolean(normalizedExpected);
  const providedPresent = Boolean(normalizedProvided);

  if (!expectedPresent || !providedPresent) {
    return {
      expectedPresent,
      providedPresent,
      match: false,
      confidence: 0,
    };
  }

  if (normalizedExpected === normalizedProvided) {
    return {
      expectedPresent,
      providedPresent,
      match: true,
      confidence: 100,
    };
  }

  if (
    !strict &&
    (normalizedExpected.includes(normalizedProvided) ||
      normalizedProvided.includes(normalizedExpected))
  ) {
    return {
      expectedPresent,
      providedPresent,
      match: true,
      confidence: 75,
    };
  }

  return {
    expectedPresent,
    providedPresent,
    match: false,
    confidence: 0,
  };
};

const compareClaimAnswers = ({ item, answers }) => {
  const original = item?.verification || {};
  const fields = {
    color: compareField(original.color, answers.color),
    brand: compareField(original.brand, answers.brand),
    uniqueIdentifier: compareField(original.uniqueIdentifier, answers.uniqueIdentifier, {
      strict: true,
    }),
  };

  const missingOriginalFields = CLAIM_FIELDS.filter(
    (field) => !fields[field].expectedPresent,
  );
  const availableFields = CLAIM_FIELDS.filter(
    (field) => fields[field].expectedPresent,
  );
  const maxScore = availableFields.reduce(
    (total, field) => total + FIELD_WEIGHTS[field],
    0,
  );
  const weightedScore = availableFields.reduce(
    (total, field) =>
      total + (fields[field].confidence / 100) * FIELD_WEIGHTS[field],
    0,
  );
  const score = maxScore ? Math.round((weightedScore / maxScore) * 100) : 0;
  const riskFlags = [];

  CLAIM_FIELDS.forEach((field) => {
    if (fields[field].expectedPresent && !fields[field].match) {
      riskFlags.push(`${field} does not match original item details`);
    }
  });

  if (missingOriginalFields.length) {
    riskFlags.push(
      `Original item is missing ${missingOriginalFields.join(", ")} verification detail(s)`,
    );
  }

  return {
    score,
    passed: score >= CLAIM_MATCH_THRESHOLD && riskFlags.length === 0,
    threshold: CLAIM_MATCH_THRESHOLD,
    fields,
    missingOriginalFields,
    riskFlags,
  };
};

module.exports = {
  compareClaimAnswers,
  normalizeVerificationInput,
  validateClaimAnswers,
};
