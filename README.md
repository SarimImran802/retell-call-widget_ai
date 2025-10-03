# Retell AI Webcall Embed Widget

A minimal embeddable widget (floating button + modal) that starts a Retell AI webcall. Designed to be embedded inside Wix via iFrame/Embed HTML.

## Features
- Floating call button that opens a compact call modal
- Start/stop call UX; requests a server to create a Retell session
- Plain JS/CSS, no build tools
- Express backend stub to proxy Retell API securely

## Quick start (local)
1. Install deps
```bash
npm install
```
2. Run the server
```bash
npm run dev
```
3. Open `http://localhost:3000` and click the floating button.

## Configure Retell proxy (server)
Implement the actual Retell API call inside `server.js` in the `/api/retell/start` handler. Example pseudocode:
```js
// server.js (inside /api/retell/start)
const retellResponse = await fetch('https://api.retell.ai/v1/webrtc/sessions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ agentId: 'YOUR_AGENT_ID', userId })
});
const data = await retellResponse.json();
return res.json({ client_token: data.client_token, session_id: data.session_id });
```
Set environment variables when deploying:
- `RETELL_API_KEY`
- optional `USE_MOCK_TOKEN=true` for frontend demo without Retell

## Deploy options
- Render, Fly.io, Railway, Vercel (Node server), Heroku, or any Node host.
- Ensure the domain is HTTPS (Wix blocks mixed content and mic access requires HTTPS).

## Embed into Wix (indirect)
You cannot run this natively in Wix, so embed it via iFrame:

1) Deploy your widget and get a public URL, e.g. `https://your-app.com`
2) In Wix Editor:
- Add ➜ Embed ➜ Embed a Site
- Choose iFrame/website embed
- Set URL to your deployed app URL
- Resize to a small rectangle; the widget uses a floating button so size isn’t critical

Alternative: Embed custom code snippet
- Add ➜ Embed ➜ Custom Embeds ➜ Embed a Widget ➜ iFrame
- Paste this minimal HTML to point to your widget:
```html
<iframe src="https://your-app.com" style="width:100%;height:600px;border:0;" allow="microphone *; camera *; autoplay *"></iframe>
```

Important permissions
- In Wix, ensure the iFrame `allow` attribute includes `microphone`, `camera`, and `autoplay`
- Your site and widget must be served over HTTPS

## Configure frontend to call your backend
If you host the frontend and backend under different domains, set in the page where you embed (optional):
```html
<script>
  window.RFT_BACKEND_URL = 'https://api.your-app.com';
</script>
```
By default the widget calls `/api/retell/start` on the same origin.

## Wiring actual audio to Retell
This starter only acquires the mic and shows connection state. To connect audio to Retell WebRTC:
- Use the Retell-provided client SDK or WebRTC offer/answer flow
- After fetching `client_token`, create/join the room/peer connection as per Retell docs
- Attach `mediaStream` tracks to the peer connection and handle inbound audio

Keep the token creation on the server. Never expose your `RETELL_API_KEY` in the browser.

## Customize
- Update styles in `public/styles.css`
- Change button emoji/text in `public/widget.js`
- Replace modal copy with your brand

## Troubleshooting
- If the modal says "Server not configured", your `/api/retell/start` returns 501. Implement the Retell API call and ensure `RETELL_API_KEY` is set.
- Mic blocked: ensure HTTPS and browser permissions, plus `allow` attributes on the iFrame.
- CORS: server enables CORS by default; restrict origins as needed in production.
