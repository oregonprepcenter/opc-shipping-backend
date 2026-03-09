# OPC Shipping Backend

Vercel serverless backend for EasyPost shipping API integration.

## Endpoints

- `POST /api/rates` — Get live shipping rates from all carriers
- `POST /api/buy-label` — Purchase a shipping label
- `POST /api/track` — Track a package

## Deploy to Vercel

1. Go to vercel.com and sign in
2. Click "Add New" → "Project"
3. Import this folder (or connect via GitHub)
4. Add Environment Variable:
   - Key: `EASYPOST_API_KEY`
   - Value: your EasyPost API key
5. Click Deploy

Your backend URL will be something like:
`https://opc-shipping-backend.vercel.app`

Enter this URL in your portal's Integrations page under EasyPost.
