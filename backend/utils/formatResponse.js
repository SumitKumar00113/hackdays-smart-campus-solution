const successResponse = (
  res,
  status = 200,
  message = "Done",
  data = {},
  meta = {},
) =>
  res.status(status).json({
    success: true,
    status,
    message,
    data,
    meta,
  });

const errorResponse = (
  res,
  status = 400,
  message = "Bad request",
  errors = null,
) =>
  res.status(status).json({
    success: false,
    status,
    message,
    errors,
  });

const paginatedResponse = (
  res,
  data = [],
  page = 1,
  limit = 10,
  total = 0,
  message = "Success",
) => {
  const hasMore = page * limit < total;
  return res.status(200).json({
    success: true,
    status: 200,
    message,
    data,
    meta: {
      page,
      limit,
      total,
      hasMore,
    },
  });
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
};
