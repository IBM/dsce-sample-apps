const express = require('express');
const next = require('next');
const { createProxyMiddleware } = require('http-proxy-middleware');
const helmet = require("helmet");
const compression = require("compression");
require('dotenv').config();

const dev = process.env.NODE_ENV !== 'production';
const API_URL = process.env.NEXT_PUBLIC_API_URL;
console.log("Server Running ON", API_URL);
const CLIENT_PORT = process.env.NEXT_PUBLIC_CLIENT_PORT;
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = express();

    // Logging Middleware: Log every incoming request
    server.use((req, res, next) => {
        console.log(`Received request: ${req.method} ${req.url}`);
        next();
    });

    // Apply compression
    server.use(compression());

    // Proxy middleware for /api
    server.use('/api', createProxyMiddleware({
        target: API_URL,
        changeOrigin: true,
        pathRewrite: {'^/api': '/api'},
        onProxyReq: (proxyReq, req, res) => {
            console.log(`AProxying request to: ${API_URL} - ${req.method} ${req.url}`);
        },
        onProxyRes: (proxyRes, req, res) => {
            console.log(`BReceived response from proxy: ${proxyRes.statusCode} - ${req.method} ${req.url}`);
        },
        onError: (err, req, res) => {
            console.error(`CProxy error for ${req.method} ${req.url}:`, err);
            res.status(500).send('DProxy error');
        }
    }));

    // Proxy middleware for /static/images
    server.use('/static/images', createProxyMiddleware({
        target: API_URL,
        changeOrigin: true,
    }));

    // Catch-all handler for all other requests
    server.all('*', (req, res) => {
        return handle(req, res);
    });

    // Error handling middleware
    server.use((err, req, res, next) => {
        console.error('Internal error:', err.stack);
        res.status(500).send("Internal server error");
    });

    server.listen(CLIENT_PORT, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://localhost:${CLIENT_PORT}`);
    });
});
