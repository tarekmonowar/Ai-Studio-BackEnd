# Backend Voice Gateway

Node TypeScript websocket gateway for Azure VoiceLive.

This backend owns all private integrations and secrets:

- Azure VoiceLive SDK
- API key authentication
- session lifecycle and response cancellation
- audio stream relay between client and Azure

## Source layout

- src/server.ts: bootstrap
- src/app/utils/httpServer.ts: base http server setup
- src/app/config/env.ts: environment parsing and defaults
- src/app/middleware/wsAsyncHandler.ts: async websocket middleware wrapper
- src/app/modules/health/health.router.ts: health route
- src/app/modules/voice/voice.router.ts: websocket route wiring
- src/app/modules/voice/voice.service.ts: Azure session service
- src/app/modules/voice/voice.types.ts: websocket event contracts
- src/app/modules/voice/voice.utils.ts: voice provider config helper

## Environment

Copy .env.example to .env.

Required:

- VOICELIVE_ENDPOINT
- VOICELIVE_API_KEY

## Run

- npm run dev

Health check:

- GET /health

WebSocket endpoint:

- /ws
