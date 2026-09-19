# Ember artwork

Runtime asset: `ember-orb.webp` (512×512, 10,478 bytes). Keep `ember-orb.png` as the source artwork;
only the WebP is imported by the game. The veil shader reads RGB for colour variation and generates
opacity procedurally, so the runtime image does not need the source alpha channel. Regenerate with:

```sh
cwebp -q 85 -noalpha -m 6 -resize 512 512 assets/fx/ember-orb.png -o assets/fx/ember-orb.webp
```

Generated with the built-in imagegen tool from `assets/art-direction/wood-ember.png`.
Final prompt:

Use case: stylized-concept. Asset type: single game VFX sprite texture for additive blending. Use the attached approved reference, specifically the enlarged orb at upper right, as the exact art direction. Create ONE isolated circular orb of wispy light on perfectly flat pure BLACK #000000 background. No scene, no character, no ground, no ground reflection, no text, no layout. Match the painted translucent peach and honey silk-like light veils curling across and around a small luminous golden heart. Preserve its circular round airy silhouette and overlapping broad tapering translucent wisps, plus two fine escaping curls. NOT a ball of fire, not an atom diagram, not concentric rings, not wire loops, not a smooth glass ball. No floating sparks outside the body; those are rendered separately in the game. The heart MUST sit exactly at the center of a square canvas (50%,50%). Orb circular main body occupies 60% of canvas width, centered; escaping wisps stay inside 12% margins. Let every edge softly fade to absolute black; all canvas corners and margins perfectly black. Hand-painted dreamy high-quality game artwork, closely reproduce the reference orb rather than inventing a new design. Square 1024x1024.
