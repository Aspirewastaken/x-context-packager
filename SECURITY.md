# Security Policy

## Supported Versions

We take security seriously. X Context Packager is actively supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in X Context Packager, please help us by reporting it responsibly.

### How to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by emailing us at: [security@adlabusa.com](mailto:security@adlabusa.com)

### What to Include

When reporting a vulnerability, please include:

- A clear description of the vulnerability
- Steps to reproduce the issue
- Potential impact and severity
- Any suggested fixes or mitigations (optional)

### Our Response Process

1. **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
2. **Investigation**: We will investigate the issue and determine its validity and severity
3. **Updates**: We will keep you informed about our progress every 7 days
4. **Resolution**: We will work to resolve valid vulnerabilities within a reasonable timeframe
5. **Disclosure**: Once fixed, we will coordinate disclosure with you

### Responsible Disclosure

We kindly ask that you:

- Give us reasonable time to fix the issue before public disclosure
- Avoid accessing or modifying user data
- Don't perform DoS attacks or degrade the service
- Don't spam our systems with automated tests

### Recognition

We appreciate security researchers who help keep our users safe. With your permission, we will acknowledge your contribution in our security advisory.

## Security Considerations

### Extension Architecture

X Context Packager is designed with security in mind:

- **No network requests**: The extension reads DOM data only, makes zero HTTP requests
- **No external dependencies**: Pure vanilla JavaScript, no third-party libraries
- **Local execution**: All processing happens in the user's browser
- **Clipboard access**: Limited to user's explicit action (copying extracted content)
- **Storage access**: Only stores user preferences locally

### Permissions

The extension requests minimal Chrome permissions:

- `activeTab`: Access current tab for DOM reading
- `scripting`: Inject content script for extraction
- `clipboardWrite`: Copy structured output to clipboard
- `storage`: Save user format preferences

### Data Handling

- **No data collection**: Zero telemetry or analytics
- **No data transmission**: Extension never sends data to external servers
- **User control**: All extracted content stays in user's browser until explicitly copied

## Known Security Considerations

### X.com DOM Changes

X.com frequently updates their DOM structure. While we monitor for changes, there may be brief periods where selectors don't match the current DOM. This affects functionality but not security.

### Content Extraction

The extension extracts publicly visible content from X.com. Users should be aware that:

- Extracted content may include links to external websites
- Some content may be behind X.com's content warnings
- The extension respects X.com's robots.txt and terms of service

### Browser Compatibility

Currently tested on Chrome. Firefox Manifest V3 support is limited, and the extension may not function properly there.

## Contact

For security-related questions or concerns:
- Email: [security@adlabusa.com](mailto:security@adlabusa.com)
- General inquiries: [adlabusa.com/contact](https://adlabusa.com/contact)

Thank you for helping keep X Context Packager secure! 🔒