export default () => ({
  nodeEnv: process.env.NODE_ENV,
  port: Number(process.env.PORT),
  frontendOrigin: process.env.FRONTEND_ORIGIN,
  timezone: process.env.APP_TIMEZONE,
  throttle: {
    ttlMs: Number(process.env.THROTTLE_TTL_MS),
    limit: Number(process.env.THROTTLE_LIMIT),
  },
});
