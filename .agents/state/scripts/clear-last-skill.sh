#!/bin/bash
# Clear the last-skill tracking state (invoking tdd-implement)
echo "tdd-implement" > "$(dirname "$0")/../last-skill.txt"
echo "✅ State cleared. Implementation edits now allowed."
