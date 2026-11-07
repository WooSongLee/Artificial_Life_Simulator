# Session — STEP 21–22

## North star

1. **Lab human looks like a real person** under close cam (capsule/sphere collage = fail).
2. **Natural behavior change** from learning: survival ↔ human-like choices visibly shift. Prove with `npm run lab:probe` (Learning vs Frozen). Ecology untouched. No PPO. No emotion meters.

## How to think (be creative)

You are not a ticket robot. Each session: **ask what would make this feel more human / learn better**, then ship one bold vertical slice.

Creative levers (pick what fits Next Task — invent better ones if justified):

- **Human presence:** GLTF/`useGLTF`/drei humans, better materials, hair, clothing, face, hands, soft shadows, close-cam framing — whatever makes “that’s a person” win.
- **Body language:** motion that reads intention (tired→rest, curious→lookout, hungry→eat) — not robotic limb math for its own sake.
- **Space as teacher:** rooms/zones/props that *invite* human-like choices (rest nook, window/lookout, table, soft light). If the arena fights learning, redesign Lab space/props (Ecology stays sacred).
- **Objects with meaning:** interactables that afford rest/curiosity/comfort vs survival pressure — clearer cues, better placement, feedback when used.
- **Learning signal:** observation features, rewards, shaping, curricula so the agent *can* discover human-like policy. If probe shows no lift, change the learning loop — don’t decorate charts.
- **Readability:** viewer should *see* the change (motion + trajectory), not only numbers.

Constraints: Ecology mode/render/sim paths stay intact unless task explicitly needs a shared bugfix. Prefer ≤6 files. No fake data.

## Do

1. Read Next Task — interpret the *intent*, not just the wording. Improve the idea if you see a stronger human/learning move.
2. Implement one slice.
3. `npm run lab:probe` when learning or Lab space/props change; always `npm test` + `npm run build`.
4. Update checkpoint: Next Task ← next Queue line (delete used). Optionally refine remaining Queue if you discovered a better path toward the north star (keep ≤8 lines, same goals).
5. Mark STEP Done in SPEC only when Done criteria truly hold. Short replies.
