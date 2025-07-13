import { tasks } from "@trigger.dev/sdk/v3";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { cors } from "hono/cors";
import type { puppeteerWebpageToPDF } from "./trigger/example";

const app = new Hono();
app.use("/*", cors());

app.get("/", (c) => {
  return c.text("Hello Hono!");
});
app.post("/pdf", bearerAuth({ token: Bun.env.BEARER_TOKEN! }), async (c) => {
  const body = await c.req.json();

  console.log(body);

  const handle = await tasks.trigger<typeof puppeteerWebpageToPDF>(
    "puppeteer-webpage-to-pdf",
    {
      url: body.url,
      name: `${body.name}`,
      user: body.user,
    }
  );

  return c.json({
    message: "Hono Json",
  });
});

export default {
  port: 3002,
  fetch: app.fetch,
};
