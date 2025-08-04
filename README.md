# 2048 Game for VSCode

🎮 Classic 2048 tile-sliding puzzle game directly in your VSCode editor!

2028 on Visual Studio Marketplace: https://marketplace.visualstudio.com/items?itemName=AliGOREN.vscode-2048

![2048 Game Screenshot](/images/screenshot.png)

## Features

✨ **Complete 2048 Experience**
- Classic 2048 gameplay with smooth animations
- Score tracking and game state persistence
- Win/lose detection with visual feedback
- Keyboard controls (Arrow keys or WASD)
- 🎯 **Social Media Sharing**: Share your scores on Twitter/X or copy to clipboard

🎨 **VSCode Integration**
- Seamless integration with VSCode themes (Dark, Light, High Contrast)
- Responsive design that adapts to your editor
- Activity bar integration for easy access
- Minimal performance impact on VSCode

🚀 **Performance Optimized**
- Hardware-accelerated animations
- Efficient memory usage
- Fast startup time
- Proper cleanup on extension deactivation

♿ **Accessibility**
- Screen reader support
- High contrast theme compatibility
- Keyboard navigation
- ARIA labels for game elements

## Installation

### From VSCode Marketplace
1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "2048 Game"
4. Click Install

### Manual Installation
1. Download the latest `.vsix` file from [Releases](https://github.com/aligoren/vscode-2048/releases)
2. Open VSCode
3. Press Ctrl+Shift+P
4. Type "Extensions: Install from VSIX..."
5. Select the downloaded `.vsix` file

## Usage

### Starting the Game
1. Click the 2048 Game icon in the Activity Bar (left sidebar)
2. The game panel will open in the sidebar
3. Start playing immediately with arrow keys!

### Controls
- **Arrow Keys** or **WASD**: Move tiles
- **R** or **Space**: Start new game
- **Command Palette**: `2048: New Game`

### Game Rules
- Use arrow keys to move tiles
- When two tiles with the same number touch, they merge into one
- Try to create a tile with the number 2048 to win
- Game ends when you can't make any more moves

## Screenshots

### Dark Theme
![Dark Theme](/images/screenshot_dark.png)

### Light Theme  
![Light Theme](/images/screenshot.png)

### High Contrast
![High Contrast](/images/screenshot_high_constract.png)

## Configuration

The extension automatically adapts to your VSCode theme and settings. No additional configuration required!

## Performance

- **Startup Impact**: < 5ms
- **Memory Usage**: < 10MB during gameplay
- **Rendering**: 60fps smooth animations
- **Theme Switching**: Instant adaptation

## Compatibility

- **VSCode Version**: 1.74.0 or higher
- **Platforms**: Windows, macOS, Linux
- **Themes**: All VSCode themes supported
- **Languages**: Universal (no text dependencies)

## Development

### Building from Source
```bash
# Clone the repository
git clone https://github.com/aligoren/vscode-2048.git
cd vscode-2048

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run tests
npm test

# Package extension
npm run package
```

### Testing
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:performance
npm run test:memory
npm run test:themes
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Ensure all tests pass
6. Submit a pull request

## Changelog

### [1.0.0] - 2025-01-03
- Initial release
- Complete 2048 game implementation
- VSCode theme integration
- Performance optimizations
- Accessibility features
- Comprehensive test coverage

See [CHANGELOG.md](CHANGELOG.md) for full version history.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Original 2048 game by [Gabriele Cirulli](https://github.com/gabrielecirulli/2048)
- VSCode Extension API documentation
- Community feedback and contributions

## Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/aligoren/vscode-2048/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/aligoren/vscode-2048/discussions)
- 📧 **Contact**: goren.ali@yandex.com

## Stats

![GitHub stars](https://img.shields.io/github/stars/aligoren/vscode-2048)
![GitHub downloads](https://img.shields.io/visual-studio-marketplace/d/aligoren.vscode-2048)
![GitHub issues](https://img.shields.io/github/issues/aligoren/vscode-2048)
![GitHub license](https://img.shields.io/github/license/aligoren/vscode-2048)

---

**Enjoy playing 2048 while coding! 🎮✨**