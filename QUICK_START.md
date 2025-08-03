# 🚀 Quick Start - Publishing VSCode 2048 Extension

## 1. Publish Immediately (5 Minutes)

### Install Required Tools
```bash
# Install vsce tool globally
npm install -g @vscode/vsce

# Install project dependencies
npm install
```

### Customize Package.json
```bash
# Change these fields:
# - "publisher": "your-publisher-name" -> your own name
# - Replace repository URLs with your GitHub repo
# - Change email address
```

### Test the Extension
```bash
# Compile the code
npm run compile

# Run tests
npm test

# Package the extension
npm run package
```

### Publish
```bash
# Publish to Marketplace (PAT token required)
npm run publish

# Or just create .vsix file
npm run package
```

## 2. Publishing to Marketplace (Detailed)

### A. Microsoft Publisher Account
1. [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage) → "Create publisher"
2. Write your Publisher ID to package.json

### B. Personal Access Token (PAT)
1. [Azure DevOps](https://dev.azure.com) → User Settings → Personal Access Tokens
2. "New Token" → Scopes: "Marketplace (manage)"
3. Save the token

### C. Publishing
```bash
# Publish with token
vsce publish -p YOUR_PERSONAL_ACCESS_TOKEN

# Or save token and publish
vsce login YOUR_PUBLISHER_NAME
vsce publish
```

## 3. Share on GitHub (Alternative)

### Create .vsix File
```bash
npm run package
# Creates vscode-2048-extension-1.0.0.vsix file
```

### Create GitHub Release
1. In your GitHub repo "Releases" → "Create a new release"
2. Tag: v1.0.0
3. Add .vsix file
4. Write release notes

### How Users Install?
1. They download the .vsix file
2. In VSCode Ctrl+Shift+P → "Extensions: Install from VSIX..."
3. Select the file

## 4. Important Files

### ✅ Must Have
- `README.md` ✅ (ready)
- `LICENSE` ✅ (ready)
- `CHANGELOG.md` ✅ (ready)
- `icon.png` (128x128 px) - create with `python create_icon.py`
- `.vscodeignore` ✅ (ready)

### 📝 Need to Update
- `package.json` → publisher, repository URLs
- `README.md` → GitHub URLs, email
- `LICENSE` → name and year

## 5. Quick Commands

```bash
# Development
npm run compile          # Compile TypeScript
npm run watch           # Auto compilation
npm test               # Run tests

# Publishing
npm run package        # Create .vsix
npm run publish        # Publish to Marketplace
npm run publish:patch  # Patch version (1.0.0 → 1.0.1)
npm run publish:minor  # Minor version (1.0.0 → 1.1.0)
npm run publish:major  # Major version (1.0.0 → 2.0.0)

# Testing
npm run test:performance  # Performance tests
npm run test:memory      # Memory tests
npm run test:themes      # Theme tests
```

## 6. Troubleshooting

### "Publisher not found"
- Check publisher name in package.json
- Make sure you created publisher account in Marketplace

### "Invalid token"
- Check that PAT token has "Marketplace (manage)" scope
- Check that token hasn't expired

### "Package validation failed"
- Check for compilation errors with `npm run compile`
- Check required fields in package.json

## 7. After First Publication

### Making Updates
```bash
# Make code changes
# Run tests
npm test

# Update CHANGELOG.md
# Increment version and publish
npm run publish:patch
```

### Track Statistics
- [Marketplace Publisher Dashboard](https://marketplace.visualstudio.com/manage)
- Download counts, ratings, reviews

---

## 🎯 Summary Checklist

- [ ] `npm install -g @vscode/vsce`
- [ ] package.json → change publisher name
- [ ] Update GitHub repo URLs
- [ ] `python create_icon.py` (create icon)
- [ ] `npm run compile && npm test`
- [ ] Create publisher account in Marketplace
- [ ] Create PAT token
- [ ] `npm run publish` or `npm run package`

**Ready to publish in 5 minutes! 🚀**