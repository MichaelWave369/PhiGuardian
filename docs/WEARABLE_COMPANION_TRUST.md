# Wearable → Guardian event trust boundary

**State:** host-side relay logic and end-to-end HTTP tests exist; physical BLE/USB transport authorization and user-facing consent controls **do not** exist yet.

## Flow
```text
External wearable bytes (UNTRUSTED)
  -> BLE/USB adapter, still missing:
     - encrypted authenticated peer, bonded device proof or controlled physical USB policy
     - device alias bound to that verified peer, not an untrusted packet claim
     - live link state and explicit per-device user consent / revocation
  -> WearableRelay.receive(packet, connectionContext)
     - strict allowlisted packet parse
     - external transport verifier runs EACH time (fail closed)
     - independent host consent checker runs EACH time (fail closed)
     - bounded in-process duplicate filter + normalized Guardian event
     - bounded in-flight POST to strictly loopback Guardian API, with host-only token
  -> POST /api/events
     - 202 accepted=true -> stored in Guardian volatile memory, not alerted to a person
     - 202 accepted=false -> not stored (duplicate/stale/capacity policy)
     - 401/403 -> host authorization rejected
     - network failure -> unavailable, not delivered
```

### Why the gate callbacks matter
A caller-provided `session.trusted=true`, a matching device alias, or data from an open BLE characteristic **must not** establish authentication. The next adapter must produce independent evidence from the OS BLE/USB transport, enforce pairing/bonding policy, and bind the actual authenticated peer to its owner-approved alias. A mock callback that returns `true` **is only acceptable in tests**. A wearable without an authenticating display or secure out-of-band mechanism may not achieve MITM-resistant pairing; encryption alone does not prove the wearer or device is genuine. See vendor guidance before choosing provisioning hardware.

An operator-controlled consent service must store approvals securely, display sensor state, support revocation, and terminate transport sessions after revocation. Consent cannot be supplied by the wearable's own packet.

The local Guardian `GUARDIAN_INGEST_TOKEN` is a **host credential**; never embed it in firmware or advertise it over BLE. The relay refuses remote hosts and non-loopback HTTP URLs. No plaintext LAN listener is provided.

### Delivery semantics
The relay's `stored` state means only that the local Guardian event store accepted the normalized event. It says **nothing** about an audio/haptic warning, phone notification, emergency dispatch, or external receipt. A manual SOS on the wearable still means *local button acknowledgment only*. Avoid presenting the status as "help contacted."

The relay has **no automatic retry queue**: connection failure or server loss drops the one-shot attempt. This prevents an unreviewed backlog or misleading stale alert, but also means real events may be lost. Retrying must be designed later with a bounded expiry, stable event IDs, reliable authenticated transport, acknowledgment, consent rechecks and explicit UI warnings.

The translator's replay filter is volatile and bounded. It is NOT persistent cryptographic anti-replay. Bounded in-flight requests limit overload, but do not constitute abuse prevention or complete backpressure control.

### Tests
`npm test` includes `tests/relay.test.mjs` which starts a real loopback Node HTTP Guardian API and checks storage, token rejection, untrusted/malformed packets, consent revocation, duplicate detection, unsuccessful acknowledgments, network failure, and concurrency bounds. These use **test stubs** for BLE authentication/consent and do not demonstrate secure over-the-air pairing.

### Security requirements before deployment
- [ ] MITM-resistant device provisioning feasible with selected hardware and user UX.
- [ ] OS/device authentication and bonding policy with verified peer-to-alias binding.
- [ ] User-visible consent request + revocation (with closing sessions and removing keys).
- [ ] Signed/validated firmware/update chain and compromised-device handling.
- [ ] Lock down the Guardian core API for multiuser service beyond localhost.
- [ ] Real wearables, battery profiles, correct sensor fault behavior and environmental validation.
- [ ] Explicit UX for link down, API offline, not stored, and no emergency contact.
- [ ] No person-dangerousness judgments, biometric profiling, or covert recording.
