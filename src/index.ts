import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { cors } from "hono/cors";
import puppeteer from "puppeteer-core";
import Browserbase from "@browserbasehq/sdk";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { drizzle } from "drizzle-orm/libsql/http";
import { articleTable } from "./db/schema";

const db = drizzle({
  connection: {
    url: "libsql://archive-mvaodhan.aws-us-west-2.turso.io",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});

const bb = new Browserbase({
  apiKey: process.env.BROWSERBASE_API_KEY,
});

// Initialize S3 client
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_BUCKET_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.CLOUDEFLARE_SECRET_ACCESS_KEY ?? "",
  },
});

const app = new Hono();
app.use("/*", cors());

app.get("/", (c) => {
  return c.text("Hello Hono!");
});
app.post(
  "/pdf",
  bearerAuth({ token: process.env.BEARER_TOKEN! }),
  async (c) => {
    const payload = await c.req.json();
    const session = await bb.sessions.create({
      projectId: "c31b8827-cd50-4595-b3d6-9609a92715e1",
    });
    // Connect to the session
    const browser = await puppeteer.connect({
      browserWSEndpoint: session.connectUrl,
    });
    const page = await browser.newPage();
    const response = await page.goto(payload.url);
    const url = response?.url() ?? "No URL found";

    // Generate PDF from the web page
    const generatePdf = await page.pdf();

    await browser.close();

    // Upload to R2
    const s3Key = `${payload.user}/${payload.name}`;
    const uploadParams = {
      Bucket: "archive",
      Key: s3Key,
      Body: generatePdf,
      ContentType: "application/pdf",
    };

    // Upload the PDF to R2 and return the URL.
    await s3Client.send(new PutObjectCommand(uploadParams));
    const s3Url = `${process.env.CLOUDFLARE_BUCKET_ENDPOINT}/${s3Key}`;

    await db
      .insert(articleTable)
      .values({ title: payload.name, url: s3Url, userID: payload.user });

    return c.json({
      message: "bb triggered",
    });
  }
);

export default {
  port: 3002,
  fetch: app.fetch,
};
