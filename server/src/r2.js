import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const Bucket = process.env.R2_BUCKET;

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  // newer SDK versions add checksum headers that R2 presigned URLs reject
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

export const presignUpload = (Key, ContentType, ContentLength) =>
  getSignedUrl(s3, new PutObjectCommand({ Bucket, Key, ContentType, ContentLength }), {
    expiresIn: 900,
  });

export const presignDownload = (Key, filename) =>
  getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket,
      Key,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    }),
    { expiresIn: 300 }
  );

export const headObject = async (Key) => {
  try {
    return await s3.send(new HeadObjectCommand({ Bucket, Key }));
  } catch (e) {
    if (e.$metadata?.httpStatusCode === 404 || e.name === 'NotFound') return null;
    throw e;
  }
};

export const deleteObject = (Key) => s3.send(new DeleteObjectCommand({ Bucket, Key }));
