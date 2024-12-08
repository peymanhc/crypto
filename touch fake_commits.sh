#!/bin/bash

# Define the number of days and commits
DAYS=21
COMMITS_PER_DAY=8

# Array of random text to append to commit messages
RANDOM_TEXTS=("improved logic" "optimized algorithm" "corrected typo" "enhanced performance" "refactored code" "updated documentation" "fixed edge case" "added tests" "removed redundancy" "streamlined process")

# Loop over the number of days
for ((i=0; i<$DAYS; i++)); do
  # Generate a random number of commits for this day
  COMMIT_COUNT=$((RANDOM % COMMITS_PER_DAY + 1))

  # Generate a random date within the past 21 days
  RANDOM_DAY=$((RANDOM % 21))
  COMMIT_DATE=$(date -d "$RANDOM_DAY days ago" +%Y-%m-%d)

  for ((j=0; j<$COMMIT_COUNT; j++)); do
    # Select a random text for the commit message
    RANDOM_INDEX=$((RANDOM % ${#RANDOM_TEXTS[@]}))
    RANDOM_TEXT=${RANDOM_TEXTS[$RANDOM_INDEX]}

    # Create a dummy commit
    echo "$COMMIT_DATE Commit $j" >> dummy.txt
    git add dummy.txt
    GIT_COMMITTER_DATE="$COMMIT_DATE 12:00:00" git commit --date="$COMMIT_DATE 12:00:00" -m ":up: (calculation): fix calculation $RANDOM_TEXT"
  done
done

# Push the commits to the repository
git push origin main  # Change 'main' to your default branch if different
