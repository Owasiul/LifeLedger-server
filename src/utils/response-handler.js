export const responseHandler = {
  sendSuccess(res, data, statusCode = 200, message = "Success") {
    res.status(statusCode).send({
      success: true,
      message,
      data,
    });
  },

  sendError(res, error, statusCode = 500) {
    const message = error.message || "An unexpected error occurred";
    res.status(statusCode).send({
      success: false,
      message,
      code: error.code || "INTERNAL_ERROR",
    });
  },

  sendCreated(res, data, message = "Created successfully") {
    this.sendSuccess(res, data, 201, message);
  },

  sendPaginatedSuccess(res, data, pagination, message = "Success") {
    res.status(200).send({
      success: true,
      message,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        pages: Math.ceil(pagination.total / pagination.limit),
      },
    });
  },

  sendBadRequest(res, message = "Bad Request") {
    res.status(400).send({
      success: false,
      message,
      code: "BAD_REQUEST",
    });
  },

  sendNotFound(res, resource = "Resource") {
    res.status(404).send({
      success: false,
      message: `${resource} not found`,
      code: "NOT_FOUND",
    });
  },

  sendUnauthorized(res, message = "Unauthorized Access") {
    res.status(401).send({
      success: false,
      message,
      code: "AUTHENTICATION_ERROR",
    });
  },

  sendForbidden(res, message = "Forbidden Access") {
    res.status(403).send({
      success: false,
      message,
      code: "AUTHORIZATION_ERROR",
    });
  },
};
