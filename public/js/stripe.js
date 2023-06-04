/* eslint-disable */

import { showAlert } from './alerts';

export const bookTour = async tourId => {
  try {
    // get checkout session
    const session = await axios({
      method: 'post',
      url: `http://localhost:3000/api/v1/booking/checkout-session/${tourId}`,
    });

    // create checkout form + charge credit card
    location.assign(session.data.session.url);
  } catch (error) {
    console.log(error);
    showAlert('error', error.message);
  }
};
