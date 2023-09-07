#!/bin/zsh

# For building a linux AppImage

docker run --rm -ti \
  --env-file .env \
  --env ELECTRON_CACHE="/root/.cache/electron" \
  --env ELECTRON_BUILDER_CACHE="/root/.cache/electron-builder" \
  -v ${PWD}:/project \
  -v ${PWD##*/}-node-modules:/project/node_modules \
  -v ~/.cache/electron:/root/.cache/electron \
  -v ~/.cache/electron-builder:/root/.cache/electron-builder \
electronuserland/builder \
pnpm install && pnpm dist
pnpx electron-builder --publish onTagOrDraft
