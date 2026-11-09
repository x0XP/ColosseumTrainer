# Sol Heredit Trainer

An independently maintained fork of [Supalosa's ColosseumTrainer](https://github.com/Supalosa/ColosseumTrainer) for practising the Fortis Colosseum and Sol Heredit encounter in Old School RuneScape.

## About this fork

This is the source repository for our version of the trainer. The aim is to improve the simulation, add useful features and eventually make it available through [x0XP](https://x0xp.github.io/) as a separate tool.

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
