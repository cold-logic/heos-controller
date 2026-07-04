---
name: jujutsu-lfs
description: >-
  Troubleshooting and workflow guidelines for using Jujutsu (jj) in repositories
  that use Git LFS. Activate this skill when encountering LFS pointer issues,
  accidental raw binary check-ins, or when pushing changes in projects that use Git LFS.
---

# Jujutsu (jj) & Git LFS Workflow Guide

This skill provides the required procedures, troubleshooting steps, and dual-tool workflows to successfully use Jujutsu (`jj`) in repositories that use Git LFS without corrupting the LFS repository state.

---

## 1. Understanding the Conflict

Jujutsu (`jj`) is Git-compatible but **does not natively support Git LFS**. It lacks the internal representations and clean/smudge filters required to parse, download, or track Git LFS pointer files natively. 

* **The Problem:** When `jj` snapshots the working copy, it reads the smudged (actual binary) files and commits them directly as raw binary blobs into Git history instead of committing the LFS text pointer files.
* **The Result:** The Git LFS database is bypassed, and pushing the commit will commit the raw binaries to Git, causing LFS integrity check failures (`git lfs fsck` errors).

---

## 2. The Dual-Tool Workflow (Colocated Git & jj)

To use `jj` in an LFS-tracked repository, you must use a colocated workspace where both `.jj` and `.git` exist. Use the following rules:

### A. Fetching and Pulling (Ingestion)
Always use native Git to update branches and pull down LFS binary files.
```bash
git fetch
git lfs pull
```
Once Git has replaced LFS pointer files with actual assets in your working directory, run the Jujutsu import:
```bash
jj git import
```
This ensures `jj`'s internal view syncs with the updated Git HEAD.

### B. Committing and Pushing (Exporting)
**Never use `jj git push` to push to the remote.** Since `jj` bypasses Git hooks, LFS binaries will not be uploaded to the LFS server. Instead, export the Jujutsu bookmarks and use Git to push:

```bash
# 1. Move your bookmark to your current revision
jj bookmark set main -r @

# 2. Export jujutsu bookmarks to git branches
jj bookmark export

# 3. Push using standard Git so LFS hooks trigger normally
git push origin main
```

---

## 3. Troubleshooting & Fixing LFS Corruption

If Jujutsu has accidentally committed raw binary files instead of LFS pointer files:

### Step 1: Switch to Git
Switch your shell context/HEAD to the actual branch:
```bash
git checkout main
```
*Note: If Git aborts due to local changes (because it compares the working copy binaries with the bad commit's raw binaries), force checkout:*
```bash
git checkout -f main
```

### Step 2: Renormalize Staged Files
Force Git to run the LFS clean filter on all files to turn them back into pointers:
```bash
git add --renormalize .
```
This stages all the incorrectly committed binary files as modified, resetting them to LFS pointers in the Git index.

### Step 3: Commit and Push
Create a commit with standard Git and push:
```bash
git commit -m "chore: renormalize LFS files to convert raw binaries to LFS pointers"
git push origin main
```

### Step 4: Verify LFS Integrity
Run the LFS integrity checker:
```bash
git lfs fsck
```
It should report: `Git LFS fsck OK`.

### Step 5: Resync Jujutsu
Bring the fixed Git history back into Jujutsu:
```bash
jj git import
jj new
```
