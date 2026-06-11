import { ObjectId } from "mongodb";
import { BadRequestError } from "../utils/errors.js";

/**
 * Middleware to validate MongoDB ObjectId parameters
 * @param {string[]} params - Array of parameter names to validate (e.g., ['id', 'lessonId'])
 */
export const validateObjectId = (...params) => {
  return (req, res, next) => {
    for (const param of params) {
      const value = req.params[param];
      if (value && !ObjectId.isValid(value)) {
        throw new BadRequestError(`Invalid ${param} format`);
      }
    }
    next();
  };
};

/**
 * Middleware to validate request body fields
 * @param {Object} schema - Validation schema with field names and validators
 */
export const validateBody = (schema) => {
  return (req, res, next) => {
    const errors = [];
    
    for (const [field, validator] of Object.entries(schema)) {
      const value = req.body[field];
      
      if (validator.required && (value === undefined || value === null || value === "")) {
        errors.push(`${field} is required`);
        continue;
      }
      
      if (value !== undefined && validator.type && typeof value !== validator.type) {
        errors.push(`${field} must be of type ${validator.type}`);
      }
      
      if (value !== undefined && validator.validate && !validator.validate(value)) {
        errors.push(`${field} is invalid`);
      }
    }
    
    if (errors.length > 0) {
      throw new BadRequestError(errors.join(", "));
    }
    
    next();
  };
};

/**
 * Middleware to validate query parameters
 * @param {Object} schema - Validation schema for query parameters
 */
export const validateQuery = (schema) => {
  return (req, res, next) => {
    const errors = [];
    
    for (const [field, validator] of Object.entries(schema)) {
      const value = req.query[field];
      
      if (validator.required && (value === undefined || value === null || value === "")) {
        errors.push(`${field} query parameter is required`);
        continue;
      }
      
      if (value !== undefined && validator.type && typeof value !== validator.type) {
        errors.push(`${field} must be of type ${validator.type}`);
      }
      
      if (value !== undefined && validator.validate && !validator.validate(value)) {
        errors.push(`${field} is invalid`);
      }
    }
    
    if (errors.length > 0) {
      throw new BadRequestError(errors.join(", "));
    }
    
    next();
  };
};

/**
 * Common validation helpers
 */
export const validators = {
  isEmail: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  isNonEmptyString: (value) => typeof value === "string" && value.trim().length > 0,
  isPositiveNumber: (value) => !isNaN(value) && Number(value) > 0,
  isBoolean: (value) => typeof value === "boolean" || value === "true" || value === "false",
  isInEnum: (allowedValues) => (value) => allowedValues.includes(value),
  isValidObjectId: (value) => ObjectId.isValid(value),
};