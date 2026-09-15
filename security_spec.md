# Peachy Animations Security Specification

## 1. Data Invariants
- An animation document MUST have a `userId` field that matches the authenticated user (`uid`).
- The `id` must be a valid alphanumeric string.
- The `prompt` must be a string between 1 and 1000 characters.
- The `aspectRatio` must be either `'16:9'` or `'9:16'`.
- The `motionStrength` must be a number between 1 and 10.
- The `durationSeconds` must be a number between 4 and 8.
- The `styleFilter` must be a valid string (one of 'none', 'vintage', 'cyberpunk', 'bw', 'vibrant').
- The `createdAt` must be a valid timestamp or a positive number.

---

## 2. The "Dirty Dozen" Payloads (Exploit Scenarios)

### Attack A: Identity Spoofing (Write to another user's account)
- **A1**: User Alice tries to write an animation document where `userId` is set to Bob's UID `bob_uid`.
- **A2**: User Alice tries to create/overwrite a document directly in Bob's animations space.

### Attack B: Value/Type Poisoning (Out of range values)
- **B1**: Alice tries to write a motionStrength of `100` (valid range is 1-10).
- **B2**: Alice tries to write a durationSeconds of `1` or `2` (Veo requires between 4 and 8 on this schema).
- **B3**: Alice tries to write an invalid aspectRatio like `"square"`.
- **B4**: Alice tries to inject a 10MB string into the styleFilter field.

### Attack C: ID Poisoning (Junk characters/Path length limits)
- **C1**: Alice tries to create a document with an ID containing massive weird characters `///&&@*#^@%` or a 10KB path-breaking string.

### Attack D: Temporal / Immutable Compromise
- **D1**: Alice tries to update the `createdAt` of an existing entry to make it appear older or newer.
- **D2**: Alice tries to update `userId` of an existing animation to assign it to Bob.

### Attack E: Blanket Reader Extraction
- **E1**: Bob tries to list all user animations without filtering by `userId` (querying the entire root collection).
- **E2**: Bob tries to perform an unauthenticated read/write to the database.

---

## 3. The Rules Architecture (Draft)
The firestore rules will define helper functions like `isValidAnimation()`, `isSignedIn()`, and use action gates or strict schemas on the write operations.
The final ruleset will be deployed in `firestore.rules`.
