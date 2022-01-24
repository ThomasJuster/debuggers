FROM node:16.13.2 as node
FROM php:7.4-cli

COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=node /usr/local/bin/node /usr/local/bin/node
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

ENV PHP_INI="$PHP_INI_DIR/php.ini"
RUN php -v
RUN mv "$PHP_INI_DIR/php.ini-production" $PHP_INI
RUN pecl install xdebug-3.1.2 && docker-php-ext-enable xdebug
RUN pear
# RUN echo "zend_extension=/usr/local/lib/php/extensions/no-debug-non-zts-20190902/xdebug.so" >> $PHP_INI
# RUN echo "extension=xdebug.so" >> $PHP_INI
# RUN cat $PHP_INI

ENV SERVER_PORT=4711
ENV ROOT=/usr/php-debug
WORKDIR ${ROOT}
RUN mkdir ${ROOT}/programs

# Debug server
COPY ./vscode-php-debug/out $ROOT/vscode-php-debug/out
COPY ./vscode-php-debug/node_modules $ROOT/vscode-php-debug/node_modules
COPY ./vscode-php-debug/package.json $ROOT/vscode-php-debug/package.json

# Script
COPY ./node_modules $ROOT/node_modules
COPY ./out $ROOT/src
# COPY ./src $ROOT/src
COPY ./package.json $ROOT/

EXPOSE ${SERVER_PORT}
ENTRYPOINT ["node", "./src/script.js"]
CMD [""]