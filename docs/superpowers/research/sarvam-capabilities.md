# Sarvam AI Capability Verification — Plan 1 Task 0.2

**Date:** 2026-05-11
**Sources:**
- https://www.sarvam.ai/products/conversational-agents (Samvaad product page)
- https://docs.sarvam.ai/api-reference-docs/introduction
- https://docs.sarvam.ai/api-reference-docs/api-guides-tutorials/text-to-speech/rest-api
- https://docs.sarvam.ai/api-reference-docs/integration/build-voice-agent-with-pipecat
- https://www.plivo.com/docs/voice-agents/audio-streaming/integration-guides/pipecat/sarvam-openai

## Headline finding: Sarvam is components, not a managed voice bot

**Sarvam does NOT expose a managed outbound voice bot product.** There is no `/voice-bot/start` HTTP endpoint that places a call, runs a conversation, and sends webhook events on turns and call-end. The plan's `SarvamProvider` skeleton (Task 2.3) assumes such an endpoint exists. It does not.

What Sarvam actually offers:
- **Speech-to-Text (STT)** — `saarika:v2.5` (transcription) and `saaras:v3` (transcribe / translate / verbatim / translit / codemix). REST + streaming via WebSocket.
- **Text-to-Speech (TTS)** — `bulbul:v2`, `bulbul:v3`, `bulbul:v3-beta`. 30+ voice IDs. 11 languages.
- **Chat Completion** — Sarvam LLM (alternative to OpenAI/Anthropic for the conversation logic).
- **Translation, Transliteration, Language Identification** — supporting APIs.
- **Samvaad** is positioned as a "conversational AI platform" but the docs describe it as the combination of the above components plus integration patterns — not as a black-box managed bot.

The Plivo + Sarvam + OpenAI integration guide makes the actual architecture explicit: you bring your own telephony, you orchestrate the audio pipeline, you bring your own LLM. Sarvam fits in as the STT/TTS layer.

## What this means for our architecture

We must replace the plan's `SarvamProvider` with a **composite provider**:

```
Outbound dial            → Plivo (or Twilio/Exotel) — handles PSTN/cellular
Audio transport          → Plivo Media Streams (WebSocket) to our orchestration service
Orchestration loop       → Pipecat (Python sidecar) OR our own Deno/Node loop
  Pipeline: audio in → Sarvam STT → Claude Sonnet → Sarvam TTS → audio out
Webhooks for call events → Plivo's REST callbacks (call_started, hangup, recording_ready)
```

Recommended stack:
- **Telephony:** Plivo (India + US, has documented Sarvam integration). Exotel as India-specific alternative.
- **Orchestration:** Pipecat (Python). Run as a sidecar service on Modal, Fly.io, or Render. The Edge Function dials via Plivo's API and points Plivo's Media Stream at our Pipecat service.
- **STT:** Sarvam streaming WebSocket (`saarika:v2.5` for Indian languages).
- **LLM:** Anthropic Claude Sonnet (already in our stack for content). Sarvam Chat Completion as fallback.
- **TTS:** Sarvam REST API (`bulbul:v3`).

Alternative: **LiveKit Agents** (TypeScript-native, would avoid the Python sidecar). Worth a 1-day spike when Task 2.3 starts. Pipecat's documented Sarvam integration is a real time-to-MVP advantage; LiveKit may require building the Sarvam STT/TTS bindings.

## Concrete API details

### TTS — POST `https://api.sarvam.ai/text-to-speech`

- **Auth header:** `api-subscription-key: <key>`
- **Sample rates:** 8 kHz to 48 kHz. Defaults to 24 kHz. **48 kHz available in v3 REST only.**
- **Output formats:** WAV, MP3, Linear16, Mulaw, Alaw, Opus, FLAC, AAC.
- **Voices:** 30+ named voices in Bulbul v3. Sample IDs:
  - Male: Shubh, Aditya, Rahul, Rohan, Amit, Dev, Ratan, Varun, Manan, Sumit, Kabir, Aayan, Ashutosh, Advait, Anand, Tarun, Sunny, Mani, Gokul, Vijay, Mohit, Rehan, Soham.
  - Female: Ritu, Priya, Neha, Pooja, Simran, Kavya, Ishita, Shreya, Roopa, Tanya, Shruti, Suhani, Kavitha, Rupali.
- **Languages confirmed:** Hindi, Bengali, Tamil, Telugu, **Kannada**, Malayalam, Marathi, **Gujarati**, Punjabi, Odia, English (Indian accent).
- **Voice ↔ language mapping** is NOT in docs. We need to test which voices sound natural in Kannada vs Gujarati. **Susheela's voice candidates** (warm, Indian-female, named for a grandmother): Ritu, Priya, Suhani, Kavitha, Shruti. Test in K/G/E during Task 2.3 spike.

### STT — `saarika:v2.5` for transcription; streaming via WebSocket

- Auth: same `api-subscription-key`.
- Streaming endpoint exists; spec details require Task 2.3 implementer to verify per current docs.
- Languages: same set as TTS, including Kannada and Gujarati.
- **Sample-rate matching is critical** — Sarvam docs explicitly warn: "both sample rate values must match your audio's actual sample rate. Mismatched sample rates will result in poor transcription quality or errors." Plivo Media Streams default to 8 kHz μ-law for PSTN. We must explicitly configure higher sample rates where possible, or up-sample/down-sample carefully.

