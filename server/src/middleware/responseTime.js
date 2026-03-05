const responseTime = (req, res, next) => {
  const startedAt = Date.now();
  const originalEnd = res.end;

  res.end = function end(...args) {
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${Date.now() - startedAt}ms`);
    }
    return originalEnd.apply(this, args);
  };

  next();
};

export default responseTime;
