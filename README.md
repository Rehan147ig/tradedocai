# TradeDocAI

TradeDocAI is a SaaS MVP for cross-border e-commerce sellers. Users upload a digital PDF invoice, the app extracts trade fields, validates common customs issues, and returns a compliance report.

## What is built

- Next.js app with landing, pricing, auth, dashboard, upload, document detail, and settings pages
- Prisma database with users, documents, subscriptions, and storage tracking
- Plan limits for document count, storage capacity, and retention windows
- PDF upload with magic-byte file validation and 20MB max file size
- NVIDIA NIM-compatible AI provider using `NVIDIA_API_KEY`
- Local fallback parser so the MVP runs before AI keys are added
- Paddle checkout/webhook placeholders for Merchant of Record billing

## Setup

1. Install dependencies:

```bash
npm install
```

If npm hangs in this OneDrive folder, move the project to a normal local path such as `C:\Projects\tradedocai` and run the same command there. This environment can read files here, but shell-based file creation is currently failing, which prevents npm from creating `node_modules`.

2. Create your environment file:

```bash
cp .env.example .env
```

3. Generate the Prisma client and create the local SQLite database:

```bash
npm run db:generate
npm run db:push
```

4. Start the dev server:

```bash
npm run dev
```

5. Open:

```text
http://localhost:3000
```

## AI key

For the MVP, the app works without an AI key by using a local fallback parser. Set `AI_PROVIDER` to `nvidia`, `gemini`, or `openai`.

For full extraction with NVIDIA, create a NVIDIA API key from build.nvidia.com and set:

```env
AI_PROVIDER="nvidia"
NVIDIA_API_KEY="your-key"
```

For the lowest paid processing cost, use Gemini Flash-Lite:

```env
AI_PROVIDER="gemini"
GEMINI_API_KEY="your-key"
GEMINI_MODEL="gemini-2.5-flash-lite"
```

For stronger JSON reliability on difficult invoices, use OpenAI:

```env
AI_PROVIDER="openai"
OPENAI_API_KEY="your-key"
OPENAI_MODEL="gpt-4.1-mini"
```

## Paddle

Paddle is the right direction for an India-based SaaS selling to UK/EU customers because it can act as Merchant of Record. Create sandbox products for Starter, Pro, and Broker, then add the price IDs to `.env`.

The checkout route is intentionally left as a safe integration shell until real Paddle sandbox credentials and product IDs exist.
