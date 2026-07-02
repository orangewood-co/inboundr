This directory contains the Lambda functions for inboundr.
Each Lambda function is in a separate directory.

| Function | Purpose | Deployment |
| --- | --- | --- |
| `document-processor` | General document processing pipeline: S3 document -> markdown (vision LLM for PDFs) -> chunks + embeddings in pgvector. Consumes the SQS document queue. | [docs/deployment/lambda-document-processor.md](../docs/deployment/lambda-document-processor.md) |
