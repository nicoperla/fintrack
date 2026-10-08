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
      // Dynamic segments: a glob, since "[id]" would be read as a character class.
      "/api/ritrovati/pratiche/**": ["./node_modules/pdfkit/js/standard-fonts/**/*"],
      "/api/fascicolo/**": ["./node_modules/pdfkit/js/standard-fonts/**/*"],
    },
  },
  async headers() {
    return [
      {
        // The family file opened from a shared link: never indexed, cached or leaked through
        // the Referer header (the token is in the URL).
        source: "/fascicolo/condiviso/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        // The referee's view of a pact: same rules, the token is in the URL here too.
        source: "/patto/arbitro/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
