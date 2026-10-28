#!/bin/sh
# Reload Nginx every 6 hours so certificates renewed by the certbot container are picked up.
(while :; do sleep 21600; nginx -s reload; done) &
