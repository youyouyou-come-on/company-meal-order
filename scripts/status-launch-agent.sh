#!/usr/bin/env bash

set -euo pipefail

LABEL="com.zcgc.company-meal-order"
USER_ID="$(id -u)"

launchctl print "gui/$USER_ID/$LABEL"
