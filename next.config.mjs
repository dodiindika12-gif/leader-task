/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ['@google-cloud/bigquery'],
  allowedDevOrigins: ['192.168.10.224', 'localhost:3001', 'localhost:3000'],
};

export default nextConfig;
