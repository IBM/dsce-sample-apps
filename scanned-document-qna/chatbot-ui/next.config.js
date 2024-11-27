const {i18n} = require('./next-i18next.config');
const {createProxyMiddleware} = require('http-proxy-middleware');

/** @type {import('next').NextConfig} */
const nextConfig = {
    i18n,
    reactStrictMode: true,

    webpack(config, {isServer, dev}) {
        config.experiments = {
            asyncWebAssembly: true,
            layers: true,
        };

        return config;
    },

    async headers() {
        return [
            {
                source: '/api/:path*',
                headers: [
                    {key: 'Access-Control-Allow-Credentials', value: 'true'},
                    {key: 'Access-Control-Allow-Origin', value: '*'},
                    {key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT'},
                    {
                        key: 'Access-Control-Allow-Headers',
                        value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
                    },
                ],
            },
        ];
    },
};

module.exports = nextConfig;

