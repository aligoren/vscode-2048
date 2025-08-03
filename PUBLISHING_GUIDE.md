# VSCode 2048 Extension Publishing Guide

## 1. Publishing to Visual Studio Code Marketplace

### Preparation

#### A. Install Required Tools
```bash
# Install vsce (Visual Studio Code Extension) tool
npm install -g vsce
```

#### B. Update Package.json
- `publisher`: Write your own publisher name
- `repository`: Add your GitHub repo URL
- `homepage`: Add your homepage URL
- `bugs`: Add your issue tracker URL
- `license`: Specify license type
- `icon`: Add 128x128 px icon file

#### C. Create README.md File
```bash
# Create README file
touch README.md
```

#### D. Add LICENSE File
```bash
# For MIT license
touch LICENSE
```

### Publishing Steps

#### 1. Create Microsoft Publisher Account
1. Go to [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage)
2. Sign in with your Microsoft account
3. Click "Create publisher" button
4. Create your Publisher ID (which you'll write in package.json publisher field)

#### 2. Create Personal Access Token (PAT)
1. Go to [Azure DevOps](https://dev.azure.com)
2. User Settings > Personal Access Tokens
3. Create "New Token"
4. Scopes: Select "Marketplace (manage)"
5. Save the token securely

#### 3. Compile and Test Extension
```bash
# Compile the code
npm run compile

# Run tests
npm test

# Package extension (for testing)
vsce package
```

#### 4. Publish Extension
```bash
# First time publishing
vsce publish

# Or with token
vsce publish -p YOUR_PERSONAL_ACCESS_TOKEN

# With specific version
vsce publish 1.0.1
```

## 2. Share on GitHub (Alternative)

### Create VSIX File
```bash
# Package extension as .vsix file
vsce package

# This will give you vscode-2048-extension-1.0.0.vsix file
```

### Create GitHub Release
1. Go to "Releases" tab in your GitHub repo
2. Click "Create a new release"
3. Tag version: v1.0.0
4. Release title: "2048 Game Extension v1.0.0"
5. Add .vsix file as assets
6. Write release notes

### Manual Installation Instructions
Users can install like this:
1. Download .vsix file
2. In VSCode Ctrl+Shift+P
3. Run "Extensions: Install from VSIX..." command
4. Select .vsix file

## 3. Private Marketplace (Enterprise)

### Azure DevOps Extensions
1. In your Azure DevOps organization
2. Extensions > Browse Marketplace
3. Upload with "Upload new extension"

## Pre-Publication Checklist

### ✅ Required Files
- [ ] README.md (usage instructions, features)
- [ ] LICENSE (MIT, Apache, etc.)
- [ ] CHANGELOG.md (version history)
- [ ] icon.png (128x128 px)
- [ ] .vscodeignore (exclude unnecessary files)

### ✅ Package.json Checks
- [ ] name: unique and descriptive
- [ ] displayName: user-friendly name
- [ ] description: clear description
- [ ] version: semantic versioning
- [ ] publisher: correct publisher ID
- [ ] categories: appropriate category
- [ ] keywords: for search
- [ ] engines.vscode: minimum VSCode version
- [ ] repository, homepage, bugs URLs

### ✅ Code Quality
- [ ] All tests passing
- [ ] No ESLint errors
- [ ] No TypeScript compilation errors
- [ ] Performance tests passing

### ✅ User Experience
- [ ] Extension works in different VSCode themes
- [ ] Error conditions properly handled
- [ ] No memory leaks
- [ ] Fast startup

## Versioning Strategy

### Semantic Versioning (SemVer)
- **MAJOR.MINOR.PATCH** (e.g.: 1.2.3)
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

### Version Updates
```bash
# Patch version (1.0.0 -> 1.0.1)
vsce publish patch

# Minor version (1.0.0 -> 1.1.0)
vsce publish minor

# Major version (1.0.0 -> 2.0.0)
vsce publish major
```

## Post-Publication

### Monitoring
- Download counts in Marketplace
- User reviews and ratings
- GitHub issues

### Update Process
1. Develop bug fixes and new features
2. Update tests
3. Update CHANGELOG.md
4. Increment version number
5. Republish

## Useful Commands

```bash
# Show extension information
vsce show your-publisher.extension-name

# Remove extension from marketplace
vsce unpublish your-publisher.extension-name

# Remove specific version
vsce unpublish your-publisher.extension-name@1.0.0

# Extension statistics
vsce ls-publishers
```

## Troubleshooting

### Common Errors
1. **Publisher not found**: Make sure you wrote Publisher ID correctly
2. **Invalid token**: Check that PAT has correct scopes
3. **Package validation failed**: Check required fields in package.json
4. **Icon not found**: Check that icon.png file is in root directory

### Debug
```bash
# Publish with verbose output
vsce publish --verbose

# Test package
vsce package --verbose
```