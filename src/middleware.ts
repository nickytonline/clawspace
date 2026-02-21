import { defineMiddleware } from "astro:middleware";

// Always serve fresh content (no caching)
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  // Set no-cache headers for all responses
  response.headers.set("Cache-Control", "no-store, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
});