### Voiceprint / speaker verification

**Sarvam does NOT expose a voiceprint or speaker-verification API.** Plan's HuggingFace pyannote approach stays in MVP.

### Pricing

Not published. Contact sales. **Action item: get pricing per minute (STT + TTS combined) for K/G/E before Plan 1 ships, to validate unit economics against the ₹299/₹699 India tiers in the spec.**

## Archival audio for cloning

Plivo records the full call when configured (`record=true` in the call API or via call API settings). Recording URL is delivered in Plivo's `RecordCallback` webhook. **Archival audio quality:** Plivo records at the PSTN/cellular line rate — typically 8 kHz μ-law on India PSTN, which is **below the 16 kHz threshold our spec sets for voice-cloning eligibility**.

This is a real constraint. Options:
1. Accept 8 kHz archival audio at MVP — voice cloning quality will be limited; document the constraint.
2. Capture the *outbound TTS audio* (Susheela's side) at full quality from Sarvam, separately from the call recording. Useful only for verifying Susheela's audio, not the elder's.
3. Use Plivo Media Streams + WebRTC bridge to capture higher-fidelity audio (16 kHz) — requires customer-side WebRTC, won't work for elder on a cellular phone.

**Recommendation:** Accept 8 kHz archival at MVP. Note in the spec's TBD that high-fidelity voice cloning is a Phase 2 problem and requires either (a) higher-quality phone audio path or (b) deliberately recording the elder on a higher-quality channel for voice samples. The voiceprint *verification* feature still works on 8 kHz audio — pyannote's speaker-embedding models are robust to low sample rates.

## Webhook events (Plivo, not Sarvam)

Since Plivo handles telephony, the events the orchestrator subscribes to are Plivo's:
- `answer` — call connected, audio stream starts.
- `hangup` — call ended (includes duration, cost, hangup cause).
- `RecordCallback` — when call recording is uploaded and ready.
- `MachineDetection` — voicemail / human / unknown classification.

Sarvam's role in the loop is via WebSocket streaming for STT (real-time transcripts) and REST for TTS (synthesized chunks). Per-turn "events" in our model are produced by the orchestration layer (Pipecat) detecting end-of-turn from STT silence — they don't come from Sarvam directly.

## Plan revisions required

These belong in Plan 1 before the relevant tasks start:

1. **Task 2.3 (SarvamProvider) rework.** The provider can no longer be a thin HTTP shim. It must compose Plivo + Sarvam + LLM. Re-spec as a **CallingService** that orchestrates the components. The composition itself may run as a sidecar; in that case the SDK-side `Provider` interface stays the same but `startCall` calls our Pipecat service, not Sarvam directly.

2. **Phase 2 architecture decision needed.** Pipecat (Python sidecar) vs LiveKit Agents (TypeScript) vs build-our-own. Recommendation: Pipecat sidecar for MVP because of documented Sarvam integration. Revisit when scale demands.

3. **Phase 6 (call-orchestrator) webhook shape changes.** Webhooks come from Plivo, not Sarvam. Event names and payload shapes must match Plivo's `<Hangup>`, `<MachineDetection>`, `<RecordCallback>` structure. Internal turn events still come from Pipecat → our service.

4. **Audio fidelity TBD update.** Spec §8 audio fidelity policy assumed 16 kHz archival. Reality is 8 kHz from PSTN. Update the spec's voice cloning eligibility criteria; flag as a Phase 2 problem.

5. **Add new dependency (and infra cost) to the plan:** Pipecat sidecar service. Modal or Fly.io deployment. Add the orchestrator service to `apps/orchestrator/` (Python) as a Plan 1.5 task before Task 2.3 or as part of Task 2.3.

## Open questions for Sarvam team

These need to be resolved by emailing sales@sarvam.ai or via their Discord:

1. Pricing per minute for STT streaming (`saarika:v2.5`) in Kannada and Gujarati.
2. Pricing per 1k characters for TTS (`bulbul:v3`) in Kannada and Gujarati.
3. Is there an enterprise SLA on streaming STT latency? (P95 first-token latency target.)
4. Voice ID recommendations for warm, elder-coded grandmother voice in Kannada and Gujarati specifically. Ask if Sarvam can share audio samples per voice per language.
5. Custom voice cloning — does Sarvam offer it? If yes, what's the data and consent requirement? (Important for Phase 2 of our plan.)
6. Is there an option to capture the elder's audio at higher than PSTN line rate? (E.g., a WhatsApp-based delivery alternative for elders who use WhatsApp.)

## Action items before Task 2.3 starts

- [ ] Email Sarvam sales for pricing + voice recommendations (above).
- [ ] Decide Pipecat vs LiveKit vs build-own. Recommend Pipecat for MVP.
- [ ] Add Pipecat sidecar service scaffold task to Plan 1.
- [ ] Update Plan 1 Task 2.3 with the composite architecture.
- [ ] Update spec §8 audio fidelity to acknowledge 8 kHz PSTN reality.
