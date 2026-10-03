# Updraft

![Updraft: a child in a yellow raincoat sits on a grassy cliff with a young swan in her satchel, watching a paper plane fly out over a sea of small islands.](docs/images/updraft-header.jpg)

A little girl finds herself on an island far from home, with winter on the way. Together with a young swan, she sets
out to find the way home.

You are the wind. Lift her paper plane and she will follow it across the sea, through autumn woods and up into the
clouds. The swan trusts her, and the days are getting shorter. When the way goes dark, she will have to be brave for
both of them.

A wordless journey home, played with nothing but the movement of your hand.

Play it in your browser at [updraft.jeremyvun.com](https://updraft.jeremyvun.com).

![Twelve painted rooms from the journey, from a grey winter shore to a jetty at home.](docs/images/updraft-chapters.jpg)

<p>
  <img width="49%" src="docs/images/updraft-washing.jpg" alt="The child walks through tall grass towards a long line of white sheets drying in the wind.">
  <img width="49%" src="docs/images/updraft-little-boats.jpg" alt="The child and the young swan walk beside a winding stream where toy sailboats drift.">
</p>
<p>
  <img width="49%" src="docs/images/updraft-piano.jpg" alt="The child plays a piano on a hilltop while colour spreads from it across a grey island.">
  <img width="49%" src="docs/images/updraft-birches.jpg" alt="The child walks through a golden birch wood with a red ribbon winding between the trees.">
</p>
<p>
  <img width="49%" src="docs/images/updraft-stairs.jpg" alt="The child holds the young swan beneath carpeted staircases floating in a lilac sky.">
  <img width="49%" src="docs/images/updraft-drowned-village.jpg" alt="A red-sailed boat passes the rooftops and bare trees of a drowned village at sunset.">
</p>
<p>
  <img width="49%" src="docs/images/updraft-sleeping-island.jpg" alt="Under a starry sky, the child walks towards a glowing fireplace, lamp and chairs standing in a field.">
  <img width="49%" src="docs/images/updraft-sky-mirror.jpg" alt="The child walks across still water that mirrors pink sunset clouds, with a lantern and a kite ahead.">
</p>

## How to play

- Move the pointer with a mouse or trackpad, or swipe on a touchscreen, to make a gust.
- Trace circles to raise an updraft.

Play with sound on: the music responds to the wind. Progress saves at checkpoints in your browser, so choose
**Continue** when you come back.

## Run locally

You need Node.js 24 or newer, npm and Git.

```sh
git clone https://github.com/JeremyVun/Updraft.git
cd Updraft
npm ci
npm run dev
```

Open [127.0.0.1:5230](http://127.0.0.1:5230/) and choose **Begin**.

To check types, build the game and preview the production build:

```sh
npm run typecheck
npm run build
npm run preview
```

The build goes to `dist/`, and the preview command prints its local address.

Production builds ignore the QA URL switches (`?shot`, `?chapter=` and the others) and leave out the debugging tools.
To use them, run the dev server or an optimised QA build:

```sh
npm run build:qa
npm run preview:qa
```

The QA build goes to `dist-qa/`. Deployment always builds and uploads the production `dist/`.

## License

[MIT](LICENSE) © 2026 Jeremy Vun.

Three.js is also MIT-licensed. Its copyright and licence text are in the
[third-party notices](public/THIRD_PARTY_NOTICES.txt), which ship with the built game.
