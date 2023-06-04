const { promisify } = require('util');
const crypto = require('crypto');

const jwt = require('jsonwebtoken');

const AppError = require('../utils/appError');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const Email = require('../utils/email');

const signinToken = id =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createSendToken = (user, statusCode, res) => {
  const token = signinToken(user._id);
  const cookieOpts = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === 'production') {
    cookieOpts.secure = true;
  }

  res.cookie('jwt', token, cookieOpts);

  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.noCache = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Expires', '0');
  next();
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  });

  const url = `${req.protocol}://${req.get('host')}/me`;

  await new Email(newUser, url).sendWelcome();

  createSendToken(newUser, 201, res);
});

exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  // 1) check if email and password exist
  if (!email || !password) {
    return next(new AppError(400, 'Please provide email and password.'));
  }

  // 2) check if user exist and password correct
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new AppError(401, 'Incorrect email or password.'));
  }

  const match = await user.correctPassword(password, user.password);

  // 3) if all correct, send jwt token to client
  if (match) {
    createSendToken(user, 200, res);
  } else {
    return next(new AppError(401, 'Incorrect email or password.'));
  }
};

exports.logout = (req, res, next) => {
  res.clearCookie('jwt');
  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // getting token and checking if it exists
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) return next(new AppError(401, 'You are not logged in.'));

  // token verification
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // checking if user exists
  const currentUser = await User.findById(decoded.id);

  if (!currentUser)
    return next(new AppError(401, 'User with this token no longer exists.'));

  // if user updated password after token was issued
  const passwordChanged = currentUser.passwordChangedAfter(decoded.iat);

  if (passwordChanged) {
    return next(
      new AppError(401, 'User has changed the password. Please log in again.')
    );
  }

  // grant access to protected route
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

// only for rendered pages
exports.isLoggedIn = catchAsync(async (req, res, next) => {
  if (req.cookies.jwt) {
    // verify cookie
    const decoded = await promisify(jwt.verify)(
      req.cookies.jwt,
      process.env.JWT_SECRET
    );

    // checking if user exists
    const currentUser = await User.findById(decoded.id);

    if (!currentUser) return next();

    // if user updated password after token was issued
    const passwordChanged = currentUser.passwordChangedAfter(decoded.iat);

    if (passwordChanged) {
      return next();
    }

    // there is a logged in user
    res.locals.user = currentUser;
    return next();
  }
  next();
});

exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'Access Denied.'));
    }

    next();
  };

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // get user POSTed email
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new AppError(404, 'User does not exist.'));
  }

  // generate token
  const resetToken = user.createResetPasswordToken();
  await user.save({ validateModifiedOnly: true });

  try {
    // send token to user email
    const resetUrl = `${req.protocol}://${req.get(
      'host'
    )}/v1/users/resetPassword/${resetToken}`;

    await new Email(user, resetUrl).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent!',
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save({ validateModifiedOnly: true });

    return next(
      new AppError(
        500,
        'There was an error sending the email. Try again later!'
      )
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError(400, 'Token is invalid or has expired.'));
  }

  // if token not expired and there is user, reset password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  // log user in, send JWT
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // get user from collection
  const user = await User.findById(req.user.id).select('+password');

  if (
    !req.body.password ||
    !req.body.passwordConfirm ||
    !req.body.passwordCurrent
  ) {
    return next(new AppError(400, 'All fields required.'));
  }

  // check POSTed current password is correct
  const match = await user.correctPassword(
    req.body.passwordCurrent,
    user.password
  );

  if (!match) {
    return next(new AppError(401, 'Incorrect Password.'));
  }

  // if so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  // log user in, send JWT
  createSendToken(user, 200, res);
});
