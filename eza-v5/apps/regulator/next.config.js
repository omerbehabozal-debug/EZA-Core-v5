/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Regulator panel runs on separate domain
  basePath: '',
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    REGULATOR_DELAY_HOURS: process.env.REGULATOR_DELAY_HOURS || '0',
  },
}

module.exports = nextConfig

