# Document Processor Lambda

The document-processor Lambda (`lambda/document-processor`) is the worker for
the general document processing pipeline: it downloads a document from S3,
converts it to markdown (PDFs via a vision LLM through OpenRouter,
spreadsheets to markdown tables, text files as-is), stores the markdown
artifact back to S3 under `document-markdown/`, chunks and embeds the content
(OpenAI `text-embedding-3-small`), and writes the result to the `documents` /
`document_chunks` tables in PostgreSQL (pgvector).

The backend enqueues work by upserting a `documents` row and sending
`{ "documentId": "<uuid>" }` to an SQS queue. Drive files inside
"Use for chat context" folders are the first source (`source_type = 'drive'`).

```
backend (EC2) --> SQS queue --> Lambda --> S3 (pdf in, markdown out)
      |                           |
      +--> Postgres documents <---+--> Postgres document_chunks (pgvector)
```

## One-time AWS setup

All commands assume the AWS CLI is configured for the production account and
region (`ap-south-1` in the examples; adjust as needed).

### 1. SQS queues

The visibility timeout must be at least the Lambda timeout (900s below).
Failed messages are retried up to 3 times, then land in the DLQ.

```bash
aws sqs create-queue \
  --queue-name inboundr-document-processing-dlq

DLQ_ARN=$(aws sqs get-queue-attributes \
  --queue-url "$(aws sqs get-queue-url --queue-name inboundr-document-processing-dlq --query QueueUrl --output text)" \
  --attribute-names QueueArn --query Attributes.QueueArn --output text)

aws sqs create-queue \
  --queue-name inboundr-document-processing \
  --attributes "{
    \"VisibilityTimeout\": \"900\",
    \"RedrivePolicy\": \"{\\\"deadLetterTargetArn\\\":\\\"$DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"
  }"
```

### 2. IAM role

The function needs: SQS consume on the queue, S3 read/write on the upload
bucket, and CloudWatch logs.

```bash
aws iam create-role \
  --role-name inboundr-document-processor-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name inboundr-document-processor-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam put-role-policy \
  --role-name inboundr-document-processor-role \
  --policy-name document-processor-access \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
        "Resource": "arn:aws:sqs:ap-south-1:YOUR_ACCOUNT_ID:inboundr-document-processing"
      },
      {
        "Effect": "Allow",
        "Action": ["s3:GetObject", "s3:PutObject"],
        "Resource": "arn:aws:s3:::YOUR_UPLOAD_BUCKET/*"
      }
    ]
  }'
```

### 3. Lambda function

Build the bundle first, then create the function. Reserved concurrency bounds
both the number of Postgres connections and vision-model throughput.

```bash
cd lambda/document-processor
bun run build
cd dist && zip lambda.zip index.mjs

aws lambda create-function \
  --function-name inboundr-document-processor \
  --runtime nodejs22.x \
  --handler index.handler \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/inboundr-document-processor-role \
  --zip-file fileb://lambda.zip \
  --memory-size 1024 \
  --timeout 900

aws lambda put-function-concurrency \
  --function-name inboundr-document-processor \
  --reserved-concurrent-executions 10
```

### 4. Environment variables

```bash
aws lambda update-function-configuration \
  --function-name inboundr-document-processor \
  --environment "Variables={
    DB_HOST=your-postgres-host,
    DB_PORT=5432,
    DB_NAME=your-db-name,
    DB_USER=your-db-user,
    DB_PASSWORD=your-db-password,
    S3_UPLOAD_BUCKET=your-upload-bucket,
    OPENAI_API_KEY=sk-your-openai-key,
    OPENROUTER_API_KEY=sk-or-your-openrouter-key
  }"
```

Optional tuning variables (defaults in parentheses):

| Variable | Purpose |
| --- | --- |
| `DOC_MARKDOWN_MODEL` | Vision model for PDF -> markdown (`google/gemini-2.5-flash`) |
| `DOC_MAX_PDF_PAGES` | Max PDF pages processed per document (200) |
| `DOC_PDF_PAGE_BATCH_SIZE` | Pages per LLM request (15) |
| `DOC_LLM_CONCURRENCY` | Parallel LLM requests per document (3) |
| `OPENROUTER_BASE_URL` | OpenRouter endpoint (`https://openrouter.ai/api/v1`) |

### 5. Event source mapping

```bash
aws lambda create-event-source-mapping \
  --function-name inboundr-document-processor \
  --event-source-arn arn:aws:sqs:ap-south-1:YOUR_ACCOUNT_ID:inboundr-document-processing \
  --batch-size 5 \
  --function-response-types ReportBatchItemFailures
```

### 6. Postgres networking

The Lambda connects to the same PostgreSQL instance the backend uses
(`DB_HOST` etc.). Make sure it is reachable:

- Postgres on the EC2 instance / public endpoint: allow inbound 5432 from the
  Lambda's egress (or attach the Lambda to the VPC and open the security group
  to the Lambda's security group).
- Postgres in a private VPC: configure the Lambda with the VPC subnets and a
  security group that the database security group accepts.

`gen_random_uuid()` is built into PostgreSQL 13+; on older versions run
`CREATE EXTENSION IF NOT EXISTS pgcrypto;` once. The tables themselves are
provisioned automatically on first use by both the backend and the Lambda.

### 7. Backend configuration

Add the queue URL to the backend `.env` on EC2 and restart the service:

```
SQS_DOCUMENT_QUEUE_URL=https://sqs.ap-south-1.amazonaws.com/YOUR_ACCOUNT_ID/inboundr-document-processing
```

The backend's IAM principal (instance role or access keys) needs
`sqs:SendMessage` on the queue. When `SQS_DOCUMENT_QUEUE_URL` is unset (local
dev), the backend processes documents in-process instead of using the queue.

## Continuous deployment

`.github/workflows/lambda-deploy.yml` typechecks on every PR touching
`lambda/**` and, on push to `main`, bundles the handler and runs
`aws lambda update-function-code` via
`lambda/document-processor/scripts/deploy.sh`.

Repository configuration used by the workflow:

- Secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
  (already used by the frontend deploy). The IAM user additionally needs
  `lambda:UpdateFunctionCode` on the function.
- Variable (optional): `DOCUMENT_PROCESSOR_FUNCTION_NAME` — defaults to
  `inboundr-document-processor`.

## Migrating existing Drive documents

Existing chat-context files indexed by the old in-process pipeline live in the
legacy `drive_document_chunks` table, which the new search path no longer
reads. After the Lambda is live, re-enqueue everything once:

```bash
cd backend
bun scripts/reindex-drive-documents.ts
```

Once documents show `status = 'completed'` in the `documents` table, the
legacy table can be dropped manually:

```sql
DROP TABLE drive_document_chunks;
```

## Operations

- Document state lives in the `documents` table (`queued`, `processing`,
  `completed`, `failed`, `unsupported`) with `error` populated on failure.
- Messages that fail 3 times land in `inboundr-document-processing-dlq`;
  redrive them from the SQS console after fixing the cause. Reprocessing is
  idempotent (content-hash skip + transactional chunk replacement).
- Generated markdown artifacts are stored at
  `document-markdown/{organizationId}/{documentId}.md` in the upload bucket.
