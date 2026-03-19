# Chrome Web Store Readiness

## Current Status

SkillClip is now closer to a reviewable Chrome extension, but it is not yet fully submission-ready.

## What Is Ready

- Manifest V3 extension structure
- single clear purpose: capture AI chat context and compile reusable skills
- local-first storage using extension APIs
- side panel workspace
- explicit user-triggered capture actions
- no remote code loading
- no account requirement
- privacy policy draft in the repository

## What Still Needs To Be Done Before Submission

- add final extension icons in required Chrome sizes
- create a public HTTPS homepage and privacy policy URL
- record a store listing description, screenshots, and promo assets
- manually test each supported platform in Chrome
- verify voice input behavior across supported Chrome versions
- tighten any host permissions if specific domains or paths can be reduced further
- replace placeholder support/contact details

## Review Notes

The extension purpose should be described consistently as:

`Capture AI chats, compile reusable skills, and reuse them across supported AI tools.`

Do not position it as a generic recorder or data scraper.

## Privacy Disclosure Guidance

Because SkillClip handles prompts, conversation text, and optional voice transcripts, the store listing should clearly disclose:

- what is captured
- when capture happens
- that data is stored locally in the MVP
- whether any future sync features are optional

## Permission Rationale

- `storage`: required for local-first assets
- `activeTab` and `tabs`: required to trigger action bar and palette in the current tab
- `sidePanel`: required for Inbox and skill workspace
- site access: required only on supported AI chat domains

## Suggested Submission Checklist

1. Verify action bar and skill palette work on each supported site.
2. Verify drafts promote correctly and variants are created correctly.
3. Verify archived items disappear from active views.
4. Verify voice input only runs after explicit user action.
5. Add icons and store screenshots.
6. Publish a public privacy policy page.
7. Perform a final permissions review.
