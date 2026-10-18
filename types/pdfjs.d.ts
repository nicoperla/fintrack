// The minified build of pdf.js has the same API as the regular one. Next 14's webpack chokes on
// the regular build (it clashes with pdf.js's own webpack runtime), so the app loads this one.
declare module "pdfjs-dist/legacy/build/pdf.min.mjs" {
  export * from "pdfjs-dist/legacy/build/pdf.mjs";
}
