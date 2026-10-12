-- Extra databases for the API integration tests and the Playwright e2e suite, so
-- `docker compose up -d db` is all a contributor needs before `npm test`.
CREATE DATABASE fittrack_test;
CREATE DATABASE fittrack_e2e;
