// Fails a hosted web build that would otherwise silently point at http://localhost:4000.
// EXPO_PUBLIC_* values are inlined at build time, so they must be set where the build runs
// (Netlify: Site configuration → Environment variables).
const url = process.env.EXPO_PUBLIC_API_URL?.trim();
const hosted = process.env.NETLIFY === 'true' || process.env.CONTEXT !== undefined;

if (!url && hosted) {
  console.error(
    '\n✖ EXPO_PUBLIC_API_URL is not set.\n' +
      '  Set it to your Render API URL (e.g. https://fittrack-api.onrender.com) in the\n' +
      '  Netlify site environment variables, then redeploy.\n',
  );
  process.exit(1);
}
if (url && !/^https?:\/\//.test(url)) {
  console.error(`\n✖ EXPO_PUBLIC_API_URL must start with http:// or https:// (got "${url}").\n`);
  process.exit(1);
}
console.log(`Building web app against API: ${url || 'http://localhost:4000 (default)'}`);
