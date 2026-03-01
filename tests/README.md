# Testing X Context Packager

This directory contains testing infrastructure for X Context Packager. Since this is a Chrome extension that reads live DOM from X.com, testing has two components:

1. **Unit Tests** — Test formatters, utilities, and data processing logic
2. **Manual Tests** — Test the extension in real browsers against live X.com

## Running Tests

### Unit Tests

```bash
# Run all unit tests
npm test

# Run specific test file
npm test -- tests/formatters.test.js

# Run tests in watch mode
npm run test:watch
```

### Manual Testing

Manual testing requires a real browser and X.com access. See `manual-testing.md` for comprehensive test cases.

## Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── formatters.test.js  # Output format tests
│   ├── utils.test.js       # Utility function tests
│   └── data.test.js        # Data processing tests
├── manual-testing.md       # Manual test procedures
├── test-data/              # Mock data for testing
│   └── sample-tweet.json
└── README.md               # This file
```

## Adding Tests

### Unit Tests

Unit tests use Jest and can test pure functions without DOM dependencies.

```javascript
// tests/unit/formatters.test.js
const { formatStructured } = require('../path/to/formatters');

describe('formatStructured', () => {
  test('formats basic tweet data', () => {
    const tweet = { /* mock tweet data */ };
    const result = formatStructured(tweet);
    expect(result).toContain('<x_context>');
    expect(result).toContain('<main_post>');
  });
});
```

### Manual Tests

Add new test cases to `manual-testing.md` following the existing format. Include:
- Test case description
- Steps to reproduce
- Expected vs. actual results
- Browser/OS requirements

## Test Data

Mock data in `test-data/` should represent real X.com structures. Update these when X.com DOM changes.

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Pushes to main branch
- Manual workflow dispatch

See `.github/workflows/test.yml` for CI configuration.