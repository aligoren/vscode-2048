# Contributing to VSCode 2048 Extension

Thank you for your interest in contributing to the VSCode 2048 Extension! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- VSCode (latest version)
- Git

### Development Setup
1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/vscode-2048.git
   cd vscode-2048
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Compile the extension:
   ```bash
   npm run compile
   ```
5. Run tests:
   ```bash
   npm test
   ```

### Running the Extension
1. Open the project in VSCode
2. Press `F5` to launch a new Extension Development Host window
3. The extension will be loaded and ready for testing

## 📋 Development Guidelines

### Code Style
- Use TypeScript for all new code
- Follow the existing code style and formatting
- Use ESLint configuration provided in the project
- Add JSDoc comments for public methods and classes

### Testing
- Write tests for new features and bug fixes
- Ensure all existing tests pass
- Aim for high test coverage
- Use the existing test patterns and utilities

### Performance
- Keep performance impact minimal
- Test memory usage and cleanup
- Ensure smooth animations (60fps target)
- Verify startup time impact is negligible

## 🐛 Bug Reports

### Before Submitting
- Check if the issue already exists in [GitHub Issues](https://github.com/aligoren/vscode-2048/issues)
- Try to reproduce the issue with the latest version
- Test in different VSCode themes (Dark, Light, High Contrast)

### Bug Report Template
```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- VSCode Version: [e.g. 1.74.0]
- Extension Version: [e.g. 1.0.0]
- OS: [e.g. Windows 10, macOS 12.0, Ubuntu 20.04]
- Theme: [e.g. Dark+, Light+, High Contrast]

**Additional context**
Any other context about the problem.
```

## 💡 Feature Requests

### Before Submitting
- Check [GitHub Discussions](https://github.com/aligoren/vscode-2048/discussions) for similar ideas
- Consider if the feature fits the extension's scope
- Think about implementation complexity and performance impact

### Feature Request Template
```markdown
**Is your feature request related to a problem?**
A clear description of what the problem is.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Other solutions or features you've considered.

**Additional context**
Any other context, mockups, or examples.
```

## 🔧 Pull Requests

### Before Submitting
- Create an issue first to discuss major changes
- Fork the repository and create a feature branch
- Follow the coding guidelines
- Add tests for new functionality
- Update documentation if needed

### Pull Request Process
1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Add tests and ensure they pass:
   ```bash
   npm test
   ```
4. Update documentation if needed
5. Commit with clear, descriptive messages
6. Push to your fork and create a pull request

### Pull Request Template
```markdown
**Description**
Brief description of changes.

**Type of Change**
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

**Testing**
- [ ] Tests pass locally
- [ ] Added tests for new functionality
- [ ] Tested in different VSCode themes
- [ ] Performance impact verified

**Checklist**
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or clearly documented)
```

## 🧪 Testing Guidelines

### Test Types
- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test component interactions
- **Performance Tests**: Verify memory usage and speed
- **Theme Tests**: Ensure compatibility across themes

### Running Tests
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:performance
npm run test:memory
npm run test:themes
npm run test:startup

# Run tests in watch mode
npm run test:watch
```

### Writing Tests
- Use descriptive test names
- Follow the AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Test both success and error cases
- Include performance assertions where relevant

## 📚 Documentation

### Code Documentation
- Use JSDoc for public APIs
- Include examples in documentation
- Document complex algorithms
- Explain performance considerations

### User Documentation
- Update README.md for user-facing changes
- Update CHANGELOG.md for all changes
- Include screenshots for UI changes
- Provide clear usage examples

## 🏗️ Architecture

### Project Structure
```
src/
├── extension.ts          # Main extension entry point
├── gameController.ts     # Game logic controller
├── gameEngine.ts         # Core game mechanics
├── gameViewProvider.ts   # Webview provider
├── messageTypes.ts       # Type definitions
└── __tests__/           # Test files
```

### Key Components
- **Extension**: Main activation and deactivation logic
- **GameController**: Coordinates between engine and view
- **GameEngine**: Core 2048 game logic
- **GameViewProvider**: Manages webview and UI
- **Message System**: Type-safe communication

## 🎨 Design Principles

### User Experience
- Seamless VSCode integration
- Responsive to theme changes
- Accessible to all users
- Minimal performance impact

### Code Quality
- Type safety with TypeScript
- Comprehensive error handling
- Memory leak prevention
- Modular architecture

### Performance
- Fast startup (< 5ms impact)
- Smooth animations (60fps)
- Low memory usage (< 10MB)
- Efficient cleanup

## 📞 Getting Help

### Communication Channels
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Email**: goren.ali@yandex.com for direct contact

### Resources
- [VSCode Extension API](https://code.visualstudio.com/api)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Testing with Vitest](https://vitest.dev/)

## 🏆 Recognition

Contributors will be recognized in:
- CHANGELOG.md for their contributions
- README.md acknowledgments section
- GitHub contributor statistics

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to make VSCode 2048 Extension better! 🎮✨