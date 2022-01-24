PHP
===

Installer PHP avec XDebug
-------------------------

- Installer PHP
- Installer XDebug

Dans php.ini :

    zend_extension=xdebug
    xdebug.client_port = 9003


Lancer le serveur DAP pour PHP
------------------------------

Récupérer l'extension vscode PHP : https://github.com/xdebug/vscode-php-debug

Build le projet :

    yarn install
    yarn build

Lancer le serveur DAP en standalone :

    cd out
    node phpDebug.js --server=4711


Lancer le prototype du server d'exécution
-----------------------------------------

Récupérer le script d'interfaçage de test avec le serveur DAP (qui deviendra le "serveur d'exécution") :
https://gitlab.com/arkandias33/dap-test

Build et lancer le script :

    yarn install
    node index.js
