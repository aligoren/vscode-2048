# Changelog

All notable changes to the "2048 Game" extension will be documented in this file.

## [1.0.5] - 2025-01-08

### Added
- 🎯 **Social Media Sharing Feature**: Share your 2048 scores on Twitter/X and copy to clipboard
- 📱 **Smart Share Button**: Disabled until game starts, prevents accidental sharing
- 🐦 **Twitter Integration**: Multi-line prefilled tweets with score, highest tile, and marketplace link
- 📋 **Clipboard Support**: Copy formatted score details for manual sharing
- 🎮 **Enhanced User Experience**: VSCode QuickPick menu for platform selection

### Technical
- Added secure browser opening from webview to prevent VSCode crashes
- Implemented message validation for share functionality
- Added comprehensive error handling for share operations
- Optimized share text formatting with proper line breaks and emojis

### Fixed
- Resolved VSCode crash issues when opening external URLs
- Fixed share button state management
- Improved message passing between webview and extension host

## [1.0.0] - 2025-01-03

### Added
- 🎮 Complete 2048 game implementation with classic gameplay
- 🎨 Full VSCode theme integration (Dark, Light, High Contrast themes)
- ⌨️ Keyboard controls (Arrow keys, WASD, R for new game)
- 💾 Automatic game state persistence and restoration
- 🏆 Score tracking with smooth animations
- 🎯 Win/lose detection with visual feedback
- 📱 Responsive design that adapts to VSCode layout
- ♿ Accessibility features with ARIA labels and screen reader support
- 🚀 Performance optimizations (< 5ms startup, < 10MB memory, 60fps animations)
- 📊 Activity bar integration with game icon
- 🎛️ Command palette integration
- 🔄 Automatic theme switching support
- 🛡️ Robust error handling and recovery

### Technical
- TypeScript implementation with full type safety
- Modular architecture with separation of concerns
- Message-based communication between extension and webview
- Efficient DOM manipulation with batched updates
- Memory leak prevention with proper disposal patterns
- Comprehensive test coverage (performance, memory, themes)

---

## 📝 How to Update Changelog

When making changes, add them to a new version section:

```markdown
## [1.0.1] - 2025-01-XX
### Fixed
- Bug fix description

### Added
- New feature description

### Changed
- Changed feature description
```

Example workflow:
```bash
# 1. Make changes to code
# 2. Update CHANGELOG.md with new version
# 3. Publish with version bump
npm run publish:patch  # 1.0.0 → 1.0.1
```

## Support

For support, bug reports, or feature requests:
- 🐛 [GitHub Issues](https://github.com/aligoren/vscode-2048/issues)
- 💬 [GitHub Discussions](https://github.com/aligoren/vscode-2048/discussions)
- 📧 Email: goren.ali@yandex.com