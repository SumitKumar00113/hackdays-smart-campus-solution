const LostFound = require("../models/LostFound");
const LostFoundMatch = require("../models/LostFoundMatch");
const { notifyLostFoundMatch } = require("./notificationService");

const NEARBY_RADIUS_METERS = 500;

const normalizeText = (text = "") =>
  text
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const computeTextSimilarity = (a = "", b = "") => {
  const wordsA = new Set(normalizeText(a));
  const wordsB = new Set(normalizeText(b));
  if (!wordsA.size || !wordsB.size) return 0;
  const intersection = [...wordsA].filter((word) => wordsB.has(word)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return Math.round((intersection / union) * 100);
};

const computeCategoryScore = (a, b) => (a && b && a === b ? 25 : 0);

const computeLocationScore = (a, b) => {
  if (!a || !b) return 0;
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  if (left === right) return 20;
  if (left.includes(right) || right.includes(left)) return 12;
  return 0;
};

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const normalizeCoordinates = (item = {}) => {
  const coordinates =
    typeof item.coordinates === "string"
      ? safeJsonParse(item.coordinates)
      : item.coordinates;
  const lat =
    coordinates?.lat ??
    coordinates?.latitude ??
    item.lat ??
    item.latitude;
  const lng =
    coordinates?.lng ??
    coordinates?.lon ??
    coordinates?.longitude ??
    item.lng ??
    item.lon ??
    item.longitude;

  const parsedLat = Number(lat);
  const parsedLng = Number(lng);

  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
    return null;
  }

  if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
    return null;
  }

  return { lat: parsedLat, lng: parsedLng };
};

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const calculateDistanceMeters = (first, second) => {
  const pointA = normalizeCoordinates(first);
  const pointB = normalizeCoordinates(second);

  if (!pointA || !pointB) {
    return null;
  }

  const earthRadiusMeters = 6371000;
  const latDelta = toRadians(pointB.lat - pointA.lat);
  const lngDelta = toRadians(pointB.lng - pointA.lng);
  const startLat = toRadians(pointA.lat);
  const endLat = toRadians(pointB.lat);

  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lngDelta / 2) ** 2;
  const centralAngle =
    2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return Math.round(earthRadiusMeters * centralAngle);
};

const computeProximityScore = (distanceMeters) => {
  if (distanceMeters === null || distanceMeters > NEARBY_RADIUS_METERS) {
    return 0;
  }

  if (distanceMeters <= 100) return 20;
  if (distanceMeters <= 250) return 15;
  return 10;
};

const computeDateScore = (a, b) => {
  const dateA = new Date(a);
  const dateB = new Date(b);
  if (Number.isNaN(dateA.getTime()) || Number.isNaN(dateB.getTime())) return 0;
  const days = Math.abs(dateA - dateB) / (1000 * 60 * 60 * 24);
  if (days <= 1) return 20;
  if (days <= 3) return 12;
  if (days <= 7) return 6;
  return 0;
};

const extractImageTags = (item) => {
  if (Array.isArray(item.imageTags) && item.imageTags.length) {
    return item.imageTags.map((tag) => tag.toLowerCase());
  }

  const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
  const colors = [
    "red",
    "blue",
    "green",
    "black",
    "white",
    "yellow",
    "orange",
    "pink",
    "purple",
    "brown",
    "gray",
  ];
  const objects = [
    "bag",
    "phone",
    "wallet",
    "keys",
    "book",
    "jacket",
    "watch",
    "laptop",
    "umbrella",
    "headphones",
    "water bottle",
    "glass",
  ];

  const tags = [];
  if (item.imageUrl) {
    tags.push("photo");
  }
  colors.forEach((color) => {
    if (text.includes(color)) tags.push(color);
  });
  objects.forEach((object) => {
    if (text.includes(object)) tags.push(object);
  });

  return tags.length ? [...new Set(tags)] : ["generic"];
};

const computeImageScore = (itemA, itemB) => {
  const tagsA = extractImageTags(itemA);
  const tagsB = extractImageTags(itemB);
  const intersection = tagsA.filter((tag) => tagsB.includes(tag)).length;
  const union = new Set([...tagsA, ...tagsB]).size;
  if (!union) return 0;
  return Math.round((intersection / union) * 10);
};

const scoreCandidateDetails = (newItem, candidate) => {
  const textA = `${newItem.title || ""} ${newItem.description || ""}`;
  const textB = `${candidate.title || ""} ${candidate.description || ""}`;

  const textScore = Math.round(
    (computeTextSimilarity(textA, textB) / 100) * 30,
  );
  const categoryScore = computeCategoryScore(
    newItem.category,
    candidate.category,
  );
  const locationScore = computeLocationScore(
    newItem.locationName || newItem.location,
    candidate.locationName || candidate.location,
  );
  const distanceMeters = calculateDistanceMeters(newItem, candidate);
  const proximityScore = computeProximityScore(distanceMeters);
  const dateScore = computeDateScore(
    newItem.createdAt || newItem.postedAt || new Date(),
    candidate.createdAt || candidate.postedAt || new Date(),
  );
  const imageScore =
    newItem.imageUrl && candidate.imageUrl
      ? computeImageScore(newItem, candidate)
      : 0;
  const score = Math.min(
    textScore +
      categoryScore +
      locationScore +
      proximityScore +
      dateScore +
      imageScore,
    100,
  );

  return {
    score,
    distanceMeters,
    nearby: distanceMeters !== null && distanceMeters <= NEARBY_RADIUS_METERS,
    breakdown: {
      textScore,
      categoryScore,
      locationScore,
      proximityScore,
      dateScore,
      imageScore,
    },
  };
};

