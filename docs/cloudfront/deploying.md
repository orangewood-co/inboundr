# CloudFront + Vite SPA Routing

## Problem

Accessing frontend routes directly (e.g. `/forms`, `/dashboard`, `/settings`) returned:

```xml
<Error>
  <Code>AccessDenied</Code>
  <Message>Access Denied</Message>
</Error>
```

while the root path (`/`) loaded correctly.

## Cause

Vite applications are Single Page Applications (SPAs). Routes such as `/forms` are handled by the client-side router and do not exist as actual files in S3.

When a user directly visits `/forms`, CloudFront attempts to fetch a corresponding file from S3. Since the file does not exist, S3 returns a 403/404 error.

## Solution

Configure CloudFront Custom Error Responses:

| Error Code | Response Page Path | Response Code |
| ---------- | ------------------ | ------------- |
| 403        | `/index.html`      | 200           |
| 404        | `/index.html`      | 200           |

This ensures all unknown routes are served by `index.html`, allowing the Vite router to handle navigation.

## Notes

* Required for React Router, Vue Router, and other SPA routing solutions.
* Root URL (`/`) may work even when deep links fail.
* Any new frontend route will work automatically once this configuration is in place.
