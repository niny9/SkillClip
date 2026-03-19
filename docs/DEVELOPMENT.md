# Development, Debug, and Packaging

## Load The Extension

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the project root:
   `/Users/niny/Documents/GitHub/SkillClip`

## First Run

1. Click the SkillClip extension icon.
2. Click `Open Control Center`.
3. Open one of the supported AI sites:
   - `chatgpt.com`
   - `chat.openai.com`
   - `claude.ai`
   - `gemini.google.com`
   - `chat.deepseek.com`
   - `perplexity.ai`
4. Return to the Control Center and use:
   - `Open Action Bar On Active Tab`
   - `Open Skill Palette On Active Tab`

## What To Test

### Capture

1. Type something in the AI input.
2. Open the action bar.
3. Click `Save Prompt`.
4. Open the workspace and confirm the item appears in Inbox.

### Compile

1. On a supported AI page, open the action bar.
2. Click `Compile to Skill`.
3. Open the workspace.
4. Confirm a draft appears in `Skill Drafts`.
5. Click `Promote to Skill`.

### Reuse

1. Focus an AI input field.
2. Open the palette from the popup or type `/`.
3. Choose a skill.
4. Confirm the prompt is inserted into the input.

### Voice

1. Focus an AI input field.
2. Open the action bar.
3. Click `Voice to Input`.
4. Speak and confirm text appears in the current input.

## Debugging

### Reload after changes

1. Go to `chrome://extensions`.
2. Find `SkillClip`.
3. Click `Reload`.
4. Refresh the AI page you are testing.

### Inspect the service worker

1. Open `chrome://extensions`.
2. Click `Service worker` under SkillClip.
3. Read runtime logs and errors there.

### Inspect the page script

1. Open the supported AI page.
2. Right click and choose `Inspect`.
3. Use the page DevTools console to inspect DOM issues.

### Common failure cases

- If the action bar does not appear, the active tab may not be a supported host.
- If the palette does not insert text, the site input selector may need adapter tuning.
- If voice does not start, Chrome speech recognition support or microphone permission may be unavailable.

## Local Data Tools

The Control Center supports:

- state snapshot refresh
- JSON copy
- JSON download
- demo skill seeding
- local reset

## Packaging For Release

Before packaging:

1. Add final icons to the extension.
2. Finalize the privacy policy and public URLs.
3. Manually test every supported site.

To create a release zip from the project root:

```bash
zip -r skillclip-extension.zip manifest.json src README.md PRIVACY.md docs -x "*.DS_Store"
```

That zip can be used for release review and Chrome Web Store submission packaging.
