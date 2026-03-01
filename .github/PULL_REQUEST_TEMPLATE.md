## Description

Brief description of the changes made in this PR.

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 🎨 UI/UX improvement (changes to user interface or experience)
- [ ] 🔧 Maintenance (code refactoring, documentation updates, etc.)
- [ ] 🧪 Testing (adding or updating tests)
- [ ] 📚 Documentation (README, guides, etc.)

## Changes Made

### Files Changed
- `file1.js` - Description of changes
- `file2.css` - Description of changes

### Key Changes
- Change 1: What and why
- Change 2: What and why

## Testing

### Manual Testing Completed
- [ ] Tested on post pages with replies
- [ ] Tested on profile pages
- [ ] Tested on long threads (50+ replies)
- [ ] Verified all output formats work
- [ ] Checked settings persistence

### Test URLs Used
- Post page: `https://x.com/...`
- Profile page: `https://x.com/...`

### Automated Tests
- [ ] Unit tests pass (`npm test`)
- [ ] Validation passes (`npm run validate`)
- [ ] Linting passes (`npm run lint`)

## Design Philosophy Compliance

This change:
- [ ] Follows the [Four Beats](DESIGN_PHILOSOPHY.md#the-four-beats) — doesn't interrupt core flow
- [ ] Defaults to invisible — power features behind gear icon
- [ ] Serves the love test — wouldn't freeze a neurodivergent person at 1am
- [ ] Maintains zero dependencies

## Breaking Changes

Does this PR introduce any breaking changes?
- [ ] No breaking changes
- [ ] Breaking change: Description of what breaks and migration path

## Screenshots (if UI changes)

<!-- Add screenshots showing before/after for UI changes -->

## Additional Notes

Any additional context, considerations, or follow-up work needed.

---

**Checklist:**
- [ ] Code follows project style guidelines
- [ ] Commit messages are clear and descriptive
- [ ] Documentation updated if needed
- [ ] CHANGELOG.md updated
- [ ] No hardcoded selectors outside SELECTORS object
- [ ] Defensive programming (try/catch around DOM queries)
- [ ] Null values for missing data (never fabricate)