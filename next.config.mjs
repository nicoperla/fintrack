/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // react-pdf is Node-only: load it at runtime instead of bundling it into the route.
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
    // pdfkit loads its standard fonts with a dynamic require ("#standard-fonts/Helvetica")
    // that file tracing can't follow: ship them with the PDF route explicitly.
    outputFileTracingIncludes: {
      "/api/reports": ["./node_modules/pdfkit/js/standard-fonts/**/*"],
      "/api/ritrovati/dossier": ["./node_modules/pdfkit/js/standard-fonts/**/*"],
    },
  },
};

export default nextConfig;
