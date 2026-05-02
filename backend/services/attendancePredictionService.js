const DEFAULT_THRESHOLD = 75;

const roundPercentage = (value) => Number(value.toFixed(2));

const toNumber = (value, fieldName) => {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  return numberValue;
};

const normalizeInputs = ({
  totalClasses,
  attendedClasses,
  upcomingClasses,
  threshold = DEFAULT_THRESHOLD,
}) => {
  const normalized = {
    totalClasses: toNumber(totalClasses, "totalClasses"),
    attendedClasses: toNumber(attendedClasses, "attendedClasses"),
    upcomingClasses: toNumber(upcomingClasses, "upcomingClasses"),
    threshold: toNumber(threshold, "threshold"),
  };

  if (normalized.totalClasses <= 0) {
    throw new Error("totalClasses must be greater than 0");
  }

  if (normalized.attendedClasses < 0 || normalized.upcomingClasses < 0) {
    throw new Error("attendedClasses and upcomingClasses cannot be negative");
  }

  if (normalized.attendedClasses > normalized.totalClasses) {
    throw new Error("attendedClasses cannot be greater than totalClasses");
  }

  if (normalized.threshold <= 0 || normalized.threshold > 100) {
    throw new Error("threshold must be between 1 and 100");
  }

  return normalized;
};

const getPercentage = (attendedClasses, totalClasses) =>
  roundPercentage((attendedClasses / totalClasses) * 100);

const getPercentageAfterMisses = ({ attendedClasses, totalClasses, misses }) =>
  getPercentage(attendedClasses, totalClasses + misses);

const findMissesUntilRisk = ({
  attendedClasses,
  totalClasses,
  upcomingClasses,
  threshold,
}) => {
  for (let misses = 1; misses <= upcomingClasses; misses += 1) {
    const percentageAfterMisses = getPercentageAfterMisses({
      attendedClasses,
      totalClasses,
      misses,
    });

    if (percentageAfterMisses < threshold) {
      return misses;
    }
  }

  return null;
};

const buildMessage = ({
  currentPercentage,
  threshold,
  upcomingClasses,
  missesUntilRisk,
}) => {
  if (currentPercentage < threshold) {
    return `You are already below ${threshold}% attendance.`;
  }

  if (upcomingClasses === 0) {
    return `You are currently at ${currentPercentage}% attendance with no upcoming classes included.`;
  }

  if (missesUntilRisk === null) {
    return `You will stay at or above ${threshold}% even if you miss all ${upcomingClasses} upcoming classes.`;
  }

  const classLabel = missesUntilRisk === 1 ? "class" : "classes";
  return `You will fall below ${threshold}% if you miss ${missesUntilRisk} more ${classLabel}.`;
};

const predictAttendanceRisk = (input) => {
  const values = normalizeInputs(input);
  const currentPercentage = getPercentage(
    values.attendedClasses,
    values.totalClasses,
  );
  const futurePercentageIfMissAll = getPercentageAfterMisses({
    attendedClasses: values.attendedClasses,
    totalClasses: values.totalClasses,
    misses: values.upcomingClasses,
  });
  const missesUntilRisk =
    currentPercentage < values.threshold ? 0 : findMissesUntilRisk(values);
  const risk =
    currentPercentage < values.threshold || missesUntilRisk !== null;

  return {
    totalClasses: values.totalClasses,
    attendedClasses: values.attendedClasses,
    upcomingClasses: values.upcomingClasses,
    threshold: values.threshold,
    currentPercentage,
    futurePercentageIfMissAll,
    missesUntilRisk,
    risk,
    message: buildMessage({
      currentPercentage,
      threshold: values.threshold,
      upcomingClasses: values.upcomingClasses,
      missesUntilRisk,
    }),
  };
};

module.exports = {
  predictAttendanceRisk,
};
