// Runs before any test file imports application code (src/config/env.ts reads process.env at import time).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123456';
process.env.JWT_ISSUER = 'doctor-tracker-api';
process.env.JWT_AUDIENCE = 'doctor-tracker-web';
process.env.JWT_EXPIRES_IN_MINUTES = '60';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/doctor_tracker_test';
process.env.COOKIE_SAMESITE = 'lax';
process.env.COOKIE_SECURE = 'false';
