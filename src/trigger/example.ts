import { logger, task } from "@trigger.dev/sdk/v3";
import puppeteer from "puppeteer";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { drizzle } from "drizzle-orm/libsql/http";
import { articleTable } from "../db/schema";

const db = drizzle({
  connection: {
    url: "libsql://archive-mvaodhan.aws-us-west-2.turso.io",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
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

export const puppeteerWebpageToPDF = task({
  id: "puppeteer-webpage-to-pdf",
  run: async (payload: { url: string; name: string; user: string }) => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const response = await page.goto(payload.url);
    const url = response?.url() ?? "No URL found";

    // Generate PDF from the web page
    const generatePdf = await page.pdf();

    logger.info("PDF generated from URL", { url });

    await browser.close();

    // Upload to R2
    const s3Key = `${payload.user}/${payload.name}`;
    const uploadParams = {
      Bucket: "archive",
      Key: s3Key,
      Body: generatePdf,
      ContentType: "application/pdf",
    };

    logger.log("Uploading to R2 with params", uploadParams);

    // Upload the PDF to R2 and return the URL.
    await s3Client.send(new PutObjectCommand(uploadParams));
    const s3Url = `${process.env.CLOUDFLARE_BUCKET_ENDPOINT}/${s3Key}`;
    logger.log("PDF uploaded to R2", { url: s3Url });

    await db
      .insert(articleTable)
      .values({ title: payload.name, url: s3Url, userID: payload.user });

    return { pdfUrl: s3Url };
  },
});
