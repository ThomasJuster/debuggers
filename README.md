# Debug Adapters

## Install

1. Install Docker ([instructions here](https://docs.docker.com/engine/install/))
2. (For C/C++ only) Unzip lldb `unzip ./vscode-lldb/lldb.zip -d ./vscode-lldb/`

## Usage

```bash
npm run build:[lldb|php] # the debug adapter you want to use
npm run demo ./path/to/file(.c|.cpp|.php)

# For C
npm run build:lldb
npm run demo ./samples/c/hello_world.c

# For C++
npm run build:lldb
npm run demo ./samples/cpp/hello_world.cpp

# For PHP
npm run build:php
npm run demo ./samples/php/hello_world.php
```

## Re-install LLDB (C/C++ debug adapter)

### Method 1 − Copy files from actual extension

1. Install [codelldb](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb) VSCode extension
2. Go to `~/.vscode/extensions/~/.vscode/extensions/vadimcn.vscode-lldb-[version]`
3. Copy folders `adapter`, `formatters` and `lldb` to `./vscode-lldb`

### Method 2 − Build from repo

1. Pull [repo](https://github.com/vadimcn/vscode-lldb) `git clone https://github.com/vadimcn/vscode-lldb`
2. Check out "Building" [documentation](https://github.com/vadimcn/vscode-lldb) (which did not work for me)

## PHP

```bash
git clone https://github.com/xdebug/vscode-php-debug vscode-php-debug
cd vscode-php-debug
rm -rf .git/
npm clean-install # install from package-lock
npm run build # Generates out/ folder

# Test that the server can be launched:
node ./out/phpDebug.js --server=4711
```
