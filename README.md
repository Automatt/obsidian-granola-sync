# Obsidian Granola Sync

[![Tests](https://github.com/mathew/obsidian-granola-sync/actions/workflows/release.yml/badge.svg)](https://github.com/mathew/obsidian-granola-sync/actions/workflows/release.yml)

This plugin allows you to synchronize your notes from Granola (https://granola.ai) directly into your Obsidian vault. It fetches documents from Granola, converts them from ProseMirror JSON format to Markdown, and saves them as `.md` files.


## Features

- Sync Granola notes to your Obsidian vault
- Support for syncing to daily notes
- Periodic automatic syncing
- Customizable sync settings

## Installation

1. Download the latest release from the releases page
2. Extract the zip file into your Obsidian plugins folder
3. Enable the plugin in Obsidian settings

## Configuration

1. Set the path to your Granola token file in the plugin settings
2. Configure whether to sync to daily notes or a specific folder
3. Set up periodic sync if desired

## Development

### Prerequisites

- Node.js 18 or later
- npm

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Building

To build the plugin:
```bash
npm run build
```

### Testing

The plugin uses Jest for testing. To run the tests:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Testing Strategy

The plugin uses a combination of unit and integration tests:

1. Unit Tests:
   - Test individual service classes in isolation
   - Mock external dependencies
   - Focus on business logic

2. Integration Tests:
   - Test interactions between components
   - Test file system operations
   - Test API integration

### Adding New Tests

1. Create a new test file in the appropriate test directory
2. Follow the existing test patterns
3. Use Jest's mocking capabilities for external dependencies
4. Run tests to ensure they pass

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT
