const AppError = require('../utils/appError');

const sendErrorDev = (req, res, error) => {
  // API
  if (req.originalUrl.startsWith('/api')) {
    return res.status(error.statusCode).json({
      status: error.status,
      message: error.message,
      error: error,
      stack: error.stack,
    });
  }

  console.error('🔴ERROR: ', error);

  // RENDER ERROR PAGE
  return res.status(error.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: error.message,
  });
};

const sendErrorProd = (req, res, error) => {
  // API
  if (req.originalUrl.startsWith('/api')) {
    // Operational, trusted errors: send message to client
    if (error.isOperational) {
      return res.status(error.statusCode).json({
        status: error.status,
        message: error.message,
      });
    }

    // Programming or other unknown error: don't leak error details
    console.error('🔴ERROR: ', error);

    return res.status(error.statusCode).json({
      status: 'error',
      message: 'Something went wrong!',
    });
  }

  // RENDER ERROR PAGE
  // Operational, trusted errors: send message to client
  if (error.isOperational) {
    return res.status(error.statusCode).render('error', {
      title: 'Something went wrong!',
      msg: error.message,
    });
  }

  // Programming or other unknown error: don't leak error details
  console.error('🔴ERROR: ', error);

  // RENDER ERROR PAGE
  return res.status(error.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: 'Please try again later.',
  });
};

const handleCastErrorDB = err => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(400, message);
};

const handleDuplicateErrorDB = err => {
  const value = Object.values(err.keyValue)[0];
  const message = `Duplicate field value: ${value}. Use another value.`;

  return new AppError(400, message);
};

const handleValidationErrorDB = err => {
  const errors = Object.values(err.errors)
    .map(error => error.message)
    .join(' ');
  const message = `Invalid input data. ${errors}`;

  return new AppError(400, message);
};

const handleJWTError = () =>
  new AppError(401, 'Invalid Signature. Please log in again.');

const handleJWTExpiredError = () =>
  new AppError(401, 'Your token has expired. Please log in again.');

const globalErrorHandler = (error, req, res, next) => {
  error.statusCode = error.statusCode || 500;
  error.status = error.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(req, res, error);
  } else if (process.env.NODE_ENV === 'production') {
    let err = { ...error };

    err.message = error.message;

    if (err.name === 'CastError') err = handleCastErrorDB(err);
    if (err.code === 11000) err = handleDuplicateErrorDB(err);
    if (err.name === 'ValidationError') err = handleValidationErrorDB(err);
    if (err.name === 'JsonWebTokenError') err = handleJWTError();
    if (err.name === 'TokenExpiredError') err = handleJWTExpiredError();

    sendErrorProd(req, res, err);
  }
};

module.exports = globalErrorHandler;
