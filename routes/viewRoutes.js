const express = require('express');

const authController = require('../controllers/authController');
const viewController = require('../controllers/viewController');
const bookingController = require('../controllers/bookingController');

const router = express.Router();

router.get(
  '/',
  bookingController.createBookingCheckout,
  authController.isLoggedIn,
  viewController.getTourOverview
);
router.get('/tour/:slug', authController.isLoggedIn, viewController.getTour);
router.get('/login', authController.isLoggedIn, viewController.getLoginForm);
router.get('/signup', authController.isLoggedIn, viewController.getSignupForm);
router.get(
  '/me',
  authController.noCache,
  authController.protect,
  viewController.getAccount
);
router.get(
  '/my-bookings',
  authController.protect,
  viewController.getMyBookings
);

module.exports = router;
