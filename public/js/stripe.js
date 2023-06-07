/* eslint-disable */

import { showAlert } from './alerts';

export const bookTour = async tourId => {
  try {
    // get checkout session
    const session = await axios({
      method: 'post',
      url: `/api/v1/bookings/checkout-session/${tourId}`,
    });

    // create checkout form + charge credit card
    location.assign(session.data.session.url);
  } catch (error) {
    console.log(error);
    showAlert('error', error.message);
  }
};
