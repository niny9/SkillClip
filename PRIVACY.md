# Privacy Policy

Last updated: March 19, 2026

## Summary

SkillClip is designed to be local-first.

The current MVP stores captured prompts, conversation snippets, skill drafts, skills, and variants in the browser using `chrome.storage.local`.

## What Data SkillClip Handles

When you use the extension, SkillClip may process:

- selected prompt text
- nearby AI conversation turns
- source page metadata such as URL, title, and detected model name
- structured skill drafts and saved skills
- your voice transcript when you use the `Voice to Input` feature

## How Data Is Used

This data is used only to provide the extension's core features:

- save AI conversation context
- compile reusable skills
- insert saved skills into supported AI inputs
- transcribe speech into the active AI input

## Storage

In the current build:

- data is stored locally in your browser
- SkillClip does not require an account
- SkillClip does not sync data to a remote server

## Voice Input

The `Voice to Input` feature uses browser-provided speech recognition APIs when available.

Speech recognition behavior may depend on the browser implementation and your browser settings.

## Data Sharing

SkillClip does not sell your data.

The current MVP does not include a backend service for transferring your captured data to SkillClip servers.

## Permissions

SkillClip requests only the permissions needed for its core function:

- `storage` to save local assets
- `activeTab` and `tabs` to communicate with the active supported page
- `sidePanel` to open the workspace panel
- host access to supported AI websites so the extension can detect context and insert skills

## Contact

Before publishing to the Chrome Web Store, replace this section with your public support email and site.