const scoreCandidate = (newItem, candidate) =>
  scoreCandidateDetails(newItem, candidate).score;

const findOppositeStatus = (status) =>
  status === "lost" ? "found" : status === "found" ? "lost" : null;

const matchItems = async (newItem) => {
  if (!newItem) {
    throw new Error("newItem with status 'lost' or 'found' is required");
  }

  if (newItem._id) {
    const loaded = await LostFound.findById(newItem._id).lean();
    if (loaded) {
      newItem = { ...loaded, ...newItem };
    }
  }

  if (!newItem.status) {
    throw new Error("newItem.status must be either 'lost' or 'found'");
  }

  const oppositeStatus = findOppositeStatus(newItem.status);
  if (!oppositeStatus) {
    throw new Error("newItem.status must be either 'lost' or 'found'");
  }

  const query = { status: oppositeStatus };
  if (newItem._id) {
    query._id = { $ne: newItem._id };
  }

  const candidates = await LostFound.find(query).lean();

  const scored = candidates
    .map((candidate) => {
      const match = scoreCandidateDetails(newItem, candidate);
      return {
        candidate,
        ...match,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (a.nearby !== b.nearby) return a.nearby ? -1 : 1;
      return b.score - a.score;
    })
    .slice(0, 5);

  const matchedItems = scored.map((entry) => ({
    item: entry.candidate,
    score: entry.score,
    distanceMeters: entry.distanceMeters,
    nearby: entry.nearby,
    breakdown: entry.breakdown,
  }));

  if (matchedItems.length && newItem._id) {
    await persistMatchRecords(newItem, matchedItems);
  }

  return matchedItems;
};

const findNearbyItems = async ({
  itemId,
  lat,
  lng,
  radiusMeters = NEARBY_RADIUS_METERS,
  status,
  limit = 20,
}) => {
  const radius = Number(radiusMeters);
  const maxResults = Number(limit);
  let sourceItem = null;
  let origin = normalizeCoordinates({ lat, lng });

  if (itemId) {
    sourceItem = await LostFound.findById(itemId).lean();
    if (!sourceItem) {
      throw new Error("Lost/found item not found");
    }

    origin = normalizeCoordinates(sourceItem);
  }

  if (!origin) {
    throw new Error("Valid coordinates or itemId with coordinates are required");
  }

  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error("radiusMeters must be a positive number");
  }

  const query = {};
  if (status) {
    query.status = status;
  } else if (sourceItem) {
    const oppositeStatus = findOppositeStatus(sourceItem.status);
    if (oppositeStatus) query.status = oppositeStatus;
  }

  if (sourceItem) {
    query._id = { $ne: sourceItem._id };
  }

  const items = await LostFound.find(query).lean();
  const nearby = items
    .map((item) => ({
      item,
      distanceMeters: calculateDistanceMeters(origin, item),
    }))
    .filter(
      ({ distanceMeters }) =>
        distanceMeters !== null && distanceMeters <= radius,
    )
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, Number.isFinite(maxResults) && maxResults > 0 ? maxResults : 20);

  return {
    origin,
    radiusMeters: radius,
    count: nearby.length,
    items: nearby,
  };
};

const persistMatchRecords = async (newItem, matchedItems) => {
  if (!newItem._id) {
    return;
  }

  const isLostItem = newItem.status === "lost";

  await Promise.all(
    matchedItems.map(async ({ item, score, distanceMeters }) => {
      const record = {
        lostItemId: isLostItem
          ? newItem._id
          : item.status === "lost"
            ? item._id
            : null,
        foundItemId: !isLostItem
          ? newItem._id
          : item.status === "found"
            ? item._id
            : null,
        score,
      };

      if (!record.lostItemId || !record.foundItemId) {
        return null;
      }

      const filter = {
        lostItemId: record.lostItemId,
        foundItemId: record.foundItemId,
      };
      const existingMatch = await LostFoundMatch.findOne(filter);
      const matchRecord = await LostFoundMatch.findOneAndUpdate(
        filter,
        record,
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      if (!existingMatch) {
        await notifyLostFoundMatch({
          item: newItem,
          candidate: item,
          score,
          distanceMeters,
        });
      }

      return matchRecord;
    }),
  );
};

module.exports = {
  calculateDistanceMeters,
  findNearbyItems,
  matchItems,
  scoreCandidate,
};
