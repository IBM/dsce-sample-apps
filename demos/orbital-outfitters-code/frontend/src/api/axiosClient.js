import axios from 'axios';

// withCredentials ensures the httpOnly auth cookie is sent on every request.
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL ? import.meta.env.VITE_BACKEND_URL : '/api',
  withCredentials: true,
});

export default axiosClient;
