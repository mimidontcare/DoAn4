export default () => ({
  nodeEnv: process.env.NODE_ENV,
  port: Number(process.env.PORT),
  frontendOrigin: process.env.FRONTEND_ORIGIN,
  timezone: process.env.APP_TIMEZONE,
  throttle: {
    ttlMs: Number(process.env.THROTTLE_TTL_MS),
    limit: Number(process.env.THROTTLE_LIMIT),
  },
  auth: {
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
    jwtAccessTtl: process.env.JWT_ACCESS_TTL,
    refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS),
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS),
    throttleTtlMs: Number(process.env.AUTH_THROTTLE_TTL_MS),
    throttleLimit: Number(process.env.AUTH_THROTTLE_LIMIT),
  },
});
