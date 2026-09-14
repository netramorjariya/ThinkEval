const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

// Runs after an express-validator chain array; throws the first validation message as a 400 so
// the response shape matches every other ApiError in the app (never a raw express-validator array).
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, errors.array()[0].msg);
  }
  next();
}

module.exports = validate;
