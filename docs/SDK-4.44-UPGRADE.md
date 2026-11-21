# SDK 4.44 upgrade plan (parked)

Status: not started. The faces build with SDK 4.33.1 (manifest v1). SDK 4.44 is installed locally but not active (`pebble sdk activate 4.33.1` is the working setting). Tested 2026-11-21 on a scratchpad copy of Aura LCD: it builds on 4.44, and `pebble convert-manifest` finds `Location` plus `Internet` for `api.open-meteo.com` and `geocoding-api.open-meteo.com`. The emulator accepted the app with and without permissions, so only a real watch proves the permissions are enough.

## Why

4.44 adds nothing the faces need (the microphone is for watchapps only, and nothing in the changelog touches battery). Manifest v1 is deprecated and may stop building in a future SDK, so this is about not being caught out later.

## Phase 0: setup

1. Keep 4.44 installed, but release with 4.33.1 until a face is converted.
2. Work on a branch per face (`sdk-444-<face>`), not on main.
3. Check whether CloudPebble (pebble-tool 5.0.39) accepts manifest v2. Essential has a `cloudpebble-essential` deploy branch that would break if it does not.
4. Ask before using the emulator, pass `--vnc` and batch the runs.

## Phase 1: Aura LCD (pilot, 1.6.1)

1. `pebble convert-manifest`, then read the diff. It rewrites `characterRegex` from literal private-use glyphs to `\u` escapes; confirm the glyphs still render.
2. Clean build on 4.44, check the `.pbw` manifest and that the uuid is unchanged.
3. Install on the real Time 2 and run the checklist below.
4. Release as 1.6.1 with the `/pebble-release` steps only after the checklist passes.

## Real-watch checklist (every face)

- Weather loads on a fresh install.
- GPS location works, then city search, then a settings save that refetches at once.
- Forecast and sun times update.
- The Clay settings page opens and saves (untested so far).
- The face renders in native emery mode.

## Phase 2: Essential (1.5.1)

Same recipe. Settle the CloudPebble question first. Also check whether the heart-rate complication needs a permission.

## Phase 3: Sky and Cityscape

They also call `air-quality-api.open-meteo.com` and `opendata.aemet.es`. `convert-manifest` only finds URLs written literally in the JS, so read the provider code for dynamic URLs. Test both Open-Meteo worldwide and AEMET in Spain. Sky first, then Cityscape (they share the provider code).

## Phase 4: wrap-up

Update the toolchain notes in `CLAUDE.md` (the `pebble clean` rule may be obsolete, but only drop it after a rebuild proves it), `docs/DISTRIBUTION.md` and the release skill, add BACKLOG entries per face, then make 4.44 the default.

## Risks

- A missed domain makes weather stop silently on the phone; the checklist is the only guard.
- A v2 app on an old phone app version may not run; the minimum app version is unchecked.
- Rollback is a normal patch release that reverts the manifest.
