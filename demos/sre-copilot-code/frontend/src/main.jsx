import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// IBM Carbon base styles
import '@carbon/styles/css/styles.css';

// App global styles
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
