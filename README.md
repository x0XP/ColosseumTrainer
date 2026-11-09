# Sol Heredit Trainer

An independently maintained fork of [Supalosa's ColosseumTrainer](https://github.com/Supalosa/ColosseumTrainer) for practising the Fortis Colosseum and Sol Heredit encounter in Old School RuneScape.

**Play:** [Open on x0XP](https://x0xp.github.io/#sol-trainer) or [open full screen](https://x0xp.github.io/ColosseumTrainer/).

## About this fork

This repository contains the editable source for our version of the trainer. We maintain it independently and publish the simulator through [x0XP](https://x0xp.github.io/#sol-trainer).

Trainer development will stay here, independent of the main x0XP website.

## Development

The trainer uses TypeScript, React, Three.js and the OSRS SDK. It requires **Node.js 20** and compatible OSRS SDK and cache-reader dependencies. See [assets.md](assets.md) for the full asset setup.

Once the dependencies and asset tools are configured:

```bash
npm ci
npm run assets
npm run start
```

Build the static application with:

```bash
npm run build
```

The build output is written to `dist/`. Generated OSRS cache assets are required for the trainer to run correctly.

## Credits and licence

The original trainer was created by **[Supalosa](https://github.com/Supalosa/ColosseumTrainer)**. This fork is maintained independently and is not an official Jagex project.

The original project's [GNU General Public License v3.0](LICENSE) and applicable copyright notices are retained. RuneScape and its game assets belong to Jagex.
