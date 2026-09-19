# Phone and portrait gameplay — deferred plan

This is an audit outline, not an approved implementation design. Start with `design.md` and Jeremy's decisions on devices and performance targets.

1. **Establish the baseline.** Play beginning to credits on the agreed physical phones. Capture chapter framing, touch failures and frame pacing. Reproduce the opening boat issue in viewport emulation. Record each issue with a reliable trigger and severity.
2. **Agree on the design.** Review the findings with Jeremy. Select framing and gesture changes that preserve readable subjects and wind targets. Update the design with concrete acceptance cases before building.
3. **Implement the agreed changes.** Group fixes by shared camera/input behavior and chapter-specific composition. Preserve desktop behavior and avoid compensating for a gameplay issue by merely reducing resolution.
4. **Verify the whole journey.** Repeat physical-device playthroughs, including orientation changes, browser controls, background/resume, interrupted touches, ending and replay. Compare frame pacing and render scale against baseline; run the desktop regression and build checks.
5. **Close out.** Record evidence, unresolved limitations and Jeremy's acceptance. Move completed documentation into the project's durable structure and remove the active backlog entry when appropriate.
