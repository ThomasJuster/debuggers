# ARCHIVED

This project was a POC for [France IOI](https://github/France-ioi). The repo has been moved to the France IOI organization under the name of [codecast-debuggers](https://github.com/France-ioi/codecast-debuggers)

# Debug Adapters

## Pre-requisites

- Docker ([install instructions](https://docs.docker.com/engine/install/))
- Node.JS
- TypeScript: `npm install -g typescript`

## Install

```bash
# Build the app
npm run build:ts

# Unzip lldb (for C/C++ only)
unzip ./vscode-lldb/lldb.zip -d ./vscode-lldb/

# Build the server (for PHP only)
cd ./vscode-php-debug && npm ci && npm run build && cd ..
ls -la vscode-php-debug/out/
# You should see a "phpDebug.js" file

# Build the docker image(s) for adapters you want to use:
npm run build:php # PHP
npm run build:lldb # C/C++
npm run build:python # Python
```

## Usage

```bash
npm run debug ./path/to/file(.c|.cpp|.php|.py)

# Examples:
npm run debug ./samples/c/hello_world.c # For C
npm run debug ./samples/cpp/hello_world.cpp # For C++
npm run debug ./samples/php/hello_world.php # For PHP
npm run debug ./samples/python/hello_world.py # For Python
```

## Re-install LLDB debug adapter server (C/C++ debug adapter)

### Method 1 − Copy files from actual extension

1. Install [codelldb](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb) VSCode extension
2. Go to `~/.vscode/extensions/~/.vscode/extensions/vadimcn.vscode-lldb-[version]`
3. Copy folders `adapter`, `formatters` and `lldb` to `./vscode-lldb`

### Method 2 − Build from repo

1. Pull [repo](https://github.com/vadimcn/vscode-lldb) `git clone https://github.com/vadimcn/vscode-lldb`
2. Check out "Building" [documentation](https://github.com/vadimcn/vscode-lldb) (which did not work for me)
3. Move build result to `./vscode-lldb`

## Re-install PHP debug adapter server

```bash
git clone https://github.com/xdebug/vscode-php-debug vscode-php-debug
cd vscode-php-debug
rm -rf .git/
npm clean-install # install from package-lock
npm run build # Generates out/ folder

# Test that the server can be launched:
node ./out/phpDebug.js --server=4711
```

## Re-install Python debug adapter

Nothing to do, it is already maintained by a Microsoft team ; DebugPy already implements the Debug Adapter Protocol.
