/* eslint-disable */

import { showAlert } from './alerts';

export const login = async (email, password) => {
  try {
    const res = await axios({
      method: 'post',
      url: 'http://localhost:3000/api/v1/users/login',
      data: {
        email,
        password,
      },
    });

    if (res.data.status === 'success') {
      showAlert('success', 'You are logged in !');
      setTimeout(() => {
        location.assign('/');
      }, 1500);
    }
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
};

export const logout = async () => {
  try {
    const res = await axios({
      method: 'get',
      url: 'http://localhost:3000/api/v1/users/logout',
    });
    if (res.data.status === 'success')
      setTimeout(() => {
        location.assign('/');
      }, 1000);
  } catch (error) {
    console.log(error);
    showAlert('error', 'Error logging out. Try again !');
  }
};
