#!/bin/zsh
cd "$(dirname "$0")"
export PATH="/Users/wangpinyuan/.nvm/versions/node/v20.20.2/bin:$PATH"
exec npm run dev
