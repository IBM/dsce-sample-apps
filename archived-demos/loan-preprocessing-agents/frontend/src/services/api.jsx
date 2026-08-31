// A simple fetch wrapper that adds the Authorization header
export const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('token');

    const headers = {
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
        // Token is invalid or expired, log the user out
        localStorage.removeItem('token');
        window.dispatchEvent(new Event('storage')); // Notify other tabs/components
        // Optionally redirect to login page
        window.location.href = '/login';
    }

    return response;
};