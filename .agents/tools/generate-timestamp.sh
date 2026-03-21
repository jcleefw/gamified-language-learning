#!/usr/bin/env bash
# generate-timestamp.sh: Outputs a timestamp in YYYYMMDDTHHmmssZ format (UTC+10)
# This format is used for changelog entries and template substitution.

TZ="Etc/GMT-10" date +"%Y%m%dT%H%M%SZ"
